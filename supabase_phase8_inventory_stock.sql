begin;

alter table public.inventory_movements
  add column if not exists unit_cost_tzs numeric(14,2)
  check (unit_cost_tzs is null or unit_cost_tzs >= 0);

create or replace view public.current_stock_summary
with (security_invoker = true)
as
with movement_lines as (
  select
    m.product_id,
    m.to_branch_id as branch_id,
    case
      when p.category <> 'Phones' and m.to_branch_id is not null and m.movement_type in ('stock_in', 'transfer', 'return') then abs(m.quantity)
      when p.category <> 'Phones' and m.to_branch_id is not null and m.movement_type = 'audit' then m.quantity
      else 0
    end::numeric as qty_delta,
    case
      when p.category <> 'Phones' and m.to_branch_id is not null and m.movement_type in ('stock_in', 'transfer', 'return') then abs(m.quantity) * coalesce(m.unit_cost_tzs, 0)
      when p.category <> 'Phones' and m.to_branch_id is not null and m.movement_type = 'audit' then m.quantity * coalesce(m.unit_cost_tzs, 0)
      else 0
    end::numeric as value_delta,
    0::numeric as sold_delta
  from public.inventory_movements m
  join public.products p on p.id = m.product_id
  where m.to_branch_id is not null

  union all

  select
    m.product_id,
    m.from_branch_id as branch_id,
    case
      when p.category <> 'Phones' and m.from_branch_id is not null and m.movement_type in ('stock_out', 'sale', 'transfer') then -abs(m.quantity)
      else 0
    end::numeric as qty_delta,
    case
      when p.category <> 'Phones' and m.from_branch_id is not null and m.movement_type in ('stock_out', 'sale', 'transfer') then -abs(m.quantity) * coalesce(m.unit_cost_tzs, 0)
      else 0
    end::numeric as value_delta,
    case
      when p.category <> 'Phones' and m.from_branch_id is not null and m.movement_type = 'sale' then abs(m.quantity)
      else 0
    end::numeric as sold_delta
  from public.inventory_movements m
  join public.products p on p.id = m.product_id
  where m.from_branch_id is not null
),
movement_stock as (
  select
    product_id,
    branch_id,
    greatest(coalesce(sum(qty_delta), 0), 0)::integer as in_stock,
    coalesce(sum(value_delta), 0)::numeric(14,2) as stock_value_tzs,
    coalesce(sum(sold_delta), 0)::integer as sold
  from movement_lines
  where branch_id is not null
  group by product_id, branch_id
),
imei_stock as (
  select
    d.product_id,
    d.branch_id,
    count(d.id) filter (where d.status = 'In Stock')::integer as in_stock,
    count(d.id) filter (where d.status = 'Reserved')::integer as reserved,
    count(d.id) filter (where d.status = 'Sold')::integer as sold,
    coalesce(sum(d.purchase_price_tzs) filter (where d.status = 'In Stock'), 0)::numeric(14,2) as stock_value_tzs
  from public.imei_devices d
  group by d.product_id, d.branch_id
)
select
  p.id as product_id,
  p.name as product_name,
  p.brand,
  p.model,
  p.category,
  b.id as branch_id,
  b.name as branch_name,
  case when p.category = 'Phones' then coalesce(i.in_stock, 0) else coalesce(m.in_stock, 0) end as in_stock,
  case when p.category = 'Phones' then coalesce(i.reserved, 0) else 0 end as reserved,
  case when p.category = 'Phones' then coalesce(i.sold, 0) else coalesce(m.sold, 0) end as sold,
  case when p.category = 'Phones' then coalesce(i.stock_value_tzs, 0) else coalesce(m.stock_value_tzs, 0) end::numeric(14,2) as stock_value_tzs,
  p.low_stock_threshold,
  (case when p.category = 'Phones' then coalesce(i.in_stock, 0) else coalesce(m.in_stock, 0) end <= p.low_stock_threshold) as is_low_stock
from public.products p
cross join public.branches b
left join imei_stock i on i.product_id = p.id and i.branch_id = b.id
left join movement_stock m on m.product_id = p.id and m.branch_id = b.id
where p.is_active = true
group by p.id, p.name, p.brand, p.model, p.category, b.id, b.name, p.low_stock_threshold,
  i.in_stock, i.reserved, i.sold, i.stock_value_tzs, m.in_stock, m.sold, m.stock_value_tzs;

create or replace function app_private.create_pos_sale_impl(
  p_branch_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_discount_tzs numeric default 0,
  p_tax_tzs numeric default 0,
  p_due_date date default null
)
returns table (
  sale_id uuid,
  invoice_number text,
  receipt_number text,
  total_tzs numeric,
  paid_tzs numeric,
  balance_tzs numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean := app_private.is_admin();
  v_branch uuid := app_private.current_user_branch_id();
  v_sale_id uuid;
  v_invoice text;
  v_receipt text;
  v_subtotal numeric := 0;
  v_paid numeric := 0;
  v_total numeric := 0;
  v_balance numeric := 0;
  v_item jsonb;
  v_payment jsonb;
  v_product_id uuid;
  v_imei_device_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_payment_amount numeric;
  v_status public.imei_status;
  v_product_category public.product_category;
  v_available_stock integer;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_admin and p_branch_id <> v_branch then
    raise exception 'Sales person can only sell from assigned branch';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale requires at least one item';
  end if;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'Payments must be an array';
  end if;

  lock table public.inventory_movements in share row exclusive mode;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_imei_device_id := nullif(v_item ->> 'imei_device_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 1);
    v_unit_price := (v_item ->> 'unit_price_tzs')::numeric;

    if v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Invalid sale item quantity or price';
    end if;

    select category into v_product_category
    from public.products
    where id = v_product_id and is_active = true;

    if not found then
      raise exception 'Product not found or inactive';
    end if;

    if v_imei_device_id is not null then
      select status into v_status
      from public.imei_devices
      where id = v_imei_device_id
        and product_id = v_product_id
        and branch_id = p_branch_id
      for update;

      if not found then
        raise exception 'IMEI device not found in selected branch';
      end if;

      if v_status <> 'In Stock' then
        raise exception 'IMEI device is not available for sale';
      end if;
    elsif v_product_category = 'Phones' then
      raise exception 'Phone sales must select an IMEI device';
    end if;

    v_subtotal := v_subtotal + (v_quantity * v_unit_price);
  end loop;

  for v_product_id, v_quantity in
    select
      (item ->> 'product_id')::uuid as product_id,
      sum(coalesce((item ->> 'quantity')::integer, 1))::integer as quantity
    from jsonb_array_elements(p_items) as item
    where nullif(item ->> 'imei_device_id', '') is null
    group by (item ->> 'product_id')::uuid
  loop
    select p.category into v_product_category
    from public.products p
    where p.id = v_product_id;

    if v_product_category <> 'Phones' then
      select coalesce(sum(delta), 0)::integer into v_available_stock
      from (
        select
          case
            when m.to_branch_id = p_branch_id and m.movement_type in ('stock_in', 'transfer', 'return') then abs(m.quantity)
            when m.to_branch_id = p_branch_id and m.movement_type = 'audit' then m.quantity
            when m.from_branch_id = p_branch_id and m.movement_type in ('stock_out', 'sale', 'transfer') then -abs(m.quantity)
            else 0
          end as delta
        from public.inventory_movements m
        where m.product_id = v_product_id
          and m.imei_device_id is null
      ) stock;

      if v_available_stock < v_quantity then
        raise exception 'Insufficient stock for product %. Available %, requested %', v_product_id, v_available_stock, v_quantity;
      end if;
    end if;
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments)
  loop
    v_payment_amount := coalesce((v_payment ->> 'amount_tzs')::numeric, 0);
    if v_payment_amount < 0 then
      raise exception 'Payment amount cannot be negative';
    end if;
    v_paid := v_paid + v_payment_amount;
  end loop;

  v_total := v_subtotal - coalesce(p_discount_tzs, 0) + coalesce(p_tax_tzs, 0);
  v_balance := v_total - v_paid;

  if v_total < 0 then
    raise exception 'Sale total cannot be negative';
  end if;

  if v_paid > v_total then
    raise exception 'Payment cannot exceed sale total';
  end if;

  if v_balance > 0 and p_customer_id is null then
    raise exception 'Credit sale requires a customer';
  end if;

  v_invoice := app_private.next_invoice_number();
  v_receipt := app_private.next_receipt_number();

  insert into public.sales (
    invoice_number,
    receipt_number,
    branch_id,
    customer_id,
    sold_by,
    subtotal_tzs,
    discount_tzs,
    tax_tzs,
    paid_tzs,
    status
  )
  values (
    v_invoice,
    v_receipt,
    p_branch_id,
    p_customer_id,
    v_actor,
    v_subtotal,
    coalesce(p_discount_tzs, 0),
    coalesce(p_tax_tzs, 0),
    v_paid,
    'completed'
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_imei_device_id := nullif(v_item ->> 'imei_device_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 1);
    v_unit_price := (v_item ->> 'unit_price_tzs')::numeric;
    v_unit_cost := null;

    if v_imei_device_id is null then
      select nullif(sum(value_delta), 0) / nullif(sum(qty_delta), 0)
      into v_unit_cost
      from (
        select
          case
            when m.to_branch_id = p_branch_id and m.movement_type in ('stock_in', 'transfer', 'return') then abs(m.quantity)
            when m.to_branch_id = p_branch_id and m.movement_type = 'audit' then m.quantity
            when m.from_branch_id = p_branch_id and m.movement_type in ('stock_out', 'sale', 'transfer') then -abs(m.quantity)
            else 0
          end::numeric as qty_delta,
          case
            when m.to_branch_id = p_branch_id and m.movement_type in ('stock_in', 'transfer', 'return') then abs(m.quantity) * coalesce(m.unit_cost_tzs, 0)
            when m.to_branch_id = p_branch_id and m.movement_type = 'audit' then m.quantity * coalesce(m.unit_cost_tzs, 0)
            when m.from_branch_id = p_branch_id and m.movement_type in ('stock_out', 'sale', 'transfer') then -abs(m.quantity) * coalesce(m.unit_cost_tzs, 0)
            else 0
          end::numeric as value_delta
        from public.inventory_movements m
        where m.product_id = v_product_id
          and m.imei_device_id is null
      ) stock;
    end if;

    insert into public.sale_items (sale_id, product_id, imei_device_id, quantity, unit_price_tzs)
    values (v_sale_id, v_product_id, v_imei_device_id, v_quantity, v_unit_price);

    insert into public.inventory_movements (
      product_id,
      imei_device_id,
      movement_type,
      quantity,
      unit_cost_tzs,
      from_branch_id,
      sale_id,
      notes,
      actor_id
    )
    values (
      v_product_id,
      v_imei_device_id,
      'sale',
      -v_quantity,
      v_unit_cost,
      p_branch_id,
      v_sale_id,
      'POS sale',
      v_actor
    );

    if v_imei_device_id is not null then
      update public.imei_devices
      set status = 'Sold',
          selling_price_tzs = v_unit_price
      where id = v_imei_device_id;

      insert into public.imei_history (
        imei_device_id,
        event_type,
        from_status,
        to_status,
        from_branch_id,
        notes,
        actor_id
      )
      values (
        v_imei_device_id,
        'sold',
        'In Stock',
        'Sold',
        p_branch_id,
        'Sold through POS invoice ' || v_invoice,
        v_actor
      );
    end if;
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments)
  loop
    v_payment_amount := coalesce((v_payment ->> 'amount_tzs')::numeric, 0);
    if v_payment_amount > 0 then
      insert into public.sale_payments (sale_id, method, amount_tzs, reference, received_by)
      values (
        v_sale_id,
        (v_payment ->> 'method')::public.payment_method,
        v_payment_amount,
        nullif(v_payment ->> 'reference', ''),
        v_actor
      );
    end if;
  end loop;

  if v_balance > 0 then
    insert into public.customer_debts (
      customer_id,
      sale_id,
      original_amount_tzs,
      outstanding_amount_tzs,
      due_date,
      status,
      created_by
    )
    values (
      p_customer_id,
      v_sale_id,
      v_balance,
      v_balance,
      coalesce(p_due_date, current_date + 7),
      case when coalesce(p_due_date, current_date + 7) < current_date then 'overdue'::public.debt_status else 'open'::public.debt_status end,
      v_actor
    );
  end if;

  return query
  select s.id, s.invoice_number, s.receipt_number, s.total_tzs, s.paid_tzs, s.balance_tzs
  from public.sales s
  where s.id = v_sale_id;
end;
$$;

grant select on public.current_stock_summary to authenticated;
grant execute on function app_private.create_pos_sale_impl(uuid, uuid, jsonb, jsonb, numeric, numeric, date) to authenticated;

commit;

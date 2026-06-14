create or replace function app_private.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad((coalesce(count(*), 0) + 1)::text, 4, '0')
  from public.sales
  where sold_at::date = now()::date
$$;

create or replace function app_private.next_receipt_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'RCT-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad((coalesce(count(*), 0) + 1)::text, 4, '0')
  from public.sales
  where sold_at::date = now()::date
$$;

create or replace function public.create_pos_sale(
  p_branch_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_discount_tzs numeric default 0,
  p_tax_tzs numeric default 0
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
  v_item jsonb;
  v_payment jsonb;
  v_product_id uuid;
  v_imei_device_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_status public.imei_status;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_admin and p_branch_id <> v_branch then
    raise exception 'Sales person can only sell from assigned branch';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Sale requires at least one item';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_imei_device_id := nullif(v_item ->> 'imei_device_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 1);
    v_unit_price := (v_item ->> 'unit_price_tzs')::numeric;

    if v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Invalid sale item quantity or price';
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
    end if;

    v_subtotal := v_subtotal + (v_quantity * v_unit_price);
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments)
  loop
    v_paid := v_paid + (v_payment ->> 'amount_tzs')::numeric;
  end loop;

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

    insert into public.sale_items (sale_id, product_id, imei_device_id, quantity, unit_price_tzs)
    values (v_sale_id, v_product_id, v_imei_device_id, v_quantity, v_unit_price);

    insert into public.inventory_movements (
      product_id,
      imei_device_id,
      movement_type,
      quantity,
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
    insert into public.sale_payments (sale_id, method, amount_tzs, reference, received_by)
    values (
      v_sale_id,
      (v_payment ->> 'method')::public.payment_method,
      (v_payment ->> 'amount_tzs')::numeric,
      nullif(v_payment ->> 'reference', ''),
      v_actor
    );
  end loop;

  return query
  select s.id, s.invoice_number, s.receipt_number, s.total_tzs, s.paid_tzs, s.balance_tzs
  from public.sales s
  where s.id = v_sale_id;
end;
$$;

grant execute on function public.create_pos_sale(uuid, uuid, jsonb, jsonb, numeric, numeric) to authenticated;

create or replace view public.current_stock_summary
with (security_invoker = true)
as
select
  p.id as product_id,
  p.name as product_name,
  p.brand,
  p.model,
  p.category,
  b.id as branch_id,
  b.name as branch_name,
  count(d.id) filter (where d.status = 'In Stock')::integer as in_stock,
  count(d.id) filter (where d.status = 'Reserved')::integer as reserved,
  count(d.id) filter (where d.status = 'Sold')::integer as sold,
  coalesce(sum(d.purchase_price_tzs) filter (where d.status = 'In Stock'), 0)::numeric(14,2) as stock_value_tzs,
  p.low_stock_threshold,
  (count(d.id) filter (where d.status = 'In Stock') <= p.low_stock_threshold) as is_low_stock
from public.products p
cross join public.branches b
left join public.imei_devices d on d.product_id = p.id and d.branch_id = b.id
where p.is_active = true
group by p.id, p.name, p.brand, p.model, p.category, b.id, b.name, p.low_stock_threshold;

grant select on public.current_stock_summary to authenticated;

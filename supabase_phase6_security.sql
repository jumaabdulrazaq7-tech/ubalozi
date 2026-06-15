update storage.buckets
set public = false
where id = 'profile-avatars';

drop function if exists public.create_pos_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, date);
drop function if exists public.collect_debt_payment(uuid, public.payment_method, numeric, text);
drop function if exists public.update_own_avatar_url(text);

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
  v_payment_amount numeric;
  v_status public.imei_status;
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

create or replace function public.create_pos_sale(
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
language sql
security invoker
set search_path = public
as $$
  select *
  from app_private.create_pos_sale_impl(
    p_branch_id,
    p_customer_id,
    p_items,
    p_payments,
    p_discount_tzs,
    p_tax_tzs,
    p_due_date
  )
$$;

create or replace function app_private.collect_debt_payment_impl(
  p_debt_id uuid,
  p_method public.payment_method,
  p_amount_tzs numeric,
  p_reference text default null
)
returns table (
  debt_id uuid,
  outstanding_amount_tzs numeric,
  status public.debt_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_is_admin boolean := app_private.is_admin();
  v_branch uuid := app_private.current_user_branch_id();
  v_debt public.customer_debts%rowtype;
  v_remaining numeric;
  v_status public.debt_status;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_amount_tzs <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select d.* into v_debt
  from public.customer_debts d
  join public.sales s on s.id = d.sale_id
  where d.id = p_debt_id
    and d.status <> 'cancelled'
    and (v_is_admin or s.branch_id = v_branch)
  for update;

  if not found then
    raise exception 'Debt not found or access denied';
  end if;

  if v_debt.outstanding_amount_tzs <= 0 or v_debt.status = 'paid' then
    raise exception 'Debt is already paid';
  end if;

  if p_amount_tzs > v_debt.outstanding_amount_tzs then
    raise exception 'Payment exceeds outstanding balance';
  end if;

  insert into public.debt_payments (debt_id, method, amount_tzs, reference, collected_by)
  values (p_debt_id, p_method, p_amount_tzs, nullif(p_reference, ''), v_actor);

  v_remaining := v_debt.outstanding_amount_tzs - p_amount_tzs;
  v_status := case
    when v_remaining = 0 then 'paid'::public.debt_status
    when v_debt.due_date < current_date then 'overdue'::public.debt_status
    else 'partial'::public.debt_status
  end;

  update public.customer_debts
  set outstanding_amount_tzs = v_remaining,
      status = v_status
  where id = p_debt_id;

  return query
  select d.id, d.outstanding_amount_tzs, d.status
  from public.customer_debts d
  where d.id = p_debt_id;
end;
$$;

create or replace function public.collect_debt_payment(
  p_debt_id uuid,
  p_method public.payment_method,
  p_amount_tzs numeric,
  p_reference text default null
)
returns table (
  debt_id uuid,
  outstanding_amount_tzs numeric,
  status public.debt_status
)
language sql
security invoker
set search_path = public
as $$
  select *
  from app_private.collect_debt_payment_impl(p_debt_id, p_method, p_amount_tzs, p_reference)
$$;

create or replace function app_private.update_own_avatar_url_impl(p_avatar_url text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_avatar_url is not null and p_avatar_url <> '' and split_part(p_avatar_url, '/', 1) <> auth.uid()::text then
    raise exception 'Avatar path must belong to current user';
  end if;

  update public.profiles
  set avatar_url = nullif(p_avatar_url, '')
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.update_own_avatar_url(p_avatar_url text)
returns public.profiles
language sql
security invoker
set search_path = public
as $$
  select app_private.update_own_avatar_url_impl(p_avatar_url)
$$;

revoke all on function app_private.create_pos_sale_impl(uuid, uuid, jsonb, jsonb, numeric, numeric, date) from public;
revoke all on function app_private.collect_debt_payment_impl(uuid, public.payment_method, numeric, text) from public;
revoke all on function app_private.update_own_avatar_url_impl(text) from public;
grant execute on function app_private.create_pos_sale_impl(uuid, uuid, jsonb, jsonb, numeric, numeric, date) to authenticated;
grant execute on function app_private.collect_debt_payment_impl(uuid, public.payment_method, numeric, text) to authenticated;
grant execute on function app_private.update_own_avatar_url_impl(text) to authenticated;

grant execute on function public.create_pos_sale(uuid, uuid, jsonb, jsonb, numeric, numeric, date) to authenticated;
grant execute on function public.collect_debt_payment(uuid, public.payment_method, numeric, text) to authenticated;
grant execute on function public.update_own_avatar_url(text) to authenticated;

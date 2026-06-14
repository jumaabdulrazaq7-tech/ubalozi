create extension if not exists "pgcrypto";

create schema if not exists app_private;

create type public.user_role as enum ('admin', 'sales_person');
create type public.branch_status as enum ('active', 'inactive');
create type public.product_category as enum ('Phones', 'Accessories', 'Spare Parts');
create type public.imei_status as enum ('In Stock', 'Sold', 'Reserved', 'Returned');
create type public.inventory_movement_type as enum ('stock_in', 'stock_out', 'transfer', 'audit', 'sale', 'return');
create type public.payment_method as enum ('Cash', 'Bank Transfer', 'Mobile Money');
create type public.sale_status as enum ('draft', 'completed', 'cancelled', 'refunded');
create type public.debt_status as enum ('open', 'partial', 'paid', 'overdue', 'cancelled');

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text not null,
  code text not null unique,
  status public.branch_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'sales_person',
  branch_id uuid references public.branches(id),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'sw')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  country text default 'United Arab Emirates',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  model text not null,
  category public.product_category not null,
  barcode text not null unique,
  qr_code text not null unique,
  description text,
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_bucket text not null default 'product-images',
  storage_path text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.imei_devices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  imei_number text not null unique check (length(regexp_replace(imei_number, '\D', '', 'g')) between 14 and 17),
  serial_number text,
  purchase_price_aed numeric(14,2) not null check (purchase_price_aed >= 0),
  exchange_rate numeric(14,4) not null check (exchange_rate > 0),
  purchase_price_tzs numeric(14,2) generated always as (purchase_price_aed * exchange_rate) stored,
  selling_price_tzs numeric(14,2) check (selling_price_tzs is null or selling_price_tzs >= 0),
  profit_tzs numeric(14,2) generated always as (
    case when selling_price_tzs is null then null else selling_price_tzs - (purchase_price_aed * exchange_rate) end
  ) stored,
  branch_id uuid not null references public.branches(id),
  supplier_id uuid references public.suppliers(id),
  warranty_months integer not null default 12 check (warranty_months >= 0),
  status public.imei_status not null default 'In Stock',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.imei_history (
  id uuid primary key default gen_random_uuid(),
  imei_device_id uuid not null references public.imei_devices(id) on delete cascade,
  event_type text not null,
  from_status public.imei_status,
  to_status public.imei_status,
  from_branch_id uuid references public.branches(id),
  to_branch_id uuid references public.branches(id),
  notes text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  email text,
  address text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  receipt_number text unique,
  branch_id uuid not null references public.branches(id),
  customer_id uuid references public.customers(id),
  sold_by uuid not null references public.profiles(id),
  subtotal_tzs numeric(14,2) not null default 0 check (subtotal_tzs >= 0),
  discount_tzs numeric(14,2) not null default 0 check (discount_tzs >= 0),
  tax_tzs numeric(14,2) not null default 0 check (tax_tzs >= 0),
  total_tzs numeric(14,2) generated always as (subtotal_tzs - discount_tzs + tax_tzs) stored,
  paid_tzs numeric(14,2) not null default 0 check (paid_tzs >= 0),
  balance_tzs numeric(14,2) generated always as ((subtotal_tzs - discount_tzs + tax_tzs) - paid_tzs) stored,
  status public.sale_status not null default 'completed',
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  imei_device_id uuid unique references public.imei_devices(id),
  quantity integer not null default 1 check (quantity > 0),
  unit_price_tzs numeric(14,2) not null check (unit_price_tzs >= 0),
  line_total_tzs numeric(14,2) generated always as (quantity * unit_price_tzs) stored
);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  method public.payment_method not null,
  amount_tzs numeric(14,2) not null check (amount_tzs > 0),
  reference text,
  received_by uuid not null references public.profiles(id),
  paid_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  imei_device_id uuid references public.imei_devices(id),
  movement_type public.inventory_movement_type not null,
  quantity integer not null check (quantity <> 0),
  from_branch_id uuid references public.branches(id),
  to_branch_id uuid references public.branches(id),
  sale_id uuid references public.sales(id),
  notes text,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (from_branch_id is not null or to_branch_id is not null)
);

create table public.customer_debts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  sale_id uuid not null references public.sales(id),
  original_amount_tzs numeric(14,2) not null check (original_amount_tzs > 0),
  outstanding_amount_tzs numeric(14,2) not null check (outstanding_amount_tzs >= 0),
  due_date date not null,
  status public.debt_status not null default 'open',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.customer_debts(id) on delete cascade,
  method public.payment_method not null,
  amount_tzs numeric(14,2) not null check (amount_tzs > 0),
  reference text,
  collected_by uuid not null references public.profiles(id),
  paid_at timestamptz not null default now()
);

create index idx_profiles_branch on public.profiles(branch_id);
create index idx_products_search on public.products using gin (to_tsvector('english', name || ' ' || brand || ' ' || model || ' ' || barcode || ' ' || qr_code));
create index idx_imei_branch_status on public.imei_devices(branch_id, status);
create index idx_imei_product on public.imei_devices(product_id);
create index idx_imei_history_device on public.imei_history(imei_device_id, created_at desc);
create index idx_inventory_product_branch on public.inventory_movements(product_id, to_branch_id, from_branch_id);
create index idx_sales_branch_date on public.sales(branch_id, sold_at desc);
create index idx_sales_customer on public.sales(customer_id);
create index idx_debts_customer_status on public.customer_debts(customer_id, status);
create index idx_debts_due_date on public.customer_debts(due_date) where status in ('open', 'partial', 'overdue');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger branches_set_updated_at before update on public.branches for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger imei_devices_set_updated_at before update on public.imei_devices for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger customer_debts_set_updated_at before update on public.customer_debts for each row execute function public.set_updated_at();

create or replace function app_private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function app_private.current_user_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.current_user_role() = 'admin'
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to authenticated;

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.imei_devices enable row level security;
alter table public.imei_history enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.customer_debts enable row level security;
alter table public.debt_payments enable row level security;

create policy "Authenticated users can read active branches" on public.branches for select to authenticated using (true);
create policy "Admins manage branches" on public.branches for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy "Users read own profile or admins read all" on public.profiles for select to authenticated using (id = auth.uid() or app_private.is_admin());
create policy "Admins manage profiles" on public.profiles for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy "Authenticated users read suppliers" on public.suppliers for select to authenticated using (true);
create policy "Admins manage suppliers" on public.suppliers for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy "Authenticated users read products" on public.products for select to authenticated using (true);
create policy "Admins manage products" on public.products for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy "Authenticated users read product images" on public.product_images for select to authenticated using (true);
create policy "Admins manage product images" on public.product_images for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy "Users read imei devices by role or branch" on public.imei_devices for select to authenticated
using (app_private.is_admin() or branch_id = app_private.current_user_branch_id());
create policy "Admins manage imei devices" on public.imei_devices for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());
create policy "Sales update imei devices in own branch" on public.imei_devices for update to authenticated
using (branch_id = app_private.current_user_branch_id())
with check (branch_id = app_private.current_user_branch_id());

create policy "Users read imei history by device branch" on public.imei_history for select to authenticated
using (
  app_private.is_admin()
  or exists (
    select 1 from public.imei_devices d
    where d.id = imei_history.imei_device_id
    and d.branch_id = app_private.current_user_branch_id()
  )
);
create policy "Authenticated users insert imei history" on public.imei_history for insert to authenticated with check (actor_id = auth.uid() or app_private.is_admin());

create policy "Authenticated users read customers" on public.customers for select to authenticated using (true);
create policy "Authenticated users manage customers" on public.customers for all to authenticated using (app_private.is_admin() or created_by = auth.uid()) with check (app_private.is_admin() or created_by = auth.uid());

create policy "Users read sales by role or branch" on public.sales for select to authenticated
using (app_private.is_admin() or branch_id = app_private.current_user_branch_id() or sold_by = auth.uid());
create policy "Users create sales in own branch" on public.sales for insert to authenticated
with check (app_private.is_admin() or (branch_id = app_private.current_user_branch_id() and sold_by = auth.uid()));
create policy "Admins update sales" on public.sales for update to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy "Users read sale items through visible sale" on public.sale_items for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_items.sale_id and (app_private.is_admin() or s.branch_id = app_private.current_user_branch_id() or s.sold_by = auth.uid())));
create policy "Users create sale items through own sale" on public.sale_items for insert to authenticated
with check (exists (select 1 from public.sales s where s.id = sale_items.sale_id and (app_private.is_admin() or (s.branch_id = app_private.current_user_branch_id() and s.sold_by = auth.uid()))));

create policy "Users read sale payments through visible sale" on public.sale_payments for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_payments.sale_id and (app_private.is_admin() or s.branch_id = app_private.current_user_branch_id() or s.sold_by = auth.uid())));
create policy "Users create sale payments in own branch" on public.sale_payments for insert to authenticated
with check (received_by = auth.uid() or app_private.is_admin());

create policy "Users read inventory by role or branch" on public.inventory_movements for select to authenticated
using (app_private.is_admin() or from_branch_id = app_private.current_user_branch_id() or to_branch_id = app_private.current_user_branch_id());
create policy "Users create inventory movements for own branch" on public.inventory_movements for insert to authenticated
with check (app_private.is_admin() or actor_id = auth.uid());

create policy "Users read debts by role or branch sale" on public.customer_debts for select to authenticated
using (
  app_private.is_admin()
  or exists (select 1 from public.sales s where s.id = customer_debts.sale_id and s.branch_id = app_private.current_user_branch_id())
);
create policy "Users create debts from own sales" on public.customer_debts for insert to authenticated
with check (
  app_private.is_admin()
  or exists (select 1 from public.sales s where s.id = customer_debts.sale_id and s.branch_id = app_private.current_user_branch_id() and s.sold_by = auth.uid())
);
create policy "Admins update debts" on public.customer_debts for update to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy "Users read debt payments through visible debt" on public.debt_payments for select to authenticated
using (
  app_private.is_admin()
  or exists (
    select 1 from public.customer_debts d
    join public.sales s on s.id = d.sale_id
    where d.id = debt_payments.debt_id
    and s.branch_id = app_private.current_user_branch_id()
  )
);
create policy "Users collect debt payments" on public.debt_payments for insert to authenticated with check (collected_by = auth.uid() or app_private.is_admin());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

insert into public.branches (name, location, code, status) values
  ('Lumumba', 'Lumumba Street, Mwanza', 'LMB', 'active'),
  ('Sokoni', 'Sokoni Street, Mwanza', 'SKN', 'active'),
  ('Kariakoo', 'Uhuru Street, Kariakoo', 'KRK', 'active')
on conflict (code) do nothing;

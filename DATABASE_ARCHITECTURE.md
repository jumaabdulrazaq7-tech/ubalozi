# UBALOZINI ELECTRONICS ERP & POS - Database Architecture

## 1. Full Database Architecture

The Phase 1 schema is organized around branch-controlled retail operations:

- `profiles`: application user profile linked to `auth.users`, with role, branch assignment, language, and status.
- `branches`: store locations and performance grouping.
- `products`: master product catalog for phones, accessories, and spare parts.
- `product_images`: Supabase Storage metadata for product images.
- `suppliers`: supplier records prepared for purchases and IMEI source tracking.
- `imei_devices`: individual phone tracking by IMEI, AED purchase cost, exchange rate, TZS cost, branch, supplier, warranty, and lifecycle status.
- `imei_history`: immutable audit trail for IMEI status, branch, sale, return, verification, and warranty events.
- `inventory_movements`: stock in, stock out, transfer, audit, sale, and return movements.
- `customers`: customer profile and contact records.
- `sales`: invoice/receipt header with branch, staff, customer, subtotal, discount, tax, paid amount, balance, and sale status.
- `sale_items`: sale lines for product quantity and optional IMEI device.
- `sale_payments`: multiple payment methods per sale.
- `customer_debts`: credit sale tracking.
- `debt_payments`: payment collection and history.

## 2. Security Model

- Supabase Auth owns login, logout, forgot password, and sessions.
- Authorization data lives in `profiles.role`, not user-editable metadata.
- Admins can manage all branches, products, IMEIs, inventory, sales, customers, and debts.
- Sales people can read shared catalog data and operate on their assigned branch.
- Row Level Security is enabled on all public tables.
- Explicit `GRANT` statements are included because new Supabase projects may not expose public tables to the Data API by default.

## 3. Money and Currency

Phones are purchased in AED and sold in TZS.

`purchase_price_tzs = purchase_price_aed * exchange_rate`

`profit_tzs = selling_price_tzs - purchase_price_tzs`

The schema stores AED price and exchange rate permanently on each IMEI device so historical profits do not change when exchange rates change later.

## 4. Project Folder Structure

```text
outputs/
  DATABASE_ARCHITECTURE.md
  supabase_schema.sql
  ubalozini-erp-pos/
    src/app/
      dashboard/
      login/
      forgot-password/
      branches/
      products/
      imei/
      inventory/
      pos/
      customers/
      debts/
    src/components/
      app/
      auth/
      dashboard/
      modules/
      ui/
    src/lib/
      data/
      supabase/
    src/types/
```

## 5. Phase 1 Module Delivery

- Authentication system: Supabase SSR client wiring, login and forgot-password UI, role model in SQL.
- Branch module: branch table, form, initial branches, performance summary fields.
- Product module: catalog form, table, categories, barcode/QR, image storage metadata.
- IMEI module: phone-level tracking, verification/search UI, AED to TZS cost model, history table.


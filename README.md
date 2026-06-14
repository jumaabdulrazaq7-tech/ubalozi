# UBALOZINI ELECTRONICS ERP & POS

Saved deliverables:

- `ubalozini-erp-pos/` - Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui app.
- `supabase_schema.sql` - Complete Phase 1 Supabase/PostgreSQL schema with RLS, grants, indexes, constraints, generated currency/profit columns, and initial branches.
- `DATABASE_ARCHITECTURE.md` - Architecture, security model, currency model, folder structure, and Phase 1 module summary.

Run locally:

```bash
cd outputs/ubalozini-erp-pos
npm install
npm run dev -- --port 3001
```

Open:

```text
http://localhost:3001/dashboard
```

Configure Supabase:

1. Create a Supabase project.
2. Run `outputs/supabase_schema.sql` in the SQL editor.
3. Copy `outputs/ubalozini-erp-pos/.env.example` to `.env.local`.
4. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Verified:

- `npm run lint`
- `npm run build`
- Browser render check on `/dashboard` and `/forgot-password`

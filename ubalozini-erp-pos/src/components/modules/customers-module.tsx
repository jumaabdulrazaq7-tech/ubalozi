"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Mail, Pencil, Phone, RefreshCw, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/data/mock-data";
import { createClient } from "@/lib/supabase/client";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
};

type SaleRow = {
  id: string;
  invoice_number: string;
  receipt_number: string | null;
  total_tzs: number;
  paid_tzs: number;
  balance_tzs: number;
  sold_at: string;
  branches: { name: string } | null;
  sale_items: {
    quantity: number;
    unit_price_tzs: number;
    line_total_tzs: number;
    products: { name: string; brand: string; model: string } | null;
    imei_devices: { imei_number: string; warranty_months: number } | null;
  }[];
};

type DebtRow = {
  id: string;
  original_amount_tzs: number;
  outstanding_amount_tzs: number;
  due_date: string;
  status: string;
};

type CustomerStats = Record<
  string,
  {
    sales: number;
    spent: number;
    outstanding: number;
  }
>;

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

export function CustomersModule() {
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [stats, setStats] = useState<CustomerStats>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0] ?? null;

  async function loadCustomers(nextSelectedId = selectedCustomerId) {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const [{ data: customerData, error: customerError }, { data: salesData, error: salesError }, { data: debtData, error: debtError }] =
      await Promise.all([
        supabase.from("customers").select("id,name,phone,email,address,created_at").order("created_at", { ascending: false }),
        supabase.from("sales").select("customer_id,total_tzs,balance_tzs").not("customer_id", "is", null),
        supabase.from("customer_debts").select("customer_id,outstanding_amount_tzs,status"),
      ]);

    setLoading(false);

    const firstError = customerError || salesError || debtError;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const rows = (customerData ?? []) as CustomerRow[];
    const nextStats: CustomerStats = {};

    (salesData ?? []).forEach((sale) => {
      const customerId = sale.customer_id as string | null;
      if (!customerId) return;
      nextStats[customerId] ??= { sales: 0, spent: 0, outstanding: 0 };
      nextStats[customerId].sales += 1;
      nextStats[customerId].spent += Number(sale.total_tzs ?? 0);
    });

    (debtData ?? []).forEach((debt) => {
      const customerId = debt.customer_id as string | null;
      if (!customerId || debt.status === "paid" || debt.status === "cancelled") return;
      nextStats[customerId] ??= { sales: 0, spent: 0, outstanding: 0 };
      nextStats[customerId].outstanding += Number(debt.outstanding_amount_tzs ?? 0);
    });

    setCustomers(rows);
    setStats(nextStats);
    setSelectedCustomerId(nextSelectedId || rows[0]?.id || null);
  }

  async function loadCustomerProfile(customerId: string | null) {
    if (!supabase || !customerId) {
      setSales([]);
      setDebts([]);
      return;
    }

    setLoadingProfile(true);
    const [saleResult, debtResult] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "id,invoice_number,receipt_number,total_tzs,paid_tzs,balance_tzs,sold_at,branches(name),sale_items(quantity,unit_price_tzs,line_total_tzs,products(name,brand,model),imei_devices(imei_number,warranty_months))"
        )
        .eq("customer_id", customerId)
        .order("sold_at", { ascending: false })
        .limit(20),
      supabase
        .from("customer_debts")
        .select("id,original_amount_tzs,outstanding_amount_tzs,due_date,status")
        .eq("customer_id", customerId)
        .order("due_date", { ascending: true }),
    ]);
    setLoadingProfile(false);

    const firstError = saleResult.error || debtResult.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    setSales((saleResult.data ?? []) as unknown as SaleRow[]);
    setDebts((debtResult.data ?? []) as DebtRow[]);
  }

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    loadCustomerProfile(selectedCustomer?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      setSaving(false);
      setError(userError.message);
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      created_by: userData.user?.id,
    };

    const result = editingId
      ? await supabase.from("customers").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("customers").insert(payload).select("id").single();

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    setMessage(editingId ? "Customer updated successfully." : "Customer created successfully.");
    await loadCustomers(result.data.id as string);
  }

  function editCustomer(customer: CustomerRow) {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      address: customer.address ?? "",
    });
  }

  const filteredCustomers = customers.filter((customer) => {
    const needle = search.toLowerCase();
    return [customer.name, customer.phone, customer.email ?? "", customer.address ?? ""].join(" ").toLowerCase().includes(needle);
  });

  const selectedStats = selectedCustomer ? stats[selectedCustomer.id] ?? { sales: 0, spent: 0, outstanding: 0 } : { sales: 0, spent: 0, outstanding: 0 };
  const warrantyItems = sales.flatMap((sale) =>
    sale.sale_items
      .filter((item) => item.imei_devices)
      .map((item) => ({
        saleId: sale.id,
        soldAt: sale.sold_at,
        productName: item.products?.name ?? "Phone",
        imei: item.imei_devices?.imei_number ?? "-",
        warrantyMonths: item.imei_devices?.warranty_months ?? 0,
      }))
  );

  return (
    <AppShell>
      <PageHeader title="Customer Management" description="Customer profiles, purchase history, warranty records, and credit visibility for every branch." actionLabel="Add Customer" />
      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="size-4" /> Customer Form</CardTitle>
              <CardDescription>Create and update customer contacts used by POS, warranty, and debt tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Customer action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
                {message ? <Alert><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
                <FieldGroup>
                  <Field><FieldLabel>Customer Name</FieldLabel><Input placeholder="Asha Mohamed" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></Field>
                  <Field><FieldLabel>Phone Number</FieldLabel><Input placeholder="+255 754 112 900" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required /></Field>
                  <Field><FieldLabel>Email</FieldLabel><Input type="email" placeholder="customer@example.com" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></Field>
                  <Field><FieldLabel>Address</FieldLabel><Input placeholder="Mwanza CBD" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></Field>
                </FieldGroup>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}><UserPlus data-icon="inline-start" /> {saving ? "Saving..." : "Save Customer"}</Button>
                  {editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</Button> : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Customers</CardTitle>
                <CardDescription>Search by name, phone, email, or address.</CardDescription>
              </div>
              <Button variant="outline" size="icon" aria-label="Refresh customers" onClick={() => loadCustomers(selectedCustomer?.id)}><RefreshCw /></Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search customers..." className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Balance</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">Loading customers...</TableCell></TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">No customers found.</TableCell></TableRow>
                  ) : filteredCustomers.map((customer) => {
                    const customerStats = stats[customer.id] ?? { sales: 0, spent: 0, outstanding: 0 };
                    return (
                      <TableRow key={customer.id} className={selectedCustomer?.id === customer.id ? "bg-muted/50" : ""}>
                        <TableCell>
                          <button type="button" className="text-left" onClick={() => setSelectedCustomerId(customer.id)}>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-xs text-muted-foreground">{customer.phone}</div>
                          </button>
                        </TableCell>
                        <TableCell><Badge variant={customerStats.outstanding > 0 ? "destructive" : "secondary"}>{money.format(customerStats.outstanding)}</Badge></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" aria-label="Edit customer" onClick={() => editCustomer(customer)}><Pencil /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="size-4" /> Customer Profile</CardTitle>
              <CardDescription>{selectedCustomer ? "Live profile summary from sales, warranties, and debt records." : "Select or create a customer to view profile details."}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Customer</div>
                    <div className="mt-1 font-semibold">{selectedCustomer.name}</div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Phone className="size-3.5" /> {selectedCustomer.phone}</div>
                    {selectedCustomer.email ? <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-3.5" /> {selectedCustomer.email}</div> : null}
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Purchase Value</div>
                    <div className="mt-1 text-xl font-semibold">{money.format(selectedStats.spent)}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{selectedStats.sales} purchases recorded</div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Outstanding Debt</div>
                    <div className="mt-1 text-xl font-semibold">{money.format(selectedStats.outstanding)}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{debts.filter((debt) => debt.status !== "paid" && debt.status !== "cancelled").length} active debt records</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">No customer selected.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Purchase History</CardTitle><CardDescription>Recent invoices and receipt records for the selected customer.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Items</TableHead><TableHead>Branch</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loadingProfile ? (
                    <TableRow><TableCell colSpan={5} className="text-muted-foreground">Loading purchase history...</TableCell></TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-muted-foreground">No purchases recorded yet.</TableCell></TableRow>
                  ) : sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell><div className="font-medium">{sale.invoice_number}</div><div className="text-xs text-muted-foreground">{new Date(sale.sold_at).toLocaleDateString()}</div></TableCell>
                      <TableCell>{sale.sale_items.map((item) => item.products?.name ?? "Item").join(", ") || "-"}</TableCell>
                      <TableCell>{sale.branches?.name ?? "-"}</TableCell>
                      <TableCell>{money.format(sale.total_tzs)}</TableCell>
                      <TableCell><Badge variant={sale.balance_tzs > 0 ? "destructive" : "secondary"}>{money.format(sale.balance_tzs)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Warranty History</CardTitle><CardDescription>IMEI devices bought by this customer.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>IMEI</TableHead><TableHead>Warranty</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {warrantyItems.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-muted-foreground">No warranty devices found.</TableCell></TableRow>
                    ) : warrantyItems.map((item) => (
                      <TableRow key={`${item.saleId}-${item.imei}`}>
                        <TableCell><div className="font-medium">{item.productName}</div><div className="text-xs text-muted-foreground">{new Date(item.soldAt).toLocaleDateString()}</div></TableCell>
                        <TableCell className="font-mono text-xs">{item.imei}</TableCell>
                        <TableCell>{item.warrantyMonths} months</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Debt Snapshot</CardTitle><CardDescription>Credit balances connected to the selected customer.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Due Date</TableHead><TableHead>Outstanding</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {debts.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-muted-foreground">No debt records found.</TableCell></TableRow>
                    ) : debts.map((debt) => (
                      <TableRow key={debt.id}>
                        <TableCell><Badge variant={debt.status === "paid" ? "secondary" : "outline"}>{debt.status}</Badge></TableCell>
                        <TableCell>{new Date(debt.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>{money.format(debt.outstanding_amount_tzs)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

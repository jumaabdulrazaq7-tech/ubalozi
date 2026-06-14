"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, History, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aed, money } from "@/lib/data/mock-data";
import { createClient } from "@/lib/supabase/client";
import type { ImeiStatus } from "@/types/erp";

type ProductOption = { id: string; name: string; brand: string; model: string };
type BranchOption = { id: string; name: string };
type SupplierOption = { id: string; name: string };
type DeviceRow = {
  id: string;
  product_id: string;
  imei_number: string;
  serial_number: string | null;
  purchase_price_aed: number;
  exchange_rate: number;
  purchase_price_tzs: number;
  selling_price_tzs: number | null;
  profit_tzs: number | null;
  warranty_months: number;
  status: ImeiStatus;
  products: { name: string } | null;
  branches: { name: string } | null;
  suppliers: { name: string } | null;
};

const emptyForm = {
  product_id: "",
  imei_number: "",
  serial_number: "",
  purchase_price_aed: "",
  exchange_rate: "",
  selling_price_tzs: "",
  branch_id: "",
  supplier_name: "",
  warranty_months: "12",
  status: "In Stock" as ImeiStatus,
};

export function ImeiModule() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculatedCost = Number(form.purchase_price_aed || 0) * Number(form.exchange_rate || 0);
  const calculatedProfit = form.selling_price_tzs ? Number(form.selling_price_tzs) - calculatedCost : null;

  async function loadData() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [productResult, branchResult, supplierResult, deviceResult] = await Promise.all([
      supabase.from("products").select("id,name,brand,model").eq("category", "Phones").eq("is_active", true).order("name"),
      supabase.from("branches").select("id,name").eq("status", "active").order("name"),
      supabase.from("suppliers").select("id,name").order("name"),
      supabase
        .from("imei_devices")
        .select("id,product_id,imei_number,serial_number,purchase_price_aed,exchange_rate,purchase_price_tzs,selling_price_tzs,profit_tzs,warranty_months,status,products(name),branches(name),suppliers(name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setLoading(false);

    const firstError = productResult.error || branchResult.error || supplierResult.error || deviceResult.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const loadedProducts = (productResult.data ?? []) as ProductOption[];
    const loadedBranches = (branchResult.data ?? []) as BranchOption[];
    setProducts(loadedProducts);
    setBranches(loadedBranches);
    setSuppliers((supplierResult.data ?? []) as SupplierOption[]);
    setDevices((deviceResult.data ?? []) as unknown as DeviceRow[]);
    setForm((current) => ({
      ...current,
      product_id: current.product_id || loadedProducts[0]?.id || "",
      branch_id: current.branch_id || loadedBranches[0]?.id || "",
    }));
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function findOrCreateSupplier(name: string) {
    if (!supabase || !name.trim()) return null;
    const cleanName = name.trim();
    const existing = suppliers.find((supplier) => supplier.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing.id;

    const { data, error: supplierError } = await supabase.from("suppliers").insert({ name: cleanName }).select("id").single();
    if (supplierError) throw supplierError;
    return data.id as string;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const supplierId = await findOrCreateSupplier(form.supplier_name);
      const payload = {
        product_id: form.product_id,
        imei_number: form.imei_number.trim(),
        serial_number: form.serial_number.trim() || null,
        purchase_price_aed: Number(form.purchase_price_aed),
        exchange_rate: Number(form.exchange_rate),
        selling_price_tzs: form.selling_price_tzs ? Number(form.selling_price_tzs) : null,
        branch_id: form.branch_id,
        supplier_id: supplierId,
        warranty_months: Number(form.warranty_months || 0),
        status: form.status,
        created_by: userData.user?.id,
      };
      const { data: device, error: insertError } = await supabase.from("imei_devices").insert(payload).select("id").single();
      if (insertError) throw insertError;

      await supabase.from("imei_history").insert({
        imei_device_id: device.id,
        event_type: "registered",
        to_status: form.status,
        to_branch_id: form.branch_id,
        notes: "Device registered from ERP web app.",
        actor_id: userData.user?.id,
      });

      setForm((current) => ({
        ...emptyForm,
        product_id: current.product_id,
        branch_id: current.branch_id,
      }));
      setMessage("IMEI device registered successfully.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "IMEI registration failed.");
    } finally {
      setSaving(false);
    }
  }

  const filteredDevices = devices.filter((device) => {
    const needle = search.toLowerCase();
    return [
      device.imei_number,
      device.serial_number ?? "",
      device.products?.name ?? "",
      device.branches?.name ?? "",
      device.suppliers?.name ?? "",
      device.status,
    ].join(" ").toLowerCase().includes(needle);
  });

  return (
    <AppShell>
      <PageHeader title="IMEI Device Management" description="Track every phone individually from purchase in AED to sale in TZS, warranty, status, and history." actionLabel="Register IMEI" />
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Register Device</CardTitle><CardDescription>TZS cost is calculated as AED purchase price x exchange rate.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>IMEI action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
              {message ? <Alert><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
              <FieldGroup>
                <Field>
                  <FieldLabel>Product</FieldLabel>
                  <Select value={form.product_id} onValueChange={(value) => setForm((current) => ({ ...current, product_id: value ?? "" }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>IMEI Number</FieldLabel><Input placeholder="356789112345671" value={form.imei_number} onChange={(event) => setForm((current) => ({ ...current, imei_number: event.target.value }))} required /></Field><Field><FieldLabel>Serial Number</FieldLabel><Input placeholder="F7QXK2UB15PM" value={form.serial_number} onChange={(event) => setForm((current) => ({ ...current, serial_number: event.target.value }))} /></Field></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Purchase Price AED</FieldLabel><Input type="number" min="0" step="0.01" placeholder="3100" value={form.purchase_price_aed} onChange={(event) => setForm((current) => ({ ...current, purchase_price_aed: event.target.value }))} required /></Field><Field><FieldLabel>Exchange Rate</FieldLabel><Input type="number" min="0" step="0.0001" placeholder="710" value={form.exchange_rate} onChange={(event) => setForm((current) => ({ ...current, exchange_rate: event.target.value }))} required /></Field></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Cost Price TZS</FieldLabel><Input value={calculatedCost ? money.format(calculatedCost) : "TZS 0"} readOnly /></Field><Field><FieldLabel>Selling Price TZS</FieldLabel><Input type="number" min="0" step="0.01" placeholder="2750000" value={form.selling_price_tzs} onChange={(event) => setForm((current) => ({ ...current, selling_price_tzs: event.target.value }))} /></Field></div>
                <Field><FieldLabel>Profit</FieldLabel><Input value={calculatedProfit === null ? "Add selling price to calculate profit" : money.format(calculatedProfit)} readOnly /></Field>
                <Field>
                  <FieldLabel>Branch</FieldLabel>
                  <Select value={form.branch_id} onValueChange={(value) => setForm((current) => ({ ...current, branch_id: value ?? "" }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Supplier</FieldLabel><Input placeholder="Dubai Mobile Hub" list="supplier-options" value={form.supplier_name} onChange={(event) => setForm((current) => ({ ...current, supplier_name: event.target.value }))} /><datalist id="supplier-options">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist></Field><Field><FieldLabel>Warranty Period</FieldLabel><Input type="number" min="0" value={form.warranty_months} onChange={(event) => setForm((current) => ({ ...current, warranty_months: event.target.value }))} /></Field></div>
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: (value ?? "In Stock") as ImeiStatus }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="In Stock">In Stock</SelectItem><SelectItem value="Reserved">Reserved</SelectItem><SelectItem value="Sold">Sold</SelectItem><SelectItem value="Returned">Returned</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={saving || products.length === 0 || branches.length === 0}>{saving ? "Saving..." : "Save IMEI Device"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>IMEI Verification</CardTitle><CardDescription>Search exact IMEI before sale, transfer, return, or warranty claim.</CardDescription></div><Button variant="outline" size="icon" aria-label="Refresh IMEI devices" onClick={loadData}><RefreshCw /></Button></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Scan or type IMEI number" className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <Table>
              <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Cost</TableHead><TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead>History</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">Loading IMEI devices...</TableCell></TableRow>
                ) : filteredDevices.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No IMEI devices found.</TableCell></TableRow>
                ) : filteredDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell><div className="font-medium">{device.products?.name ?? "Unknown phone"}</div><div className="font-mono text-xs text-muted-foreground">{device.imei_number}</div></TableCell>
                    <TableCell><div>{aed.format(device.purchase_price_aed)}</div><div className="text-xs text-muted-foreground">{money.format(device.purchase_price_tzs)}</div></TableCell>
                    <TableCell>{device.branches?.name ?? "-"}</TableCell>
                    <TableCell><Badge variant={device.status === "Sold" ? "secondary" : "outline"}><CheckCircle2 className="mr-1 size-3" />{device.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="sm"><History data-icon="inline-start" /> View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

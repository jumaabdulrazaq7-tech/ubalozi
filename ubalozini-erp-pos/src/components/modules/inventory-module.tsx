"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, CircleAlert, MoveRight, PackagePlus, RefreshCw, Search, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/data/mock-data";
import { createClient } from "@/lib/supabase/client";
import type { ProductCategory } from "@/types/erp";

type StockRow = {
  product_id: string;
  product_name: string;
  brand: string;
  model: string;
  category: string;
  branch_id: string;
  branch_name: string;
  in_stock: number;
  reserved: number;
  sold: number;
  stock_value_tzs: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
};

type ProductOption = { id: string; name: string; brand: string; model: string; category: ProductCategory };
type BranchOption = { id: string; name: string };
type MovementType = "stock_in" | "stock_out" | "transfer" | "audit" | "return";
type MovementRow = {
  id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost_tzs: number | null;
  notes: string | null;
  created_at: string;
  products: { name: string; category: ProductCategory } | null;
  from_branch: { name: string } | null;
  to_branch: { name: string } | null;
};

const emptyMovementForm = {
  movement_type: "stock_in" as MovementType,
  product_id: "",
  from_branch_id: "",
  to_branch_id: "",
  quantity: "1",
  unit_cost_tzs: "",
  notes: "",
};

export function InventoryModule() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStock() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [stockResult, productResult, branchResult, movementResult] = await Promise.all([
      supabase.from("current_stock_summary").select("*").order("branch_name").order("product_name"),
      supabase.from("products").select("id,name,brand,model,category").neq("category", "Phones").eq("is_active", true).order("name"),
      supabase.from("branches").select("id,name").eq("status", "active").order("name"),
      supabase
        .from("inventory_movements")
        .select("id,movement_type,quantity,unit_cost_tzs,notes,created_at,products(name,category),from_branch:branches!inventory_movements_from_branch_id_fkey(name),to_branch:branches!inventory_movements_to_branch_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    setLoading(false);

    const firstError = stockResult.error || productResult.error || branchResult.error || movementResult.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const loadedProducts = (productResult.data ?? []) as ProductOption[];
    const loadedBranches = (branchResult.data ?? []) as BranchOption[];
    setRows((stockResult.data ?? []) as StockRow[]);
    setProducts(loadedProducts);
    setBranchOptions(loadedBranches);
    setMovements((movementResult.data ?? []) as unknown as MovementRow[]);
    setMovementForm((current) => ({
      ...current,
      product_id: current.product_id || loadedProducts[0]?.id || "",
      to_branch_id: current.to_branch_id || loadedBranches[0]?.id || "",
      from_branch_id: current.from_branch_id || loadedBranches[0]?.id || "",
    }));
  }

  useEffect(() => {
    loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const branches = Array.from(new Set(rows.map((row) => row.branch_name))).sort();
  const filteredRows = rows.filter((row) => {
    const needle = search.toLowerCase();
    const matchesSearch = [row.product_name, row.brand, row.model, row.category, row.branch_name].join(" ").toLowerCase().includes(needle);
    const matchesBranch = branch === "all" || row.branch_name === branch;
    return matchesSearch && matchesBranch;
  });
  const totalInStock = filteredRows.reduce((sum, row) => sum + row.in_stock, 0);
  const totalValue = filteredRows.reduce((sum, row) => sum + Number(row.stock_value_tzs), 0);
  const lowStock = filteredRows.filter((row) => row.is_low_stock).length;
  const selectedProduct = products.find((product) => product.id === movementForm.product_id);
  const selectedFromStock = rows.find((row) => row.product_id === movementForm.product_id && row.branch_id === movementForm.from_branch_id);
  const computedUnitCost = selectedFromStock?.in_stock ? Number(selectedFromStock.stock_value_tzs) / selectedFromStock.in_stock : 0;

  async function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const quantity = Number(movementForm.quantity || 0);
      const costInput = Number(movementForm.unit_cost_tzs || 0);
      if (!movementForm.product_id) throw new Error("Select a product.");
      if (!quantity || quantity < 0 && movementForm.movement_type !== "audit") throw new Error("Quantity must be greater than zero.");
      if (selectedProduct?.category === "Phones") throw new Error("Phones must be stocked through IMEI Device Management.");

      const needsFrom = movementForm.movement_type === "stock_out" || movementForm.movement_type === "transfer";
      const needsTo = movementForm.movement_type === "stock_in" || movementForm.movement_type === "transfer" || movementForm.movement_type === "return" || movementForm.movement_type === "audit";
      const unitCost = costInput || (needsFrom ? computedUnitCost : 0) || null;

      if (needsFrom && !movementForm.from_branch_id) throw new Error("Select source branch.");
      if (needsTo && !movementForm.to_branch_id) throw new Error("Select destination branch.");
      if (movementForm.movement_type === "transfer" && movementForm.from_branch_id === movementForm.to_branch_id) throw new Error("Transfer branches must be different.");
      if ((movementForm.movement_type === "stock_out" || movementForm.movement_type === "transfer") && selectedFromStock && quantity > selectedFromStock.in_stock) {
        throw new Error(`Insufficient stock. Available ${selectedFromStock.in_stock}, requested ${quantity}.`);
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { error: movementError } = await supabase.from("inventory_movements").insert({
        product_id: movementForm.product_id,
        movement_type: movementForm.movement_type,
        quantity: movementForm.movement_type === "audit" ? quantity : Math.abs(quantity),
        unit_cost_tzs: unitCost,
        from_branch_id: needsFrom ? movementForm.from_branch_id : null,
        to_branch_id: needsTo ? movementForm.to_branch_id : null,
        notes: movementForm.notes.trim() || null,
        actor_id: userData.user?.id,
      });
      if (movementError) throw movementError;

      setMovementForm((current) => ({ ...emptyMovementForm, product_id: current.product_id, from_branch_id: current.from_branch_id, to_branch_id: current.to_branch_id }));
      setMessage("Inventory movement saved successfully.");
      await loadStock();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inventory movement failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Inventory Management" description="Stock in, stock out, branch transfers, audits, low stock alerts, and branch-level inventory visibility." />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Current Stock" value={String(totalInStock)} note="Available IMEI devices in selected view" icon={Boxes} />
        <StatCard title="Stock Value" value={money.format(totalValue)} note="Purchase value for in-stock devices" icon={WalletCards} />
        <StatCard title="Low Stock Items" value={String(lowStock)} note="Products at or below threshold" icon={CircleAlert} />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Stock Movement</CardTitle>
            <CardDescription>Add accessories and spare parts stock, transfer between branches, or record audit adjustments.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleMovementSubmit}>
              {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Inventory action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
              {message ? <Alert><PackagePlus /><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
              <FieldGroup>
                <Field>
                  <FieldLabel>Movement Type</FieldLabel>
                  <Select value={movementForm.movement_type} onValueChange={(value) => setMovementForm((current) => ({ ...current, movement_type: (value ?? "stock_in") as MovementType }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="stock_in">Stock In</SelectItem><SelectItem value="stock_out">Stock Out</SelectItem><SelectItem value="transfer">Transfer</SelectItem><SelectItem value="audit">Audit Adjustment</SelectItem><SelectItem value="return">Return</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Product</FieldLabel>
                  <Select value={movementForm.product_id} onValueChange={(value) => setMovementForm((current) => ({ ...current, product_id: value ?? "" }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent><SelectGroup>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name} - {product.category}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>From Branch</FieldLabel>
                    <Select value={movementForm.from_branch_id} onValueChange={(value) => setMovementForm((current) => ({ ...current, from_branch_id: value ?? "" }))} disabled={movementForm.movement_type === "stock_in" || movementForm.movement_type === "return" || movementForm.movement_type === "audit"}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup>{branchOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>To Branch</FieldLabel>
                    <Select value={movementForm.to_branch_id} onValueChange={(value) => setMovementForm((current) => ({ ...current, to_branch_id: value ?? "" }))} disabled={movementForm.movement_type === "stock_out"}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup>{branchOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel>Quantity</FieldLabel><Input type="number" step="1" value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: event.target.value }))} /></Field>
                  <Field><FieldLabel>Unit Cost TZS</FieldLabel><Input type="number" min="0" step="0.01" placeholder={computedUnitCost ? String(Math.round(computedUnitCost)) : "Optional"} value={movementForm.unit_cost_tzs} onChange={(event) => setMovementForm((current) => ({ ...current, unit_cost_tzs: event.target.value }))} /></Field>
                </div>
                <Field><FieldLabel>Notes</FieldLabel><Textarea placeholder="Supplier invoice, audit note, transfer reason..." value={movementForm.notes} onChange={(event) => setMovementForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
              </FieldGroup>
              <Button type="submit" disabled={saving || products.length === 0 || branchOptions.length === 0}><PackagePlus data-icon="inline-start" /> {saving ? "Saving..." : "Save Movement"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Movements</CardTitle>
            <CardDescription>Latest stock activity across branches.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Movement</TableHead><TableHead>Branches</TableHead><TableHead>Qty</TableHead></TableRow></TableHeader>
              <TableBody>
                {movements.length === 0 ? <TableRow><TableCell colSpan={4} className="text-muted-foreground">No movements recorded yet.</TableCell></TableRow> : movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell><div className="font-medium">{movement.products?.name ?? "Unknown product"}</div><div className="text-xs text-muted-foreground">{movement.products?.category}</div></TableCell>
                    <TableCell><Badge variant="outline">{movement.movement_type.replace("_", " ")}</Badge></TableCell>
                    <TableCell><div className="flex items-center gap-2 text-xs"><span>{movement.from_branch?.name ?? "-"}</span><MoveRight className="size-3" /><span>{movement.to_branch?.name ?? "-"}</span></div></TableCell>
                    <TableCell>{movement.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Current Stock Report</CardTitle>
            <CardDescription>Live data from Supabase view `current_stock_summary`.</CardDescription>
          </div>
          <Button variant="outline" size="icon" aria-label="Refresh inventory" onClick={loadStock}><RefreshCw /></Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Inventory load failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search product, category, branch..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Select value={branch} onValueChange={(value) => setBranch(value ?? "all")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((branchName) => <SelectItem key={branchName} value={branchName}>{branchName}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>In Stock</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">Loading inventory...</TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No inventory rows found.</TableCell></TableRow>
              ) : filteredRows.map((row) => (
                <TableRow key={`${row.product_id}-${row.branch_id}`}>
                  <TableCell><div className="font-medium">{row.product_name}</div><div className="text-xs text-muted-foreground">{row.brand} {row.model} • {row.category}</div></TableCell>
                  <TableCell>{row.branch_name}</TableCell>
                  <TableCell><Badge variant={row.is_low_stock ? "destructive" : "secondary"}>{row.in_stock}</Badge></TableCell>
                  <TableCell>{row.reserved}</TableCell>
                  <TableCell>{row.sold}</TableCell>
                  <TableCell>{money.format(Number(row.stock_value_tzs))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

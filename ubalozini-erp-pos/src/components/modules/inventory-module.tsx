"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, CircleAlert, RefreshCw, Search, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/data/mock-data";
import { createClient } from "@/lib/supabase/client";

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

export function InventoryModule() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStock() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: stockError } = await supabase
      .from("current_stock_summary")
      .select("*")
      .order("branch_name")
      .order("product_name");
    setLoading(false);

    if (stockError) {
      setError(stockError.message);
      return;
    }
    setRows((data ?? []) as StockRow[]);
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

  return (
    <AppShell>
      <PageHeader title="Inventory Management" description="Real time stock, low stock alerts, stock value, and branch-level inventory visibility." />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Current Stock" value={String(totalInStock)} note="Available IMEI devices in selected view" icon={Boxes} />
        <StatCard title="Stock Value" value={money.format(totalValue)} note="Purchase value for in-stock devices" icon={WalletCards} />
        <StatCard title="Low Stock Items" value={String(lowStock)} note="Products at or below threshold" icon={CircleAlert} />
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Boxes, Building2, CircleAlert, ReceiptText, RefreshCw, TrendingUp, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/data/mock-data";
import { createClient } from "@/lib/supabase/client";

type BranchRow = { id: string; name: string; location: string; status: string };
type SaleRow = { id: string; total_tzs: number; sold_at: string; branches: { name: string } | null };
type StockRow = { in_stock: number; stock_value_tzs: number; is_low_stock: boolean };
type DebtRow = { outstanding_amount_tzs: number; status: string };
type DeviceRow = {
  id: string;
  imei_number: string;
  status: string;
  profit_tzs: number | null;
  created_at: string;
  products: { name: string } | null;
};

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysAgo(days: number) {
  const date = startOfDay();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export function DashboardModule() {
  const supabase = useMemo(() => createClient(), []);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const [branchResult, saleResult, stockResult, debtResult, deviceResult] = await Promise.all([
      supabase.from("branches").select("id,name,location,status").order("name"),
      supabase.from("sales").select("id,total_tzs,sold_at,branches(name)").gte("sold_at", daysAgo(30)).order("sold_at", { ascending: false }),
      supabase.from("current_stock_summary").select("in_stock,stock_value_tzs,is_low_stock"),
      supabase.from("customer_debts").select("outstanding_amount_tzs,status"),
      supabase.from("imei_devices").select("id,imei_number,status,profit_tzs,created_at,products(name)").order("updated_at", { ascending: false }).limit(5),
    ]);

    setLoading(false);
    const firstError = branchResult.error || saleResult.error || stockResult.error || debtResult.error || deviceResult.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    setBranches((branchResult.data ?? []) as BranchRow[]);
    setSales((saleResult.data ?? []) as unknown as SaleRow[]);
    setStock((stockResult.data ?? []) as StockRow[]);
    setDebts((debtResult.data ?? []) as DebtRow[]);
    setDevices((deviceResult.data ?? []) as unknown as DeviceRow[]);
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const today = startOfDay().toISOString();
  const week = daysAgo(7);
  const totalSalesToday = sales.filter((sale) => sale.sold_at >= today).reduce((sum, sale) => sum + Number(sale.total_tzs), 0);
  const weeklySales = sales.filter((sale) => sale.sold_at >= week).reduce((sum, sale) => sum + Number(sale.total_tzs), 0);
  const monthlySales = sales.reduce((sum, sale) => sum + Number(sale.total_tzs), 0);
  const inventoryValue = stock.reduce((sum, row) => sum + Number(row.stock_value_tzs), 0);
  const lowStock = stock.filter((row) => row.is_low_stock).length;
  const customerDebts = debts
    .filter((debt) => debt.status !== "paid" && debt.status !== "cancelled")
    .reduce((sum, debt) => sum + Number(debt.outstanding_amount_tzs), 0);

  const branchSales = branches.map((branch) => {
    const total = sales.filter((sale) => sale.branches?.name === branch.name).reduce((sum, sale) => sum + Number(sale.total_tzs), 0);
    return { ...branch, total };
  });
  const maxBranchSales = Math.max(...branchSales.map((branch) => branch.total), 1);

  return (
    <AppShell>
      <PageHeader title="Dashboard" description="Live operating view for sales, branch performance, inventory value, low stock, and customer debts." />
      {error ? <Alert variant="destructive" className="mb-4"><AlertCircle /><AlertTitle>Dashboard load failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={loadDashboard}><RefreshCw data-icon="inline-start" /> Refresh</Button>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Sales Today" value={loading ? "Loading..." : money.format(totalSalesToday)} note="Completed sales today" icon={ReceiptText} />
        <StatCard title="Monthly Sales" value={loading ? "Loading..." : money.format(monthlySales)} note="Last 30 days" icon={TrendingUp} />
        <StatCard title="Inventory Value" value={loading ? "Loading..." : money.format(inventoryValue)} note="In-stock device purchase value" icon={Boxes} />
        <StatCard title="Customer Debts" value={loading ? "Loading..." : money.format(customerDebts)} note="Outstanding credit balance" icon={WalletCards} />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Branch Performance</CardTitle><CardDescription>Sales contribution from the last 30 days.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-5">
            {branchSales.length === 0 ? <div className="text-sm text-muted-foreground">No branches found.</div> : branchSales.map((branch) => (
              <div key={branch.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="font-medium">{branch.name}</p><p className="text-xs text-muted-foreground">{branch.location}</p></div>
                  <Badge variant="secondary">{money.format(branch.total)}</Badge>
                </div>
                <Progress value={(branch.total / maxBranchSales) * 100} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent IMEI Activity</CardTitle><CardDescription>Latest device records and profitability.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Status</TableHead><TableHead>Profit</TableHead></TableRow></TableHeader>
              <TableBody>
                {devices.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-muted-foreground">No IMEI activity found.</TableCell></TableRow>
                ) : devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell><div className="font-medium">{device.products?.name ?? "Unknown device"}</div><div className="font-mono text-xs text-muted-foreground">{device.imei_number}</div></TableCell>
                    <TableCell><Badge>{device.status}</Badge></TableCell>
                    <TableCell>{money.format(Number(device.profit_tzs ?? 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard title="Active Branches" value={String(branches.filter((branch) => branch.status === "active").length)} note="Branches available for operations" icon={Building2} />
        <StatCard title="Low Stock Products" value={String(lowStock)} note="Rows at or below product threshold" icon={CircleAlert} />
        <StatCard title="Weekly Sales" value={money.format(weeklySales)} note="Rolling 7 day performance" icon={TrendingUp} />
      </section>
    </AppShell>
  );
}

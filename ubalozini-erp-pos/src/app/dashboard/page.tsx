import { Boxes, Building2, CircleAlert, ReceiptText, TrendingUp, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { branches, customers, imeiDevices, money, products } from "@/lib/data/mock-data";

export default function DashboardPage() {
  const totalSales = branches.reduce((sum, branch) => sum + branch.salesToday, 0);
  const inventoryValue = branches.reduce((sum, branch) => sum + branch.inventoryValue, 0);
  const debts = customers.reduce((sum, customer) => sum + customer.outstandingBalance, 0);
  const lowStock = products.filter((product) => product.stock <= product.lowStockThreshold).length;

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Live operating view for sales, branch performance, inventory value, low stock, and customer debts."
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Sales Today" value={money.format(totalSales)} note="Across 3 active branches" icon={ReceiptText} />
        <StatCard title="Monthly Sales" value={money.format(286400000)} note="Projected from current run rate" icon={TrendingUp} />
        <StatCard title="Inventory Value" value={money.format(inventoryValue)} note="Phones, accessories, spare parts" icon={Boxes} />
        <StatCard title="Customer Debts" value={money.format(debts)} note="Credit sales outstanding" icon={WalletCards} />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Branch Performance</CardTitle>
            <CardDescription>Today sales contribution and stock risk by location.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {branches.map((branch) => (
              <div key={branch.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-xs text-muted-foreground">{branch.location}</p>
                  </div>
                  <Badge variant="secondary">{money.format(branch.salesToday)}</Badge>
                </div>
                <Progress value={(branch.salesToday / totalSales) * 100} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent IMEI Activity</CardTitle>
            <CardDescription>Device level traceability for phones.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imeiDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="font-medium">{device.productName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{device.imeiNumber}</div>
                    </TableCell>
                    <TableCell><Badge>{device.status}</Badge></TableCell>
                    <TableCell>{money.format(device.profitTzs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard title="Active Branches" value="3" note="Lumumba, Sokoni, Kariakoo" icon={Building2} />
        <StatCard title="Low Stock Products" value={String(lowStock)} note="Needs purchase or transfer action" icon={CircleAlert} />
        <StatCard title="Weekly Sales" value={money.format(49400000)} note="Rolling 7 day performance" icon={TrendingUp} />
      </section>
    </AppShell>
  );
}

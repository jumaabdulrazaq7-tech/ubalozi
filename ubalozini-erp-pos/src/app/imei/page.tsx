import { CheckCircle2, History, Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aed, branches, imeiDevices, money, products } from "@/lib/data/mock-data";

export default function ImeiPage() {
  return (
    <AppShell>
      <PageHeader title="IMEI Device Management" description="Track every phone individually from purchase in AED to sale in TZS, warranty, status, and history." actionLabel="Register IMEI" />
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Register Device</CardTitle><CardDescription>TZS cost is calculated as AED purchase price x exchange rate.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5">
              <FieldGroup>
                <Field><FieldLabel>Product</FieldLabel><Select defaultValue={products[0]?.id}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{products.filter((p) => p.category === "Phones").map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>IMEI Number</FieldLabel><Input placeholder="356789112345671" /></Field><Field><FieldLabel>Serial Number</FieldLabel><Input placeholder="F7QXK2UB15PM" /></Field></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Purchase Price AED</FieldLabel><Input placeholder="3100" /></Field><Field><FieldLabel>Exchange Rate</FieldLabel><Input placeholder="710" /></Field></div>
                <Field><FieldLabel>Branch</FieldLabel><Select defaultValue="Lumumba"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{branches.map((branch) => <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>Supplier</FieldLabel><Input placeholder="Dubai Mobile Hub" /></Field><Field><FieldLabel>Warranty Period</FieldLabel><Input placeholder="12 months" /></Field></div>
              </FieldGroup>
              <Button type="button">Save IMEI Device</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>IMEI Verification</CardTitle><CardDescription>Search exact IMEI before sale, transfer, return, or warranty claim.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Scan or type IMEI number" className="pl-10" /></div>
            <Table>
              <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Cost</TableHead><TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead>History</TableHead></TableRow></TableHeader>
              <TableBody>
                {imeiDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell><div className="font-medium">{device.productName}</div><div className="font-mono text-xs text-muted-foreground">{device.imeiNumber}</div></TableCell>
                    <TableCell><div>{aed.format(device.purchasePriceAed)}</div><div className="text-xs text-muted-foreground">{money.format(device.purchasePriceTzs)}</div></TableCell>
                    <TableCell>{device.branch}</TableCell>
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

import { ImagePlus, Pencil, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { products } from "@/lib/data/mock-data";

export default function ProductsPage() {
  return (
    <AppShell>
      <PageHeader title="Product Management" description="Manage phones, accessories, spare parts, barcodes, QR codes, and product media." actionLabel="Add Product" />
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Product Form</CardTitle><CardDescription>Supports product image upload through Supabase Storage.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5">
              <FieldGroup>
                <Field><FieldLabel>Product Name</FieldLabel><Input placeholder="iPhone 15 Pro Max" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel>Brand</FieldLabel><Input placeholder="Apple" /></Field>
                  <Field><FieldLabel>Model</FieldLabel><Input placeholder="A3106" /></Field>
                </div>
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select defaultValue="Phones"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Phones">Phones</SelectItem><SelectItem value="Accessories">Accessories</SelectItem><SelectItem value="Spare Parts">Spare Parts</SelectItem></SelectGroup></SelectContent></Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel>Barcode</FieldLabel><Input placeholder="UBZ-PHN-0001" /></Field>
                  <Field><FieldLabel>QR Code</FieldLabel><Input placeholder="QR-UBZ-PHN-0001" /></Field>
                </div>
                <Field><FieldLabel>Description</FieldLabel><Textarea placeholder="Device specifications and sale notes" /></Field>
              </FieldGroup>
              <div className="flex gap-2">
                <Button type="button"><ImagePlus data-icon="inline-start" /> Upload Image</Button>
                <Button type="button" variant="outline">Save Product</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>Searchable catalog with stock thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search product, brand, barcode, QR..." className="pl-10" />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Stock</TableHead><TableHead>Codes</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell><div className="font-medium">{product.name}</div><div className="text-xs text-muted-foreground">{product.brand} {product.model}</div></TableCell>
                    <TableCell><Badge variant="outline">{product.category}</Badge></TableCell>
                    <TableCell><Badge variant={product.stock <= product.lowStockThreshold ? "destructive" : "secondary"}>{product.stock}</Badge></TableCell>
                    <TableCell><div className="font-mono text-xs">{product.barcode}</div><div className="font-mono text-xs text-muted-foreground">{product.qrCode}</div></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" aria-label="Edit"><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Delete"><Trash2 /></Button></TableCell>
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

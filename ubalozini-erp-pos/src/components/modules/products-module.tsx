"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, ImagePlus, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { CameraScanner } from "@/components/app/camera-scanner";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { ProductCategory } from "@/types/erp";

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: ProductCategory;
  barcode: string;
  qr_code: string;
  description: string | null;
  low_stock_threshold: number;
};

type StockCount = Record<string, number>;

const emptyForm = {
  name: "",
  brand: "",
  model: "",
  category: "Phones" as ProductCategory,
  barcode: "",
  qr_code: "",
  description: "",
  low_stock_threshold: "3",
};

export function ProductsModule() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stockCount, setStockCount] = useState<StockCount>({});
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [{ data, error: productsError }, { data: stockRows, error: stockError }] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,brand,model,category,barcode,qr_code,description,low_stock_threshold")
        .eq("is_active", true)
        .order("name"),
      supabase.from("current_stock_summary").select("product_id,in_stock"),
    ]);
    setLoading(false);

    if (productsError || stockError) {
      setError(productsError?.message || stockError?.message || "Unable to load products.");
      return;
    }

    const counts: StockCount = {};
    (stockRows ?? []).forEach((row) => {
      counts[row.product_id] = (counts[row.product_id] ?? 0) + Number(row.in_stock ?? 0);
    });
    setStockCount(counts);
    setProducts((data ?? []) as ProductRow[]);
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function uploadProductImage(productId: string) {
    if (!supabase || !imageFile) return;
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${productId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(storagePath, imageFile, {
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { error: imageError } = await supabase.from("product_images").insert({
      product_id: productId,
      storage_bucket: "product-images",
      storage_path: storagePath,
      is_primary: true,
    });
    if (imageError) throw imageError;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      category: form.category,
      barcode: form.barcode.trim(),
      qr_code: form.qr_code.trim(),
      description: form.description.trim(),
      low_stock_threshold: Number(form.low_stock_threshold || 0),
    };

    try {
      const result = editingId
        ? await supabase.from("products").update(payload).eq("id", editingId).select("id").single()
        : await supabase.from("products").insert(payload).select("id").single();

      if (result.error) throw result.error;
      await uploadProductImage(result.data.id);

      setForm(emptyForm);
      setImageFile(null);
      setEditingId(null);
      setMessage(editingId ? "Product updated successfully." : "Product created successfully.");
      await loadProducts();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product action failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(productId: string) {
    if (!supabase) return;
    setError(null);
    setMessage(null);
    const { error: deleteError } = await supabase.from("products").update({ is_active: false }).eq("id", productId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setMessage("Product archived successfully.");
    await loadProducts();
  }

  function editProduct(product: ProductRow) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      brand: product.brand,
      model: product.model,
      category: product.category,
      barcode: product.barcode,
      qr_code: product.qr_code,
      description: product.description ?? "",
      low_stock_threshold: String(product.low_stock_threshold),
    });
  }

  const filteredProducts = products.filter((product) => {
    const needle = search.toLowerCase();
    return [product.name, product.brand, product.model, product.barcode, product.qr_code, product.category]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  return (
    <AppShell>
      <PageHeader title="Product Management" description="Manage phones, accessories, spare parts, barcodes, QR codes, and product media." actionLabel="Add Product" />
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Product Form</CardTitle><CardDescription>Creates catalog records and uploads optional product images.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Product action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
              {message ? <Alert><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
              <FieldGroup>
                <Field><FieldLabel>Product Name</FieldLabel><Input placeholder="iPhone 15 Pro Max" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel>Brand</FieldLabel><Input placeholder="Apple" value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} required /></Field>
                  <Field><FieldLabel>Model</FieldLabel><Input placeholder="A3106" value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} required /></Field>
                </div>
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as ProductCategory }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="Phones">Phones</SelectItem><SelectItem value="Accessories">Accessories</SelectItem><SelectItem value="Spare Parts">Spare Parts</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel>Barcode</FieldLabel><div className="flex gap-2"><Input placeholder="UBZ-PHN-0001" value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} required /><CameraScanner label="Camera" onScan={(value) => setForm((current) => ({ ...current, barcode: value }))} /></div></Field>
                  <Field><FieldLabel>QR Code</FieldLabel><div className="flex gap-2"><Input placeholder="QR-UBZ-PHN-0001" value={form.qr_code} onChange={(event) => setForm((current) => ({ ...current, qr_code: event.target.value }))} required /><CameraScanner label="Camera" onScan={(value) => setForm((current) => ({ ...current, qr_code: value }))} /></div></Field>
                </div>
                <Field><FieldLabel>Description</FieldLabel><Textarea placeholder="Device specifications and sale notes" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
                <Field><FieldLabel>Low Stock Threshold</FieldLabel><Input type="number" min="0" value={form.low_stock_threshold} onChange={(event) => setForm((current) => ({ ...current, low_stock_threshold: event.target.value }))} /></Field>
                <Field><FieldLabel>Product Image</FieldLabel><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></Field>
              </FieldGroup>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}><ImagePlus data-icon="inline-start" /> {saving ? "Saving..." : "Save Product"}</Button>
                {editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</Button> : null}
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Products</CardTitle>
              <CardDescription>Searchable live catalog with branch stock totals from inventory and IMEI devices.</CardDescription>
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh products" onClick={loadProducts}><RefreshCw /></Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search product, brand, barcode, QR..." className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />
              </div>
              <CameraScanner label="Camera" onScan={setSearch} />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Stock</TableHead><TableHead>Codes</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">Loading products...</TableCell></TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No products found.</TableCell></TableRow>
                ) : filteredProducts.map((product) => {
                  const stock = stockCount[product.id] ?? 0;
                  return (
                    <TableRow key={product.id}>
                      <TableCell><div className="font-medium">{product.name}</div><div className="text-xs text-muted-foreground">{product.brand} {product.model}</div></TableCell>
                      <TableCell><Badge variant="outline">{product.category}</Badge></TableCell>
                      <TableCell><Badge variant={stock <= product.low_stock_threshold ? "destructive" : "secondary"}>{stock}</Badge></TableCell>
                      <TableCell><div className="font-mono text-xs">{product.barcode}</div><div className="font-mono text-xs text-muted-foreground">{product.qr_code}</div></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon" aria-label="Edit" onClick={() => editProduct(product)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Delete" onClick={() => deleteProduct(product.id)}><Trash2 /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

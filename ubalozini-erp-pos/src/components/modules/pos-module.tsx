"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, ReceiptText, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { money } from "@/lib/data/mock-data";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/types/erp";

type Branch = { id: string; name: string };
type Customer = { id: string; name: string; phone: string };
type Product = { id: string; name: string; brand: string; model: string; category: string; barcode: string; qr_code: string; stock_available?: number };
type Device = {
  id: string;
  product_id: string;
  imei_number: string;
  serial_number: string | null;
  selling_price_tzs: number | null;
  products: { name: string; brand: string; model: string } | null;
};
type CartItem = {
  product_id: string;
  product_name: string;
  imei_device_id: string | null;
  imei_number: string | null;
  quantity: number;
  unit_price_tzs: number;
};
type SaleResult = {
  sale_id: string;
  invoice_number: string;
  receipt_number: string;
  total_tzs: number;
  paid_tzs: number;
  balance_tzs: number;
};

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function PosModule() {
  const supabase = useMemo(() => createClient(), []);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("walk-in");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [reference, setReference] = useState("");
  const [discount, setDiscount] = useState("0");
  const [loading, setLoading] = useState(true);
  const [sellingPrice, setSellingPrice] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price_tzs, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);
  const paid = Number(amountPaid || 0);
  const balance = total - paid;

  async function loadData(selectedBranchId = branchId) {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const [branchResult, customerResult, productResult, stockResult] = await Promise.all([
      supabase.from("branches").select("id,name").eq("status", "active").order("name"),
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.from("products").select("id,name,brand,model,category,barcode,qr_code").eq("is_active", true).order("name"),
      selectedBranchId
        ? supabase.from("current_stock_summary").select("product_id,in_stock").eq("branch_id", selectedBranchId)
        : supabase.from("current_stock_summary").select("product_id,in_stock").limit(0),
    ]);

    if (branchResult.error || customerResult.error || productResult.error || stockResult.error) {
      setLoading(false);
      setError(branchResult.error?.message || customerResult.error?.message || productResult.error?.message || stockResult.error?.message || "Unable to load POS data.");
      return;
    }

    const loadedBranches = (branchResult.data ?? []) as Branch[];
    const nextBranchId = selectedBranchId || loadedBranches[0]?.id || "";
    let productStock = new Map<string, number>((stockResult.data ?? []).map((row) => [row.product_id as string, Number(row.in_stock ?? 0)]));
    if (!selectedBranchId && nextBranchId) {
      const { data: nextStock, error: nextStockError } = await supabase.from("current_stock_summary").select("product_id,in_stock").eq("branch_id", nextBranchId);
      if (nextStockError) {
        setLoading(false);
        setError(nextStockError.message);
        return;
      }
      productStock = new Map((nextStock ?? []).map((row) => [row.product_id as string, Number(row.in_stock ?? 0)]));
    }
    setBranches(loadedBranches);
    setCustomers((customerResult.data ?? []) as Customer[]);
    setProducts(((productResult.data ?? []) as Product[]).map((product) => ({ ...product, stock_available: productStock.get(product.id) ?? 0 })));
    setBranchId(nextBranchId);

    if (nextBranchId) {
      const { data, error: deviceError } = await supabase
        .from("imei_devices")
        .select("id,product_id,imei_number,serial_number,selling_price_tzs,products(name,brand,model)")
        .eq("branch_id", nextBranchId)
        .eq("status", "In Stock")
        .order("created_at", { ascending: false });

      if (deviceError) {
        setError(deviceError.message);
      } else {
        setDevices((data ?? []) as unknown as Device[]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function handleBranchChange(value: string | null) {
    const nextBranch = value ?? "";
    setBranchId(nextBranch);
    setCart([]);
    await loadData(nextBranch);
  }

  function addProduct(product: Product) {
    const price = Number(sellingPrice[product.id] || 0);
    if (!price) {
      setError("Enter selling price before adding product.");
      return;
    }
    const inCart = cart.filter((item) => item.product_id === product.id && !item.imei_device_id).reduce((sum, item) => sum + item.quantity, 0);
    if ((product.stock_available ?? 0) - inCart <= 0) {
      setError("This product does not have enough stock in the selected branch.");
      return;
    }
    setError(null);
    setCart((current) => [
      ...current,
      {
        product_id: product.id,
        product_name: product.name,
        imei_device_id: null,
        imei_number: null,
        quantity: 1,
        unit_price_tzs: price,
      },
    ]);
  }

  function addDevice(device: Device) {
    const price = Number(sellingPrice[device.id] || device.selling_price_tzs || 0);
    if (!price) {
      setError("Enter selling price before adding IMEI device.");
      return;
    }
    setError(null);
    setCart((current) => {
      if (current.some((item) => item.imei_device_id === device.id)) return current;
      return [
        ...current,
        {
          product_id: device.product_id,
          product_name: device.products?.name ?? "Phone",
          imei_device_id: device.id,
          imei_number: device.imei_number,
          quantity: 1,
          unit_price_tzs: price,
        },
      ];
    });
  }

  function removeCartItem(index: number) {
    setCart((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (cart.length === 0) {
      setError("Add at least one item to cart.");
      return;
    }
    if (paid < 0) {
      setError("Payment amount cannot be negative.");
      return;
    }
    if (paid > total) {
      setError("Payment cannot exceed sale total.");
      return;
    }
    if (balance > 0 && customerId === "walk-in") {
      setError("Credit sale requires selecting a customer.");
      return;
    }
    if (balance > 0 && !dueDate) {
      setError("Credit sale requires a due date.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSaleResult(null);

    const { data, error: rpcError } = await supabase.rpc("create_pos_sale", {
      p_branch_id: branchId,
      p_customer_id: customerId === "walk-in" ? null : customerId,
      p_items: cart.map((item) => ({
        product_id: item.product_id,
        imei_device_id: item.imei_device_id,
        quantity: item.quantity,
        unit_price_tzs: item.unit_price_tzs,
      })),
      p_payments: [
        {
          method: paymentMethod,
          amount_tzs: paid,
          reference,
        },
      ],
      p_discount_tzs: Number(discount || 0),
      p_tax_tzs: 0,
      p_due_date: balance > 0 ? dueDate : null,
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setSaleResult(result as SaleResult);
    setCart([]);
    setAmountPaid("");
    setReference("");
    setDueDate(defaultDueDate());
    await loadData(branchId);
  }

  const filteredProducts = products.filter((product) => {
    if (product.category === "Phones") return false;
    const needle = search.toLowerCase();
    return [product.name, product.brand, product.model, product.barcode, product.qr_code].join(" ").toLowerCase().includes(needle);
  });

  const filteredDevices = devices.filter((device) => {
    const needle = search.toLowerCase();
    return [device.imei_number, device.serial_number ?? "", device.products?.name ?? ""].join(" ").toLowerCase().includes(needle);
  });

  return (
    <AppShell>
      <PageHeader title="Sales POS" description="Fast sales screen for IMEI phones, accessories, payments, invoices, receipts, and automatic stock deduction." />
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Product and IMEI Search</CardTitle>
                <CardDescription>Select a branch, scan/search item, enter price, then add to cart.</CardDescription>
              </div>
              <Button variant="outline" size="icon" aria-label="Refresh POS data" onClick={() => loadData(branchId)}><RefreshCw /></Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>POS error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
              <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                <Select value={branchId} onValueChange={handleBranchChange}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent><SelectGroup>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search barcode, QR, product, serial, or IMEI" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />
                  </div>
                  <CameraScanner label="Camera" onScan={setSearch} />
                </div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Available Phones by IMEI</TableHead><TableHead>IMEI</TableHead><TableHead>Selling Price</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={4} className="text-muted-foreground">Loading phones...</TableCell></TableRow> : filteredDevices.length === 0 ? <TableRow><TableCell colSpan={4} className="text-muted-foreground">No available IMEI phones found.</TableCell></TableRow> : filteredDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell><div className="font-medium">{device.products?.name}</div><div className="text-xs text-muted-foreground">{device.products?.brand} {device.products?.model}</div></TableCell>
                      <TableCell className="font-mono text-xs">{device.imei_number}</TableCell>
                      <TableCell><Input type="number" min="0" placeholder="TZS" value={sellingPrice[device.id] ?? ""} onChange={(event) => setSellingPrice((current) => ({ ...current, [device.id]: event.target.value }))} /></TableCell>
                      <TableCell><Button size="sm" onClick={() => addDevice(device)}><Plus data-icon="inline-start" /> Add</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table>
                <TableHeader><TableRow><TableHead>Accessories and Spare Parts</TableHead><TableHead>Codes</TableHead><TableHead>Selling Price</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? <TableRow><TableCell colSpan={4} className="text-muted-foreground">No accessory/spare product found.</TableCell></TableRow> : filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell><div className="font-medium">{product.name}</div><div className="text-xs text-muted-foreground">{product.brand} {product.model}</div><Badge variant={(product.stock_available ?? 0) > 0 ? "secondary" : "destructive"} className="mt-1">Stock {product.stock_available ?? 0}</Badge></TableCell>
                      <TableCell><div className="font-mono text-xs">{product.barcode}</div><div className="font-mono text-xs text-muted-foreground">{product.qr_code}</div></TableCell>
                      <TableCell><Input type="number" min="0" placeholder="TZS" value={sellingPrice[product.id] ?? ""} onChange={(event) => setSellingPrice((current) => ({ ...current, [product.id]: event.target.value }))} /></TableCell>
                      <TableCell><Button size="sm" onClick={() => addProduct(product)} disabled={(product.stock_available ?? 0) <= cart.filter((item) => item.product_id === product.id && !item.imei_device_id).reduce((sum, item) => sum + item.quantity, 0)}><Plus data-icon="inline-start" /> Add</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="size-4" /> Cart and Payment</CardTitle><CardDescription>Complete sale and generate invoice/receipt numbers.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={submitSale}>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {cart.length === 0 ? <TableRow><TableCell colSpan={3} className="text-muted-foreground">Cart is empty.</TableCell></TableRow> : cart.map((item, index) => (
                    <TableRow key={`${item.product_id}-${item.imei_device_id ?? index}`}>
                      <TableCell><div className="font-medium">{item.product_name}</div>{item.imei_number ? <Badge variant="outline" className="mt-1 font-mono">{item.imei_number}</Badge> : <div className="text-xs text-muted-foreground">Qty {item.quantity}</div>}</TableCell>
                      <TableCell>{money.format(item.quantity * item.unit_price_tzs)}</TableCell>
                      <TableCell><Button type="button" variant="ghost" size="icon" aria-label="Remove item" onClick={() => removeCartItem(index)}><Trash2 /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <FieldGroup>
                <Field>
                  <FieldLabel>Customer</FieldLabel>
                  <Select value={customerId} onValueChange={(value) => setCustomerId(value ?? "walk-in")}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>{customer.name} - {customer.phone}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field><FieldLabel>Discount TZS</FieldLabel><Input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} /></Field>
                <Field>
                  <FieldLabel>Payment Method</FieldLabel>
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod((value ?? "Cash") as PaymentMethod)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Mobile Money">Mobile Money</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field><FieldLabel>Amount Paid TZS</FieldLabel><Input type="number" min="0" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} /></Field>
                {balance > 0 ? <Field><FieldLabel>Credit Due Date</FieldLabel><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></Field> : null}
                <Field><FieldLabel>Payment Reference</FieldLabel><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional reference" /></Field>
              </FieldGroup>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>
                <div className="flex justify-between"><span>Discount</span><strong>{money.format(Number(discount || 0))}</strong></div>
                <div className="flex justify-between text-base"><span>Total</span><strong>{money.format(total)}</strong></div>
                <div className="flex justify-between"><span>Balance</span><strong className={balance > 0 ? "text-destructive" : ""}>{money.format(balance)}</strong></div>
                {balance > 0 ? <div className="mt-2 text-xs text-muted-foreground">Credit balance will be saved in Debt Management.</div> : null}
              </div>
              <Button type="submit" disabled={submitting || cart.length === 0}>{submitting ? "Completing sale..." : "Complete Sale"}</Button>
              {saleResult ? (
                <Alert>
                  <ReceiptText />
                  <AlertTitle>Sale completed</AlertTitle>
                  <AlertDescription>
                    Invoice {saleResult.invoice_number} • Receipt {saleResult.receipt_number} • Total {money.format(saleResult.total_tzs)}
                  </AlertDescription>
                </Alert>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

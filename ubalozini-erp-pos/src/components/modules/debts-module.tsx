"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Banknote, CalendarClock, CheckCircle2, RefreshCw, Search, WalletCards } from "lucide-react";
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
import { money } from "@/lib/data/mock-data";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/types/erp";

type DebtRow = {
  id: string;
  original_amount_tzs: number;
  outstanding_amount_tzs: number;
  due_date: string;
  status: string;
  created_at: string;
  customers: { name: string; phone: string } | null;
  sales: {
    invoice_number: string;
    total_tzs: number;
    paid_tzs: number;
    sold_at: string;
    branches: { name: string } | null;
  } | null;
};

type PaymentRow = {
  id: string;
  method: PaymentMethod;
  amount_tzs: number;
  reference: string | null;
  paid_at: string;
  profiles: { full_name: string } | null;
};

export function DebtsModule() {
  const supabase = useMemo(() => createClient(), []);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDebt = debts.find((debt) => debt.id === selectedDebtId) ?? debts[0] ?? null;

  async function loadDebts(nextSelectedId = selectedDebtId) {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { data, error: debtError } = await supabase
      .from("customer_debts")
      .select("id,original_amount_tzs,outstanding_amount_tzs,due_date,status,created_at,customers(name,phone),sales(invoice_number,total_tzs,paid_tzs,sold_at,branches(name))")
      .order("due_date", { ascending: true });

    setLoading(false);

    if (debtError) {
      setError(debtError.message);
      return;
    }

    const rows = (data ?? []) as unknown as DebtRow[];
    setDebts(rows);
    setSelectedDebtId(nextSelectedId || rows[0]?.id || null);
  }

  async function loadPayments(debtId: string | null) {
    if (!supabase || !debtId) {
      setPayments([]);
      return;
    }
    setLoadingPayments(true);
    const { data, error: paymentError } = await supabase
      .from("debt_payments")
      .select("id,method,amount_tzs,reference,paid_at,profiles(full_name)")
      .eq("debt_id", debtId)
      .order("paid_at", { ascending: false });
    setLoadingPayments(false);

    if (paymentError) {
      setError(paymentError.message);
      return;
    }

    setPayments((data ?? []) as unknown as PaymentRow[]);
  }

  useEffect(() => {
    loadDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    loadPayments(selectedDebt?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDebt?.id, supabase]);

  async function collectPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedDebt) return;
    const paymentAmount = Number(amount || 0);
    if (paymentAmount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }
    if (paymentAmount > Number(selectedDebt.outstanding_amount_tzs)) {
      setError("Payment cannot exceed outstanding balance.");
      return;
    }

    setCollecting(true);
    setError(null);
    setMessage(null);
    const { error: rpcError } = await supabase.rpc("collect_debt_payment", {
      p_debt_id: selectedDebt.id,
      p_method: method,
      p_amount_tzs: paymentAmount,
      p_reference: reference,
    });
    setCollecting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setAmount("");
    setReference("");
    setMessage("Debt payment collected successfully.");
    await loadDebts(selectedDebt.id);
    await loadPayments(selectedDebt.id);
  }

  const activeDebts = debts.filter((debt) => debt.status !== "paid" && debt.status !== "cancelled");
  const totalDebts = activeDebts.reduce((sum, debt) => sum + Number(debt.outstanding_amount_tzs), 0);
  const collectedDebts = debts.reduce((sum, debt) => sum + Math.max(Number(debt.original_amount_tzs) - Number(debt.outstanding_amount_tzs), 0), 0);
  const overdueDebts = activeDebts.filter((debt) => new Date(debt.due_date) < new Date(new Date().toISOString().slice(0, 10)));
  const overdueAmount = overdueDebts.reduce((sum, debt) => sum + Number(debt.outstanding_amount_tzs), 0);

  const filteredDebts = debts.filter((debt) => {
    const needle = search.toLowerCase();
    return [
      debt.customers?.name ?? "",
      debt.customers?.phone ?? "",
      debt.sales?.invoice_number ?? "",
      debt.sales?.branches?.name ?? "",
      debt.status,
    ].join(" ").toLowerCase().includes(needle);
  });

  return (
    <AppShell>
      <PageHeader title="Debt Management" description="Track customer credit sales, due dates, payment collection, and debt history." actionLabel="Collect Payment" />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Debts" value={money.format(totalDebts)} note={`${activeDebts.length} active credit records`} icon={WalletCards} />
        <StatCard title="Overdue Debts" value={money.format(overdueAmount)} note={`${overdueDebts.length} records past due date`} icon={CalendarClock} />
        <StatCard title="Collected Debts" value={money.format(collectedDebts)} note="Payments collected against credit sales" icon={CheckCircle2} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Outstanding Balances</CardTitle>
              <CardDescription>Credit sales generated automatically from POS partial payments.</CardDescription>
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh debts" onClick={() => loadDebts(selectedDebt?.id)}><RefreshCw /></Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Debt action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
            {message ? <Alert><CheckCircle2 /><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search customer, phone, invoice, branch..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Invoice</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead>Outstanding</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">Loading debts...</TableCell></TableRow>
                ) : filteredDebts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No debt records found.</TableCell></TableRow>
                ) : filteredDebts.map((debt) => {
                  const isOverdue = debt.status !== "paid" && new Date(debt.due_date) < new Date(new Date().toISOString().slice(0, 10));
                  return (
                    <TableRow key={debt.id} className={selectedDebt?.id === debt.id ? "bg-muted/50" : ""}>
                      <TableCell>
                        <button type="button" className="text-left" onClick={() => setSelectedDebtId(debt.id)}>
                          <div className="font-medium">{debt.customers?.name ?? "Unknown customer"}</div>
                          <div className="text-xs text-muted-foreground">{debt.customers?.phone ?? "-"}</div>
                        </button>
                      </TableCell>
                      <TableCell><div className="font-medium">{debt.sales?.invoice_number ?? "-"}</div><div className="text-xs text-muted-foreground">{debt.sales?.branches?.name ?? "-"}</div></TableCell>
                      <TableCell>{new Date(debt.due_date).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={debt.status === "paid" ? "secondary" : isOverdue ? "destructive" : "outline"}>{isOverdue ? "overdue" : debt.status}</Badge></TableCell>
                      <TableCell>{money.format(Number(debt.outstanding_amount_tzs))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="size-4" /> Payment Collection</CardTitle><CardDescription>Collect partial or full payments from the selected debt.</CardDescription></CardHeader>
            <CardContent>
              {selectedDebt ? (
                <form className="flex flex-col gap-4" onSubmit={collectPayment}>
                  <div className="rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">Selected debt</div>
                    <div className="mt-1 font-semibold">{selectedDebt.customers?.name ?? "Unknown customer"}</div>
                    <div className="mt-2 flex justify-between text-sm"><span>Invoice</span><strong>{selectedDebt.sales?.invoice_number ?? "-"}</strong></div>
                    <div className="flex justify-between text-sm"><span>Outstanding</span><strong>{money.format(Number(selectedDebt.outstanding_amount_tzs))}</strong></div>
                  </div>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Payment Method</FieldLabel>
                      <Select value={method} onValueChange={(value) => setMethod((value ?? "Cash") as PaymentMethod)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectGroup><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Mobile Money">Mobile Money</SelectItem></SelectGroup></SelectContent>
                      </Select>
                    </Field>
                    <Field><FieldLabel>Amount TZS</FieldLabel><Input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} required /></Field>
                    <Field><FieldLabel>Reference</FieldLabel><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional transaction reference" /></Field>
                  </FieldGroup>
                  <Button type="submit" disabled={collecting || selectedDebt.status === "paid"}>{collecting ? "Collecting..." : "Collect Payment"}</Button>
                </form>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">No debt selected.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment History</CardTitle><CardDescription>Collections recorded for the selected debt.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loadingPayments ? (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">Loading payments...</TableCell></TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">No payments collected yet.</TableCell></TableRow>
                  ) : payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell><div>{new Date(payment.paid_at).toLocaleDateString()}</div><div className="text-xs text-muted-foreground">{payment.reference ?? "No reference"}</div></TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell>{money.format(Number(payment.amount_tzs))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

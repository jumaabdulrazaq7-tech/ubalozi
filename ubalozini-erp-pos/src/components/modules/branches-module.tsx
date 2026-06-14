"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Pencil, Plus, RefreshCw } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import type { BranchStatus } from "@/types/erp";

type BranchRow = {
  id: string;
  name: string;
  location: string;
  code: string;
  status: BranchStatus;
};

const emptyForm = {
  name: "",
  location: "",
  code: "",
  status: "active" as BranchStatus,
};

export function BranchesModule() {
  const supabase = useMemo(() => createClient(), []);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBranches() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("branches")
      .select("id,name,location,code,status")
      .order("name");
    setLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setBranches((data ?? []) as BranchRow[]);
  }

  useEffect(() => {
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      name: form.name.trim(),
      location: form.location.trim(),
      code: form.code.trim().toUpperCase(),
      status: form.status,
    };

    const result = editingId
      ? await supabase.from("branches").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("branches").insert(payload).select("id").single();

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setForm(emptyForm);
    setEditingId(null);
    setMessage(editingId ? "Branch updated successfully." : "Branch created successfully.");
    await loadBranches();
  }

  function editBranch(branch: BranchRow) {
    setEditingId(branch.id);
    setForm({
      name: branch.name,
      location: branch.location,
      code: branch.code,
      status: branch.status,
    });
  }

  return (
    <AppShell>
      <PageHeader title="Branch Management" description="Create, edit, view, and compare branch performance for every UBALOZINI location." actionLabel="Create Branch" />
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="size-4" /> Branch Form</CardTitle>
            <CardDescription>{editingId ? "Editing an existing branch record." : "Create a new operating branch."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Branch action failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {message ? (
                <Alert>
                  <AlertTitle>Saved</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}
              <FieldGroup>
                <Field><FieldLabel>Branch Name</FieldLabel><Input placeholder="Lumumba" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></Field>
                <Field><FieldLabel>Branch Location</FieldLabel><Input placeholder="Lumumba Street, Mwanza" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required /></Field>
                <Field><FieldLabel>Branch Code</FieldLabel><Input placeholder="LMB" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} required /></Field>
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as BranchStatus }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}><Plus data-icon="inline-start" /> {saving ? "Saving..." : "Save Branch"}</Button>
                {editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</Button> : null}
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Branches</CardTitle>
              <CardDescription>Live records from Supabase.</CardDescription>
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh branches" onClick={loadBranches}>
              <RefreshCw />
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead>Location</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">Loading branches...</TableCell></TableRow>
                ) : branches.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No branches found.</TableCell></TableRow>
                ) : branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell><div className="font-medium">{branch.name}</div></TableCell>
                    <TableCell className="font-mono">{branch.code}</TableCell>
                    <TableCell><Badge variant="secondary">{branch.status}</Badge></TableCell>
                    <TableCell>{branch.location}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" aria-label="Edit branch" onClick={() => editBranch(branch)}><Pencil /></Button></TableCell>
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

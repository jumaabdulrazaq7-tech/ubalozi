import { Building2, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { branches, money } from "@/lib/data/mock-data";

export default function BranchesPage() {
  return (
    <AppShell>
      <PageHeader title="Branch Management" description="Create, edit, view, and compare branch performance for every UBALOZINI location." actionLabel="Create Branch" />
      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="size-4" /> Branch Form</CardTitle>
            <CardDescription>Ready for Supabase insert/update actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5">
              <FieldGroup>
                <Field><FieldLabel>Branch Name</FieldLabel><Input placeholder="Lumumba" /></Field>
                <Field><FieldLabel>Branch Location</FieldLabel><Input placeholder="Lumumba Street, Mwanza" /></Field>
                <Field><FieldLabel>Branch Code</FieldLabel><Input placeholder="LMB" /></Field>
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select defaultValue="active">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectGroup></SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <Button type="button"><Plus data-icon="inline-start" /> Save Branch</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
            <CardDescription>Initial branches seeded in the database schema.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead>Sales Today</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell><div className="font-medium">{branch.name}</div><div className="text-xs text-muted-foreground">{branch.location}</div></TableCell>
                    <TableCell className="font-mono">{branch.code}</TableCell>
                    <TableCell><Badge variant="secondary">{branch.status}</Badge></TableCell>
                    <TableCell>{money.format(branch.salesToday)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" aria-label="Edit branch"><Pencil /></Button></TableCell>
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

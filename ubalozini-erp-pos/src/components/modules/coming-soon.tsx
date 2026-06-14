import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function ComingSoonModule({
  title,
  description,
  icon: Icon,
  items,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
}) {
  return (
    <AppShell>
      <PageHeader title={title} description={description} />
      <Card>
        <CardHeader><CardTitle>Phase 1 workflow shell</CardTitle><CardDescription>The route is wired and ready for Supabase mutations, reports, and scanner flows.</CardDescription></CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Icon /></EmptyMedia>
              <EmptyTitle>{title}</EmptyTitle>
              <EmptyDescription>{items.join(" • ")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </AppShell>
  );
}

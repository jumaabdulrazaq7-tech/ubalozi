import { ShieldCheck } from "lucide-react";
import { ComingSoonModule } from "@/components/modules/coming-soon";

export default function SettingsPage() {
  return <ComingSoonModule title="Settings" description="Roles, language, branches, currency defaults, and Supabase Auth administration." icon={ShieldCheck} items={["Admin", "Sales Person", "English", "Swahili"]} />;
}

import { Users } from "lucide-react";
import { ComingSoonModule } from "@/components/modules/coming-soon";

export default function CustomersPage() {
  return <ComingSoonModule title="Customer Management" description="Customer profiles, purchase history, warranty history, and branch relationship tracking." icon={Users} items={["Profile", "Purchase History", "Warranty History"]} />;
}

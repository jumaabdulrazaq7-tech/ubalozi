import { WalletCards } from "lucide-react";
import { ComingSoonModule } from "@/components/modules/coming-soon";

export default function DebtsPage() {
  return <ComingSoonModule title="Debt Management" description="Customer credit sales, outstanding balances, collections, payment history, and due date tracking." icon={WalletCards} items={["Total Debts", "Overdue Debts", "Collected Debts"]} />;
}

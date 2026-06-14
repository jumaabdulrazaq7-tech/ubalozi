import { Boxes } from "lucide-react";
import { ComingSoonModule } from "@/components/modules/coming-soon";

export default function InventoryPage() {
  return <ComingSoonModule title="Inventory Management" description="Real time stock, stock in/out, transfers, audits, low stock alerts, and stock valuation." icon={Boxes} items={["Current Stock", "Stock Value", "Low Stock Items"]} />;
}

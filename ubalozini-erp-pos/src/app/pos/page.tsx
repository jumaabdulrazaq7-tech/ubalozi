import { ReceiptText } from "lucide-react";
import { ComingSoonModule } from "@/components/modules/coming-soon";

export default function PosPage() {
  return <ComingSoonModule title="Sales POS" description="Fast sales screen with barcode, QR, IMEI selection, payments, invoices, receipts, and automatic stock deduction." icon={ReceiptText} items={["Cash", "Bank Transfer", "Mobile Money", "Receipt", "Invoice"]} />;
}

import { Wallet } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Ledger" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={Wallet} title="Ledger" />
      <Section title="Ledger">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

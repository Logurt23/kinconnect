import { Lock } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Vault" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={Lock} title="Vault" />
      <Section title="Vault">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

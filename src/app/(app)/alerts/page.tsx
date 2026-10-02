import { BellRing } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Alerts" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={BellRing} title="Alerts" />
      <Section title="Alerts">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

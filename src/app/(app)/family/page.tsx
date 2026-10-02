import { Users } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Family" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={Users} title="Family" />
      <Section title="Family">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

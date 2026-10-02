import { Gift } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Lists" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={Gift} title="Lists" />
      <Section title="Lists">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

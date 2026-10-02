import { Cake } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Dates" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={Cake} title="Dates" />
      <Section title="Dates">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

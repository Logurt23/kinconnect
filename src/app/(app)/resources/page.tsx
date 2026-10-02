import { Boxes } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Resources" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={Boxes} title="Resources" />
      <Section title="Resources">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

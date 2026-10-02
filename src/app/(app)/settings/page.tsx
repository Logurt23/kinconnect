import { Settings } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={Settings} title="Settings" />
      <Section title="Settings">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

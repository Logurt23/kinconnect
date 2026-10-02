import { HandHelping } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Requests" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={HandHelping} title="Requests" />
      <Section title="Requests">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

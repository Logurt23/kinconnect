import { CloudLightning } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Weather" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={CloudLightning} title="Weather" />
      <Section title="Weather">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

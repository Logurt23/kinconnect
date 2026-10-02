import { CalendarDays } from "lucide-react";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireMember } from "@/lib/auth";

export const metadata = { title: "Schedule" };

export default async function Page() {
  await requireMember();
  return (
    <div className="space-y-5">
      <PageHeader icon={CalendarDays} title="Schedule" />
      <Section title="Schedule">
        <Empty>This screen is being built next.</Empty>
      </Section>
    </div>
  );
}

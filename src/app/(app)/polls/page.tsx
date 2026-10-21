import { Vote } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { PollCard, isOpen, loadPolls } from "@/components/PollCard";
import { CirclePicker, Empty, PageHeader, Section } from "@/components/ui";
import { alertCircles, allCircles, defaultCircleIds, requireMember } from "@/lib/auth";
import { createClient } from "@/lib/db";
import { createPoll } from "./actions";

export const metadata = { title: "Polls" };

const OPTION_SLOTS = 6;

export default async function PollsPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const db = await createClient();
  const [polls, circles, sendable] = await Promise.all([loadPolls(db), allCircles(), alertCircles(me)]);
  const open = polls.filter(isOpen);
  const closed = polls.filter((p) => !isOpen(p)).slice(0, 20);

  return (
    <div className="space-y-5">
      <PageHeader icon={Vote} title="Polls" subtitle="Ask the family a quick question: yes or no, or pick one. Answers show up as people tap." />
      <Flash searchParams={searchParams} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.5fr]">
        <Section title="New poll">
          {/* "Pick one" options hide while "Yes or no" is chosen. */}
          <form action={createPoll} className="space-y-4 [&:has(#kind-yesno:checked)_.choice-only]:hidden">
            <div><label className="label" htmlFor="question">Question</label>
              <input className="input" id="question" name="question" maxLength={200} placeholder="What should we have for dinner tonight?" required /></div>
            <fieldset>
              <legend className="label">Answers</legend>
              <div className="flex flex-wrap gap-2">
                {[["choice", "Pick one"], ["yes_no", "Yes or no"]].map(([value, label]) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft sm:min-h-9">
                    <input type="radio" id={`kind-${value.replace("_", "")}`} name="kind" value={value} defaultChecked={value === "choice"} className="accent-brand" />{label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="choice-only grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: OPTION_SLOTS }, (_, i) => (
                <input key={i} className="input" name="option" maxLength={80} aria-label={`Option ${i + 1}`}
                  placeholder={["Tacos", "Pizza", "Grill out"][i] ? `Option ${i + 1}, e.g. ${["Tacos", "Pizza", "Grill out"][i]}` : `Option ${i + 1} (optional)`} />
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_other" className="h-4 w-4 accent-brand" /> Let people write their own answer</label>
            <div><label className="label" htmlFor="closes_in">Closes</label>
              <select id="closes_in" name="closes_in" className="input" defaultValue="">
                <option value="">When I close it</option>
                <option value="1h">In 1 hour</option>
                <option value="3h">In 3 hours</option>
                <option value="24h">In 24 hours</option>
                <option value="3d">In 3 days</option>
                <option value="7d">In a week</option>
              </select></div>
            <CirclePicker circles={sendable} defaults={defaultCircleIds(me)} label="Send to" />
            <ConfirmSubmit className="btn-primary" pending="Sending...">Send poll</ConfirmSubmit>
          </form>
        </Section>
        <div className="space-y-5">
          <Section title="Open polls">
            {!open.length ? <Empty>No open polls. Ask one on the left.</Empty> : (
              <div className="space-y-3">{open.map((p) => <PollCard key={p.id} poll={p} meId={me.id} circles={circles} />)}</div>
            )}
          </Section>
          {closed.length > 0 && (
            <Section title="Closed">
              <div className="space-y-3">{closed.map((p) => <PollCard key={p.id} poll={p} meId={me.id} circles={circles} />)}</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

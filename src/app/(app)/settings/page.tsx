import { Settings } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadge, PageHeader, Section } from "@/components/ui";
import { UseMyLocation } from "@/components/UseMyLocation";
import { requireMember } from "@/lib/auth";
import { initials } from "@/lib/format";
import { fileUrl } from "@/lib/storage";
import { boardPeople } from "@/components/StatusBoard";
import { changePassword, saveProfile, saveStatusSettings } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const photo = me.photo_path ? fileUrl("avatars", me.photo_path) : null;
  const { all, picked } = await boardPeople(me);
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader icon={Settings} title="Settings" subtitle={me.email} />
      <Flash searchParams={searchParams} />
      <Section title="Profile">
        <form action={saveProfile} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{initials(me.display_name)}</span>}
            <div className="min-w-0 flex-1"><label className="label" htmlFor="photo">Photo</label><input id="photo" name="photo" type="file" accept="image/*" className="w-full text-sm" /></div>
          </div>
          <div><label className="label" htmlFor="display_name">Display name</label><input className="input" id="display_name" name="display_name" defaultValue={me.display_name} required /></div>
          <div><label className="label" htmlFor="birthday">Birthday</label><input className="input" id="birthday" name="birthday" type="date" defaultValue={me.birthday ?? ""} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="home_label">Home base</label><input className="input" id="home_label" name="home_label" defaultValue={me.home_label ?? ""} placeholder="City, state" /></div>
          <div><label className="label" htmlFor="lat">Latitude</label><input className="input" id="lat" name="lat" inputMode="decimal" defaultValue={me.lat ?? ""} /></div>
          <div><label className="label" htmlFor="lon">Longitude</label><input className="input" id="lon" name="lon" inputMode="decimal" defaultValue={me.lon ?? ""} /></div>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
            <UseMyLocation />
            <span className="text-xs text-muted">Weather alerts use this point. US only.</span>
          </div>
          <div className="sm:col-span-2"><span className="label">Circles</span><span className="flex gap-1">{me.circles.map((c) => <CircleBadge key={c.id} circle={c} />)}</span>
            <span className="text-xs text-muted">An admin sets these in Family.</span></div>
          <div className="sm:col-span-2"><ConfirmSubmit className="btn-primary" pending="Saving...">Save profile</ConfirmSubmit></div>
        </form>
      </Section>
      <section id="status" className="scroll-mt-4">
        <Section title="Family status">
          <form action={saveStatusSettings} className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="status_sharing" defaultChecked={me.status_sharing} className="mt-1 h-5 w-5 accent-brand" />
              <span><b className="block text-sm">Share my status and show the family board on Home</b>
                <span className="text-sm text-muted">Safe, Still exploring, Away, Out of town, On vacation, SOS and more, set with one tap.
                  Only people in your circles who also have this on can see it. Turn it off and your status is hidden.</span></span>
            </label>
            <fieldset>
              <legend className="label">Who shows on my board</legend>
              <p className="mb-2 text-xs text-muted">Leave everyone unticked to show your Core circle.</p>
              <div className="flex flex-wrap gap-2">
                {all.map((p) => (
                  <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft sm:min-h-9">
                    <input type="checkbox" name="watch" value={p.id} defaultChecked={picked.has(p.id)} className="h-4 w-4 accent-brand" />
                    {p.display_name}{!p.status_sharing && <span className="text-xs text-muted">(not sharing)</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            <ConfirmSubmit className="btn-primary" pending="Saving...">Save family status</ConfirmSubmit>
          </form>
        </Section>
      </section>
      <Section title="Password">
        <form action={changePassword} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div><label className="label" htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
          <div><label className="label" htmlFor="confirm">Confirm</label><input className="input" id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required /></div>
          <ConfirmSubmit className="btn-secondary" pending="Saving...">Change password</ConfirmSubmit>
        </form>
      </Section>
    </div>
  );
}

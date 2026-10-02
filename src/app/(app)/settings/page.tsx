import { Settings } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash, type Search } from "@/components/Flash";
import { CircleBadge, PageHeader, Section } from "@/components/ui";
import { UseMyLocation } from "@/components/UseMyLocation";
import { requireMember } from "@/lib/auth";
import { initials } from "@/lib/format";
import { signedUrls } from "@/lib/storage";
import { changePassword, saveProfile } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Search }) {
  const me = await requireMember();
  const photo = me.photo_path ? (await signedUrls("avatars", [me.photo_path], 300)).get(me.photo_path) : null;
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

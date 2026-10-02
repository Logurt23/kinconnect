import { Notice } from "./ui";

export type Search = Promise<{ [k: string]: string | string[] | undefined }>;

/** Shows ?error= or ?ok= left by a server action. */
export async function Flash({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  if (typeof q.error === "string") return <Notice tone="error">{q.error}</Notice>;
  if (typeof q.ok === "string") return <Notice tone="ok">{q.ok}</Notice>;
  return null;
}

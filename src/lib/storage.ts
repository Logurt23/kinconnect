import "server-only";
import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";

export const MAX_UPLOAD = 20 * 1024 * 1024;

/**
 * Files live in one private Cloud Storage bucket as <area>/<owner id>/..., written by the app's service
 * account. Nobody gets a bucket URL: pages link to /files/<area>/<path>, which asks the database, as the
 * member, whether they may read it (can_read_object) and then streams it. GCS_ENDPOINT points this at
 * fake-gcs-server locally (not STORAGE_EMULATOR_HOST, which the library mixes up for downloads).
 */
export type Area = "vault" | "listing-photos" | "avatars";
export const AREAS: Area[] = ["vault", "listing-photos", "avatars"];

let storage: Storage | null = null;
const bucket = () =>
  (storage ??= new Storage(process.env.GCS_ENDPOINT ? { apiEndpoint: process.env.GCS_ENDPOINT, projectId: process.env.GOOGLE_CLOUD_PROJECT } : {})).bucket(process.env.GCS_BUCKET!);
const object = (area: Area, path: string) => bucket().file(`${area}/${path}`);

export async function putFile(area: Area, path: string, file: File, contentType: string) {
  try {
    await object(area, path).save(Buffer.from(await file.arrayBuffer()), { contentType, resumable: false });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Upload failed.";
  }
}

export async function removeFiles(area: Area, paths: string[]) {
  await Promise.allSettled(paths.map((p) => object(area, p).delete({ ignoreNotFound: true })));
}

/** Where a page links to a file. The /files route decides who may open it. */
export function fileUrl(area: Area, path: string) {
  return `/files/${area}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function fileUrls(area: Area, paths: string[]) {
  return new Map(paths.map((p) => [p, fileUrl(area, p)]));
}

/** The file itself, for a reader already allowed to see it. */
export async function serveFile(area: Area, path: string) {
  const f = object(area, path);
  try {
    const [[meta], [body]] = await Promise.all([f.getMetadata(), f.download()]);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": meta.contentType || "application/octet-stream",
        "Content-Length": String(body.length),
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "file";
}

/** Vault: 1 GB per member, plain text only (notes, backups, CSV, JSON, Markdown and the like). */
export const VAULT_QUOTA = 1024 ** 3;
export const TEXT_TYPE = "text/plain; charset=utf-8";

/** True when every byte is valid UTF-8 text with no NULs, so images, video, PDFs and Office files are refused. */
export async function isPlainText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/heic", "image/heif"];

/**
 * The real type of an upload, read from its first bytes. The browser's `file.type` is just a claim,
 * so it never decides what gets stored or how Storage serves it back.
 */
export async function sniffType(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (/^(heic|heix|heim|heis|hevc|hevx)$/.test(brand)) return "image/heic";
    if (/^(mif1|msf1)$/.test(brand)) return "image/heif";
  }
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}

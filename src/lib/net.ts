import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Addresses a member-supplied link must never reach from the server: loopback, private, link-local
// (cloud metadata lives at 169.254.169.254), carrier-grade NAT, benchmarking and multicast ranges.
const blocked = new BlockList();
for (const [net, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const)
  blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const)
  blocked.addSubnet(net, bits, "ipv6");

function isPrivate(ip: string) {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  return blocked.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

/** Local development and the e2e stub serve calendars from 127.0.0.1; production never may. */
const allowPrivate = () => process.env.NODE_ENV !== "production" && process.env.ICS_ALLOW_PRIVATE === "1";

export async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:" && !(allowPrivate() && url.protocol === "http:")) throw new Error("Use the https or webcal link from your calendar app.");
  if (allowPrivate()) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addrs.length) throw new Error("That link's server couldn't be found.");
  if (addrs.some(isPrivate)) throw new Error("That link points inside a private network.");
}

/**
 * GETs a member-supplied URL as text: public addresses only (checked again on every redirect),
 * a timeout, and a size cap so a huge or endless response can't tie up the server.
 */
export async function fetchPublicText(raw: string, { maxBytes = 5 * 1024 * 1024, timeoutMs = 15000, headers = {} as Record<string, string> } = {}) {
  let url = new URL(raw);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, { redirect: "manual", signal, headers, cache: "no-store" });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (next) {
      await res.body?.cancel();
      url = new URL(next, url);
      continue;
    }
    if (!res.ok) throw new Error(`The link answered ${res.status}.`);
    if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("That calendar is too large to read.");
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("That calendar is too large to read.");
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  throw new Error("That link redirects too many times.");
}

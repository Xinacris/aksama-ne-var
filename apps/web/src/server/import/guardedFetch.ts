import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * fetch for user-supplied links (the schema.org web adapter): only public
 * http(s) hosts, redirects re-checked, at most 3 hops. Keeps the import route
 * from being used to reach private networks.
 */

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

type Resolve = (host: string) => Promise<string[]>;
const defaultResolve: Resolve = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

export async function assertPublicUrl(raw: string, resolve: Resolve = defaultResolve): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("blocked-protocol");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("blocked-host");
  const addrs = isIP(host) ? [host] : await resolve(host);
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new Error("blocked-host");
  return u;
}

export function guardedFetch(base: typeof fetch = fetch, resolve?: Resolve): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = String(input);
    for (let hop = 0; hop < 4; hop++) {
      await assertPublicUrl(url, resolve);
      const res = await base(url, { ...init, redirect: "manual" });
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!loc) return res;
      url = new URL(loc, url).toString();
    }
    throw new Error("too-many-redirects");
  }) as typeof fetch;
}

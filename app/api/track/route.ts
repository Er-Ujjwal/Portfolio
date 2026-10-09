import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { redisPipeline, upstashConfigured } from "@/lib/upstash";

export const dynamic = "force-dynamic";

/**
 * One-way hash for deriving Redis keys from visitor IPs. Raw IPs must never
 * appear in stored key names (they're personal data); the hash keeps the
 * per-IP cache/rate-limit semantics identical while revealing nothing.
 */
function ipKey(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Visitor heartbeat. Body: { sessionId }.
 *
 * - Refreshes the session in a sorted set scored by expiry time (90s TTL).
 * - On the FIRST heartbeat of a session also: increments total visits,
 *   pushes { city, country, countryCode, lat, lon, ts } onto the
 *   recent-visits list (capped at 100), bumps per-city / per-country
 *   counters, and upserts the per-location aggregate used for globe spikes.
 *
 * Geo comes from a server-side lookup by client IP (ipapi.co, then
 * ip-api.com as fallback — free geo APIs throttle), giving city, country
 * name + code, and lat/lon; successes are cached per IP for 24h so repeat
 * visits skip the providers entirely. Vercel's ip headers are the fallback
 * (city/country only). On local dev the machine's public IP is used so
 * local visits still record real geography. Everything is best-effort:
 * unknown geo is stored as nulls, never as fake places.
 */
const SESSION_TTL_S = 90;
const SEEN_TTL_S = 24 * 60 * 60; // one "first visit" credit per session id per day

type Geo = {
  city?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
};

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function isPrivateIp(ip: string): boolean {
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc00:|fe80:)/i.test(ip);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function ipapiLookup(ip: string): Promise<Geo | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      city?: unknown;
      country_name?: unknown;
      country_code?: unknown;
      latitude?: unknown;
      longitude?: unknown;
    };
    return {
      city: str(d.city),
      country: str(d.country_name),
      countryCode: str(d.country_code)?.toUpperCase(),
      lat: num(d.latitude),
      lon: num(d.longitude),
    };
  } catch {
    return null;
  }
}

async function ipApiComLookup(ip: string): Promise<Geo | null> {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as {
      status?: unknown;
      country?: unknown;
      countryCode?: unknown;
      city?: unknown;
      lat?: unknown;
      lon?: unknown;
    };
    if (d.status !== "success") return null;
    return {
      city: str(d.city),
      country: str(d.country),
      countryCode: str(d.countryCode)?.toUpperCase(),
      lat: num(d.lat),
      lon: num(d.lon),
    };
  } catch {
    return null;
  }
}

/**
 * Public IP of this machine, resolved via ipify and never stored.
 * Used only when the client IP is private/unroutable (local dev), so
 * local visits still record real geography instead of "Unknown".
 * Never triggers in production, where client IPs are always public.
 */
async function serverPublicIp(): Promise<string | undefined> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const d = (await res.json()) as { ip?: unknown };
    return typeof d.ip === "string" && !isPrivateIp(d.ip) ? d.ip : undefined;
  } catch {
    return undefined;
  }
}

/** Public client IP, or "" when there isn't a usable one. */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  // Take the LAST entry: each proxy appends the address it saw, so the last
  // one was added by the edge closest to us (Vercel) and can't be spoofed by
  // the client prepending fake entries.
  const parts = (fwd ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = (parts.length > 0 ? parts[parts.length - 1] : req.headers.get("x-real-ip")) ?? "";
  return ip && !isPrivateIp(ip) ? ip : "";
}

/**
 * Sliding-window rate limit backed by Redis: max 30 requests/minute per
 * key. Legit traffic is ~2 heartbeats/minute per tab, so this only bites
 * spam loops. Fails open — a store hiccup never blocks real visitors.
 */
async function rateLimited(key: string): Promise<boolean> {
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  try {
    const [, , count] = await redisPipeline([
      ["ZADD", key, String(now), member],
      ["ZREMRANGEBYSCORE", key, "0", String(now - 60_000)],
      ["ZCOUNT", key, String(now - 60_000), String(now)],
      ["EXPIRE", key, "90"],
    ]);
    return Number(count ?? 0) > 30;
  } catch {
    return false;
  }
}

async function lookupGeo(req: NextRequest): Promise<Geo> {
  // Vercel's ip headers carry city/country only (no coordinates) and the
  // city value is URL-encoded — decode it defensively.
  const rawCity = req.headers.get("x-vercel-ip-city");
  const rawCountry = req.headers.get("x-vercel-ip-country");
  const code = rawCountry ? rawCountry.trim().toUpperCase() : undefined;
  const headerGeo: Geo = {
    city: rawCity ? safeDecode(rawCity) : undefined,
    countryCode: code,
    country: code ? countryName(code) : undefined,
  };

  // The globe spikes need coordinates for every visit, so do a server-side
  // geo lookup by the client IP and merge it over the header geo.
  // Coordinates are skipped only if both sources fail. On local dev the
  // client IP is private/loopback, so fall back to this machine's public
  // IP to keep local visits geographically real. Two providers are tried
  // in order (ipapi.co, then ip-api.com) because free geo APIs throttle —
  // and a success is cached per IP for 24h, so one good lookup covers
  // every later visit from the same IP with zero provider calls.
  let ip = clientIp(req);
  let stage = "client-ip";
  if (!ip) {
    stage = "public-ip";
    ip = (await serverPublicIp()) ?? "";
  }
  const merge = (g: Geo): Geo => ({
    city: g.city ?? headerGeo.city,
    country: g.country ?? headerGeo.country,
    countryCode: g.countryCode ?? headerGeo.countryCode,
    lat: g.lat,
    lon: g.lon,
  });
  if (ip) {
    try {
      const [cached] = await redisPipeline([["GET", `ujjwal:geo:${ipKey(ip)}`]]);
      if (typeof cached === "string") {
        const d = JSON.parse(cached) as Partial<Geo>;
        const hit: Geo = {
          city: str(d.city),
          country: str(d.country),
          countryCode: str(d.countryCode),
          lat: num(d.lat),
          lon: num(d.lon),
        };
        if (hit.city || hit.countryCode) return merge(hit);
      }
    } catch {
      /* geo cache is best-effort */
    }
  }
  let ipGeo: Geo | null = null;
  if (ip) {
    stage = "ipapi";
    ipGeo = await ipapiLookup(ip);
    if (!ipGeo) {
      stage = "ip-api-com";
      ipGeo = await ipApiComLookup(ip);
    }
    // Cache named successes only: a coords-only partial must not pin
    // "Unknown" names for 24h while the providers may recover.
    if (ipGeo && (ipGeo.city || ipGeo.countryCode)) {
      try {
        await redisPipeline([
          ["SET", `ujjwal:geo:${ipKey(ip)}`, JSON.stringify(ipGeo), "EX", "86400"],
        ]);
      } catch {
        /* geo cache is best-effort */
      }
    }
  }
  if (!ipGeo && process.env.NODE_ENV === "development") {
    // Dev-only: tells us exactly which step failed (never logs the IP).
    console.warn(`[track] geo unresolved (failed at: ${stage})`);
  }
  if (ipGeo) {
    return merge(ipGeo);
  }

  return headerGeo;
}

export async function POST(req: NextRequest) {
  if (!upstashConfigured) {
    return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  }

  // Crawlers and bots must not inflate the visitor counters.
  const ua = req.headers.get("user-agent") ?? "";
  if (
    /bot|crawl|spider|slurp|mediapartners|baidu|yandex|sogou|exabot|facebot|ia_archiver/i.test(
      ua,
    )
  ) {
    return NextResponse.json({ ok: true, bot: true });
  }

  let sessionId: unknown = null;
  try {
    sessionId = (await req.json()).sessionId;
  } catch {
    sessionId = null;
  }
  if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) {
    return NextResponse.json({ ok: false, error: "bad session id" }, { status: 400 });
  }

  // Spam guard: max ~30 heartbeats/minute per IP (legit traffic is ~2/min).
  // Falls back to the session id when there's no public IP (local dev).
  // The IP is hashed — raw IPs never appear in stored key names.
  const rawIp = clientIp(req);
  const rlKey = `ujjwal:rl:${rawIp ? ipKey(rawIp) : sessionId}`;
  if (await rateLimited(rlKey)) {
    return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 });
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + SESSION_TTL_S;

  let isNew: boolean;
  try {
    const [setResult] = await redisPipeline([
      ["SET", `ujjwal:seen:${sessionId}`, "1", "NX", "EX", String(SEEN_TTL_S)],
      ["ZADD", "ujjwal:sessions", String(expiry), sessionId],
    ]);
    isNew = setResult === "OK";
  } catch {
    return NextResponse.json({ ok: false, error: "store unavailable" }, { status: 503 });
  }

  if (isNew) {
    const geo = await lookupGeo(req);
    const visit = JSON.stringify({
      city: geo.city ?? null,
      country: geo.country ?? null,
      countryCode: geo.countryCode ?? null,
      lat: geo.lat ?? null,
      lon: geo.lon ?? null,
      ts: Date.now(),
    });

    const commands: (string | number)[][] = [
      ["INCR", "ujjwal:visits"],
      ["LPUSH", "ujjwal:recent", visit],
      ["LTRIM", "ujjwal:recent", "0", "99"],
    ];
    if (geo.countryCode) {
      commands.push(["HINCRBY", "ujjwal:countries", geo.countryCode, "1"]);
    }
    if (geo.city || geo.countryCode) {
      const cityKey = [geo.city, geo.countryCode].filter(Boolean).join("|");
      commands.push(["HINCRBY", "ujjwal:cities", cityKey, "1"]);
    }

    // Per-location aggregate for the globe spikes (needs coordinates).
    if (geo.lat != null && geo.lon != null) {
      const locKey = [geo.countryCode ?? "??", geo.city ?? "??"].join("|");
      type LocationEntry = {
        city: string | null;
        country: string | null;
        countryCode: string | null;
        lat: number;
        lon: number;
        count: number;
      };
      try {
        const [raw] = await redisPipeline([["HGET", "ujjwal:locdata", locKey]]);
        let entry: LocationEntry | null = null;
        if (typeof raw === "string") {
          try {
            const d = JSON.parse(raw) as Partial<LocationEntry>;
            if (
              typeof d?.lat === "number" &&
              typeof d?.lon === "number" &&
              typeof d?.count === "number"
            ) {
              entry = {
                city: typeof d.city === "string" ? d.city : null,
                country: typeof d.country === "string" ? d.country : null,
                countryCode: typeof d.countryCode === "string" ? d.countryCode : null,
                lat: d.lat,
                lon: d.lon,
                count: d.count,
              };
            }
          } catch {
            entry = null;
          }
        }
        const next = {
          city: geo.city ?? entry?.city ?? null,
          country: geo.country ?? entry?.country ?? null,
          countryCode: geo.countryCode ?? entry?.countryCode ?? null,
          lat: geo.lat,
          lon: geo.lon,
          count: (entry?.count ?? 0) + 1,
        };
        commands.push(["HSET", "ujjwal:locdata", locKey, JSON.stringify(next)]);
      } catch {
        /* location aggregate is best-effort */
      }
    }

    try {
      await redisPipeline(commands);
    } catch {
      // Heartbeat already recorded; counters are best-effort.
    }
  }

  return NextResponse.json({ ok: true, new: isNew });
}

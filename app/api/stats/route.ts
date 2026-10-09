import { NextResponse } from "next/server";
import { flatArrayToRecord, redisPipeline, upstashConfigured } from "@/lib/upstash";

export const dynamic = "force-dynamic";

/**
 * Visitor analytics snapshot.
 * Returns { total, live, cities, countries, recent, topCountries, locations }.
 * `live` counts sessions whose heartbeat hasn't expired (pruned first).
 * `locations` are per-location aggregates { city, country, countryCode,
 * lat, lon, count } for the globe spikes, sorted by count desc.
 * 503 { configured: false } when Upstash env vars are missing.
 */
type RecentVisit = {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  ts: number;
};

type Location = {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lon: number;
  count: number;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function parseVisit(raw: unknown): RecentVisit | null {
  if (typeof raw !== "string") return null;
  try {
    const d = JSON.parse(raw) as Partial<RecentVisit>;
    if (typeof d.ts !== "number" || !Number.isFinite(d.ts)) return null;
    return {
      city: asString(d.city),
      country: asString(d.country),
      countryCode: asString(d.countryCode),
      ts: d.ts,
    };
  } catch {
    return null;
  }
}

function parseLocation(raw: unknown): Location | null {
  if (typeof raw !== "string") return null;
  try {
    const d = JSON.parse(raw) as Partial<Location>;
    if (
      typeof d.lat !== "number" ||
      !Number.isFinite(d.lat) ||
      typeof d.lon !== "number" ||
      !Number.isFinite(d.lon)
    ) {
      return null;
    }
    return {
      city: asString(d.city),
      country: asString(d.country),
      countryCode: asString(d.countryCode),
      lat: d.lat,
      lon: d.lon,
      count: typeof d.count === "number" && Number.isFinite(d.count) ? d.count : 0,
    };
  } catch {
    return null;
  }
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export async function GET() {
  if (!upstashConfigured) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const [, live, total, citiesRaw, countriesRaw, recentRaw, locRaw] =
      await redisPipeline([
        ["ZREMRANGEBYSCORE", "ujjwal:sessions", "0", String(now)],
        ["ZCOUNT", "ujjwal:sessions", String(now), "+inf"],
        ["GET", "ujjwal:visits"],
        ["HGETALL", "ujjwal:cities"],
        ["HGETALL", "ujjwal:countries"],
        ["LRANGE", "ujjwal:recent", "0", "29"],
        ["HGETALL", "ujjwal:locdata"],
      ]);

    const cities = flatArrayToRecord(citiesRaw);
    const countries = flatArrayToRecord(countriesRaw);

    const recent = (Array.isArray(recentRaw) ? recentRaw : [])
      .map(parseVisit)
      .filter((v): v is RecentVisit => v !== null)
      // Recent activity resets every 24h: only visits from the last day
      // feed the activity list, the ticker and the live-ping detection.
      // After a quiet day the section falls back to "Waiting for visitors...".
      .filter((v) => Date.now() - v.ts < 24 * 60 * 60 * 1000);

    const topCountries = Object.entries(countries)
      .map(([code, count]) => ({
        code,
        country: countryName(code),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const locValues: unknown[] = [];
    if (Array.isArray(locRaw)) {
      for (let i = 1; i < locRaw.length; i += 2) locValues.push(locRaw[i]);
    }
    const locations = locValues
      .map(parseLocation)
      .filter((l): l is Location => l !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 60);

    return NextResponse.json({
      configured: true,
      total: Number(total ?? 0),
      live: Number(live ?? 0),
      cities: Object.keys(cities).length,
      countries: Object.keys(countries).length,
      recent,
      topCountries,
      locations,
    });
  } catch {
    return NextResponse.json({ configured: true, error: true }, { status: 503 });
  }
}

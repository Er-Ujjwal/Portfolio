"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { type GlobePoint, type LivePing } from "./Globe";

/**
 * The globe library touches `window` at import time, so it loads only in the
 * browser (never during server prerendering) and only when this section
 * mounts — the ~500KB stays out of the initial page load.
 */
const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => (
    <div id="globe-canvas" aria-hidden="true">
      <div className="loader-wrap">
        <div className="loader-dot" />
      </div>
    </div>
  ),
});

type RecentVisit = {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  ts: number;
};
type TopCountry = { code: string; country: string; count: number };
type Stats = {
  total: number;
  live: number;
  cities: number;
  countries: number;
  recent: RecentVisit[];
  topCountries: TopCountry[];
  locations: GlobePoint[];
};

const TRACK_INTERVAL_MS = 30_000;
const SID_KEY = "ujjwal-portfolio-sid";

function getSessionId(): string {
  try {
    let sid = window.sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Regional-indicator flag emoji from a 2-letter country code. */
function getFlag(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

/** Green → yellow → red dot as an activity ages (90s / 300s). */
function ageClass(ms: number): string {
  const age = Date.now() - ms;
  if (age < 90000) return "";
  if (age < 300000) return "dot-soon";
  return "dot-old";
}

/** Count-up animation over 800ms, like the reference. */
function CountUp({ value }: { value: number | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || value == null || Number.isNaN(value)) return;
    const target = value;
    const duration = 800;
    let start: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      el.textContent = Math.floor(progress * target).toLocaleString("en-US");
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span ref={ref} className="stat-num">
      {value == null ? "--" : value.toLocaleString("en-US")}
    </span>
  );
}

function spawnConfetti() {
  const box = document.getElementById("confetti-box");
  if (!box) return;
  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
    box.appendChild(piece);
    window.setTimeout(() => piece.remove(), 3500);
  }
}

function createParticles() {
  const container = document.getElementById("globe-particles");
  if (!container) return;
  for (let i = 0; i < 15; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.bottom = Math.random() * 30 + "%";
    p.style.animationDelay = Math.random() * 6 + "s";
    p.style.animationDuration = 4 + Math.random() * 4 + "s";
    container.appendChild(p);
  }
}

/**
 * Visitor analytics section, behavior-for-behavior like the reference:
 * greeting pill, animated metric row, globe.gl globe with live arcs,
 * ticker, confetti on new visitors, recent-activity and top-countries
 * cards. Backed by the local /api/track + /api/stats (Upstash) instead
 * of the reference's worker + websocket; live events are derived from
 * polling. Without Upstash configured, shows placeholders — never fakes.
 */
export default function Visitors() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [livePing, setLivePing] = useState<LivePing | null>(null);
  const [ownGeo, setOwnGeo] = useState<GlobePoint | null>(null);
  const [tick, setTick] = useState(0);
  const lastSeenRef = useRef(0);
  const welcomeRef = useRef<HTMLSpanElement>(null);
  const tickerRef = useRef<HTMLSpanElement>(null);
  const liveBadgeRef = useRef<HTMLSpanElement>(null);
  const totalBadgeRef = useRef<HTMLSpanElement>(null);

  /* Track heartbeats + poll stats. */
  useEffect(() => {
    let cancelled = false;
    const sid = getSessionId();

    const track = () => {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
        cache: "no-store",
      }).catch(() => {});
    };

    const load = () => {
      fetch("/api/stats", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error("stats failed");
          return r.json();
        })
        .then((d) => {
          if (cancelled) return;
          if (d?.configured === false) {
            setUnconfigured(true);
            return;
          }
          const recent: RecentVisit[] = Array.isArray(d.recent) ? d.recent : [];
          const locations: GlobePoint[] = Array.isArray(d.locations)
            ? d.locations
            : [];
          const newest = recent[0];
          if (newest && newest.ts > lastSeenRef.current) {
            const firstLoad = lastSeenRef.current === 0;
            lastSeenRef.current = newest.ts;
            if (!firstLoad) {
              /* A genuinely new visit landed while watching: find its
                 real coordinates from the location aggregates. */
              const match =
                locations.find(
                  (l) =>
                    l.city === newest.city &&
                    l.countryCode === newest.countryCode,
                ) ?? locations[0];
              if (match && Number.isFinite(match.lat) && Number.isFinite(match.lon)) {
                setLivePing({
                  lat: match.lat,
                  lon: match.lon,
                  city: newest.city,
                  countryCode: newest.countryCode,
                  ts: newest.ts,
                });
                spawnConfetti();
                const ticker = tickerRef.current;
                if (ticker && newest.city) {
                  const flag = getFlag(newest.countryCode);
                  const messages = [
                    `${flag} ${newest.city} just landed`,
                    `Someone from ${newest.city} ${flag}`,
                    `${flag} Hello from ${newest.city}!`,
                    `${newest.city} ${flag} exploring...`,
                  ];
                  ticker.textContent =
                    messages[Math.floor(Math.random() * messages.length)];
                }
              }
            }
          }
          setStats({
            total: d.total ?? 0,
            live: d.live ?? 0,
            cities: d.cities ?? 0,
            countries: d.countries ?? 0,
            recent,
            topCountries: Array.isArray(d.topCountries) ? d.topCountries : [],
            locations,
          });
        })
        .catch(() => {});
    };

    track();
    load();
    const id = window.setInterval(() => {
      track();
      load();
    }, TRACK_INTERVAL_MS);
    const tickId = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearInterval(tickId);
    };
  }, []);

  /* Welcome pill personalization (viewer's own city). */
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (
          typeof data.latitude === "number" &&
          typeof data.longitude === "number"
        ) {
          setOwnGeo({
            lat: data.latitude,
            lon: data.longitude,
            count: 1,
            city: data.city ?? null,
            country: data.country_name ?? null,
            countryCode: data.country_code ?? null,
          });
        }
        if (data.city && welcomeRef.current) {
          const flag = getFlag(data.country_code);
          /* Built with DOM APIs, never innerHTML: data.city comes from an
             external API and must not be concatenated into HTML. */
          const el = welcomeRef.current;
          el.textContent = "Hey, visiting from " + flag + " ";
          const strong = document.createElement("strong");
          strong.textContent = String(data.city);
          el.appendChild(strong);
          el.appendChild(document.createTextNode("?"));
        }
      })
      .catch(() => {});
  }, []);

  /* Globe particles once. */
  useEffect(() => {
    createParticles();
  }, []);

  /* Live + total badges follow the numbers. */
  useEffect(() => {
    const badge = liveBadgeRef.current;
    if (!badge) return;
    const n = stats?.live ?? 0;
    if (n > 0) {
      badge.textContent = `${n} live`;
      badge.classList.add("visible");
    } else {
      badge.classList.remove("visible");
    }
  }, [stats?.live]);

  useEffect(() => {
    const badge = totalBadgeRef.current;
    if (!badge || !stats) return;
    badge.textContent = `${stats.countries} total`;
    badge.classList.add("visible");
  }, [stats]);

  const globeLocations: GlobePoint[] =
    stats && stats.locations.length > 0
      ? stats.locations
      : ownGeo
        ? [ownGeo]
        : [];

  const activities = (stats?.recent ?? [])
    .slice(0, 5)
    .map((r) => ({ city: r.city, countryCode: r.countryCode, time: r.ts }));
  const countries = (stats?.topCountries ?? [])
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  /* `tick` re-renders every 30s so relative times stay fresh. */
  void tick;

  return (
    <section className="globe-section animate delay-4" id="visitors">
      <h2>visitors</h2>

      <div className="visitor-welcome" id="visitor-welcome">
        <span className="welcome-emoji">👋</span>
        <span className="welcome-text" ref={welcomeRef}>
          Hey there, welcome! <strong id="visitor-city"></strong>
        </span>
      </div>

      <div className="stats-row">
        <div className="stat">
          <CountUp value={unconfigured ? null : (stats?.total ?? null)} />
          <span className="stat-text">visits</span>
        </div>
        <div className="stat">
          <CountUp value={unconfigured ? null : (stats?.cities ?? null)} />
          <span className="stat-text">cities</span>
        </div>
        <div className="stat">
          <CountUp value={unconfigured ? null : (stats?.countries ?? null)} />
          <span className="stat-text">countries</span>
        </div>
        <div className="stat live">
          <span className="live-dot" />
          <span id="stat-live" className="stat-num">
            {stats?.live ?? 0}
          </span>
          <span className="stat-text">live</span>
        </div>
      </div>

      <div className="globe-universe">
        <div className="globe-aurora" />
        <div className="globe-particles" id="globe-particles" />
        <div className="globe-container">
          <Globe
            locations={globeLocations}
            livePing={livePing}
            ownLocation={ownGeo}
          />
        </div>
        <div className="globe-ticker" id="globe-ticker">
          <span className="ticker-dot" />
          <span className="ticker-text" id="ticker-text" ref={tickerRef}>
            Watching the world...
          </span>
        </div>
      </div>

      <div className="confetti-box" id="confetti-box" />

      <div className="inline-section activity-section">
        <div className="inline-label">
          <span className="label-icon">◉</span> Recent Activity
          <span className="live-badge" id="live-badge" ref={liveBadgeRef} />
        </div>
        <div className="inline-row" id="activity-list">
          {activities.length === 0 ? (
            <span className="inline-empty">Waiting for visitors...</span>
          ) : (
            activities.map((a, i) => (
              <div className="activity-item" key={`${a.time}-${i}`}>
                <span className="activity-city">
                  {a.city || "Unknown"}{" "}
                  <span className="activity-flag">{getFlag(a.countryCode)}</span>
                </span>
                <span className="activity-time">
                  <span className={`activity-dot ${ageClass(a.time)}`} />
                  {timeAgo(a.time)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="inline-section countries-section">
        <div className="inline-label">
          <span className="label-icon">◈</span> Top Countries
          <span
            className="total-badge"
            id="total-countries-badge"
            ref={totalBadgeRef}
          />
        </div>
        <div className="inline-row" id="countries-list">
          {!stats ? (
            <span className="inline-empty">Loading...</span>
          ) : countries.length === 0 ? (
            <span className="inline-empty">No country data yet</span>
          ) : (
            countries.map((c, i) => (
              <div className="country-item" key={c.code}>
                <span
                  className={`country-rank${i === 0 ? " rank-first" : ""}`}
                >
                  {i === 0 ? "👑" : `#${i + 1}`}
                </span>
                <span className="country-count">
                  {c.count.toLocaleString("en-US")}
                </span>
                <span className="country-label">
                  {getFlag(c.code)} {c.country}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

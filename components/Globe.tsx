"use client";

import { useEffect, useRef } from "react";
import GlobeLib from "globe.gl";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import countriesTopo from "world-atlas/countries-110m.json";

export type GlobePoint = {
  lat: number;
  lon: number;
  count: number;
  city: string | null;
  country: string | null;
  countryCode: string | null;
};

export type LivePing = {
  lat: number;
  lon: number;
  city: string | null;
  countryCode: string | null;
  ts: number;
};

/** Owner's location — live-visitor arcs fly here (Greater Noida, India). */
const HOME_LAT = 28.4744;
const HOME_LNG = 77.503;

interface GlobeControls {
  autoRotate: boolean;
  autoRotateSpeed: number;
  enableZoom: boolean;
}

interface GlobePt {
  lat: number;
  lng: number;
  r: number;
  a: number;
  c: string;
  l: string;
  ts?: number;
}

interface GlobeRing {
  lat: number;
  lng: number;
}

interface GlobeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  ts: number;
}

/** Fluent API of globe.gl 2.x, typed so no `any` leaks in. */
interface GlobeChain {
  backgroundColor(c: string): GlobeChain;
  atmosphereColor(c: string): GlobeChain;
  atmosphereAltitude(n: number): GlobeChain;
  showAtmosphere(b: boolean): GlobeChain;
  showGlobe(b: boolean): GlobeChain;
  polygonCapColor(fn: () => string): GlobeChain;
  polygonSideColor(fn: () => string): GlobeChain;
  polygonStrokeColor(fn: () => string): GlobeChain;
  polygonAltitude(n: number): GlobeChain;
  polygonsTransitionDuration(ms: number): GlobeChain;
  polygonsData(d: unknown[]): GlobeChain;
  arcColor(fn: () => [string, string]): GlobeChain;
  arcAltitude(n: number): GlobeChain;
  arcStroke(n: number): GlobeChain;
  arcDashLength(n: number): GlobeChain;
  arcDashGap(n: number): GlobeChain;
  arcDashAnimateTime(ms: number): GlobeChain;
  arcsData(d: GlobeArc[]): GlobeChain;
  ringLat(fn: (d: GlobeRing) => number): GlobeChain;
  ringLng(fn: (d: GlobeRing) => number): GlobeChain;
  ringColor(fn: () => (t: number) => string): GlobeChain;
  ringMaxRadius(n: number): GlobeChain;
  ringPropagationSpeed(n: number): GlobeChain;
  ringRepeatPeriod(ms: number): GlobeChain;
  ringAltitude(n: number): GlobeChain;
  ringsData(d: GlobeRing[]): GlobeChain;
  pointLat(fn: (d: GlobePt) => number): GlobeChain;
  pointLng(fn: (d: GlobePt) => number): GlobeChain;
  pointRadius(fn: (d: GlobePt) => number): GlobeChain;
  pointAltitude(fn: (d: GlobePt) => number): GlobeChain;
  pointColor(fn: (d: GlobePt) => string): GlobeChain;
  pointLabel(fn: (d: GlobePt) => string): GlobeChain;
  pointsData(d: GlobePt[]): GlobeChain;
  controls(): GlobeControls;
  width(w: number): GlobeChain;
  height(h: number): GlobeChain;
}

/**
 * Stacked-disc markers, like the reference: every visitor location grows a
 * vertical stack of maroon discs. The stack grows logarithmically with the
 * visit count (1 disc for a single visit, up to 12), and deepens in color
 * both with popularity and with height up the stack.
 */
const MAX_DISCS = 12;

function discCount(count: number): number {
  if (count <= 1) return 1;
  return Math.min(MAX_DISCS, 1 + Math.round(Math.log10(count) * 3.5));
}

/** Maroon ramp: deepens with visit count and with height up the stack. */
function discColor(count: number, level: number, levels: number): string {
  const t = Math.min(1, count / 50);
  const h = levels <= 1 ? 0 : level / (levels - 1);
  const r = Math.round(158 - t * 40 - h * 18);
  const g = Math.round(48 - t * 22 - h * 10);
  const b = Math.round(66 - t * 28 - h * 12);
  return `rgba(${r},${g},${b},0.88)`;
}

function countryName(code: string | null): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Escape HTML special chars: tooltip HTML is injected via innerHTML by
 * globe.gl, so city/country strings (which can originate from geo providers
 * or the x-vercel-ip-* headers) must never be concatenated raw. */
function esc(s: string | null): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return (s ?? "Unknown").replace(/[&<>"']/g, (c) => map[c]);
}

function label(
  p: { city: string | null; country: string | null; countryCode: string | null },
  count: number,
  isLive: boolean,
): string {
  const name = p.country ?? countryName(p.countryCode);
  return (
    '<div style="line-height:1.5">' +
    '<div style="font-weight:600;margin-bottom:2px">' +
    esc(p.city) +
    "</div>" +
    '<div style="color:#666;font-size:12px;margin-bottom:4px">' +
    esc(name) +
    "</div>" +
    '<div style="color:#999;font-size:11px;padding-top:4px;border-top:1px solid #eee">' +
    (isLive ? '<span style="color:#22c55e">● Live</span>' : count + " visits") +
    "</div></div>"
  );
}

/**
 * Globe rendered with globe.gl (bundled via npm, lazy-loaded with SSR
 * disabled), configured exactly like the reference: transparent background,
 * mauve landmass, white country boundaries, red dashed arcs, expanding red
 * rings, pink-red point pins, slow
 * auto-rotation that eases to a stop on hover.
 */
export default function Globe({
  locations,
  livePing,
}: {
  locations: GlobePoint[];
  livePing: LivePing | null;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const locationsRef = useRef(locations);
  const livePingRef = useRef<LivePing | null>(null);

  /* Sync props into refs inside an effect, never during render. */
  useEffect(() => {
    locationsRef.current = locations;
    if (livePing && livePing.ts !== livePingRef.current?.ts) {
      livePingRef.current = livePing;
    }
  }, [locations, livePing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let globe: GlobeChain | null = null;
    const handles: {
      rotateTimer?: number;
      frameTimer?: number;
      locTimer?: number;
      onMouseEnter?: () => void;
      onMouseLeave?: () => void;
      onResize?: () => void;
    } = {};

    const init = () => {
      if (cancelled) return;

      // globe.gl ships as a Kapsule factory: GlobeLib()(canvas) builds the
      // chainable instance, the same call shape the CDN global used.
      const createGlobe = GlobeLib as unknown as () => (
        el: HTMLElement,
      ) => GlobeChain;

      globe = createGlobe()(canvas)
        .backgroundColor("rgba(0,0,0,0)")
        .atmosphereColor("rgba(160,140,150,0.2)")
        .atmosphereAltitude(0.1)
        .showAtmosphere(true)
        .showGlobe(false)
        .polygonCapColor(() => "rgba(150,130,140,0.4)")
        .polygonSideColor(() => "rgba(170,150,160,0.2)")
        .polygonStrokeColor(() => "rgba(255,255,255,0.4)")
        .polygonAltitude(0.002)
        .polygonsTransitionDuration(250)
        .arcColor(() => ["rgba(220,38,38,0.4)", "rgba(220,38,38,0.05)"])
        .arcAltitude(0.08)
        .arcStroke(0.25)
        .arcDashLength(0.6)
        .arcDashGap(0.2)
        .arcDashAnimateTime(1000)
        .arcsData([])
        .ringLat((d) => d.lat)
        .ringLng((d) => d.lng)
        .ringColor(() => (t: number) => "rgba(220,38,38," + (1 - t) * 0.3 + ")")
        .ringMaxRadius(2.5)
        .ringPropagationSpeed(1.2)
        .ringRepeatPeriod(2000)
        .ringAltitude(0.004)
        .ringsData([])
        .pointLat((d) => d.lat)
        .pointLng((d) => d.lng)
        .pointRadius((d) => d.r)
        .pointAltitude((d) => d.a)
        .pointColor((d) => d.c)
        .pointLabel((d) => d.l)
        .pointsData([]);

      // Country boundaries ship with the bundle now (world-atlas), converted
      // from TopoJSON to GeoJSON once at startup.
      const topo = countriesTopo as unknown as Topology;
      const countries = feature(topo, topo.objects.countries) as unknown as {
        features: unknown[];
      };
      globe.polygonsData(countries.features);

      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.35;
      globe.controls().enableZoom = false;

      let speed = 0.35;
      const onMouseEnter = () => {
        speed = 0;
      };
      const onMouseLeave = () => {
        speed = 0.35;
      };
      handles.onMouseEnter = onMouseEnter;
      handles.onMouseLeave = onMouseLeave;
      canvas.addEventListener("mouseenter", onMouseEnter);
      canvas.addEventListener("mouseleave", onMouseLeave);
      handles.rotateTimer = window.setInterval(() => {
        if (!globe) return;
        const curr = globe.controls().autoRotateSpeed;
        const diff = speed - curr;
        if (Math.abs(diff) > 0.01)
          globe.controls().autoRotateSpeed = curr + diff * 0.08;
      }, 50);

      const onResize = () => {
        if (!globe) return;
        const rect = canvas.getBoundingClientRect();
        globe.width(rect.width).height(rect.height);
      };
      handles.onResize = onResize;
      onResize();
      window.addEventListener("resize", onResize);

      const pts: GlobePt[] = [];
      const livePts: GlobePt[] = [];
      const arcs: GlobeArc[] = [];
      const rings: GlobeRing[] = [];
      let lastPingTs = 0;

      const applyLocations = () => {
        const discs: GlobePt[] = [];
        const bases: GlobeRing[] = [];
        for (const p of locationsRef.current) {
          const lat = Number(p.lat);
          const lng = Number(p.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const cnt = p.count || 1;
          const n = discCount(cnt);
          const tip = label(p, cnt, false);
          for (let i = 0; i < n; i++) {
            discs.push({
              lat,
              lng,
              r: Math.max(0.08, 0.15 - i * 0.005),
              a: 0.012 + i * 0.016,
              c: discColor(cnt, i, n),
              l: tip,
            });
          }
          bases.push({ lat, lng });
        }
        pts.length = 0;
        pts.push(...discs);
        rings.length = 0;
        rings.push(...bases.slice(0, 12));
        if (globe) {
          globe.pointsData(pts.concat(livePts));
          globe.ringsData(rings);
        }
      };
      applyLocations();
      handles.locTimer = window.setInterval(applyLocations, 5000);

      handles.frameTimer = window.setInterval(() => {
        if (!globe) return;
        const now = Date.now();

        const ping = livePingRef.current;
        if (ping && ping.ts !== lastPingTs) {
          lastPingTs = ping.ts;
          const lat = Number(ping.lat);
          const lng = Number(ping.lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            arcs.push({
              startLat: lat,
              startLng: lng,
              endLat: HOME_LAT,
              endLng: HOME_LNG,
              ts: now,
            });
            globe.arcsData(arcs);
            livePts.push({
              lat,
              lng,
              ts: now,
              r: 0.3,
              a: 0.1,
              c: "#22c55e",
              l: label(
                {
                  city: ping.city,
                  country: null,
                  countryCode: ping.countryCode,
                },
                0,
                true,
              ),
            });
            rings.push({ lat, lng });
            globe.ringsData(rings);
          }
        }

        for (let i = arcs.length - 1; i >= 0; i--) {
          if (now - arcs[i].ts > 2000) arcs.splice(i, 1);
        }
        globe.arcsData(arcs);

        for (let j = livePts.length - 1; j >= 0; j--) {
          const ts = livePts[j].ts;
          if (ts !== undefined && now - ts > 9000) livePts.splice(j, 1);
        }
        livePts.forEach((p) => {
          const age = now - (p.ts ?? now);
          const pulse =
            (Math.sin(age / 200) * 0.5 + 0.5) * Math.max(0, 1 - age / 9000);
          p.r = 0.2 + pulse * 0.2;
          p.a = 0.05 + pulse * 0.05;
        });

        globe.pointsData(pts.concat(livePts));
      }, 60);

      canvas.classList.add("loaded");
    };

    init();

    return () => {
      cancelled = true;
      if (handles.rotateTimer !== undefined)
        window.clearInterval(handles.rotateTimer);
      if (handles.frameTimer !== undefined)
        window.clearInterval(handles.frameTimer);
      if (handles.locTimer !== undefined)
        window.clearInterval(handles.locTimer);
      if (handles.onMouseEnter)
        canvas.removeEventListener("mouseenter", handles.onMouseEnter);
      if (handles.onMouseLeave)
        canvas.removeEventListener("mouseleave", handles.onMouseLeave);
      if (handles.onResize)
        window.removeEventListener("resize", handles.onResize);
    };
  }, []);

  return (
    <div
      id="globe-canvas"
      ref={canvasRef}
      role="img"
      aria-label="Globe showing visitor locations"
    >
      <div className="loader-wrap">
        <div className="loader-dot" />
      </div>
    </div>
  );
}

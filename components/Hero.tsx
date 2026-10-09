"use client";

import { Fragment, useEffect, useRef } from "react";
import Heatmap from "./Heatmap";
import { BIRTH_DATE, NAME, QUOTE, TAGS } from "@/lib/config";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Reference text-scramble reveal: resolves over `dur` ms in 50 steps. */
function scramble(el: HTMLElement | null, text: string, dur = 1200) {
  if (!el) return;
  let n = 0;
  const steps = 50;
  const per = dur / steps;
  const id = window.setInterval(() => {
    el.textContent = text
      .split("")
      .map((ch, i) =>
        i < (n / per) * text.length
          ? text[i]
          : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
      )
      .join("");
    if (n >= per) {
      window.clearInterval(id);
      el.textContent = text;
    }
    n++;
  }, steps);
}

function SantaHat() {
  return (
    <svg
      className="svg-hat"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M20 80C20 80 35 30 70 20C70 20 60 50 80 80"
        fill="#DC2626"
        stroke="#DC2626"
        strokeWidth="2"
      />
      <circle cx="85" cy="85" r="10" fill="white" />
      <rect x="15" y="80" width="70" height="15" rx="7.5" fill="white" />
      <path
        d="M20 80C35 50 50 35 70 20"
        stroke="white"
        strokeWidth="2"
        strokeOpacity="0.2"
      />
    </svg>
  );
}

export default function Hero() {
  const timerRef = useRef<HTMLSpanElement>(null);
  const ipRef = useRef<HTMLSpanElement>(null);
  const locRef = useRef<HTMLSpanElement>(null);
  const latencyRef = useRef<HTMLSpanElement>(null);

  /* Life timer: requestAnimationFrame, at most one update per 33ms. */
  useEffect(() => {
    const el = timerRef.current;
    if (!el || !BIRTH_DATE) return;
    const birth = new Date(`${BIRTH_DATE}T00:00:00`).getTime();
    if (Number.isNaN(birth)) return;
    let last = 0;
    let raf = 0;
    const tick = (t: number) => {
      if (t - last > 33) {
        const years = (Date.now() - birth) / MS_PER_YEAR;
        el.textContent = years.toFixed(9);
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* IP + location lookup with scramble-in, like the reference. */
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const [ipRes, geoRes] = await Promise.allSettled([
        fetch("https://api.ipify.org?format=json").then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch("https://ipapi.co/json/").then((r) => (r.ok ? r.json() : null)),
      ]);
      if (cancelled) return;
      if (ipRes.status === "fulfilled" && ipRes.value?.ip) {
        scramble(ipRef.current, ipRes.value.ip);
      } else if (ipRef.current) {
        ipRef.current.textContent = "OFFLINE";
      }
      if (geoRes.status === "fulfilled" && geoRes.value) {
        const g = geoRes.value;
        scramble(
          locRef.current,
          `${g.city}, ${g.country_name}`.toUpperCase(),
        );
      } else if (locRef.current) {
        locRef.current.textContent = "UNKNOWN";
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  /* Ping: HEAD /favicon.ico, first at 2s, then every 5s. */
  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;
    const ping = async () => {
      const el = latencyRef.current;
      if (!el || cancelled) return;
      const t0 = performance.now();
      try {
        await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
        el.textContent = `${Math.round(performance.now() - t0)}ms`;
      } catch {
        el.textContent = "--ms";
      }
    };
    const start = window.setTimeout(() => {
      ping();
      interval = window.setInterval(ping, 5000);
    }, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  return (
    <header className="hero animate">
      <div className="hero-header-row">
        <div className="name-wrapper">
          <SantaHat />
          <h1>{NAME.toLowerCase()}</h1>
        </div>
        <div className="life-timer-container">
          <span className="life-label">On Earth for</span>
          <div className="timer-value">
            <span id="life-timer" ref={timerRef}>
              Calculating...
            </span>
            <span className="unit">years</span>
          </div>
        </div>
      </div>

      <p className="quote">&ldquo;{QUOTE}&rdquo;</p>

      <div className="hero-footer animate delay-1">
        <div className="roles-wrapper">
          {TAGS.map((tag, i) => (
            <Fragment key={tag}>
              {i > 0 && (
                <span className="sep" aria-hidden="true">
                  •
                </span>
              )}
              <span>{tag}</span>
            </Fragment>
          ))}
        </div>
        <div className="hud-container">
          <div className="hud-row top">
            <div className="hud-group">
              <span className="status-dot" aria-hidden="true" />
              <span className="hud-label">PING</span>
              <span id="latency-val" ref={latencyRef} className="hud-mono">
                --ms
              </span>
            </div>
          </div>
          <div className="hud-row main">
            <span id="ip-val" ref={ipRef} className="hud-mono hud-primary">
              {"\u00A0"}
            </span>
          </div>
          <div className="hud-row sub">
            <span className="hud-icon" aria-hidden="true">
              📍
            </span>
            <span id="loc-val" ref={locRef} className="hud-mono hud-secondary">
              LOCATING...
            </span>
          </div>
        </div>
      </div>

      <section className="contribution-section animate delay-1">
        <Heatmap />
      </section>
    </header>
  );
}

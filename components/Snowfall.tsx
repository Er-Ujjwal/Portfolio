"use client";

import { useEffect, useRef } from "react";

/**
 * Snowfall matching the reference exactly: "❄" emoji flakes in #cbd5e1,
 * random size .8–1.4em, opacity .4–.8, fall duration 5–10s, max 40 live
 * flakes, a new flake every 400ms, 15 staggered over the first 2s, each
 * removed after 10s. Paused while the tab is hidden.
 */
export default function Snowfall() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let spawnTimer: number | undefined;
    const initialTimers: number[] = [];
    let cancelled = false;

    const spawn = () => {
      if (cancelled || !container || container.children.length > 40) return;
      const flake = document.createElement("div");
      flake.textContent = "❄";
      flake.className = "snowflake";
      flake.style.cssText =
        `left:${Math.random() * 100}vw;` +
        `font-size:${Math.random() * 0.6 + 0.8}em;` +
        `opacity:${Math.random() * 0.4 + 0.4};` +
        `animation-duration:${Math.random() * 5 + 5}s`;
      container.appendChild(flake);
      window.setTimeout(() => flake.remove(), 10000);
    };

    const start = () => {
      for (let i = 0; i < 15; i++) {
        initialTimers.push(window.setTimeout(spawn, Math.random() * 2000));
      }
      spawnTimer = window.setInterval(spawn, 400);
    };
    const stop = () => {
      if (spawnTimer !== undefined) window.clearInterval(spawnTimer);
      initialTimers.forEach((t) => window.clearTimeout(t));
      initialTimers.length = 0;
      spawnTimer = undefined;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}

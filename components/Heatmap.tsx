"use client";

import { useEffect, useMemo, useState } from "react";
import { GITHUB_USERNAME } from "@/lib/config";

type Day = { date: string; count: number; level: number };
type Cell = Day | null;

const API_URL = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`;

function parseDay(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

/** Group days into Sunday-first week columns, padding partial weeks. */
function buildWeeks(days: Day[]): Cell[][] {
  const weeks: Cell[][] = [];
  let week: Cell[] = [];
  days.forEach((d, i) => {
    if (i === 0) {
      const pad = parseDay(d.date).getDay();
      for (let k = 0; k < pad; k++) week.push(null);
    }
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function cellTitle(cell: Day): string {
  return `${cell.count} contribution${cell.count === 1 ? "" : "s"} on ${cell.date}`;
}

/**
 * Contribution heatmap in the reference's exact markup: a label row and a
 * 10px-cell grid fed by the same contributions API the reference uses.
 * Cells are plain divs with native tooltips — nothing links anywhere.
 */
export default function Heatmap() {
  const [days, setDays] = useState<Day[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 10000);

    fetch(API_URL, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error("contributions api failed");
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        const list: Day[] = Array.isArray(d.contributions) ? d.contributions : [];
        if (list.length === 0) throw new Error("empty contributions");
        const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
        setDays(sorted);
        const apiTotal = d?.total?.lastYear;
        setTotal(
          typeof apiTotal === "number"
            ? apiTotal
            : sorted.reduce((s, x) => s + (x.count || 0), 0),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  const weeks = useMemo(() => (days ? buildWeeks(days) : []), [days]);

  if (failed) return null;

  return (
    <>
      <div className="contribution-info">
        <span className="contribution-count">
          {total == null
            ? "…"
            : `${total.toLocaleString("en-US")} contribution${total === 1 ? "" : "s"}`}
        </span>{" "}
        in the last year
      </div>
      <div className="graph-scroll-container">
        <div className="graph-grid" aria-hidden={!days}>
          {weeks.flatMap((week, wi) =>
            week.map((cell, di) =>
              cell === null ? (
                <div
                  key={`${wi}-${di}`}
                  className="contribution-cell"
                  style={{ visibility: "hidden" }}
                />
              ) : (
                <div
                  key={`${wi}-${di}`}
                  className="contribution-cell"
                  data-level={Math.min(Math.max(cell.level, 0), 4)}
                  title={cellTitle(cell)}
                />
              ),
            ),
          )}
        </div>
      </div>
    </>
  );
}

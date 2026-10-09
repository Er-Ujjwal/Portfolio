/**
 * Minimal Upstash Redis REST client.
 *
 * Uses the plain REST API (no extra dependency): single commands go to the
 * base URL, batches go to /pipeline which returns [{ result }, ...].
 * When the env vars are missing, `upstashConfigured` is false and the API
 * routes degrade gracefully instead of throwing.
 */

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const upstashConfigured = Boolean(REST_URL && REST_TOKEN);

type Command = (string | number)[];

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${REST_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash responded ${res.status}`);
  return res.json();
}

/**
 * Run several Redis commands in one round trip.
 * Resolves to the array of per-command `result` values, in order.
 */
export async function redisPipeline(commands: Command[]): Promise<unknown[]> {
  const data = (await post("/pipeline", commands)) as { result: unknown }[];
  if (!Array.isArray(data)) throw new Error("unexpected upstash pipeline payload");
  return data.map((d) => d.result);
}

/** Convert a flat HGETALL array [k1, v1, k2, v2, ...] into a record. */
export function flatArrayToRecord(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const key = String(raw[i]);
    const val = Number(raw[i + 1]);
    if (key) out[key] = Number.isFinite(val) ? val : 0;
  }
  return out;
}

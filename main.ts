/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import "$std/dotenv/load.ts";

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import config from "./fresh.config.ts";
import { fetchAndCacheShowtimes } from "./routes/api/cineboxd.ts";

// Watchlists to pre-warm (from HomePage.tsx)
const WATCHLIST_PATHS = [
  "105424/watchlist",
  "filmjournl/list/sight-sound-2025",
  "idiah/list/sight-and-sound-2024",
  "jack/list/official-top-250-films-with-the-most-fans",
  "benvsthemovies/list/the-criterion-challenge-2026",
  "fcbarcelona/list/movies-everyone-should-watch-at-least-once",
  "Snautsie/watchlist",
] as const;

// Register cron jobs for cache pre-warming
// Staggered throughout day (every ~3.5 hours, UTC times)
// Calls fetchAndCacheShowtimes() directly - no HTTP overhead
console.log("[Cron] Registering 7 staggered cache pre-warming jobs");

Deno.cron("Refresh Mark's Watchlist", "0 0 * * *", async () => {
  const start = Date.now();
  try {
    await fetchAndCacheShowtimes(WATCHLIST_PATHS[0]);
    console.log(`[Cron] ✓ ${WATCHLIST_PATHS[0]} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[Cron] ✗ ${WATCHLIST_PATHS[0]}:`, err);
  }
});

Deno.cron("Refresh Sight & Sound 2025", "30 3 * * *", async () => {
  const start = Date.now();
  try {
    await fetchAndCacheShowtimes(WATCHLIST_PATHS[1]);
    console.log(`[Cron] ✓ ${WATCHLIST_PATHS[1]} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[Cron] ✗ ${WATCHLIST_PATHS[1]}:`, err);
  }
});

Deno.cron("Refresh Sight & Sound 2024", "0 7 * * *", async () => {
  const start = Date.now();
  try {
    await fetchAndCacheShowtimes(WATCHLIST_PATHS[2]);
    console.log(`[Cron] ✓ ${WATCHLIST_PATHS[2]} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[Cron] ✗ ${WATCHLIST_PATHS[2]}:`, err);
  }
});

Deno.cron("Refresh Top 250 Most Popular", "30 10 * * *", async () => {
  const start = Date.now();
  try {
    await fetchAndCacheShowtimes(WATCHLIST_PATHS[3]);
    console.log(`[Cron] ✓ ${WATCHLIST_PATHS[3]} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[Cron] ✗ ${WATCHLIST_PATHS[3]}:`, err);
  }
});

Deno.cron("Refresh Criterion Challenge 2026", "0 14 * * *", async () => {
  const start = Date.now();
  try {
    await fetchAndCacheShowtimes(WATCHLIST_PATHS[4]);
    console.log(`[Cron] ✓ ${WATCHLIST_PATHS[4]} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[Cron] ✗ ${WATCHLIST_PATHS[4]}:`, err);
  }
});

Deno.cron("Refresh Movies Everyone Should Watch", "30 17 * * *", async () => {
  const start = Date.now();
  try {
    await fetchAndCacheShowtimes(WATCHLIST_PATHS[5]);
    console.log(`[Cron] ✓ ${WATCHLIST_PATHS[5]} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[Cron] ✗ ${WATCHLIST_PATHS[5]}:`, err);
  }
});

Deno.cron("Refresh Snautsie's Watchlist", "0 21 * * *", async () => {
  const start = Date.now();
  try {
    await fetchAndCacheShowtimes(WATCHLIST_PATHS[6]);
    console.log(`[Cron] ✓ ${WATCHLIST_PATHS[6]} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`[Cron] ✗ ${WATCHLIST_PATHS[6]}:`, err);
  }
});

console.log("[Cron] All cron jobs registered successfully");

await start(manifest, config);

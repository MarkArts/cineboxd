// Cache prewarm worker: keeps the watchlist caches warm so user requests
// are always cache hits. Replaces the Deno.cron jobs that ran inside the
// API process. Round-robin: one list every INTERVAL_MS, so each list is
// refreshed roughly once a day.

import {
  fetchAndCacheShowtimes,
  WATCHLIST_PATHS,
} from "../routes/api/cineboxd.ts";

const INTERVAL_MS = (24 * 60 * 60 * 1000) / WATCHLIST_PATHS.length; // ~3.4h

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

console.log(
  `[Worker] started: ${WATCHLIST_PATHS.length} lists, refreshing one every ${
    Math.round(INTERVAL_MS / 60000)
  } minutes`,
);

let index = 0;
while (true) {
  const listPath = WATCHLIST_PATHS[index % WATCHLIST_PATHS.length];
  const startedAt = Date.now();
  console.log(`[Worker] refreshing "${listPath}"...`);
  try {
    await fetchAndCacheShowtimes(listPath, { force: true });
    console.log(
      `[Worker] refreshed "${listPath}" in ${
        Math.round((Date.now() - startedAt) / 1000)
      }s`,
    );
  } catch (err) {
    console.error(`[Worker] refresh failed for "${listPath}":`, err);
  }
  index++;
  await sleep(INTERVAL_MS);
}

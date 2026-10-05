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
import { warmUpCache } from "./utils/cache.ts";

// Cache pre-warming used to run as Deno.cron jobs here. It now runs in the
// dedicated worker service (worker/main.ts), which shares the Valkey cache
// with this API.

// Connect the cache backend before serving so the first request does not
// pay connection latency
await warmUpCache();

await start(manifest, config);

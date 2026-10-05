/// <reference lib="deno.unstable" />

// Two-tier cache for showtimes and TMDB metadata.
//
// Preferred backend: Valkey (Redis-compatible) when VALKEY_URL (or
// REDIS_URL) is set — survives app restarts when run as a separate
// service with a persistent volume. Falls back to Deno KV (chunked,
// ephemeral) when no Valkey is configured, e.g. local development.

const CACHE_TTL_SECONDS = 36 * 60 * 60; // 36 hours for showtimes
const METADATA_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days for TMDB
const CHUNK_SIZE = 60000; // 60KB chunks (under Deno KV's 64KB value limit)

const VALKEY_URL = (Deno.env.get("VALKEY_URL") ||
  Deno.env.get("REDIS_URL") || "").replace(/^valkey:\/\//, "redis://");

import RedisModule from "npm:ioredis@5.4.2";

type ValkeyClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
};

// ioredis's CJS typings resolve oddly under Deno's type checker; the runtime
// default export is the Redis constructor.
const Redis = RedisModule as unknown as {
  new (
    url: string,
    opts?: Record<string, unknown>,
  ): {
    on(event: string, listener: (err: Error) => void): void;
    once(event: string, listener: () => void): void;
    status: string;
  } & ValkeyClient;
};

let valkeyClient: ValkeyClient | null | undefined;
let valkeyHealthy = true;

async function getValkey(): Promise<ValkeyClient | null> {
  if (valkeyClient !== undefined) return valkeyClient;
  if (!VALKEY_URL) {
    valkeyClient = null;
    return null;
  }
  try {
    const client = new Redis(VALKEY_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 2000,
    });
    client.on("error", (err: Error) => {
      if (valkeyHealthy) {
        valkeyHealthy = false;
        console.warn("[Cache] Valkey error (will retry per request):", err.message);
        setTimeout(() => (valkeyHealthy = true), 60000);
      }
    });
    valkeyClient = client as unknown as ValkeyClient;
    // Wait for the connection to become ready: clients created inside a
    // Deno.serve handler otherwise time out their first command. Give up
    // after a grace period; later requests retry and fall back to KV if
    // Valkey never comes up.
    await new Promise<void>((resolve) => {
      if (client.status === "ready") return resolve();
      const timer = setTimeout(resolve, 4000);
      client.once("ready", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    console.log(`[Cache] Valkey client ready (${client.status})`);
    return valkeyClient;
  } catch (e) {
    console.warn("[Cache] Valkey unavailable, using Deno KV fallback:", e);
    valkeyClient = null;
    return null;
  }
}

// ---- Deno KV fallback (chunked values) ----

let kv: Deno.Kv | null = null;

async function getKv(): Promise<Deno.Kv | null> {
  if (kv) return kv;
  try {
    kv = await Deno.openKv();
    console.log("Deno KV initialized");
    return kv;
  } catch (e) {
    console.warn("Deno KV not available:", e);
  }
  return null;
}

async function getCachedKv<T>(key: string): Promise<T | null> {
  const store = await getKv();
  if (!store) return null;

  try {
    const meta = await store.get<{ chunks: number; timestamp: number }>([
      "cache",
      key,
      "meta",
    ]);
    if (!meta.value) return null;

    const age = Date.now() - meta.value.timestamp;
    if (age >= CACHE_TTL_SECONDS * 1000) {
      console.log(`Cache expired for ${key}`);
      const deleteOps = store.atomic();
      deleteOps.delete(["cache", key, "meta"]);
      for (let i = 0; i < meta.value.chunks; i++) {
        deleteOps.delete(["cache", key, "chunk", i]);
      }
      await deleteOps.commit();
      return null;
    }

    const chunks: string[] = [];
    for (let i = 0; i < meta.value.chunks; i++) {
      const chunk = await store.get<string>(["cache", key, "chunk", i]);
      if (!chunk.value) {
        console.warn(`Missing chunk ${i} for ${key}`);
        return null;
      }
      chunks.push(chunk.value);
    }

    console.log(
      `Cache HIT for ${key} (KV, age: ${Math.round(age / 1000)}s)`,
    );
    return JSON.parse(chunks.join("")) as T;
  } catch (e) {
    console.warn("Cache read error:", e);
  }
  return null;
}

async function setCacheKv<T>(key: string, data: T): Promise<void> {
  const store = await getKv();
  if (!store) return;

  try {
    const json = JSON.stringify(data);
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += CHUNK_SIZE) {
      chunks.push(json.slice(i, i + CHUNK_SIZE));
    }

    await store.set(["cache", key, "meta"], {
      chunks: chunks.length,
      timestamp: Date.now(),
    });

    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const ops = store.atomic();
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      for (let i = batchStart; i < batchEnd; i++) {
        ops.set(["cache", key, "chunk", i], chunks[i]);
      }
      await ops.commit();
    }

    console.log(`Cached ${key} in KV (${chunks.length} chunks, ${json.length} bytes)`);
  } catch (e) {
    console.warn("Cache write error:", e);
  }
}

// ---- Public API ----

// Connect early (e.g. at server startup) so the first request does not pay
// the connection latency inside a Deno.serve handler.
export async function warmUpCache(): Promise<void> {
  await getValkey();
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = await getValkey();
  if (client) {
    try {
      const raw = await client.get(key);
      if (raw === null) return null;
      console.log(`Cache HIT for ${key} (Valkey, ${raw.length} bytes)`);
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn("[Cache] Valkey read failed, falling back to KV:", e);
    }
  }
  return getCachedKv<T>(key);
}

export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds = CACHE_TTL_SECONDS,
): Promise<void> {
  const client = await getValkey();
  if (client) {
    try {
      const json = JSON.stringify(data);
      await client.set(key, json, "EX", ttlSeconds);
      console.log(
        `Cached ${key} in Valkey (${json.length} bytes, TTL ${ttlSeconds}s)`,
      );
      return;
    } catch (e) {
      console.warn("[Cache] Valkey write failed, falling back to KV:", e);
    }
  }
  await setCacheKv(key, data);
}

// ---- TMDB metadata cache (30-day TTL) ----

export async function getCachedTMDBMetadata<T>(
  title: string,
): Promise<T | null | undefined> {
  const client = await getValkey();
  const key = `tmdb:${title.toLowerCase()}`;
  if (client) {
    try {
      const raw = await client.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  const store = await getKv();
  if (!store) return undefined;

  try {
    const result = await store.get<
      { data: T | null; timestamp: number }
    >(["tmdb", title.toLowerCase()]);
    if (!result.value) return undefined;

    const { data, timestamp } = result.value;
    if (Date.now() - timestamp >= METADATA_CACHE_TTL_SECONDS * 1000) {
      return undefined;
    }
    return data;
  } catch {
    return undefined;
  }
}

export async function setCachedTMDBMetadata<T>(
  title: string,
  data: T | null,
): Promise<void> {
  const client = await getValkey();
  const key = `tmdb:${title.toLowerCase()}`;
  if (client) {
    try {
      await client.set(key, JSON.stringify(data), "EX", METADATA_CACHE_TTL_SECONDS);
      return;
    } catch {
      // ignore cache errors
      return;
    }
  }

  const store = await getKv();
  if (!store) return;
  try {
    await store.set(["tmdb", title.toLowerCase()], {
      data,
      timestamp: Date.now(),
    });
  } catch {
    // ignore cache errors
  }
}

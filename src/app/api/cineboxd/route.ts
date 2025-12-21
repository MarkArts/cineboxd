import { NextRequest, NextResponse } from 'next/server';

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;
const CHUNK_SIZE = 60000; // 60KB chunks (under 64KB limit)

// Deno KV singleton
// @ts-ignore - Deno types not available in Next.js build
let kv: any = null;

async function getKv(): Promise<any> {
  if (kv) return kv;
  try {
    // @ts-ignore - Deno global
    if (typeof Deno !== 'undefined' && Deno.openKv) {
      // @ts-ignore
      kv = await Deno.openKv();
      console.log('Deno KV initialized');
      return kv;
    }
  } catch (e) {
    console.warn('Deno KV not available:', e);
  }
  return null;
}

async function getCached<T>(key: string): Promise<T | null> {
  const store = await getKv();
  if (!store) return null;

  try {
    // Get metadata
    const meta = await store.get(['cache', key, 'meta']);
    if (!meta.value) return null;

    // Check TTL
    const age = Date.now() - meta.value.timestamp;
    if (age >= CACHE_TTL_MS) {
      console.log(`Cache expired for ${key}`);
      // Clean up expired cache
      const deleteOps = store.atomic();
      deleteOps.delete(['cache', key, 'meta']);
      for (let i = 0; i < meta.value.chunks; i++) {
        deleteOps.delete(['cache', key, 'chunk', i]);
      }
      await deleteOps.commit();
      return null;
    }

    // Fetch all chunks
    const chunks: string[] = [];
    for (let i = 0; i < meta.value.chunks; i++) {
      const chunk = await store.get(['cache', key, 'chunk', i]);
      if (!chunk.value) {
        console.warn(`Missing chunk ${i} for ${key}`);
        return null;
      }
      chunks.push(chunk.value);
    }

    console.log(`Cache HIT for ${key} (age: ${Math.round(age / 1000)}s, chunks: ${meta.value.chunks})`);
    return JSON.parse(chunks.join('')) as T;
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  return null;
}

async function setCache<T>(key: string, data: T): Promise<void> {
  const store = await getKv();
  if (!store) return;

  try {
    const json = JSON.stringify(data);
    const chunks: string[] = [];

    // Split into chunks
    for (let i = 0; i < json.length; i += CHUNK_SIZE) {
      chunks.push(json.slice(i, i + CHUNK_SIZE));
    }

    // Store chunks atomically
    const ops = store.atomic();
    ops.set(['cache', key, 'meta'], { chunks: chunks.length, timestamp: Date.now() });
    for (let i = 0; i < chunks.length; i++) {
      ops.set(['cache', key, 'chunk', i], chunks[i]);
    }
    await ops.commit();

    console.log(`Cached ${key} (${chunks.length} chunks, ${json.length} bytes)`);
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

const getWatchlist = (username: string) =>
  fetch(`https://letterboxd-list-radarr.onrender.com/${username}/watchlist/`).then(
    (r) => {
      if (!r.ok) throw new Error(`Failed to fetch watchlist for ${username}: ${r.status}`);
      return r.json();
    }
  );

type ProductionIds = { data: { films: { data: { id: string; title?: string }[] } } };

const getProductionIds = async (username: string): Promise<ProductionIds> => {
  const watchlist = (await getWatchlist(username)) as { title: string }[];

  const titleList = watchlist
    .map((x) => `"${x.title.replace(/"/g, '\\"')}"`)
    .join(",");

  const query = JSON.stringify({
    query: `{
  films(page: {limit: 999} filters:  {
     title:  {
         in: [${titleList}]
     }
  }) {
    data {
      title
      id
    }
  }
}`,
  });

  const data = await fetch("https://cineville.nl/api/graphql", {
    method: "POST",
    body: query,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

  if (!data.ok) {
    throw new Error(`Cineville films query failed:" ${await data.text()}`);
  }

  const json = await data.json();
  return json;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = (searchParams.get("username") || "105424").trim();

    // Check cache first
    const cacheKey = `showtimes:${username}`;
    const cached = await getCached<any>(cacheKey);
    if (cached) {
      const CACHE_SECONDS = 60 * 60; // 1 hour for HTTP cache too
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
          'Surrogate-Control': `max-age=${CACHE_SECONDS}`,
          'Vary': 'Accept-Encoding',
          'X-Cache': 'HIT',
        },
      });
    }

    const currentDate = new Date().toISOString();

    const productionIds = await getProductionIds(username);

    const productionIdList = productionIds.data.films.data
      .map((x) => `"${x.id}"`)
      .join(",");

    const showtimesQuery = JSON.stringify({
      query: `{
  showtimes(page: {limit: 999}, filters:  {
     productionId:  {
        in: [${productionIdList}]
     }
      startDate:  {
        gt: "${currentDate}"
     }
  }) {
    data {
      id,
      startDate
      endDate
      film {
        title
        slug
        poster {
          url
        }
        duration
        directors
      }
      ticketingUrl
      theater {
        name
        address {
          city
        }        
      }
    }
  }
}`,
    });

    const data = await fetch("https://cineville.nl/api/graphql", {
      method: "POST",
      body: showtimesQuery,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });

    if (!data.ok) {
      throw new Error(`Cineville showtimes query failed: ${await data.text()}`);
    }

    const resp = await data.json();

    // Store in cache
    await setCache(cacheKey, resp);

    const CACHE_SECONDS = 60 * 60; // 1 hour

    return NextResponse.json(resp, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
        'Surrogate-Control': `max-age=${CACHE_SECONDS}`,
        'Vary': 'Accept-Encoding',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
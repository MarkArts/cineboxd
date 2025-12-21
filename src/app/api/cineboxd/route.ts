import { NextRequest, NextResponse } from 'next/server';

// In-memory cache (1 hour TTL)
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

const cache = new Map<string, { data: any; timestamp: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry) {
    const age = Date.now() - entry.timestamp;
    if (age < CACHE_TTL_MS) {
      console.log(`Cache HIT for ${key} (age: ${Math.round(age / 1000)}s)`);
      return entry.data as T;
    }
    console.log(`Cache expired for ${key}`);
    cache.delete(key);
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`Cached ${key}`);
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
    const cached = getCached<any>(cacheKey);
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
    setCache(cacheKey, resp);

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
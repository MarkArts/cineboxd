import { NextRequest, NextResponse } from 'next/server';

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

    const CACHE_SECONDS = 60 * 10; // 10 minutes
    
    return NextResponse.json(resp, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
        'Surrogate-Control': `max-age=${CACHE_SECONDS}`,
        'Vary': 'Accept-Encoding',
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
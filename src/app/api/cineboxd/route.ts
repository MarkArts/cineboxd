import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - skip static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;
const CHUNK_SIZE = 60000; // 60KB chunks (under 64KB limit)

// Pathé API configuration (new working endpoints on pathe.nl)
const PATHE_BASE_URL = 'https://www.pathe.nl/api';
const PATHE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

// TMDB API configuration for enriching movie metadata
// Get your free API key from https://www.themoviedb.org/settings/api
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// All Pathé cinema locations in the Netherlands (32 theaters, 22 cities)
// Full list available, but we query only major cities for performance
const PATHE_CINEMAS_ALL: { slug: string; city: string; name: string }[] = [
  // Amsterdam (4 locations)
  { slug: 'pathe-arena', city: 'Amsterdam', name: 'Pathé Arena' },
  { slug: 'pathe-city', city: 'Amsterdam', name: 'Pathé City' },
  { slug: 'pathe-de-munt', city: 'Amsterdam', name: 'Pathé De Munt' },
  { slug: 'pathe-amsterdam-noord', city: 'Amsterdam', name: 'Pathé Noord' },
  { slug: 'pathe-tuschinski', city: 'Amsterdam', name: 'Pathé Tuschinski' },
  // Den Haag (4 locations)
  { slug: 'pathe-buitenhof', city: 'Den Haag', name: 'Pathé Buitenhof' },
  { slug: 'pathe-scheveningen', city: 'Den Haag', name: 'Pathé Scheveningen' },
  { slug: 'pathe-spuimarkt', city: 'Den Haag', name: 'Pathé Spuimarkt' },
  { slug: 'pathe-ypenburg', city: 'Den Haag', name: 'Pathé Ypenburg' },
  // Rotterdam (3 locations)
  { slug: 'pathe-de-kuip', city: 'Rotterdam', name: 'Pathé De Kuip' },
  { slug: 'pathe-schouwburgplein', city: 'Rotterdam', name: 'Pathé Schouwburgplein' },
  { slug: 'pathe-schiedam', city: 'Schiedam', name: 'Pathé Schiedam' },
  // Utrecht (2 locations)
  { slug: 'pathe-rembrandt-utrecht', city: 'Utrecht', name: 'Pathé Rembrandt' },
  { slug: 'pathe-utrecht-leidsche-rijn', city: 'Utrecht', name: 'Pathé Leidsche Rijn' },
  // Tilburg (2 locations)
  { slug: 'pathe-tilburg-centrum', city: 'Tilburg', name: 'Pathé Tilburg Centrum' },
  { slug: 'pathe-tilburg-stappegoor', city: 'Tilburg', name: 'Pathé Tilburg Stappegoor' },
  // Other cities (single locations)
  { slug: 'pathe-amersfoort', city: 'Amersfoort', name: 'Pathé Amersfoort' },
  { slug: 'pathe-arnhem', city: 'Arnhem', name: 'Pathé Arnhem' },
  { slug: 'pathe-breda', city: 'Breda', name: 'Pathé Breda' },
  { slug: 'pathe-delft', city: 'Delft', name: 'Pathé Delft' },
  { slug: 'pathe-ede', city: 'Ede', name: 'Pathé Ede' },
  { slug: 'pathe-eindhoven', city: 'Eindhoven', name: 'Pathé Eindhoven' },
  { slug: 'pathe-groningen', city: 'Groningen', name: 'Pathé Groningen' },
  { slug: 'pathe-haarlem', city: 'Haarlem', name: 'Pathé Haarlem' },
  { slug: 'pathe-helmond', city: 'Helmond', name: 'Pathé Helmond' },
  { slug: 'pathe-leeuwarden', city: 'Leeuwarden', name: 'Pathé Leeuwarden' },
  { slug: 'pathe-maastricht', city: 'Maastricht', name: 'Pathé Maastricht' },
  { slug: 'pathe-nijmegen', city: 'Nijmegen', name: 'Pathé Nijmegen' },
  { slug: 'pathe-vlissingen', city: 'Vlissingen', name: 'Pathé Vlissingen' },
  { slug: 'pathe-zaandam', city: 'Zaandam', name: 'Pathé Zaandam' },
  { slug: 'pathe-zwolle', city: 'Zwolle', name: 'Pathé Zwolle' },
];

// Major Pathé cinemas (one per major city) for faster API response
const PATHE_CINEMAS: { slug: string; city: string; name: string }[] = [
  { slug: 'pathe-de-munt', city: 'Amsterdam', name: 'Pathé De Munt' },
  { slug: 'pathe-buitenhof', city: 'Den Haag', name: 'Pathé Buitenhof' },
  { slug: 'pathe-schouwburgplein', city: 'Rotterdam', name: 'Pathé Schouwburgplein' },
  { slug: 'pathe-rembrandt-utrecht', city: 'Utrecht', name: 'Pathé Rembrandt' },
  { slug: 'pathe-eindhoven', city: 'Eindhoven', name: 'Pathé Eindhoven' },
  { slug: 'pathe-groningen', city: 'Groningen', name: 'Pathé Groningen' },
  { slug: 'pathe-breda', city: 'Breda', name: 'Pathé Breda' },
  { slug: 'pathe-arnhem', city: 'Arnhem', name: 'Pathé Arnhem' },
  { slug: 'pathe-tilburg-centrum', city: 'Tilburg', name: 'Pathé Tilburg' },
  { slug: 'pathe-haarlem', city: 'Haarlem', name: 'Pathé Haarlem' },
  { slug: 'pathe-nijmegen', city: 'Nijmegen', name: 'Pathé Nijmegen' },
  { slug: 'pathe-maastricht', city: 'Maastricht', name: 'Pathé Maastricht' },
  { slug: 'pathe-zwolle', city: 'Zwolle', name: 'Pathé Zwolle' },
  { slug: 'pathe-amersfoort', city: 'Amersfoort', name: 'Pathé Amersfoort' },
  { slug: 'pathe-leeuwarden', city: 'Leeuwarden', name: 'Pathé Leeuwarden' },
];

// Shared Show interface (matches frontend)
interface Show {
  id: string;
  startDate: string;
  endDate: string;
  ticketingUrl: string;
  film: {
    title: string;
    slug: string;
    poster?: { url: string };
    duration: number;
    directors: string[];
  };
  theater: {
    name: string;
    address?: { city: string };
  };
  chain?: 'cineville' | 'pathe';
}

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

// ============ TMDB API Functions ============

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
}

interface TMDBMovieDetails {
  id: number;
  title: string;
  poster_path: string | null;
  runtime: number;
  credits?: {
    crew: { job: string; name: string }[];
  };
}

// In-memory cache for TMDB lookups (per-request)
const tmdbCache = new Map<string, TMDBMovieDetails | null>();

// Search TMDB for a movie by title
const searchTMDB = async (title: string): Promise<TMDBMovie | null> => {
  try {
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0] || null;
  } catch (e) {
    return null;
  }
};

// Get movie details from TMDB including credits (directors)
const getTMDBDetails = async (movieId: number): Promise<TMDBMovieDetails | null> => {
  try {
    const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch (e) {
    return null;
  }
};

// Get movie metadata from TMDB (poster, directors, duration)
const getMovieMetadata = async (title: string): Promise<{
  poster?: { url: string };
  directors: string[];
  duration: number;
} | null> => {
  // Skip if no API key configured
  if (!TMDB_API_KEY) return null;

  // Check cache first
  const cacheKey = title.toLowerCase();
  if (tmdbCache.has(cacheKey)) {
    const cached = tmdbCache.get(cacheKey);
    if (!cached) return null;
    return {
      poster: cached.poster_path ? { url: `${TMDB_IMAGE_BASE}${cached.poster_path}` } : undefined,
      directors: cached.credits?.crew.filter(c => c.job === 'Director').map(c => c.name) || [],
      duration: cached.runtime || 0,
    };
  }

  // Search for movie
  const searchResult = await searchTMDB(title);
  if (!searchResult) {
    tmdbCache.set(cacheKey, null);
    return null;
  }

  // Get full details
  const details = await getTMDBDetails(searchResult.id);
  tmdbCache.set(cacheKey, details);

  if (!details) return null;

  return {
    poster: details.poster_path ? { url: `${TMDB_IMAGE_BASE}${details.poster_path}` } : undefined,
    directors: details.credits?.crew.filter(c => c.job === 'Director').map(c => c.name) || [],
    duration: details.runtime || 0,
  };
};

// ============ Pathé API Functions ============

// Generate date strings for next N days
const generateDateRange = (days: number = 14): string[] => {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// Pathé zone show data structure
interface PatheZoneShow {
  slug: string;
  tags: string[];
  bookable: boolean;
  isKids: boolean;
}

// Pathé showtime data structure
interface PatheShowtime {
  status: string;
  time: string;  // "2025-12-21 17:00:00"
  version: string;  // "ov" for original version
  tags: string[];
  refCmd: string;  // ticket URL
  auditoriumName: string;
  endTime: string;
}

// Fetch all films showing in Pathé from zone API
const fetchPatheZone = async (zone: string = 'amsterdam'): Promise<PatheZoneShow[]> => {
  try {
    const response = await fetch(`${PATHE_BASE_URL}/zone/${zone}`, {
      headers: { 'User-Agent': PATHE_USER_AGENT },
    });
    if (!response.ok) {
      console.warn(`Failed to fetch Pathé zone ${zone}:`, response.status);
      return [];
    }
    const data = await response.json();
    return data.shows || [];
  } catch (e) {
    console.warn(`Failed to fetch Pathé zone ${zone}:`, e);
    return [];
  }
};

// Fetch showtimes for a specific film/cinema/date
const fetchPatheShowtimesForCinema = async (
  filmSlug: string,
  cinemaSlug: string,
  date: string
): Promise<PatheShowtime[]> => {
  try {
    const url = `${PATHE_BASE_URL}/show/${filmSlug}/showtimes/${cinemaSlug}/${date}?language=nl`;
    const response = await fetch(url, {
      headers: { 'User-Agent': PATHE_USER_AGENT },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
};

// Normalize title for matching (lowercase, no accents, no punctuation)
const normalizeTitle = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '')     // Remove punctuation
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
};

// Extract readable title from Pathé slug (e.g., "avatar-fire-and-ash-40584" -> "avatar fire and ash")
const slugToTitle = (slug: string): string => {
  return slug
    .replace(/-\d+$/, '')  // Remove trailing ID number
    .replace(/-nederlands-gesproken$/, '')  // Remove Dutch dub indicator
    .replace(/-originele-versie$/, '')  // Remove original version indicator
    .replace(/-/g, ' ')  // Replace hyphens with spaces
    .trim();
};

// Match Pathé zone shows against watchlist titles
const matchPatheFilmsFromZone = (
  watchlistTitles: string[],
  zoneShows: PatheZoneShow[]
): PatheZoneShow[] => {
  const normalizedWatchlist = watchlistTitles.map(normalizeTitle);

  return zoneShows.filter(show => {
    if (!show.bookable) return false;
    const normalizedSlugTitle = normalizeTitle(slugToTitle(show.slug));

    return normalizedWatchlist.some(watchlistTitle =>
      normalizedSlugTitle === watchlistTitle ||
      normalizedSlugTitle.includes(watchlistTitle) ||
      watchlistTitle.includes(normalizedSlugTitle)
    );
  });
};

// Convert Pathé showtime to Show interface
const patheShowtimeToShow = (
  showtime: PatheShowtime,
  filmSlug: string,
  filmTitle: string,
  cinema: { slug: string; city: string; name: string },
  tmdbMetadata?: { poster?: { url: string }; directors: string[]; duration: number } | null
): Show => {
  // Parse "2025-12-21 17:00:00" to ISO format
  const startDate = new Date(showtime.time.replace(' ', 'T') + '+01:00').toISOString();
  const endDate = showtime.endTime
    ? new Date(showtime.endTime.replace(' ', 'T') + '+01:00').toISOString()
    : startDate;

  return {
    id: `pathe-${filmSlug}-${cinema.slug}-${showtime.time}`,
    startDate,
    endDate,
    ticketingUrl: showtime.refCmd || `https://www.pathe.nl/nl/films/${filmSlug}`,
    film: {
      title: filmTitle,
      slug: filmSlug,
      poster: tmdbMetadata?.poster,
      duration: tmdbMetadata?.duration || 0,
      directors: tmdbMetadata?.directors || [],
    },
    theater: {
      name: cinema.name,
      address: { city: cinema.city },
    },
    chain: 'pathe',
  };
};

// Fetch and process Pathé showtimes for given watchlist titles
const fetchPatheShowtimes = async (watchlistTitles: string[]): Promise<Show[]> => {
  try {
    // Get all films showing at Pathé
    const zoneShows = await fetchPatheZone('amsterdam');
    console.log(`Pathé: fetched ${zoneShows.length} films from zone`);

    // Match against watchlist
    const matchedFilms = matchPatheFilmsFromZone(watchlistTitles, zoneShows);
    console.log(`Pathé: matched ${matchedFilms.length} films from watchlist`);

    if (matchedFilms.length === 0) return [];

    // Pre-fetch TMDB metadata for all matched films in parallel (if API key configured)
    const filmTitles = matchedFilms.map(f => {
      const title = slugToTitle(f.slug);
      return title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    });

    const metadataMap = new Map<string, Awaited<ReturnType<typeof getMovieMetadata>>>();

    if (TMDB_API_KEY) {
      console.log(`Pathé: fetching TMDB metadata for ${filmTitles.length} films`);
      const tmdbMetadataPromises = filmTitles.map(title => getMovieMetadata(title));
      const tmdbMetadata = await Promise.all(tmdbMetadataPromises);
      filmTitles.forEach((title, i) => metadataMap.set(title, tmdbMetadata[i]));
      console.log(`Pathé: got TMDB metadata for ${tmdbMetadata.filter(m => m !== null).length} films`);
    } else {
      console.log('Pathé: TMDB_API_KEY not set, skipping metadata enrichment');
    }

    // Generate dates for next 3 days (balance between coverage and API calls)
    const dates = generateDateRange(3);
    const shows: Show[] = [];

    // Fetch showtimes for each matched film from each cinema
    // Process films in parallel, but batch cinema requests to avoid overwhelming the API
    const filmPromises = matchedFilms.map(async (film) => {
      const filmTitle = slugToTitle(film.slug)
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const metadata = metadataMap.get(filmTitle);

      // Fetch all cinema/date combinations in parallel for this film
      const requests = PATHE_CINEMAS.flatMap(cinema =>
        dates.map(date => ({
          cinema,
          date,
          promise: fetchPatheShowtimesForCinema(film.slug, cinema.slug, date),
        }))
      );

      const results = await Promise.all(requests.map(r => r.promise));

      return requests
        .flatMap((req, i) =>
          results[i].map(st => patheShowtimeToShow(st, film.slug, filmTitle, req.cinema, metadata))
        );
    });

    const filmResults = await Promise.all(filmPromises);
    shows.push(...filmResults.flat());

    console.log(`Pathé: fetched ${shows.length} total showtimes`);
    return shows;
  } catch (e) {
    console.error('Pathé fetch failed:', e);
    return [];
  }
};

// ============ Letterboxd & Cineville Functions ============

const getWatchlist = (username: string) =>
  fetch(`https://letterboxd-list-radarr.onrender.com/${username}/watchlist/`).then(
    (r) => {
      if (!r.ok) throw new Error(`Failed to fetch watchlist for ${username}: ${r.status}`);
      return r.json();
    }
  );

type ProductionIds = { data: { films: { data: { id: string; title?: string }[] } } };

// Get Cineville production IDs from film titles
const getCinevilleProductionIds = async (titles: string[]): Promise<ProductionIds> => {
  const titleList = titles
    .map((t) => `"${t.replace(/"/g, '\\"')}"`)
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
    throw new Error(`Cineville films query failed: ${await data.text()}`);
  }

  return data.json();
};

// Fetch Cineville showtimes for given watchlist titles
const fetchCinevilleShowtimes = async (watchlistTitles: string[]): Promise<Show[]> => {
  try {
    const productionIds = await getCinevilleProductionIds(watchlistTitles);

    if (!productionIds.data?.films?.data?.length) {
      console.log('Cineville: no matching films found');
      return [];
    }

    const productionIdList = productionIds.data.films.data
      .map((x) => `"${x.id}"`)
      .join(",");

    const currentDate = new Date().toISOString();
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

    const response = await fetch("https://cineville.nl/api/graphql", {
      method: "POST",
      body: showtimesQuery,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });

    if (!response.ok) {
      throw new Error(`Cineville showtimes query failed: ${await response.text()}`);
    }

    const result = await response.json();
    const shows = result?.data?.showtimes?.data || [];

    console.log(`Cineville: fetched ${shows.length} showtimes`);

    // Add chain identifier to each show
    return shows.map((show: any) => ({ ...show, chain: 'cineville' as const }));
  } catch (e) {
    console.error('Cineville fetch failed:', e);
    return [];
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = (searchParams.get("username") || "105424").trim();

    // Check cache first (v8 with TMDB metadata)
    const cacheKey = `showtimes:v8:${username}`;
    const cached = await getCached<any>(cacheKey);
    if (cached) {
      const CACHE_SECONDS = 60 * 60;
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

    // Fetch watchlist first
    const watchlist = (await getWatchlist(username)) as { title: string }[];
    const watchlistTitles = watchlist.map((x) => x.title);

    console.log(`Fetching showtimes for ${watchlistTitles.length} films from watchlist`);

    // Fetch from both sources in parallel with graceful degradation
    const [cinevilleResult, patheResult] = await Promise.allSettled([
      fetchCinevilleShowtimes(watchlistTitles),
      fetchPatheShowtimes(watchlistTitles),
    ]);

    // Extract results, defaulting to empty arrays on failure
    const cinevilleShows = cinevilleResult.status === 'fulfilled' ? cinevilleResult.value : [];
    const patheShows = patheResult.status === 'fulfilled' ? patheResult.value : [];

    // Log any failures
    if (cinevilleResult.status === 'rejected') {
      console.error('Cineville fetch rejected:', cinevilleResult.reason);
    }
    if (patheResult.status === 'rejected') {
      console.error('Pathé fetch rejected:', patheResult.reason);
    }

    // Merge all showtimes
    const allShows = [...cinevilleShows, ...patheShows];

    console.log(`Total: ${allShows.length} showtimes (Cineville: ${cinevilleShows.length}, Pathé: ${patheShows.length})`);

    // Format response to match expected structure
    const resp = { data: { showtimes: { data: allShows } } };

    // Store in cache
    await setCache(cacheKey, resp);

    const CACHE_SECONDS = 60 * 60;

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
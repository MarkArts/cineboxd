/// <reference lib="deno.unstable" />
import { Handlers } from "$fresh/server.ts";

// Cache TTLs
const CACHE_TTL_MS = 36 * 60 * 60 * 1000; // 36 hours for showtimes
const METADATA_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for TMDB metadata
const CHUNK_SIZE = 60000; // 60KB chunks (under 64KB limit)

// Pathé API configuration (new working endpoints on pathe.nl)
const PATHE_BASE_URL = "https://www.pathe.nl/api";
const PATHE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

// TMDB API configuration for enriching movie metadata
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// All Pathé cinema locations in the Netherlands
const PATHE_CINEMAS: { slug: string; city: string; name: string }[] = [
  // Amsterdam (5 locations)
  { slug: "pathe-arena", city: "Amsterdam", name: "Pathé Arena" },
  { slug: "pathe-city", city: "Amsterdam", name: "Pathé City" },
  { slug: "pathe-de-munt", city: "Amsterdam", name: "Pathé De Munt" },
  { slug: "pathe-amsterdam-noord", city: "Amsterdam", name: "Pathé Noord" },
  { slug: "pathe-tuschinski", city: "Amsterdam", name: "Pathé Tuschinski" },
  // Den Haag (4 locations)
  { slug: "pathe-buitenhof", city: "Den Haag", name: "Pathé Buitenhof" },
  { slug: "pathe-scheveningen", city: "Den Haag", name: "Pathé Scheveningen" },
  { slug: "pathe-spuimarkt", city: "Den Haag", name: "Pathé Spuimarkt" },
  { slug: "pathe-ypenburg", city: "Den Haag", name: "Pathé Ypenburg" },
  // Rotterdam (3 locations)
  { slug: "pathe-de-kuip", city: "Rotterdam", name: "Pathé De Kuip" },
  {
    slug: "pathe-schouwburgplein",
    city: "Rotterdam",
    name: "Pathé Schouwburgplein",
  },
  { slug: "pathe-schiedam", city: "Schiedam", name: "Pathé Schiedam" },
  // Utrecht (2 locations)
  { slug: "pathe-rembrandt-utrecht", city: "Utrecht", name: "Pathé Rembrandt" },
  {
    slug: "pathe-utrecht-leidsche-rijn",
    city: "Utrecht",
    name: "Pathé Leidsche Rijn",
  },
  // Tilburg (2 locations)
  {
    slug: "pathe-tilburg-centrum",
    city: "Tilburg",
    name: "Pathé Tilburg Centrum",
  },
  {
    slug: "pathe-tilburg-stappegoor",
    city: "Tilburg",
    name: "Pathé Tilburg Stappegoor",
  },
  // Other cities (single locations)
  { slug: "pathe-amersfoort", city: "Amersfoort", name: "Pathé Amersfoort" },
  { slug: "pathe-arnhem", city: "Arnhem", name: "Pathé Arnhem" },
  { slug: "pathe-breda", city: "Breda", name: "Pathé Breda" },
  { slug: "pathe-delft", city: "Delft", name: "Pathé Delft" },
  { slug: "pathe-ede", city: "Ede", name: "Pathé Ede" },
  { slug: "pathe-eindhoven", city: "Eindhoven", name: "Pathé Eindhoven" },
  { slug: "pathe-groningen", city: "Groningen", name: "Pathé Groningen" },
  { slug: "pathe-haarlem", city: "Haarlem", name: "Pathé Haarlem" },
  { slug: "pathe-helmond", city: "Helmond", name: "Pathé Helmond" },
  { slug: "pathe-leeuwarden", city: "Leeuwarden", name: "Pathé Leeuwarden" },
  { slug: "pathe-maastricht", city: "Maastricht", name: "Pathé Maastricht" },
  { slug: "pathe-nijmegen", city: "Nijmegen", name: "Pathé Nijmegen" },
  { slug: "pathe-vlissingen", city: "Vlissingen", name: "Pathé Vlissingen" },
  { slug: "pathe-zaandam", city: "Zaandam", name: "Pathé Zaandam" },
  { slug: "pathe-zwolle", city: "Zwolle", name: "Pathé Zwolle" },
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
  chain?: "cineville" | "pathe";
}

// Deno KV singleton
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

async function getCached<T>(key: string): Promise<T | null> {
  const store = await getKv();
  if (!store) return null;

  try {
    // Get metadata
    const meta = await store.get<{ chunks: number; timestamp: number }>([
      "cache",
      key,
      "meta",
    ]);
    if (!meta.value) return null;

    // Check TTL
    const age = Date.now() - meta.value.timestamp;
    if (age >= CACHE_TTL_MS) {
      console.log(`Cache expired for ${key}`);
      // Clean up expired cache
      const deleteOps = store.atomic();
      deleteOps.delete(["cache", key, "meta"]);
      for (let i = 0; i < meta.value.chunks; i++) {
        deleteOps.delete(["cache", key, "chunk", i]);
      }
      await deleteOps.commit();
      return null;
    }

    // Fetch all chunks
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
      `Cache HIT for ${key} (age: ${
        Math.round(age / 1000)
      }s, chunks: ${meta.value.chunks})`,
    );
    return JSON.parse(chunks.join("")) as T;
  } catch (e) {
    console.warn("Cache read error:", e);
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

    // Store metadata first
    await store.set(["cache", key, "meta"], {
      chunks: chunks.length,
      timestamp: Date.now(),
    });

    // Store chunks in batches to avoid atomic operation size limit (800KB)
    // With 60KB chunks, batch size of 10 = ~600KB per operation (safe margin)
    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const ops = store.atomic();
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);

      for (let i = batchStart; i < batchEnd; i++) {
        ops.set(["cache", key, "chunk", i], chunks[i]);
      }

      await ops.commit();
    }

    console.log(
      `Cached ${key} (${chunks.length} chunks, ${json.length} bytes)`,
    );
  } catch (e) {
    console.warn("Cache write error:", e);
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

// In-memory cache for TMDB lookups during request (persisted to KV for long-term)
const tmdbMemoryCache = new Map<string, TMDBMovieDetails | null>();

// Get cached TMDB metadata from Deno KV (30-day TTL)
async function getCachedTMDBMetadata(
  title: string,
): Promise<TMDBMovieDetails | null | undefined> {
  const store = await getKv();
  if (!store) return undefined; // undefined = no cache available

  try {
    const key = ["tmdb", title.toLowerCase()];
    const result = await store.get<
      { data: TMDBMovieDetails | null; timestamp: number }
    >(key);
    if (!result.value) return undefined;

    const { data, timestamp } = result.value;
    if (Date.now() - timestamp >= METADATA_CACHE_TTL_MS) {
      return undefined; // expired
    }
    return data;
  } catch {
    return undefined;
  }
}

// Store TMDB metadata in Deno KV
async function setCachedTMDBMetadata(
  title: string,
  data: TMDBMovieDetails | null,
): Promise<void> {
  const store = await getKv();
  if (!store) return;

  try {
    const key = ["tmdb", title.toLowerCase()];
    await store.set(key, { data, timestamp: Date.now() });
  } catch {
    // ignore cache errors
  }
}

// Search TMDB for a movie by title
const searchTMDB = async (title: string): Promise<TMDBMovie | null> => {
  try {
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${
      encodeURIComponent(title)
    }&language=en-US&page=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0] || null;
  } catch {
    return null;
  }
};

// Get movie details from TMDB including credits (directors)
const getTMDBDetails = async (
  movieId: number,
): Promise<TMDBMovieDetails | null> => {
  try {
    const url =
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
};

// Convert TMDB details to metadata format
const tmdbDetailsToMetadata = (details: TMDBMovieDetails | null): {
  poster?: { url: string };
  directors: string[];
  duration: number;
} | null => {
  if (!details) return null;
  return {
    poster: details.poster_path
      ? { url: `${TMDB_IMAGE_BASE}${details.poster_path}` }
      : undefined,
    directors:
      details.credits?.crew.filter((c) => c.job === "Director").map((c) =>
        c.name
      ) || [],
    duration: details.runtime || 0,
  };
};

// Get movie metadata from TMDB (poster, directors, duration)
// Uses 30-day persistent cache in Deno KV
const getMovieMetadata = async (title: string): Promise<
  {
    poster?: { url: string };
    directors: string[];
    duration: number;
  } | null
> => {
  // Skip if no API key configured
  if (!TMDB_API_KEY) return null;

  const cacheKey = title.toLowerCase();

  // Check in-memory cache first (for current request)
  if (tmdbMemoryCache.has(cacheKey)) {
    return tmdbDetailsToMetadata(tmdbMemoryCache.get(cacheKey) || null);
  }

  // Check persistent KV cache (30-day TTL)
  const kvCached = await getCachedTMDBMetadata(title);
  if (kvCached !== undefined) {
    tmdbMemoryCache.set(cacheKey, kvCached);
    return tmdbDetailsToMetadata(kvCached);
  }

  // Search for movie on TMDB
  const searchResult = await searchTMDB(title);
  if (!searchResult) {
    tmdbMemoryCache.set(cacheKey, null);
    await setCachedTMDBMetadata(title, null);
    return null;
  }

  // Get full details
  const details = await getTMDBDetails(searchResult.id);
  tmdbMemoryCache.set(cacheKey, details);
  await setCachedTMDBMetadata(title, details);

  return tmdbDetailsToMetadata(details);
};

// ============ Pathé API Functions ============

// Generate date strings for next N days
const generateDateRange = (days: number = 14): string[] => {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split("T")[0]);
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
  time: string; // "2025-12-21 17:00:00"
  version: string; // "ov" for original version
  tags: string[];
  refCmd: string; // ticket URL
  auditoriumName: string;
  endTime: string;
}

// Fetch all films showing in Pathé from zone API
const fetchPatheZone = async (
  zone: string = "amsterdam",
): Promise<PatheZoneShow[]> => {
  try {
    const response = await fetch(`${PATHE_BASE_URL}/zone/${zone}`, {
      headers: { "User-Agent": PATHE_USER_AGENT },
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
  date: string,
): Promise<PatheShowtime[]> => {
  try {
    const url =
      `${PATHE_BASE_URL}/show/${filmSlug}/showtimes/${cinemaSlug}/${date}?language=nl`;
    const response = await fetch(url, {
      headers: { "User-Agent": PATHE_USER_AGENT },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// Normalize title for matching (lowercase, no accents, no punctuation)
const normalizeTitle = (title: string): string => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
};

// Extract readable title from Pathé slug (e.g., "avatar-fire-and-ash-40584" -> "avatar fire and ash")
const slugToTitle = (slug: string): string => {
  return slug
    .replace(/-\d+$/, "") // Remove trailing ID number
    .replace(/-nederlands-gesproken$/, "") // Remove Dutch dub indicator
    .replace(/-originele-versie$/, "") // Remove original version indicator
    .replace(/-/g, " ") // Replace hyphens with spaces
    .trim();
};

// Match Pathé zone shows against watchlist titles
const matchPatheFilmsFromZone = (
  watchlistTitles: string[],
  zoneShows: PatheZoneShow[],
): PatheZoneShow[] => {
  const normalizedWatchlist = watchlistTitles.map(normalizeTitle);

  return zoneShows.filter((show) => {
    if (!show.bookable) return false;
    const normalizedSlugTitle = normalizeTitle(slugToTitle(show.slug));

    return normalizedWatchlist.some((watchlistTitle) =>
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
  tmdbMetadata?: {
    poster?: { url: string };
    directors: string[];
    duration: number;
  } | null,
): Show => {
  // Parse "2025-12-21 17:00:00" to ISO format
  const startDate = new Date(showtime.time.replace(" ", "T") + "+01:00")
    .toISOString();
  const endDate = showtime.endTime
    ? new Date(showtime.endTime.replace(" ", "T") + "+01:00").toISOString()
    : startDate;

  return {
    id: `pathe-${filmSlug}-${cinema.slug}-${showtime.time}`,
    startDate,
    endDate,
    ticketingUrl: showtime.refCmd ||
      `https://www.pathe.nl/nl/films/${filmSlug}`,
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
    chain: "pathe",
  };
};

// Fetch and process Pathé showtimes for given watchlist titles
const fetchPatheShowtimes = async (
  watchlistTitles: string[],
): Promise<Show[]> => {
  try {
    // Get all films showing at Pathé
    const zoneShows = await fetchPatheZone("amsterdam");
    console.log(`Pathé: fetched ${zoneShows.length} films from zone`);

    // Match against watchlist
    const matchedFilms = matchPatheFilmsFromZone(watchlistTitles, zoneShows);
    console.log(`Pathé: matched ${matchedFilms.length} films from watchlist`);

    if (matchedFilms.length === 0) return [];

    // Pre-fetch TMDB metadata for all matched films in parallel (if API key configured)
    const filmTitles = matchedFilms.map((f) => {
      const title = slugToTitle(f.slug);
      return title.split(" ").map((word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(" ");
    });

    const metadataMap = new Map<
      string,
      Awaited<ReturnType<typeof getMovieMetadata>>
    >();

    if (TMDB_API_KEY) {
      console.log(
        `Pathé: fetching TMDB metadata for ${filmTitles.length} films`,
      );
      const tmdbMetadataPromises = filmTitles.map((title) =>
        getMovieMetadata(title)
      );
      const tmdbMetadata = await Promise.all(tmdbMetadataPromises);
      filmTitles.forEach((title, i) => metadataMap.set(title, tmdbMetadata[i]));
      console.log(
        `Pathé: got TMDB metadata for ${
          tmdbMetadata.filter((m) => m !== null).length
        } films`,
      );
    } else {
      console.log("Pathé: TMDB_API_KEY not set, skipping metadata enrichment");
    }

    // Generate dates for next 15 days (balance between coverage and API calls)
    const dates = generateDateRange(15);
    const shows: Show[] = [];

    // Fetch showtimes for each matched film from each cinema
    // Process films in parallel, but batch cinema requests to avoid overwhelming the API
    const filmPromises = matchedFilms.map(async (film) => {
      const filmTitle = slugToTitle(film.slug)
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const metadata = metadataMap.get(filmTitle);

      // Fetch all cinema/date combinations in parallel for this film
      const requests = PATHE_CINEMAS.flatMap((cinema) =>
        dates.map((date) => ({
          cinema,
          date,
          promise: fetchPatheShowtimesForCinema(film.slug, cinema.slug, date),
        }))
      );

      const results = await Promise.all(requests.map((r) => r.promise));

      return requests
        .flatMap((req, i) =>
          results[i].map((st) =>
            patheShowtimeToShow(st, film.slug, filmTitle, req.cinema, metadata)
          )
        );
    });

    const filmResults = await Promise.all(filmPromises);
    shows.push(...filmResults.flat());

    console.log(`Pathé: fetched ${shows.length} total showtimes`);
    return shows;
  } catch (e) {
    console.error("Pathé fetch failed:", e);
    return [];
  }
};

// ============ Letterboxd & Cineville Functions ============

// Fetch any Letterboxd list (watchlist, custom list, etc.)
// listPath examples:
//   "username/watchlist" - user's watchlist
//   "username/list/my-favorites" - user's custom list
//   "dave/list/official-top-250-narrative-feature-films" - IMDB top 250
// Includes retry logic for 503 errors (service waking up from cold start)
const getLetterboxdList = async (
  listPath: string,
  maxRetries = 3,
  delayMs = 2000,
): Promise<unknown> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://letterboxd-list-radarr.onrender.com/${listPath}/`,
      );

      if (response.ok) {
        return response.json();
      }

      // Retry on 503 (service unavailable / cold start)
      if (response.status === 503 && attempt < maxRetries) {
        console.log(
          `Letterboxd service returned 503, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      // Other errors or final 503 attempt
      if (response.status === 503) {
        throw new Error(
          "The Letterboxd service is temporarily unavailable. Please try again in a moment.",
        );
      } else if (response.status === 404) {
        throw new Error(
          `List not found: "${listPath}". Please check the URL or username.`,
        );
      } else {
        throw new Error(
          `Failed to fetch list "${listPath}" (HTTP ${response.status})`,
        );
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // Network errors - retry
      if (
        attempt < maxRetries &&
        !(e instanceof Error && e.message.includes("not found"))
      ) {
        console.log(
          `Letterboxd fetch failed, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries}):`,
          lastError.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Failed to fetch Letterboxd list");
};

type ProductionIds = {
  data: { films: { data: { id: string; title?: string }[] } };
};

// Get Cineville production IDs from film titles
const getCinevilleProductionIds = async (
  titles: string[],
): Promise<ProductionIds> => {
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
const fetchCinevilleShowtimes = async (
  watchlistTitles: string[],
): Promise<Show[]> => {
  try {
    const productionIds = await getCinevilleProductionIds(watchlistTitles);

    if (!productionIds.data?.films?.data?.length) {
      console.log("Cineville: no matching films found");
      return [];
    }

    console.log(`Cineville: found ${productionIds.data.films.data.length} matching production IDs`);

    // Batch production IDs to get better coverage per film
    // With 999 limit per query, batching ensures each film gets more showtimes
    const BATCH_SIZE = 20; // 20 films per query = ~50 showtimes per film
    const allShows: any[] = [];
    const productionIdBatches: string[][] = [];

    for (let i = 0; i < productionIds.data.films.data.length; i += BATCH_SIZE) {
      const batch = productionIds.data.films.data.slice(i, i + BATCH_SIZE);
      productionIdBatches.push(batch.map((x) => `"${x.id}"`));
    }

    console.log(`Cineville: querying ${productionIdBatches.length} batches of ${BATCH_SIZE} films each`);

    const currentDate = new Date().toISOString();

    // Fetch each batch in parallel
    const batchPromises = productionIdBatches.map(async (productionIdList) => {
      const showtimesQuery = JSON.stringify({
        query: `{
  showtimes(page: {limit: 999}, filters:  {
     productionId:  {
        in: [${productionIdList.join(",")}]
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
        throw new Error(
          `Cineville showtimes query failed: ${await response.text()}`,
        );
      }

      const result = await response.json();
      return result?.data?.showtimes?.data || [];
    });

    const batchResults = await Promise.all(batchPromises);
    const shows = batchResults.flat();

    console.log(`Cineville: fetched ${shows.length} showtimes across ${productionIdBatches.length} batches`);

    // Find films missing poster or directors for TMDB enrichment
    const filmsNeedingEnrichment = new Map<
      string,
      { needsPoster: boolean; needsDirectors: boolean }
    >();
    for (const show of shows) {
      const title = show.film?.title;
      if (!title) continue;
      const needsPoster = !show.film?.poster?.url;
      const needsDirectors = !show.film?.directors?.length;
      if (needsPoster || needsDirectors) {
        filmsNeedingEnrichment.set(title, { needsPoster, needsDirectors });
      }
    }

    // Fetch TMDB metadata for films needing enrichment
    const tmdbMetadataMap = new Map<
      string,
      Awaited<ReturnType<typeof getMovieMetadata>>
    >();
    if (TMDB_API_KEY && filmsNeedingEnrichment.size > 0) {
      console.log(
        `Cineville: enriching ${filmsNeedingEnrichment.size} films with TMDB data`,
      );
      const titles = Array.from(filmsNeedingEnrichment.keys());
      const metadataPromises = titles.map((title) => getMovieMetadata(title));
      const metadata = await Promise.all(metadataPromises);
      titles.forEach((title, i) => tmdbMetadataMap.set(title, metadata[i]));
      console.log(
        `Cineville: got TMDB data for ${
          metadata.filter((m) => m !== null).length
        } films`,
      );
    }

    // Add chain identifier and enrich with TMDB data
    return shows.map((show: Show) => {
      const enriched = { ...show, chain: "cineville" as const };
      const title = show.film?.title;
      const tmdb = title ? tmdbMetadataMap.get(title) : null;

      if (tmdb) {
        // Enrich missing poster
        if (!enriched.film.poster?.url && tmdb.poster) {
          enriched.film = { ...enriched.film, poster: tmdb.poster };
        }
        // Enrich missing directors
        if (!enriched.film.directors?.length && tmdb.directors?.length) {
          enriched.film = { ...enriched.film, directors: tmdb.directors };
        }
        // Enrich missing duration
        if (!enriched.film.duration && tmdb.duration) {
          enriched.film = { ...enriched.film, duration: tmdb.duration };
        }
      }

      return enriched;
    });
  } catch (e) {
    console.error("Cineville fetch failed:", e);
    return [];
  }
};

/**
 * Fetch and cache showtimes for a given Letterboxd list
 * This is the core logic extracted from the HTTP handler for reuse in cron jobs
 * @param listPath - The Letterboxd list path (e.g., "105424/watchlist")
 * @returns The cached/fresh showtime data
 */
export async function fetchAndCacheShowtimes(listPath: string) {
  try {
    // Check cache first
    const cacheKey = `showtimes:v18:${listPath}`;
    const cached = await getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      console.log(`Cache HIT for ${listPath}`);
      return cached;
    }

    console.log(`Cache MISS for ${listPath}, fetching fresh data...`);

    // Fetch Letterboxd list
    const listData = (await getLetterboxdList(listPath)) as {
      title: string;
    }[];
    const filmTitles = listData.map((x) => x.title);

    console.log(
      `Fetching showtimes for ${filmTitles.length} films from "${listPath}"`,
    );

    // Fetch from both sources in parallel
    const [cinevilleResult, patheResult] = await Promise.allSettled([
      fetchCinevilleShowtimes(filmTitles),
      fetchPatheShowtimes(filmTitles),
    ]);

    // Extract results
    const cinevilleShows = cinevilleResult.status === "fulfilled"
      ? cinevilleResult.value
      : [];
    const patheShows = patheResult.status === "fulfilled"
      ? patheResult.value
      : [];

    // Log failures
    if (cinevilleResult.status === "rejected") {
      console.error("Cineville fetch rejected:", cinevilleResult.reason);
    }
    if (patheResult.status === "rejected") {
      console.error("Pathé fetch rejected:", patheResult.reason);
    }

    // Merge all showtimes
    const allShows = [...cinevilleShows, ...patheShows];

    console.log(
      `Total: ${allShows.length} showtimes (Cineville: ${cinevilleShows.length}, Pathé: ${patheShows.length})`,
    );

    // Format response
    const resp = { data: { showtimes: { data: allShows } } };

    // Store in cache
    await setCache(cacheKey, resp);

    return resp;
  } catch (error) {
    console.error(`Error fetching showtimes for ${listPath}:`, error);
    throw error;
  }
}

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      // Support both old 'username' param (for backwards compat) and new 'listPath' param
      const listPathParam = url.searchParams.get("listPath");
      const usernameParam = url.searchParams.get("username");

      // Determine the list path to fetch
      let listPath: string;
      if (listPathParam) {
        listPath = listPathParam.trim();
      } else if (usernameParam) {
        // Backwards compatibility: username param becomes username/watchlist
        listPath = `${usernameParam.trim()}/watchlist`;
      } else {
        listPath = "105424/watchlist"; // Default
      }

      // Use the extracted function
      const resp = await fetchAndCacheShowtimes(listPath);

      const CACHE_SECONDS = 36 * 60 * 60; // 36 hours
      const cacheKey = `showtimes:v18:${listPath}`;
      const wasCached = (await getCached<Record<string, unknown>>(cacheKey)) === resp;

      return new Response(JSON.stringify(resp), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control":
            `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`,
          "Surrogate-Control": `max-age=${CACHE_SECONDS}`,
          "Vary": "Accept-Encoding",
          "X-Cache": wasCached ? "HIT" : "MISS",
        },
      });
    } catch (error) {
      console.error("API error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error
            ? error.message
            : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  },
};

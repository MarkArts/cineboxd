/// <reference lib="deno.unstable" />
import { Handlers } from "$fresh/server.ts";
import {
  getCached,
  setCache,
  getCachedTMDBMetadata,
  setCachedTMDBMetadata,
} from "../../utils/cache.ts";

// Watchlists to pre-warm (kept warm by the worker service)
export const WATCHLIST_PATHS = [
  "105424/watchlist",
  "filmjournl/list/sight-sound-2025",
  "idiah/list/sight-and-sound-2024",
  "official/list/top-250-films-with-the-most-fans",
  "benvsthemovies/list/the-criterion-challenge-2026",
  "fcbarcelona/list/movies-everyone-should-watch-at-least-once",
  "Snautsie/watchlist",
] as const;

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
  chain?: "cineville" | "pathe" | "gouda";
  subtitlesList?: string[];
  languageVersion?: string;
  languageVersionAbbreviation?: string;
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

// In-memory cache for TMDB lookups during request (persisted to the cache
// backend for long-term, see utils/cache.ts)
const tmdbMemoryCache = new Map<string, TMDBMovieDetails | null>();

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

  // Check persistent cache backend (30-day TTL)
  const kvCached = await getCachedTMDBMetadata<TMDBMovieDetails>(title);
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
// Pathé caches: the zone list (films showing) is the same for every watchlist,
// and per film/cinema/date showtimes are mostly-empty lookups shared across
// lists. Caching both - including EMPTY results, but never failures - cuts
// the per-refresh fan-out (30 cinemas x 15 dates per film) to almost zero
// after the first sweep, and keeps us far away from Pathé's rate limits.
const PATHE_ZONE_CACHE_TTL = 12 * 60 * 60; // 12h
const PATHE_SHOWTIMES_CACHE_TTL = 24 * 60 * 60; // 24h for real showtimes
const PATHE_SHOWTIMES_EMPTY_TTL = 6 * 60 * 60; // 6h for "not showing here"

const fetchPatheZone = async (
  zone: string = "amsterdam",
): Promise<PatheZoneShow[]> => {
  const cacheKey = `pathe:zone:v1:${zone}`;
  const cached = await getCached<PatheZoneShow[]>(cacheKey);
  if (cached !== null) {
    console.log(`Pathé: zone ${zone} cache HIT (${cached.length} films)`);
    return cached;
  }

  try {
    const response = await fetch(`${PATHE_BASE_URL}/zone/${zone}`, {
      headers: { "User-Agent": PATHE_USER_AGENT },
    });
    if (!response.ok) {
      // Do not cache failures: a rate-limited response must not be frozen
      console.warn(`Failed to fetch Pathé zone ${zone}:`, response.status);
      return [];
    }
    const data = await response.json();
    const shows = data.shows || [];
    await setCache(cacheKey, shows, PATHE_ZONE_CACHE_TTL);
    return shows;
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
  const cacheKey = `pathe:showtimes:v1:${filmSlug}:${cinemaSlug}:${date}`;
  const cached = await getCached<PatheShowtime[]>(cacheKey);
  if (cached !== null) return cached;

  try {
    const url =
      `${PATHE_BASE_URL}/show/${filmSlug}/showtimes/${cinemaSlug}/${date}?language=nl`;
    const response = await fetch(url, {
      headers: { "User-Agent": PATHE_USER_AGENT },
    });
    if (!response.ok) return []; // never cache failures
    const data = await response.json();
    const showtimes = Array.isArray(data) ? data : [];
    await setCache(
      cacheKey,
      showtimes,
      showtimes.length > 0
        ? PATHE_SHOWTIMES_CACHE_TTL
        : PATHE_SHOWTIMES_EMPTY_TTL,
    );
    return showtimes;
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

// Whole-word subphrase test (normalized titles only contain [a-z0-9 ])
const containsAsWholeWords = (haystack: string, needle: string): boolean =>
  needle.length > 0 && new RegExp(`(^|\\s)${needle}(\\s|$)`).test(haystack);

// Two normalized titles match if they are equal, or if one is a
// whole-word subphrase of the other. Raw substring matching is too
// loose: watchlist film "Ran" must not match "Spider-Man: BRANd New Day",
// but "Dune" should still match "Dune: Part Two".
const titlesMatch = (a: string, b: string): boolean =>
  a === b || containsAsWholeWords(a, b) || containsAsWholeWords(b, a);

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
      titlesMatch(normalizedSlugTitle, watchlistTitle)
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

// Decode common HTML entities in scraped titles (e.g. "Raging Bull &amp; Co")
const decodeHtmlEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// Fetch any Letterboxd list (watchlist, custom list, etc.) by scraping
// letterboxd.com directly (the old letterboxd-list-radarr proxy is dead).
// listPath examples:
//   "username/watchlist" - user's watchlist
//   "username/list/my-favorites" - user's custom list
//   "dave/list/official-top-250-narrative-feature-films" - IMDB top 250
// Includes retry logic for transient errors and paginates through all pages
const getLetterboxdList = async (
  listPath: string,
  maxRetries = 3,
  delayMs = 2000,
): Promise<{ title: string }[]> => {
  const titles: string[] = [];
  let page = 1;

  while (true) {
    const url = page === 1
      ? `https://letterboxd.com/${listPath}/`
      : `https://letterboxd.com/${listPath}/page/${page}/`;

    let html: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries && html === null; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (response.ok) {
          html = await response.text();
          break;
        }

        if (response.status === 404) {
          if (page === 1) {
            throw new Error(
              `List not found: "${listPath}". Please check the URL or username.`,
            );
          }
          break; // past the last page, stop paginating
        }

        if (
          (response.status === 503 || response.status === 429) &&
          attempt < maxRetries
        ) {
          lastError = new Error(
            `Letterboxd returned ${response.status}, retrying`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw new Error(
          `Failed to fetch list "${listPath}" (HTTP ${response.status})`,
        );
      } catch (e) {
        // "List not found" errors should not be retried
        if (e instanceof Error && e.message.includes("not found")) throw e;

        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
    }

    if (html === null) {
      if (page > 1 && titles.length > 0) break; // tolerate a failed later page
      throw lastError || new Error(`Failed to fetch list "${listPath}"`);
    }

    // Titles live in the alt attribute of each film poster image, e.g.
    // <div class="poster film-poster"> <img ... class="image" alt="Title"/>
    const found = [
      ...html.matchAll(
        /<img(?=[^>]*class="image")[^>]*alt="([^"]+)"/g,
      ),
    ].map((m) => decodeHtmlEntities(m[1]));

    if (found.length === 0) break;
    titles.push(...found);

    page++;
    // Be polite to letterboxd.com while paginating
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  console.log(`Letterboxd: scraped ${titles.length} films from "${listPath}"`);
  return titles.map((title) => ({ title }));
};

// Cineville production (film) from the CultureKit REST API
interface CultureKitProduction {
  id: string;
  slug: string;
  title: string;
  attributes?: {
    duration?: number;
    directors?: string[];
  };
  assets?: { poster?: { url?: string } };
}

// Get Cineville film productions matching watchlist titles (exact title match)
// via the CultureKit REST API (cineville.nl's old GraphQL API is gone)
const getCinevilleProductions = async (
  titles: string[],
): Promise<CultureKitProduction[]> => {
  const BATCH_SIZE = 50; // page limit on productions/search is capped at 100
  const batches: string[][] = [];
  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    batches.push(titles.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const response = await fetch(
        "https://api.cineville.nl/productions/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: { in: batch },
            productionTypeId: { eq: "film" },
            page: { limit: 100 },
            isHidden: { eq: false },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Cineville productions query failed: ${await response.text()}`,
        );
      }

      const data = await response.json();
      return (data?._embedded?.productions ??
        []) as CultureKitProduction[];
    }),
  );

  return results.flat();
};

// Fetch Cineville showtimes for given watchlist titles
const fetchCinevilleShowtimes = async (
  watchlistTitles: string[],
): Promise<Show[]> => {
  try {
    const productions = await getCinevilleProductions(watchlistTitles);

    if (!productions.length) {
      console.log("Cineville: no matching films found");
      return [];
    }

    console.log(`Cineville: found ${productions.length} matching productions`);

    const now = new Date().toISOString();
    const BATCH_SIZE = 50; // events/search page limit is capped at 100
    const shows: Show[] = [];

    for (let i = 0; i < productions.length; i += BATCH_SIZE) {
      const batch = productions.slice(i, i + BATCH_SIZE).map((p) => p.id);
      let after: string | undefined;

      // Paginate through all upcoming events for this batch of productions
      for (let page = 0; page < 20; page++) {
        const response = await fetch("https://api.cineville.nl/events/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productionId: { in: batch },
            startDate: { gte: now },
            isHidden: { eq: false },
            embed: { production: true, venue: true },
            sort: { startDate: "asc" },
            page: { limit: 100, ...(after ? { after } : {}) },
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Cineville events query failed: ${await response.text()}`,
          );
        }

        const result = await response.json();
        const events: {
          id: string;
          startDate: string;
          endDate: string;
          ticketingUrl: string;
          attributes?: { subtitles?: string[] };
          _embedded?: {
            production?: CultureKitProduction;
            venue?: {
              name: string;
              address?: { city?: string };
            };
          };
        }[] = result?._embedded?.events || [];

        for (const event of events) {
          const production = event._embedded?.production;
          const venue = event._embedded?.venue;
          if (!production || !venue) continue;

          shows.push({
            id: event.id,
            startDate: event.startDate,
            endDate: event.endDate,
            ticketingUrl: event.ticketingUrl,
            film: {
              title: production.title,
              slug: production.slug,
              poster: production.assets?.poster?.url
                ? { url: production.assets.poster.url }
                : undefined,
              duration: production.attributes?.duration ?? 0,
              directors: production.attributes?.directors || [],
            },
            theater: {
              name: venue.name,
              address: { city: venue.address?.city ?? "" },
            },
            chain: "cineville",
            subtitlesList: event.attributes?.subtitles,
          });
        }

        const nextHref = result?._links?.next?.href as string | undefined;
        const cursor = nextHref
          ? new URL(nextHref, "https://api.cineville.nl").searchParams.get(
            "page[after]",
          )
          : null;
        if (!cursor) break;
        after = cursor;
      }
    }

    console.log(`Cineville: fetched ${shows.length} showtimes`);

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

// ============ Cinema Gouda (independent cinema, scraped) ============

const GOUDA_BASE_URL = "https://www.cinemagouda.nl";

// Convert an Europe/Amsterdam wall clock time to a UTC ISO string
// (handles DST: CET in winter, CEST in summer)
const amsterdamWallClockToUtcISO = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string => {
  const wallMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Iteratively find the UTC instant whose Amsterdam wall clock matches
  let utcMs = wallMs;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const shownMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    );
    utcMs += wallMs - shownMs;
  }

  return new Date(utcMs).toISOString();
};

const GOUDA_MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

// Resolve day + Dutch month to a full date (year is not shown on the
// site, so infer it: a date more than a week in the past must be next year)
const resolveGoudaDate = (
  day: number,
  month: number,
): { year: number; month: number; day: number } => {
  const now = Date.now();
  let year = new Date().getUTCFullYear();
  if (Date.UTC(year, month - 1, day) < now - 7 * 24 * 3600 * 1000) {
    year += 1;
  }
  return { year, month, day };
};

// Parse a single Cinema Gouda film page into Show objects
const parseGoudaFilmPage = async (slug: string): Promise<Show[] | null> => {
  const response = await fetch(`${GOUDA_BASE_URL}/film/${slug}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  if (!response.ok) {
    console.warn(`Cinema Gouda: failed to fetch film ${slug}:`, response.status);
    return null;
  }
  const html = await response.text();

  const titleMatch = html.match(/<h1 class="titel">([^<]+)<\/h1>/);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";
  if (!title) return null;

  const posterMatch = html.match(
    /<img src="(https:\/\/www\.cinemagouda\.nl\/cache\/[^"']*s800x800\.jpg)"/,
  );
  const posterUrl = posterMatch?.[1];

  const directorsMatch = html.match(
    /<span class="text-label">Regisseur<\/span>\s*<div class="text">\s*<p>([^<]*)<\/p>/,
  );
  const directors = directorsMatch
    ? decodeHtmlEntities(directorsMatch[1])
      .split(/[,/]| en /)
      .map((d) => d.trim())
      .filter(Boolean)
    : [];

  const durationMatch = html.match(
    /<span class="text-label">Duur<\/span>\s*<div class="text">\s*<p>(\d+)\s*min<\/p>/,
  );
  const duration = durationMatch ? Number(durationMatch[1]) : 0;

  const shows: Show[] = [];

  // Each date group: <li class="film-item ...">
  //   <h4 class="titel">Zondag 11 oktober ...</h4>
  //   <a class="time-item" href="...ticketing..."><span class="time">15:35</span>
  const segments = html.split(/<li class="film-item/).slice(1);
  for (const segment of segments) {
    const dateMatch = segment.match(
      /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i,
    );
    if (!dateMatch) continue;

    const monthIndex = GOUDA_MONTHS.findIndex((m) =>
      m === dateMatch[2].toLowerCase()
    );
    if (monthIndex === -1) continue;
    const { year, month, day } = resolveGoudaDate(
      Number(dateMatch[1]),
      monthIndex + 1,
    );

    const timeRe =
      /<a class="time-item[^>]*href="([^"]+)"[^>]*>\s*<span class="time">(\d{1,2}):(\d{2})<\/span>/g;
    for (const timeMatch of segment.matchAll(timeRe)) {
      const startDate = amsterdamWallClockToUtcISO(
        year,
        month,
        day,
        Number(timeMatch[2]),
        Number(timeMatch[3]),
      );
      const endDate = duration > 0
        ? new Date(
          new Date(startDate).getTime() + duration * 60 * 1000,
        ).toISOString()
        : startDate;

      shows.push({
        id: `gouda-${slug}-${startDate}`,
        startDate,
        endDate,
        ticketingUrl: decodeHtmlEntities(timeMatch[1]),
        film: {
          title,
          slug,
          poster: posterUrl ? { url: posterUrl } : undefined,
          duration,
          directors,
        },
        theater: {
          name: "Cinema Gouda",
          address: { city: "Gouda" },
        },
        chain: "gouda",
      });
    }
  }

  return shows;
};

// Fetch all current Cinema Gouda showtimes (the whole program is cached in
// KV so multiple watchlist fetches share one scrape)
const fetchCinemaGoudaShows = async (): Promise<Show[]> => {
  const cacheKey = "cinemagouda:shows:v1";
  const cached = await getCached<Show[]>(cacheKey);
  if (cached) {
    console.log(`Cinema Gouda: cache HIT (${cached.length} showtimes)`);
    return cached;
  }

  const response = await fetch(`${GOUDA_BASE_URL}/films/nu-te-zien`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Cinema Gouda film list failed (HTTP ${response.status})`,
    );
  }
  const html = await response.text();

  const slugs = [...new Set(
    [...html.matchAll(/href="https:\/\/www\.cinemagouda\.nl\/film\/([a-z0-9-]+)"/g)]
      .map((m) => m[1]),
  )];

  console.log(`Cinema Gouda: scraping ${slugs.length} film pages`);

  const shows: Show[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < slugs.length; i += CONCURRENCY) {
    const batch = slugs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((slug) => parseGoudaFilmPage(slug)),
    );
    for (const result of results) {
      if (result) shows.push(...result);
    }
    // Be polite to cinemagouda.nl
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`Cinema Gouda: scraped ${shows.length} showtimes total`);
  await setCache(cacheKey, shows);
  return shows;
};

// Match Cinema Gouda showtimes against watchlist titles
const fetchCinemaGoudaShowtimes = async (
  watchlistTitles: string[],
): Promise<Show[]> => {
  try {
    const all = await fetchCinemaGoudaShows();
    if (!all.length) return [];

    const normalizedWatchlist = watchlistTitles.map(normalizeTitle);
    const matches = all.filter((show) => {
      const normalized = normalizeTitle(show.film.title);
      return normalizedWatchlist.some((w) => titlesMatch(normalized, w));
    });

    console.log(
      `Cinema Gouda: matched ${matches.length}/${all.length} showtimes from watchlist`,
    );
    return matches;
  } catch (e) {
    console.error("Cinema Gouda fetch failed:", e);
    return [];
  }
};

/**
 * Fetch and cache showtimes for a given Letterboxd list
 * This is the core logic extracted from the HTTP handler for reuse in cron jobs
 * @param listPath - The Letterboxd list path (e.g., "105424/watchlist")
 * @returns The cached/fresh showtime data
 */
export async function fetchAndCacheShowtimes(
  listPath: string,
  opts?: { force?: boolean },
) {
  try {
    // Check cache first (the worker passes force to always refresh)
    const cacheKey = `showtimes:v24:${listPath}`;
    const cached = opts?.force
      ? null
      : await getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      console.log(`Cache HIT for ${listPath}`);
      return cached;
    }

    console.log(`Cache MISS for ${listPath}, fetching fresh data...`);

    // Fetch Letterboxd list
    const listData = (await getLetterboxdList(listPath)) as {
      title: string;
    }[];
    const filmTitles = listData
      .map((x) => x.title)
      // Defensive: never let malformed upstream data break the parsers again
      .filter((t): t is string => typeof t === "string" && t.length > 0);

    console.log(
      `Fetching showtimes for ${filmTitles.length} films from "${listPath}"`,
    );

    // Fetch from all sources in parallel
    const [cinevilleResult, patheResult, goudaResult] = await Promise.allSettled([
      fetchCinevilleShowtimes(filmTitles),
      fetchPatheShowtimes(filmTitles),
      fetchCinemaGoudaShowtimes(filmTitles),
    ]);

    // Extract results
    const cinevilleShows = cinevilleResult.status === "fulfilled"
      ? cinevilleResult.value
      : [];
    const patheShows = patheResult.status === "fulfilled"
      ? patheResult.value
      : [];
    const goudaShows = goudaResult.status === "fulfilled"
      ? goudaResult.value
      : [];

    // Log failures
    if (cinevilleResult.status === "rejected") {
      console.error("Cineville fetch rejected:", cinevilleResult.reason);
    }
    if (patheResult.status === "rejected") {
      console.error("Pathé fetch rejected:", patheResult.reason);
    }
    if (goudaResult.status === "rejected") {
      console.error("Cinema Gouda fetch rejected:", goudaResult.reason);
    }

    // Merge all showtimes
    const allShows = [...cinevilleShows, ...patheShows, ...goudaShows];

    console.log(
      `Total: ${allShows.length} showtimes (Cineville: ${cinevilleShows.length}, Pathé: ${patheShows.length}, Gouda: ${goudaShows.length})`,
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
      const cacheKey = `showtimes:v24:${listPath}`;
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

import { useEffect, useMemo, useState } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";
import MovieCard from "./MovieCard.tsx";
import { CITY_STATION_MAPPINGS } from "../data/station-mappings.ts";

// Witty loading messages
const LOADING_MESSAGES = [
  "Rewinding the tapes...",
  "Buttering the popcorn...",
  "Finding the best seats...",
  "Checking what's playing...",
  "Rolling the film reels...",
  "Dimming the lights...",
  "Shushing the audience...",
  "Dodging spoilers...",
  "Consulting the critics...",
  "Scanning the marquee...",
  "Adjusting the projector...",
  "Queueing the trailers...",
];

// Film reel spinner component
function FilmReelSpinner() {
  return (
    <div
      style={{
        width: "60px",
        height: "60px",
        position: "relative",
        margin: "0 auto",
      }}
    >
      {/* Outer reel */}
      <div
        class="film-reel-spin"
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          border: "3px solid #3b82f6",
          position: "absolute",
          boxSizing: "border-box",
        }}
      >
        {/* Sprocket holes */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <div
            key={angle}
            style={{
              position: "absolute",
              width: "10px",
              height: "10px",
              backgroundColor: "#3b82f6",
              borderRadius: "50%",
              top: "50%",
              left: "50%",
              transform:
                `rotate(${angle}deg) translateY(-22px) translateX(-5px)`,
            }}
          />
        ))}
        {/* Center hole */}
        <div
          style={{
            position: "absolute",
            width: "16px",
            height: "16px",
            backgroundColor: "#0f1419",
            border: "2px solid #3b82f6",
            borderRadius: "50%",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    </div>
  );
}

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

interface MovieListProps {
  listPath: string;
}

// Format list path for display
// "username/watchlist" -> "@username's watchlist"
// "username/list/my-list" -> "@username/my-list"
// "dave/list/official-top-250" -> "@dave/official-top-250"
function formatListName(listPath: string): string {
  const parts = listPath.split("/");
  if (parts.length >= 2 && parts[1] === "watchlist") {
    return `@${parts[0]}'s watchlist`;
  }
  if (parts.length >= 3 && parts[1] === "list") {
    return `@${parts[0]}/${parts.slice(2).join("/")}`;
  }
  return listPath;
}

export default function MovieList({ listPath }: MovieListProps) {
  const [showtimes, setShowtimes] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedTheaters, setSelectedTheaters] = useState<string[]>([]);
  const [selectedFilms, setSelectedFilms] = useState<string[]>([]);
  const [showCityFilter, setShowCityFilter] = useState(false);
  const [showMovieFilter, setShowMovieFilter] = useState(false);
  const [showTheaterFilter, setShowTheaterFilter] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shortLink, setShortLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [travelTimes, setTravelTimes] = useState<Map<string, number>>(
    new Map(),
  );
  const [isFetchingTravelTimes, setIsFetchingTravelTimes] = useState(false);

  // Cycle through loading messages
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Initialize from URL params on mount
  useEffect(() => {

    const params = new URLSearchParams(globalThis.location.search);
    const urlStartDate = params.get("startDate");
    const urlEndDate = params.get("endDate");
    const urlTheaters = params.get("theaters")?.split(",").filter(Boolean);
    const urlFilms = params.get("films")?.split(",").filter(Boolean);
    const urlCities = params.get("cities")?.split(",").filter(Boolean);

    if (urlStartDate) setStartDate(urlStartDate);
    if (urlEndDate) setEndDate(urlEndDate);
    if (urlTheaters && urlTheaters.length > 0) setSelectedTheaters(urlTheaters);
    if (urlFilms && urlFilms.length > 0) setSelectedFilms(urlFilms);
    if (urlCities && urlCities.length > 0) setSelectedCities(urlCities);
  }, []);

  // Load active location from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("cineboxd_user_location");
    if (saved) {
      setActiveLocation(saved);
      setSelectedLocation(saved);
    }
  }, []);

  // Save active location to localStorage when changed
  useEffect(() => {
    if (activeLocation) {
      localStorage.setItem("cineboxd_user_location", activeLocation);
    } else {
      localStorage.removeItem("cineboxd_user_location");
    }
  }, [activeLocation]);

  // Handle click outside to close dropdowns
  useEffect(() => {

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-dropdown]")) {
        setShowCityFilter(false);
        setShowMovieFilter(false);
        setShowTheaterFilter(false);
      }
    };

    if (showCityFilter || showMovieFilter || showTheaterFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showCityFilter, showMovieFilter, showTheaterFilter]);

  // URL synchronization (filters only, not username)
  useEffect(() => {

    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedCities.length > 0) {
      params.set("cities", selectedCities.join(","));
    }
    if (selectedTheaters.length > 0) {
      params.set("theaters", selectedTheaters.join(","));
    }
    if (selectedFilms.length > 0) params.set("films", selectedFilms.join(","));

    const queryString = params.toString();
    const newUrl = queryString
      ? `${globalThis.location.pathname}?${queryString}`
      : globalThis.location.pathname;

    try {
      globalThis.history.replaceState({ path: newUrl }, "", newUrl);
    } catch {
      // Ignore URL update errors
    }
  }, [startDate, endDate, selectedCities, selectedTheaters, selectedFilms]);

  // Get cached travel times from localStorage
  const getCachedTravelTimes = (
    location: string,
  ): Map<string, number> | null => {
    try {
      const cached = localStorage.getItem(`travel_times_${location}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return new Map(Object.entries(parsed));
      }
    } catch (e) {
      console.error("Failed to load cached travel times:", e);
    }
    return null;
  };

  // Save travel times to localStorage
  const saveTravelTimesToCache = (location: string, times: Map<string, number>) => {
    try {
      const obj = Object.fromEntries(times);
      localStorage.setItem(`travel_times_${location}`, JSON.stringify(obj));
    } catch (e) {
      console.error("Failed to save travel times to cache:", e);
    }
  };

  // Fetch travel times lazily (one by one) when location and showtimes exist
  useEffect(() => {
    if (!activeLocation.trim() || showtimes.length === 0) {
      setTravelTimes(new Map());
      setIsFetchingTravelTimes(false);
      return;
    }

    const fetchTravelTimesLazy = async () => {
      setIsFetchingTravelTimes(true);

      // Extract unique theater names from showtimes
      const theaters = new Set<string>();
      showtimes.forEach((show) => {
        if (show.theater?.name) {
          theaters.add(show.theater.name);
        }
      });

      // Check if we have cached times for this location
      const cachedTimes = getCachedTravelTimes(activeLocation);
      const times = cachedTimes || new Map<string, number>();

      // Set cached times immediately if available
      if (cachedTimes) {
        setTravelTimes(new Map(cachedTimes));
      }

      // Fetch missing theater times lazily (one at a time)
      for (const theaterName of Array.from(theaters)) {
        // Skip if already cached
        if (times.has(theaterName)) {
          continue;
        }

        try {
          const response = await fetch("/api/travel-time", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromLocation: activeLocation,
              toTheater: theaterName,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            times.set(theaterName, data.duration);

            // Update state incrementally as each theater loads
            setTravelTimes(new Map(times));

            // Save to cache after each successful fetch
            saveTravelTimesToCache(activeLocation, times);
          }
        } catch (e) {
          console.error(
            `Travel time fetch failed for ${theaterName}:`,
            e,
          );
        }
      }

      setIsFetchingTravelTimes(false);
    };

    fetchTravelTimesLazy();
  }, [activeLocation, showtimes]);

  const fetchShowtimes = async () => {
    if (!listPath.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/cineboxd?listPath=${encodeURIComponent(listPath.trim())}`,
      );

      if (!response.ok) {
        // Try to parse error message from JSON, fallback to text
        let errorMessage = `Failed to load list (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
        } catch {
          // If JSON parsing fails, try to get text
          try {
            const errorText = await response.text();
            if (errorText) errorMessage = errorText;
          } catch {
            // Ignore, use default error message
          }
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // JSON parsing failed on successful response - likely server issue
        throw new Error(
          "Server returned invalid data. Please try again in a moment.",
        );
      }

      setShowtimes(data?.data?.showtimes?.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
      setShowtimes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (IS_BROWSER) {
      fetchShowtimes();
    }
  }, [listPath]);

  // Extract unique filter options (filtered by date range and selections)
  const { uniqueCities, uniqueTheaters, uniqueFilms, filteredCities, filteredTheaters, filteredFilms } =
    useMemo(() => {
      // First, filter showtimes by date range
      let dateFilteredShowtimes = showtimes;
      if (startDate) {
        dateFilteredShowtimes = dateFilteredShowtimes.filter(
          (s) => s.startDate.split("T")[0] >= startDate
        );
      }
      if (endDate) {
        dateFilteredShowtimes = dateFilteredShowtimes.filter(
          (s) => s.startDate.split("T")[0] <= endDate
        );
      }

      // Build maps from ALL showtimes (for reference)
      const allTheatersMap = new Map<string, Show["theater"]>();
      const allFilmsMap = new Map<string, Show["film"]>();
      showtimes.forEach((show) => {
        if (show.theater && !allTheatersMap.has(show.theater.name)) {
          allTheatersMap.set(show.theater.name, show.theater);
        }
        if (show.film && !allFilmsMap.has(show.film.slug)) {
          allFilmsMap.set(show.film.slug, show.film);
        }
      });
      const allTheaters = Array.from(allTheatersMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const allFilms = Array.from(allFilmsMap.values()).sort((a, b) =>
        a.title.localeCompare(b.title)
      );
      const allCitiesSet = new Set<string>();
      allTheaters.forEach((theater) => {
        if (theater.address?.city) allCitiesSet.add(theater.address.city);
      });
      const allCities = Array.from(allCitiesSet).sort();

      // Build available sets from date-filtered showtimes
      const availableCities = new Set<string>();
      const availableTheaterNames = new Set<string>();
      const availableFilmSlugs = new Set<string>();

      dateFilteredShowtimes.forEach((show) => {
        if (show.theater.address?.city) {
          availableCities.add(show.theater.address.city);
        }
        availableTheaterNames.add(show.theater.name);
        availableFilmSlugs.add(show.film.slug);
      });

      // Filtered cities: available in date range
      const citiesInDateRange = allCities.filter((city) =>
        availableCities.has(city)
      );

      // Filtered theaters: available in date range AND in selected cities
      const theatersInSelection = allTheaters.filter((theater) => {
        if (!availableTheaterNames.has(theater.name)) return false;
        if (selectedCities.length > 0) {
          return selectedCities.includes(theater.address?.city || "");
        }
        return true;
      });

      // Filtered films: available in date range AND in selected cities/theaters
      const filmsInSelection = allFilms.filter((film) => {
        // Check if any showtime for this film matches the current filters
        return dateFilteredShowtimes.some((show) => {
          if (show.film.slug !== film.slug) return false;
          const cityMatch = selectedCities.length === 0 ||
            selectedCities.includes(show.theater.address?.city || "");
          const theaterMatch = selectedTheaters.length === 0 ||
            selectedTheaters.includes(show.theater.name);
          return cityMatch && theaterMatch;
        });
      });

      return {
        uniqueCities: allCities,
        uniqueTheaters: allTheaters,
        uniqueFilms: allFilms,
        filteredCities: citiesInDateRange,
        filteredTheaters: theatersInSelection,
        filteredFilms: filmsInSelection,
      };
    }, [showtimes, startDate, endDate, selectedCities, selectedTheaters]);

  // Auto-cleanup: Remove selected cities not available in date range
  useEffect(() => {
    // Don't run cleanup until we have data loaded
    if (showtimes.length === 0) return;

    if (selectedCities.length > 0) {
      const availableCitySet = new Set(filteredCities);
      const validCities = selectedCities.filter((city) => availableCitySet.has(city));
      if (validCities.length !== selectedCities.length) {
        setSelectedCities(validCities);
      }
    }
  }, [startDate, endDate, selectedCities, filteredCities, showtimes]);

  // Auto-cleanup: Remove selected theaters not available in current selection
  useEffect(() => {
    // Don't run cleanup until we have data loaded
    if (showtimes.length === 0) return;

    if (selectedTheaters.length > 0) {
      const availableTheaterSet = new Set(filteredTheaters.map((t) => t.name));
      const validTheaters = selectedTheaters.filter((name) => availableTheaterSet.has(name));
      if (validTheaters.length !== selectedTheaters.length) {
        setSelectedTheaters(validTheaters);
      }
    }
  }, [startDate, endDate, selectedCities, selectedTheaters, filteredTheaters, showtimes]);

  // Auto-cleanup: Remove selected films not available in current selection
  useEffect(() => {
    // Don't run cleanup until we have data loaded
    if (showtimes.length === 0) return;

    if (selectedFilms.length > 0) {
      const availableSlugs = new Set(filteredFilms.map((f) => f.slug));
      const validFilms = selectedFilms.filter((slug) => availableSlugs.has(slug));
      if (validFilms.length !== selectedFilms.length) {
        setSelectedFilms(validFilms);
      }
    }
  }, [startDate, endDate, selectedCities, selectedTheaters, selectedFilms, filteredFilms, showtimes]);

  // Filter showtimes based on selected filters
  const filteredShowtimes = useMemo(() => {
    let filtered = showtimes;

    if (startDate) {
      filtered = filtered.filter((s) => s.startDate.split("T")[0] >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((s) => s.startDate.split("T")[0] <= endDate);
    }
    if (selectedTheaters.length > 0) {
      filtered = filtered.filter((s) =>
        selectedTheaters.includes(s.theater.name)
      );
    }
    if (selectedFilms.length > 0) {
      filtered = filtered.filter((s) => selectedFilms.includes(s.film.slug));
    }
    if (selectedCities.length > 0) {
      filtered = filtered.filter((s) =>
        selectedCities.includes(s.theater.address?.city || "")
      );
    }

    return filtered;
  }, [
    showtimes,
    startDate,
    endDate,
    selectedTheaters,
    selectedFilms,
    selectedCities,
  ]);

  const groupedFilms = useMemo(() => {
    const films: Record<string, {
      film: Show["film"];
      shows: Show[];
      showsByDateAndTheater: Map<string, {
        date: string;
        theater: Show["theater"];
        shows: Show[];
      }>;
    }> = {};

    // Normalize title for grouping (combine Pathé and Cineville entries for same movie)
    const normalizeTitle = (title: string) => title.toLowerCase().trim();

    filteredShowtimes.forEach((show) => {
      const filmKey = normalizeTitle(show.film.title);
      if (!films[filmKey]) {
        films[filmKey] = {
          film: show.film,
          shows: [],
          showsByDateAndTheater: new Map(),
        };
      }
      // Use the film with more complete data (prefer one with poster/directors)
      const existing = films[filmKey].film;
      if (
        (!existing.poster?.url && show.film.poster?.url) ||
        (!existing.directors?.length && show.film.directors?.length) ||
        (!existing.duration && show.film.duration)
      ) {
        films[filmKey].film = {
          ...existing,
          poster: show.film.poster?.url ? show.film.poster : existing.poster,
          directors: show.film.directors?.length
            ? show.film.directors
            : existing.directors,
          duration: show.film.duration || existing.duration,
        };
      }
      films[filmKey].shows.push(show);

      // Group shows by date and theater
      const showDate = show.startDate.split("T")[0];
      const key = `${showDate}_${show.theater.name}`;
      if (!films[filmKey].showsByDateAndTheater.has(key)) {
        films[filmKey].showsByDateAndTheater.set(key, {
          date: showDate,
          theater: show.theater,
          shows: [],
        });
      }
      films[filmKey].showsByDateAndTheater.get(key)!.shows.push(show);
    });

    return Object.values(films).sort((a, b) =>
      a.film.title.localeCompare(b.film.title)
    );
  }, [filteredShowtimes]);

  const handleMultiSelect =
    (setter: (fn: (prev: string[]) => string[]) => void) => (value: string) => {
      setter((prev) =>
        prev.includes(value)
          ? prev.filter((item) => item !== value)
          : [...prev, value]
      );
    };

  const handleDateShortcut = (type: "today" | "week" | "month") => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (type === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === "week") {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      setStartDate(todayStr);
      setEndDate(nextWeek.toISOString().split("T")[0]);
    } else {
      const nextMonth = new Date(today);
      nextMonth.setDate(today.getDate() + 30);
      setStartDate(todayStr);
      setEndDate(nextMonth.toISOString().split("T")[0]);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
    setLinkCopied(false);

    if (shortLink || isGeneratingLink) return;

    setIsGeneratingLink(true);
    try {
      const currentPath = globalThis.location.pathname + globalThis.location.search;
      const response = await fetch("/api/shortlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentPath }),
      });

      const data = await response.json();
      if (response.ok && data.code) {
        setShortLink(`${globalThis.location.origin}/s/${data.code}`);
      }
    } catch (error) {
      console.error("Failed to generate short link:", error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shortLink) return;
    try {
      await navigator.clipboard.writeText(shortLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = shortLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Share Modal */}
      {showShareModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowShareModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowShareModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              border: "1px solid #2f3336",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="share-modal-title"
              style={{
                margin: "0 0 16px 0",
                color: "#e1e8ed",
                fontSize: "18px",
              }}
            >
              Share this list
            </h3>

            {isGeneratingLink ? (
              <p style={{ color: "#9ca3af" }}>Generating link...</p>
            ) : shortLink ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <input
                    type="text"
                    value={shortLink}
                    readOnly
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      backgroundColor: "#0f1419",
                      border: "1px solid #2f3336",
                      borderRadius: "6px",
                      color: "#e1e8ed",
                      fontSize: "14px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: linkCopied ? "#10b981" : "#1d4ed8",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {linkCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>
                  Share this link to show others what's playing from this list.
                </p>
              </div>
            ) : (
              <p style={{ color: "#f4212e" }}>Failed to generate link</p>
            )}

            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                backgroundColor: "transparent",
                color: "#9ca3af",
                border: "1px solid #2f3336",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                width: "100%",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowLocationModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowLocationModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              border: "1px solid #2f3336",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="location-modal-title"
              style={{
                margin: "0 0 16px 0",
                color: "#e1e8ed",
                fontSize: "18px",
              }}
            >
              Select Your Location
            </h3>

            <p
              style={{
                color: "#9ca3af",
                fontSize: "14px",
                margin: "0 0 16px 0",
              }}
            >
              Choose your starting location to see travel times to each theater
            </p>

            <div style={{ marginBottom: "16px" }}>
              {Object.entries(CITY_STATION_MAPPINGS).map(([city, mapping]) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setSelectedLocation(city)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 16px",
                    marginBottom: "8px",
                    backgroundColor:
                      selectedLocation === city ? "#1d4ed8" : "#0f1419",
                    border: `1px solid ${
                      selectedLocation === city ? "#1d4ed8" : "#2f3336"
                    }`,
                    borderRadius: "6px",
                    color: selectedLocation === city ? "white" : "#e1e8ed",
                    fontSize: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedLocation !== city) {
                      (e.target as HTMLElement).style.backgroundColor =
                        "#1e293b";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedLocation !== city) {
                      (e.target as HTMLElement).style.backgroundColor =
                        "#0f1419";
                    }
                  }}
                >
                  <div style={{ fontWeight: "500" }}>{city}</div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: selectedLocation === city
                        ? "rgba(255,255,255,0.8)"
                        : "#9ca3af",
                      marginTop: "4px",
                    }}
                  >
                    {mapping.stationName}
                  </div>
                </button>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  color: "#9ca3af",
                  border: "1px solid #2f3336",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              {activeLocation && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveLocation("");
                    setSelectedLocation("");
                    setShowLocationModal(false);
                  }}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  Clear Location
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (selectedLocation) {
                    setActiveLocation(selectedLocation);
                    setShowLocationModal(false);
                  }
                }}
                disabled={!selectedLocation}
                style={{
                  padding: "8px 16px",
                  backgroundColor: selectedLocation ? "#1d4ed8" : "#374151",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: selectedLocation ? "pointer" : "not-allowed",
                  fontSize: "14px",
                  fontWeight: "500",
                  opacity: selectedLocation ? 1 : 0.5,
                }}
              >
                Set Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          backgroundColor: "#1e293b",
          borderBottom: "1px solid #2f3336",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          class="header-controls"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a
              href="/"
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "bold",
                color: "#3b82f6",
                textDecoration: "none",
              }}
            >
              Cineboxd
            </a>
            <span style={{ color: "#9ca3af", fontSize: "14px" }}>·</span>
            <span style={{ color: "#e1e8ed", fontSize: "14px" }}>
              {formatListName(listPath)}
            </span>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share this list"
              style={{
                marginLeft: "8px",
                padding: "6px 12px",
                backgroundColor: "#1d4ed8",
                border: "none",
                borderRadius: "6px",
                color: "white",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>

          {/* Location Button */}
          <button
            type="button"
            onClick={() => setShowLocationModal(true)}
            style={{
              marginLeft: "auto",
              padding: "6px 12px",
              backgroundColor: activeLocation ? "#1d4ed8" : "#1e293b",
              border: "1px solid #2f3336",
              borderRadius: "6px",
              color: activeLocation ? "white" : "#9ca3af",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {activeLocation || "Set Location"}
          </button>

          <div
            class="header-row"
            style={{
              flex: 1,
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Date Shortcuts */}
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                onClick={() => handleDateShortcut("today")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #2f3336",
                  backgroundColor: "#0f1419",
                  color: "#e1e8ed",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleDateShortcut("week")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #2f3336",
                  backgroundColor: "#0f1419",
                  color: "#e1e8ed",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Next Week
              </button>
              <button
                type="button"
                onClick={() => handleDateShortcut("month")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #2f3336",
                  backgroundColor: "#0f1419",
                  color: "#e1e8ed",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Next Month
              </button>
            </div>

            {/* Date Filters */}
            <div
              class="date-filters"
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <label htmlFor="filter-start-date" style={{ fontSize: "12px", color: "#9ca3af" }}>From:</label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <input
                  id="filter-start-date"
                  class="date-input"
                  type="date"
                  value={startDate}
                  onInput={(e) =>
                    setStartDate((e.target as HTMLInputElement).value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid #2f3336",
                    backgroundColor: "#0f1419",
                    color: "#e1e8ed",
                    fontSize: "14px",
                    cursor: "pointer",
                    minWidth: "140px",
                    width: "140px",
                  }}
                />
                {startDate && (
                  <button
                    type="button"
                    onClick={() => setStartDate("")}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #2f3336",
                      borderRadius: "3px",
                      color: "#9ca3af",
                      cursor: "pointer",
                      padding: "4px 8px",
                      fontSize: "14px",
                      lineHeight: "1",
                      height: "28px",
                    }}
                  >
                    x
                  </button>
                )}
              </div>
              <label htmlFor="filter-end-date" style={{ fontSize: "12px", color: "#9ca3af" }}>To:</label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <input
                  id="filter-end-date"
                  class="date-input"
                  type="date"
                  value={endDate}
                  onInput={(e) =>
                    setEndDate((e.target as HTMLInputElement).value)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    border: "1px solid #2f3336",
                    backgroundColor: "#0f1419",
                    color: "#e1e8ed",
                    fontSize: "14px",
                    cursor: "pointer",
                    minWidth: "140px",
                    width: "140px",
                  }}
                />
                {endDate && (
                  <button
                    type="button"
                    onClick={() => setEndDate("")}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #2f3336",
                      borderRadius: "3px",
                      color: "#9ca3af",
                      cursor: "pointer",
                      padding: "4px 8px",
                      fontSize: "14px",
                      lineHeight: "1",
                      height: "28px",
                    }}
                  >
                    x
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div style={{ position: "relative" }} data-dropdown="city">
              <button
                type="button"
                aria-expanded={showCityFilter}
                aria-haspopup="listbox"
                onClick={() => {
                  setShowCityFilter(!showCityFilter);
                  setShowMovieFilter(false);
                  setShowTheaterFilter(false);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "1px solid #2f3336",
                  backgroundColor: selectedCities.length > 0
                    ? "#1d4ed8"
                    : "#0f1419",
                  color: selectedCities.length > 0 ? "white" : "#e1e8ed",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                All Cities {selectedCities.length > 0
                  ? `(${selectedCities.length})`
                  : (startDate || endDate)
                  ? `(${filteredCities.length} available)`
                  : ""}
              </button>
              {showCityFilter && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "4px",
                    backgroundColor: "#1e293b",
                    border: "1px solid #2f3336",
                    borderRadius: "4px",
                    padding: "8px",
                    minWidth: "200px",
                    maxHeight: "300px",
                    overflowY: "auto",
                    zIndex: 1000,
                  }}
                >
                  {filteredCities.map((city) => (
                    <label
                      key={city}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city)}
                        onChange={() =>
                          handleMultiSelect(setSelectedCities)(city)}
                        style={{ marginRight: "8px" }}
                      />
                      {city}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }} data-dropdown="theater">
              <button
                type="button"
                aria-expanded={showTheaterFilter}
                aria-haspopup="listbox"
                onClick={() => {
                  setShowTheaterFilter(!showTheaterFilter);
                  setShowCityFilter(false);
                  setShowMovieFilter(false);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "1px solid #2f3336",
                  backgroundColor: selectedTheaters.length > 0
                    ? "#1d4ed8"
                    : "#0f1419",
                  color: selectedTheaters.length > 0 ? "white" : "#e1e8ed",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                All Theaters {selectedTheaters.length > 0
                  ? `(${selectedTheaters.length})`
                  : (startDate || endDate || selectedCities.length > 0)
                  ? `(${filteredTheaters.length} available)`
                  : ""}
              </button>
              {showTheaterFilter && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "4px",
                    backgroundColor: "#1e293b",
                    border: "1px solid #2f3336",
                    borderRadius: "4px",
                    padding: "8px",
                    minWidth: "250px",
                    maxHeight: "300px",
                    overflowY: "auto",
                    zIndex: 1000,
                  }}
                >
                  {filteredTheaters.map((theater) => (
                    <label
                      key={theater.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTheaters.includes(theater.name)}
                        onChange={() =>
                          handleMultiSelect(setSelectedTheaters)(theater.name)}
                        style={{ marginRight: "8px" }}
                      />
                      {theater.name}{" "}
                      {theater.address?.city && `(${theater.address.city})`}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }} data-dropdown="movie">
              <button
                type="button"
                aria-expanded={showMovieFilter}
                aria-haspopup="listbox"
                onClick={() => {
                  setShowMovieFilter(!showMovieFilter);
                  setShowCityFilter(false);
                  setShowTheaterFilter(false);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "1px solid #2f3336",
                  backgroundColor: selectedFilms.length > 0
                    ? "#1d4ed8"
                    : "#0f1419",
                  color: selectedFilms.length > 0 ? "white" : "#e1e8ed",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                All Movies {selectedFilms.length > 0
                  ? `(${selectedFilms.length})`
                  : (startDate || endDate || selectedCities.length > 0 || selectedTheaters.length > 0)
                  ? `(${filteredFilms.length} available)`
                  : ""}
              </button>
              {showMovieFilter && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "4px",
                    backgroundColor: "#1e293b",
                    border: "1px solid #2f3336",
                    borderRadius: "4px",
                    padding: "8px",
                    minWidth: "250px",
                    maxHeight: "300px",
                    overflowY: "auto",
                    zIndex: 1000,
                  }}
                >
                  {filteredFilms.map((film) => (
                    <label
                      key={film.slug}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFilms.includes(film.slug)}
                        onChange={() =>
                          handleMultiSelect(setSelectedFilms)(film.slug)}
                        style={{ marginRight: "8px" }}
                      />
                      {film.title}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "20px",
          minHeight: "60vh",
        }}
      >
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            style={{
              textAlign: "center",
              padding: "40px 40px",
              color: "#9ca3af",
            }}
          >
            <FilmReelSpinner />
            <p
              style={{
                marginTop: "24px",
                fontSize: "1.1rem",
                color: "#9ca3af",
                minHeight: "1.5em",
              }}
            >
              {LOADING_MESSAGES[loadingMessageIndex]}
            </p>
          </div>
        )}

        {error && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 40px",
            }}
          >
            <div
              style={{
                fontSize: "3rem",
                marginBottom: "16px",
              }}
            >
              😕
            </div>
            <p
              style={{
                color: "#f4212e",
                fontSize: "1.1rem",
                marginBottom: "24px",
              }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => fetchShowtimes()}
              style={{
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: "600",
                backgroundColor: "#1d4ed8",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && groupedFilms.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 40px",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🎬</div>
            <p
              style={{
                color: "#9ca3af",
                fontSize: "1.1rem",
                marginBottom: "16px",
              }}
            >
              No showtimes found for this list
            </p>
            <a
              href={`https://letterboxd.com/${listPath}/`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#3b82f6",
                textDecoration: "none",
                fontSize: "0.95rem",
              }}
            >
              View list on Letterboxd →
            </a>
          </div>
        )}

        {!isLoading && !error && groupedFilms.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {groupedFilms.map(({ film, showsByDateAndTheater }, index) => (
              <div
                key={film.slug}
                style={{
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 400px",
                }}
              >
                <MovieCard
                  film={film}
                  showsByDateAndTheater={Array.from(
                    showsByDateAndTheater.entries(),
                  )}
                  isFirstCard={index === 0}
                  travelTimes={travelTimes}
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid #2f3336",
            textAlign: "center",
          }}
        >
          <a
            href="/105424/watchlist/"
            style={{
              color: "#9ca3af",
              textDecoration: "none",
              fontSize: "0.85rem",
            }}
          >
            Check out the creator's watchlist →
          </a>
        </footer>
      </main>
    </div>
  );
}

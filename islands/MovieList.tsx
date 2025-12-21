import { useEffect, useMemo, useState } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";
import MovieCard from "./MovieCard.tsx";

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
        width: "80px",
        height: "80px",
        position: "relative",
        margin: "0 auto",
      }}
    >
      {/* Outer reel */}
      <div
        class="film-reel-spin"
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          border: "4px solid #3b82f6",
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
              width: "12px",
              height: "12px",
              backgroundColor: "#3b82f6",
              borderRadius: "50%",
              top: "50%",
              left: "50%",
              transform:
                `rotate(${angle}deg) translateY(-30px) translateX(-6px)`,
            }}
          />
        ))}
        {/* Center hole */}
        <div
          style={{
            position: "absolute",
            width: "20px",
            height: "20px",
            backgroundColor: "#0f1419",
            border: "3px solid #3b82f6",
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

  // Cycle through loading messages
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Initialize from URL params on mount (client-side only)
  useEffect(() => {
    if (!IS_BROWSER) return;

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

  // Handle click outside to close dropdowns
  useEffect(() => {
    if (!IS_BROWSER) return;

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
    if (!IS_BROWSER) return;

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

  const fetchShowtimes = async () => {
    if (!listPath.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/cineboxd?listPath=${encodeURIComponent(listPath.trim())}`,
      );
      const data = await response.json();

      if (!response.ok) {
        // Use error message from API if available
        throw new Error(
          data?.error || `Failed to load list (HTTP ${response.status})`,
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

  // Extract unique filter options
  const { uniqueCities, uniqueTheaters, uniqueFilms, filteredTheaters } =
    useMemo(() => {
      const theatersMap = new Map<string, Show["theater"]>();
      const filmsMap = new Map<string, Show["film"]>();

      showtimes.forEach((show) => {
        if (show.theater && !theatersMap.has(show.theater.name)) {
          theatersMap.set(show.theater.name, show.theater);
        }
        if (show.film && !filmsMap.has(show.film.slug)) {
          filmsMap.set(show.film.slug, show.film);
        }
      });

      const allTheaters = Array.from(theatersMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const allFilms = Array.from(filmsMap.values()).sort((a, b) =>
        a.title.localeCompare(b.title)
      );

      const citiesSet = new Set<string>();
      allTheaters.forEach((theater) => {
        if (theater.address?.city) citiesSet.add(theater.address.city);
      });
      const allCities = Array.from(citiesSet).sort();

      // Filter theaters by selected cities
      const theatersInSelectedCities = selectedCities.length > 0
        ? allTheaters.filter((theater) =>
          selectedCities.includes(theater.address?.city || "")
        )
        : allTheaters;

      return {
        uniqueCities: allCities,
        uniqueTheaters: allTheaters,
        uniqueFilms: allFilms,
        filteredTheaters: theatersInSelectedCities,
      };
    }, [showtimes, selectedCities]);

  // Auto-cleanup: Remove selected theaters that are not in selected cities
  useEffect(() => {
    if (selectedCities.length > 0 && selectedTheaters.length > 0) {
      const validTheaters = selectedTheaters.filter((theaterName) => {
        const theater = uniqueTheaters.find((t) => t.name === theaterName);
        return theater && selectedCities.includes(theater.address?.city || "");
      });

      if (validTheaters.length !== selectedTheaters.length) {
        setSelectedTheaters(validTheaters);
      }
    }
  }, [selectedCities, selectedTheaters, uniqueTheaters]);

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
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      setStartDate(todayStr);
      setEndDate(endOfWeek.toISOString().split("T")[0]);
    } else {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(todayStr);
      setEndDate(endOfMonth.toISOString().split("T")[0]);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
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
            <span style={{ color: "#71767b", fontSize: "14px" }}>·</span>
            <span style={{ color: "#e1e8ed", fontSize: "14px" }}>
              {formatListName(listPath)}
            </span>
          </div>

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
                This Week
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
                This Month
              </button>
            </div>

            {/* Date Filters */}
            <div
              class="date-filters"
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
            >
              <span style={{ fontSize: "12px", color: "#71767b" }}>From:</span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <input
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
                      color: "#71767b",
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
              <span style={{ fontSize: "12px", color: "#71767b" }}>To:</span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <input
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
                      color: "#71767b",
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
                    ? "#3b82f6"
                    : "#0f1419",
                  color: selectedCities.length > 0 ? "white" : "#e1e8ed",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                All Cities{" "}
                {selectedCities.length > 0 && `(${selectedCities.length})`}
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
                  {uniqueCities.map((city) => (
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
                    ? "#3b82f6"
                    : "#0f1419",
                  color: selectedTheaters.length > 0 ? "white" : "#e1e8ed",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                All Theaters {selectedTheaters.length > 0
                  ? `(${selectedTheaters.length})`
                  : selectedCities.length > 0
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
                    ? "#3b82f6"
                    : "#0f1419",
                  color: selectedFilms.length > 0 ? "white" : "#e1e8ed",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                All Movies{" "}
                {selectedFilms.length > 0 && `(${selectedFilms.length})`}
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
                  {uniqueFilms.map((film) => (
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
        }}
      >
        {isLoading && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 40px",
              color: "#71767b",
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
                backgroundColor: "#3b82f6",
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
            {groupedFilms.map(({ film, showsByDateAndTheater }) => (
              <MovieCard
                key={film.slug}
                film={film}
                showsByDateAndTheater={Array.from(
                  showsByDateAndTheater.entries(),
                )}
              />
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
              color: "#71767b",
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

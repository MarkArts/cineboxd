import { useMemo, useState, useRef, useEffect } from "preact/hooks";

// Generate optimized poster URLs for srcset
function getPosterSrcSet(url: string): { src: string; srcSet: string } {
  if (!url) return { src: url, srcSet: "" };

  // imgix URLs - generate multiple sizes
  if (url.includes("imgix.net")) {
    const base = url.split("?")[0];
    const sizes = [200, 400, 600];
    const srcSet = sizes
      .map((w) =>
        `${base}?w=${w}&h=${
          Math.round(w * 1.5)
        }&fit=crop&auto=format,compress&q=65 ${w}w`
      )
      .join(", ");
    return {
      src: `${base}?w=200&h=300&fit=crop&auto=format,compress&q=65`,
      srcSet,
    };
  }

  // TMDB URLs - use available sizes
  if (url.includes("image.tmdb.org")) {
    const pathMatch = url.match(/\/t\/p\/\w+(\/.+)$/);
    if (pathMatch) {
      const imagePath = pathMatch[1];
      const baseUrl = "https://image.tmdb.org/t/p";
      return {
        src: `${baseUrl}/w342${imagePath}`,
        srcSet:
          `${baseUrl}/w185${imagePath} 185w, ${baseUrl}/w342${imagePath} 342w, ${baseUrl}/w500${imagePath} 500w`,
      };
    }
  }

  return { src: url, srcSet: "" };
}

interface Show {
  id: string;
  startDate: string;
  ticketingUrl: string;
  chain?: "cineville" | "pathe";
  subtitlesList?: string[];
  languageVersion?: string;
  languageVersionAbbreviation?: string;
}

interface TheaterData {
  date: string;
  theater: {
    name: string;
    address?: { city: string };
  };
  shows: Show[];
}

interface MovieCardProps {
  film: {
    title: string;
    slug: string;
    poster?: { url: string };
    duration: number;
    directors: string[];
  };
  showsByDateAndTheater: [string, TheaterData][];
  isFirstCard?: boolean;
  travelTimes?: Map<string, number>;
  userLocation?: string;
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(minutes: number): string {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTravelTime(minutes: number): string {
  if (!minutes) return "";
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

export default function MovieCard(
  { film, showsByDateAndTheater, isFirstCard = false, travelTimes, userLocation }:
    MovieCardProps,
) {
  // Debug logging
  if (travelTimes && travelTimes.size > 0) {
    console.log(`[MovieCard ${film.title}] Received travel times for ${travelTimes.size} theaters`);
  }
  // Memoize sorting and grouping to avoid recalculation on every render
  const showsByDate = useMemo(() => {
    const sortedEntries = [...showsByDateAndTheater].sort((a, b) => {
      const dateA = a[1].date;
      const dateB = b[1].date;
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return a[1].theater.name.localeCompare(b[1].theater.name);
    });

    const grouped = new Map<string, Map<string, TheaterData>>();
    sortedEntries.forEach(([_key, data]) => {
      const date = data.date;
      if (!grouped.has(date)) {
        grouped.set(date, new Map());
      }
      grouped.get(date)!.set(data.theater.name, data);
    });
    return grouped;
  }, [showsByDateAndTheater]);

  const dateKeys = useMemo(() => Array.from(showsByDate.keys()), [showsByDate]);

  const [selectedDate, setSelectedDate] = useState<string>(
    dateKeys.length > 0 ? dateKeys[0] : "",
  );

  // Drag-to-scroll state for date selector
  const dateListRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const handleMouseDown = (e: any) => {
    if (!dateListRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    scrollLeftRef.current = dateListRef.current.scrollLeft;
    setIsDragging(true);
    e.preventDefault();
  };

  const handleDateClick = (date: string) => {
    // Prevent selection if user was dragging
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    setSelectedDate(date);
  };

  // Attach global event listeners for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dateListRef.current) return;
      e.preventDefault();

      const x = e.clientX;
      const walk = (x - startXRef.current) * 1.5;

      // Mark as dragged if moved more than 5 pixels
      if (Math.abs(walk) > 5) {
        hasMovedRef.current = true;
      }

      dateListRef.current.scrollLeft = scrollLeftRef.current - walk;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Memoize poster URLs
  const posterUrls = useMemo(
    () => (film.poster?.url ? getPosterSrcSet(film.poster.url) : null),
    [film.poster?.url],
  );

  return (
    <article
      style={{
        backgroundColor: "#1e293b",
        borderRadius: "8px",
        border: "1px solid #2f3336",
        overflow: "hidden",
        padding: "16px",
        contain: "layout style paint",
      }}
    >
      <div
        class="movie-card-layout"
        style={{
          display: "flex",
          gap: "16px",
        }}
      >
        {/* Poster */}
        <div
          class="movie-poster"
          style={{
            width: "200px",
            height: "300px",
            flexShrink: 0,
            backgroundColor: "#2f3336",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          {posterUrls
            ? (
              <img
                src={posterUrls.src}
                srcSet={posterUrls.srcSet || undefined}
                sizes="(max-width: 768px) 120px, 200px"
                alt={film.title}
                loading={isFirstCard ? "eager" : "lazy"}
                fetchpriority={isFirstCard ? "high" : undefined}
                decoding="async"
                width={200}
                height={300}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )
            : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  color: "#9ca3af",
                  textAlign: "center",
                  padding: "8px",
                }}
              >
                {film.title.substring(0, 20)}
              </div>
            )}
        </div>

        {/* Right side: Film Info + Theaters */}
        <div
          class="movie-content"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "300px",
          }}
        >
          {/* Film Info */}
          <div>
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "20px",
                fontWeight: "bold",
                color: "#e1e8ed",
              }}
            >
              {film.title}
            </h3>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                marginBottom: "12px",
                fontSize: "14px",
                color: "#9ca3af",
              }}
            >
              {film.directors.length > 0 && (
                <span>Directed by {film.directors.join(", ")}</span>
              )}
              {film.duration > 0 && <span>{formatDuration(film.duration)}
              </span>}
            </div>

            {/* Horizontal Date List */}
            <div
              ref={dateListRef}
              class="date-list"
              onMouseDown={handleMouseDown}
              style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                paddingBottom: "12px",
                marginBottom: "12px",
                borderBottom: "1px solid #2f3336",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none",
              }}
            >
              {dateKeys.map((date) => {
                const dateStr = new Date(date + "T00:00:00").toLocaleDateString(
                  "en-GB",
                  {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  },
                );
                const fullDateStr = new Date(date + "T00:00:00").toLocaleDateString(
                  "en-GB",
                  {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  },
                );
                const isSelected = date === selectedDate;

                return (
                  <button
                    type="button"
                    key={date}
                    onClick={() => handleDateClick(date)}
                    aria-label={`${isSelected ? "Selected: " : "Select "}showtimes for ${fullDateStr}`}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: isSelected ? "#1d4ed8" : "#0f1419",
                      color: isSelected ? "white" : "#e1e8ed",
                      border: `1px solid ${isSelected ? "#1d4ed8" : "#2f3336"}`,
                      borderRadius: "4px",
                      fontSize: "13px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {dateStr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theater Locations for Selected Date */}
          {selectedDate && showsByDate.get(selectedDate) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {Array.from(showsByDate.get(selectedDate)!.values())
                .sort((a, b) => a.theater.name.localeCompare(b.theater.name))
                .map((data) => {
                  // Check if this theater has ANY showtime with subtitle data for this film
                  const hasAnySubtitleData = data.shows.some(show =>
                    (show.subtitlesList && show.subtitlesList.length > 0) ||
                    show.languageVersionAbbreviation
                  );

                  return (
                  <div
                    key={data.theater.name}
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                      padding: "8px",
                      backgroundColor: "#0f1419",
                      borderRadius: "6px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#e1e8ed",
                          marginBottom: "4px",
                        }}
                      >
                        {data.theater.name}
                        {data.theater.address?.city && (
                          <>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#9ca3af",
                                fontWeight: "normal",
                                marginLeft: "8px",
                              }}
                            >
                              • {data.theater.address.city}
                            </span>
                            {travelTimes?.has(data.theater.name) && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#9ca3af",
                                  fontWeight: "normal",
                                }}
                              >
                                {" "}(
                                <a
                                  href={userLocation
                                    ? `https://www.google.com/maps/dir/?api=1&origin=${
                                      encodeURIComponent(userLocation)
                                    }&destination=${
                                      encodeURIComponent(
                                        `${data.theater.name}, ${data.theater.address.city}, Netherlands`,
                                      )
                                    }&travelmode=transit`
                                    : `https://www.google.com/maps/search/${
                                      encodeURIComponent(
                                        `${data.theater.name}, ${data.theater.address.city}, Netherlands`,
                                      )
                                    }`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#3b82f6",
                                    textDecoration: "none",
                                  }}
                                  onMouseEnter={(e) => {
                                    (e.target as HTMLAnchorElement).style.textDecoration = "underline";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.target as HTMLAnchorElement).style.textDecoration = "none";
                                  }}
                                >
                                  {formatTravelTime(travelTimes.get(data.theater.name)!)}
                                </a>)
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                        }}
                      >
                        {data.shows
                          .sort((a, b) =>
                            new Date(a.startDate).getTime() -
                            new Date(b.startDate).getTime()
                          )
                          .map((show) => {
                            const isPathe = show.chain === "pathe";
                            const bgColor = isPathe ? "#c2410c" : "#1d4ed8";
                            const timeStr = formatTime(show.startDate);

                            // Format subtitle information
                            const subtitleInfo = [];
                            const hasExplicitSubtitleData =
                              (show.subtitlesList && show.subtitlesList.length > 0) ||
                              show.languageVersionAbbreviation;

                            if (show.languageVersionAbbreviation) {
                              subtitleInfo.push(show.languageVersionAbbreviation.toUpperCase());
                            }
                            if (show.subtitlesList && show.subtitlesList.length > 0) {
                              const subtitles = show.subtitlesList.map(s => s.toUpperCase()).join("/");
                              subtitleInfo.push(subtitles);
                            }

                            // If this theater has mixed subtitle data and this showtime has none, default to NL
                            if (hasAnySubtitleData && !hasExplicitSubtitleData) {
                              subtitleInfo.push("NL");
                            }

                            const subtitleStr = subtitleInfo.length > 0
                              ? ` (${subtitleInfo.join(", ")})`
                              : "";

                            const ariaLabel = show.ticketingUrl
                              ? `Book tickets for ${timeStr} showing of ${film.title} at ${data.theater.name}${subtitleStr}`
                              : `${timeStr} showing at ${data.theater.name}${subtitleStr} - tickets unavailable`;

                            return (
                              <a
                                key={show.id}
                                href={show.ticketingUrl || "#"}
                                target={show.ticketingUrl ? "_blank" : "_self"}
                                rel="noopener noreferrer"
                                aria-label={ariaLabel}
                                style={{
                                  padding: "4px 10px",
                                  backgroundColor: bgColor,
                                  color: "white",
                                  textDecoration: "none",
                                  borderRadius: "4px",
                                  fontSize: "13px",
                                  fontWeight: "500",
                                  cursor: show.ticketingUrl
                                    ? "pointer"
                                    : "default",
                                  display: "inline-block",
                                }}
                                title={subtitleInfo.length > 0 ? subtitleInfo.join(", ") : undefined}
                              >
                                {timeStr}
                                {subtitleStr && (
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      opacity: "0.85",
                                      marginLeft: "4px",
                                    }}
                                  >
                                    {subtitleStr}
                                  </span>
                                )}
                              </a>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

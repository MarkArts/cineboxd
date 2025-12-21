import { useEffect, useState } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";

// Parse Letterboxd URL or path to get the list path
// Handles:
// - Full URLs: https://letterboxd.com/username/watchlist/
// - Full URLs: https://letterboxd.com/dave/list/official-top-250-narrative-feature-films/
// - Paths: username/watchlist
// - Paths: dave/list/official-top-250-narrative-feature-films
// - Just username: username (converts to username/watchlist)
function parseLetterboxdInput(input: string): string {
  const trimmed = input.trim();

  // Remove letterboxd.com prefix if present
  let path = trimmed
    .replace(/^https?:\/\/(www\.)?letterboxd\.com\/?/, "")
    .replace(/\/$/, ""); // Remove trailing slash

  // If it's just a username (no slashes), assume watchlist
  if (!path.includes("/")) {
    path = `${path}/watchlist`;
  }

  return path;
}

// Date helpers for time range filters
function getDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getNextWeekRange(): string {
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + 7);
  return `startDate=${getDateString(today)}&endDate=${getDateString(endOfWeek)}`;
}

function getNextMonthRange(): string {
  const today = new Date();
  const endOfMonth = new Date(today);
  endOfMonth.setDate(today.getDate() + 30);
  return `startDate=${getDateString(today)}&endDate=${getDateString(endOfMonth)}`;
}

// Example lists to showcase
const EXAMPLE_LISTS = [
  {
    title: "Sight & Sound 2024",
    subtitle: "Critics' picks this week",
    path: "idiah/list/sight-and-sound-2024",
    emoji: "🎥",
    getFilters: getNextWeekRange,
  },
  {
    title: "Most Popular",
    subtitle: "Fan favorites next month",
    path: "jack/list/official-top-250-films-with-the-most-fans",
    emoji: "❤️",
    getFilters: getNextMonthRange,
  },
  {
    title: "Must Watch",
    subtitle: "Essential cinema this week",
    path: "fcbarcelona/list/movies-everyone-should-watch-at-least-once",
    emoji: "✨",
    getFilters: getNextWeekRange,
  },
  {
    title: "Criterion 2026",
    subtitle: "Arthouse gems next month",
    path: "benvsthemovies/list/the-criterion-challenge-2026",
    emoji: "🎬",
    getFilters: getNextMonthRange,
  },
];

export default function HomePage() {
  const [input, setInput] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);

  // Reset navigating state when page is restored from bfcache (back button)
  useEffect(() => {
    if (!IS_BROWSER) return;

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setIsNavigating(false);
      }
    };

    globalThis.addEventListener("pageshow", handlePageShow);
    return () => globalThis.removeEventListener("pageshow", handlePageShow);
  }, []);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const path = parseLetterboxdInput(input);
    if (path) {
      setIsNavigating(true);
      globalThis.location.href = `/${path}/`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  const navigateToExample = (path: string, filters: string) => {
    setIsNavigating(true);
    const url = filters ? `/${path}/?${filters}` : `/${path}/`;
    globalThis.location.href = url;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f1419",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Bokeh Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div class="bokeh-circle bokeh-1" />
        <div class="bokeh-circle bokeh-2" />
        <div class="bokeh-circle bokeh-3" />
        <div class="bokeh-circle bokeh-4" />
        <div class="bokeh-circle bokeh-5" />
        <div class="bokeh-circle bokeh-6" />
        <div class="bokeh-circle bokeh-7" />
        <div class="bokeh-circle bokeh-8" />
      </div>

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "20px",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        {/* Logo */}
        <h1
          style={{
            fontSize: "4rem",
            fontWeight: "bold",
            margin: "0 0 16px 0",
            background:
              "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 0 60px rgba(59, 130, 246, 0.5)",
            letterSpacing: "-0.02em",
          }}
        >
          Cineboxd
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: "1.1rem",
            color: "#9ca3af",
            margin: "0 0 32px 0",
            lineHeight: 1.6,
          }}
        >
          Find showtimes for any Letterboxd list
          <br />
          in Dutch cinemas
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={input}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
              placeholder="Username, list URL, or letterboxd.com/..."
              disabled={isNavigating}
              style={{
                width: "100%",
                maxWidth: "400px",
                padding: "14px 20px",
                fontSize: "16px",
                backgroundColor: "#1e293b",
                border: "2px solid #374151",
                borderRadius: "12px",
                color: "#e1e8ed",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#3b82f6";
                (e.target as HTMLInputElement).style.boxShadow =
                  "0 0 0 3px rgba(59, 130, 246, 0.2)";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#374151";
                (e.target as HTMLInputElement).style.boxShadow = "none";
              }}
            />

            <button
              type="submit"
              disabled={!input.trim() || isNavigating}
              style={{
                padding: "14px 48px",
                fontSize: "16px",
                fontWeight: "600",
                backgroundColor: input.trim() && !isNavigating
                  ? "#3b82f6"
                  : "#374151",
                color: input.trim() && !isNavigating ? "white" : "#6b7280",
                border: "none",
                borderRadius: "12px",
                cursor: input.trim() && !isNavigating
                  ? "pointer"
                  : "not-allowed",
                transition: "background-color 0.2s, transform 0.1s",
              }}
              onMouseOver={(e) => {
                if (input.trim() && !isNavigating) {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    "#2563eb";
                }
              }}
              onMouseOut={(e) => {
                if (input.trim() && !isNavigating) {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    "#3b82f6";
                }
              }}
              onMouseDown={(e) => {
                if (input.trim() && !isNavigating) {
                  (e.target as HTMLButtonElement).style.transform =
                    "scale(0.98)";
                }
              }}
              onMouseUp={(e) => {
                (e.target as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              {isNavigating ? "Loading..." : "Find Showtimes"}
            </button>
          </div>
        </form>

        {/* Example Lists */}
        <div style={{ marginTop: "48px" }}>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#6b7280",
              marginBottom: "16px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Or try a popular list
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            {EXAMPLE_LISTS.map((example) => (
              <button
                type="button"
                key={example.path}
                onClick={() => navigateToExample(example.path, example.getFilters())}
                disabled={isNavigating}
                style={{
                  padding: "16px",
                  backgroundColor: "#1e293b",
                  border: "1px solid #374151",
                  borderRadius: "12px",
                  cursor: isNavigating ? "wait" : "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  if (!isNavigating) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "#3b82f6";
                    (e.currentTarget as HTMLButtonElement).style
                      .backgroundColor = "#253548";
                  }
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#374151";
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "#1e293b";
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ fontSize: "1.5rem" }}>{example.emoji}</span>
                  <div>
                    <div
                      style={{
                        color: "#e1e8ed",
                        fontWeight: "600",
                        fontSize: "0.95rem",
                      }}
                    >
                      {example.title}
                    </div>
                    <div
                      style={{
                        color: "#71767b",
                        fontSize: "0.8rem",
                        marginTop: "2px",
                      }}
                    >
                      {example.subtitle}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <p
          style={{
            marginTop: "40px",
            fontSize: "0.8rem",
            color: "#4b5563",
          }}
        >
          Works with any public Letterboxd list, watchlist, or username
        </p>
        <p
          style={{
            marginTop: "8px",
            fontSize: "0.75rem",
            color: "#374151",
          }}
        >
          Powered by Cineville & Pathe
        </p>
      </div>
    </div>
  );
}

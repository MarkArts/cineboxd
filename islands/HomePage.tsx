import { useState } from "preact/hooks";

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (username.trim()) {
      setIsNavigating(true);
      globalThis.location.href = `/${encodeURIComponent(username.trim())}/`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
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
        {/* Bokeh circles */}
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
          maxWidth: "500px",
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
            margin: "0 0 40px 0",
            lineHeight: 1.6,
          }}
        >
          Find showtimes for your Letterboxd watchlist
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
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your Letterboxd username"
              disabled={isNavigating}
              style={{
                width: "100%",
                maxWidth: "320px",
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
              disabled={!username.trim() || isNavigating}
              style={{
                padding: "14px 48px",
                fontSize: "16px",
                fontWeight: "600",
                backgroundColor: username.trim() && !isNavigating
                  ? "#3b82f6"
                  : "#374151",
                color: username.trim() && !isNavigating ? "white" : "#6b7280",
                border: "none",
                borderRadius: "12px",
                cursor: username.trim() && !isNavigating
                  ? "pointer"
                  : "not-allowed",
                transition: "background-color 0.2s, transform 0.1s",
              }}
              onMouseOver={(e) => {
                if (username.trim() && !isNavigating) {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    "#2563eb";
                }
              }}
              onMouseOut={(e) => {
                if (username.trim() && !isNavigating) {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    "#3b82f6";
                }
              }}
              onMouseDown={(e) => {
                if (username.trim() && !isNavigating) {
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

        {/* Footer hint */}
        <p
          style={{
            marginTop: "48px",
            fontSize: "0.85rem",
            color: "#6b7280",
          }}
        >
          Powered by Cineville & Pathe showtimes
        </p>
      </div>
    </div>
  );
}

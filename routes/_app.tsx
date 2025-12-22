import { type PageProps } from "$fresh/server.ts";

export default function App({ Component }: PageProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cineboxd</title>
        <meta
          name="description"
          content="Find showtimes for movies on your Letterboxd watchlist in Dutch cinemas"
        />

        {/* Open Graph / Social Media */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Cineboxd" />
        <meta
          property="og:description"
          content="Find showtimes for movies on your Letterboxd watchlist in Dutch cinemas"
        />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:site_name" content="Cineboxd" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Cineboxd" />
        <meta
          name="twitter:description"
          content="Find showtimes for movies on your Letterboxd watchlist in Dutch cinemas"
        />
        <meta name="twitter:image" content="/og-image.png" />

        {/* Theme Color */}
        <meta name="theme-color" content="#0f1419" />

        <style>
          {`
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: #0f1419;
            color: #e1e8ed;
            font-family: system-ui, -apple-system, sans-serif;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-y;
          }

          /* Performance optimizations */
          img {
            content-visibility: auto;
          }

          /* Keyboard focus styles */
          button:focus-visible,
          input:focus-visible,
          a:focus-visible {
            outline: 2px solid #3b82f6;
            outline-offset: 2px;
          }

          /* Bokeh animation for home page */
          @keyframes float {
            0%, 100% {
              transform: translateY(0) scale(1);
              opacity: 0.3;
            }
            50% {
              transform: translateY(-30px) scale(1.1);
              opacity: 0.5;
            }
          }
          @keyframes drift {
            0%, 100% {
              transform: translateX(0) translateY(0);
            }
            25% {
              transform: translateX(20px) translateY(-15px);
            }
            50% {
              transform: translateX(-10px) translateY(-25px);
            }
            75% {
              transform: translateX(-20px) translateY(-10px);
            }
          }
          .bokeh-circle {
            position: absolute;
            border-radius: 50%;
            filter: blur(40px);
            opacity: 0.3;
            will-change: transform, opacity;
          }
          .bokeh-1 {
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, transparent 70%);
            top: 10%;
            left: 10%;
            animation: float 8s ease-in-out infinite;
          }
          .bokeh-2 {
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%);
            top: 60%;
            right: 15%;
            animation: float 10s ease-in-out infinite 1s;
          }
          .bokeh-3 {
            width: 250px;
            height: 250px;
            background: radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, transparent 70%);
            bottom: 20%;
            left: 20%;
            animation: drift 12s ease-in-out infinite;
          }
          .bokeh-4 {
            width: 180px;
            height: 180px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, transparent 70%);
            top: 30%;
            right: 25%;
            animation: float 9s ease-in-out infinite 2s;
          }
          .bokeh-5 {
            width: 150px;
            height: 150px;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%);
            bottom: 30%;
            right: 10%;
            animation: drift 11s ease-in-out infinite 1.5s;
          }
          .bokeh-6 {
            width: 220px;
            height: 220px;
            background: radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, transparent 70%);
            top: 5%;
            right: 5%;
            animation: float 13s ease-in-out infinite 0.5s;
          }
          .bokeh-7 {
            width: 160px;
            height: 160px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.45) 0%, transparent 70%);
            bottom: 10%;
            left: 5%;
            animation: drift 10s ease-in-out infinite 3s;
          }
          .bokeh-8 {
            width: 280px;
            height: 280px;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%);
            top: 50%;
            left: 40%;
            animation: float 14s ease-in-out infinite 2.5s;
          }

          /* Film reel spinner */
          @keyframes film-reel-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .film-reel-spin {
            animation: film-reel-spin 2s linear infinite;
          }

          /* Featured list button glow effect */
          @keyframes glow-pulse {
            0%, 100% {
              box-shadow:
                0 0 20px rgba(59, 130, 246, 0.4),
                0 0 40px rgba(139, 92, 246, 0.2),
                0 0 60px rgba(236, 72, 153, 0.1);
            }
            50% {
              box-shadow:
                0 0 25px rgba(59, 130, 246, 0.6),
                0 0 50px rgba(139, 92, 246, 0.4),
                0 0 75px rgba(236, 72, 153, 0.2);
            }
          }
          .featured-list-btn {
            animation: glow-pulse 3s ease-in-out infinite;
          }

          @media (max-width: 768px) {
            .header-controls {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 8px !important;
            }
            .header-row {
              flex-wrap: wrap !important;
              gap: 8px !important;
            }
            .movie-card-layout {
              flex-direction: column !important;
            }
            .movie-poster {
              width: 120px !important;
              height: 180px !important;
              margin: 0 auto !important;
            }
            .movie-content {
              min-height: auto !important;
            }
            .date-list {
              flex-wrap: nowrap !important;
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .date-list::-webkit-scrollbar {
              display: none;
            }
            .date-filters {
              flex-wrap: wrap !important;
            }
            .date-input {
              min-width: 120px !important;
              width: 120px !important;
            }
          }
        `}
        </style>
      </head>
      <body>
        <main>
          <Component />
        </main>
      </body>
    </html>
  );
}

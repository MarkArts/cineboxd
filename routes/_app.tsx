import { type PageProps } from "$fresh/server.ts";

export default function App({ Component }: PageProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cineboxd</title>
        <meta name="description" content="Find showtimes for movies on your Letterboxd watchlist" />
        <style>{`
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: #0f1419;
            color: #e1e8ed;
            font-family: system-ui, -apple-system, sans-serif;
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
        `}</style>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
}

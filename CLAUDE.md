# Cineboxd Project Documentation

## Overview

Cineboxd is a movie showtime finder that connects to Letterboxd watchlists.
Users enter their Letterboxd username to see cinema showtimes for movies on
their watchlist in Dutch theaters (Cineville + Pathé).

## Tech Stack

- Fresh 1.6 (Deno web framework)
- Preact (React-compatible UI)
- TypeScript
- Deno KV for caching
- Inline styles (no CSS framework)

## Development Commands

```bash
deno task start                       # Start development server (port 8000)
deno task build                       # Build for production
deno task preview                     # Preview production build
```

## Project Structure

```
/routes/
  _app.tsx                # Root layout (html, head, body)
  index.tsx               # Home page (renders MovieList island)
  /api/
    cineboxd.ts           # API endpoint for fetching showtimes
/islands/
  MovieList.tsx           # Main interactive component (filters, API calls)
  MovieCard.tsx           # Movie card with date selector
/static/                  # Static assets
main.ts                   # Server entry point
dev.ts                    # Development server
fresh.config.ts           # Fresh configuration
fresh.gen.ts              # Auto-generated manifest
deno.json                 # Deno configuration
```

## Key Components

**MovieList Island** - Main container with all filtering logic, state
management, and API fetching.

**MovieCard Island** - Displays film poster (200x300), title, director,
duration, date selector, and theater showtimes. Each card manages its own
selected date state.

## Features

- Fetches user's Letterboxd watchlist via API (`/api/cineboxd?username=X`)
- Combines showtimes from Cineville and Pathé cinemas
- Movie cards with large posters, film info, and showtimes
- Horizontal date selector per movie card
- Theater locations with time slots for selected date
- Filtering by cities, theaters, films, and date ranges
- URL state synchronization
- Click-outside to close filter dropdowns
- TMDB integration for poster/director enrichment
- Deno KV caching (24h showtimes, 30d metadata)

## API Endpoint

`GET /api/cineboxd?username=<letterboxd_username>`

Returns showtimes for films on the user's Letterboxd watchlist.

## Environment Variables

- `TMDB_API_KEY` - The Movie Database API key for metadata enrichment

## Common Issues

**Hydration Errors**: Occur when server/client render differently. Use
`IS_BROWSER` from `$fresh/runtime.ts` for client-only code.

**Preact Hooks**: Import from `preact/hooks`, not `react`. Use `onInput` instead
of `onChange` for input events.

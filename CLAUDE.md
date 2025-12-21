# Cineboxd Project Documentation

## Overview

Cineboxd is a movie showtime finder that connects to Letterboxd watchlists. Users enter their Letterboxd username to see cinema showtimes for movies on their watchlist in Dutch theaters.

## Tech Stack

- Next.js 15 with React 19
- TypeScript
- Deno runtime
- Inline styles (no CSS framework)

## Development Commands

```bash
deno run dev                          # Start development server (port 3000)
node screenshot.js                    # Take desktop/mobile screenshots of localhost:3000
node screenshot.js 3000               # Take screenshots on specific port
node screenshot.js https://url.com    # Take screenshots of external site
node screenshot.js --help             # Show screenshot help
```

## Project Structure

- `/src/app/page.tsx` - Main page component with all UI logic
- `/src/app/layout.tsx` - Root layout
- `/api/cineboxd` - API endpoint for fetching Letterboxd watchlist data

## Key Components

**MovieCard** - Displays film poster (160x240), title, director, duration, date selector, and theater showtimes. Each card manages its own selected date state.

## Features

- Fetches user's Letterboxd watchlist via API (`/api/cineboxd?username=X`)
- Movie cards with large posters, film info, and showtimes
- Horizontal date selector per movie card
- Theater locations with time slots for selected date
- Filtering by cities, theaters, films, and date ranges
- URL state synchronization
- Click-outside to close filter dropdowns

## Common Issues

**Hydration Errors**: Occur when server/client render differently. Avoid:
- `typeof window` checks in render
- Browser APIs (localStorage, Date.now()) during render
- Random values during render

Fix by moving client-only code to `useEffect` hooks.

**React Hooks Rules**: Never call hooks inside loops, conditions, or callbacks. Extract into separate components if needed.

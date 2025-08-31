# Cineboxd Project Documentation

## App Summary & Learnings

**Goal**: Cineboxd is a movie showtime finder that connects to Letterboxd watchlists. Users enter their Letterboxd username to see cinema showtimes for movies on their watchlist in Dutch theaters.

**Key Features**:
- Fetches user's Letterboxd watchlist via API (`/api/cineboxd?username=X`)
- Shows movie cards with posters, directors, duration
- Displays showtimes grouped by theater and date
- Filtering by cities, theaters, films, and date ranges
- Expandable movie cards showing detailed showtimes

**Tech Stack**:
- Next.js 15 with React 19
- Tailwind CSS v4 (new syntax)
- TypeScript
- Deno runtime (`deno run dev` to start)

**Key Learnings**:
1. **Tailwind v4 syntax** - Uses `@tailwindcss/postcss` instead of regular Tailwind, can't use `@apply` directives
2. **Component structure** - MovieCard component handles poster display and showtime expansion
3. **API integration** - TMDB API for missing posters, custom backend for Letterboxd data
4. **State management** - URL params sync, debounced username input, filter state

**How to run**: `deno run dev` (runs on port 3003 if 3000 is taken)

**Testing**: `node screenshot.js` - Takes desktop and mobile screenshots for visual verification

**Main Issues Encountered**:
- Tailwind v4 compilation issues when using `@apply` directives
- Image overflow and sizing problems
- Low contrast accessibility issues
- Component styling inconsistencies

**Development Commands**:
- `deno run dev` - Start development server
- `node screenshot.js` - Take screenshots for testing
- `deno task build` - Build for production (if available)
/// <reference lib="deno.unstable" />
import { Handlers } from "$fresh/server.ts";
import { fetchAndCacheShowtimes } from "../cineboxd.ts";

// Same watchlist paths as main.ts (duplicated for simplicity)
const WATCHLIST_PATHS = [
  "105424/watchlist",
  "filmjournl/list/sight-sound-2025",
  "idiah/list/sight-and-sound-2024",
  "jack/list/official-top-250-films-with-the-most-fans",
  "benvsthemovies/list/the-criterion-challenge-2026",
  "fcbarcelona/list/movies-everyone-should-watch-at-least-once",
  "Snautsie/watchlist",
] as const;

function verifyBasicAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(":");
    const expectedPassword = Deno.env.get("ADMIN_PASSWORD") || "admin";
    return username === "admin" && password === expectedPassword;
  } catch {
    return false;
  }
}

export const handler: Handlers = {
  async GET(req) {
    if (!verifyBasicAuth(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Basic realm="Cineboxd Cron"',
        },
      });
    }

    try {
      const url = new URL(req.url);
      const listPath = url.searchParams.get("listPath");

      // Single watchlist refresh
      if (listPath) {
        const startTime = Date.now();
        try {
          await fetchAndCacheShowtimes(listPath);
          const duration = Date.now() - startTime;
          return new Response(JSON.stringify({
            listPath,
            success: true,
            duration,
          }, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          return new Response(JSON.stringify({
            listPath,
            success: false,
            duration,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Refresh all watchlists sequentially
      const overallStart = Date.now();
      const results = [];

      for (const path of WATCHLIST_PATHS) {
        const startTime = Date.now();
        try {
          await fetchAndCacheShowtimes(path);
          results.push({
            listPath: path,
            success: true,
            duration: Date.now() - startTime,
          });
        } catch (error) {
          results.push({
            listPath: path,
            success: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const totalDuration = Date.now() - overallStart;
      const successCount = results.filter(r => r.success).length;
      const avgDuration = Math.round(
        results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      );

      return new Response(JSON.stringify({
        summary: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          totalDuration,
          avgDuration,
        },
        results,
      }, null, 2), {
        status: successCount === results.length ? 200 : 207,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

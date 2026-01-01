import { Handlers, PageProps } from "$fresh/server.ts";
import MovieList from "../islands/MovieList.tsx";

// Handler to prevent /api/* routes from rendering HTML
export const handler: Handlers = {
  GET(req, ctx) {
    const url = new URL(req.url);
    // If path starts with /api, return 404 JSON (API route not found)
    if (url.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "API endpoint not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    // Otherwise, render the page normally
    return ctx.render();
  },
};

export default function ListPage(props: PageProps) {
  // Combine path segments into a single list path
  // e.g., ["username", "watchlist"] -> "username/watchlist"
  // e.g., ["dave", "list", "official-top-250"] -> "dave/list/official-top-250"
  const pathSegments = props.params.path.split("/").filter(Boolean);
  const listPath = pathSegments.join("/");

  return <MovieList listPath={listPath} />;
}

import { PageProps, Handlers } from "$fresh/server.ts";
import MovieList from "../islands/MovieList.tsx";

interface Show {
  id: string;
  startDate: string;
  endDate: string;
  ticketingUrl: string;
  film: {
    title: string;
    slug: string;
    poster?: { url: string };
    duration: number;
    directors: string[];
  };
  theater: {
    name: string;
    address?: { city: string };
  };
  chain?: "cineville" | "pathe";
}

interface PageData {
  listPath: string;
  initialShowtimes: Show[];
  error?: string;
}

export const handler: Handlers<PageData> = {
  async GET(req, ctx) {
    const pathSegments = ctx.params.path.split("/").filter(Boolean);
    const listPath = pathSegments.join("/");

    try {
      // Fetch data server-side (leverages KV cache)
      const url = new URL(req.url);
      const apiUrl = `${url.origin}/api/cineboxd?listPath=${encodeURIComponent(listPath)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok) {
        return ctx.render({
          listPath,
          initialShowtimes: [],
          error: data?.error || "Failed to load list",
        });
      }

      return ctx.render({
        listPath,
        initialShowtimes: data?.data?.showtimes?.data || [],
      });
    } catch (error) {
      return ctx.render({
        listPath,
        initialShowtimes: [],
        error: error instanceof Error ? error.message : "An error occurred",
      });
    }
  }
};

export default function ListPage(props: PageProps<PageData>) {
  return (
    <MovieList
      listPath={props.data.listPath}
      initialShowtimes={props.data.initialShowtimes}
      initialError={props.data.error}
    />
  );
}

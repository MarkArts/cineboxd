import { PageProps } from "$fresh/server.ts";
import MovieList from "../islands/MovieList.tsx";

export default function ListPage(props: PageProps) {
  // Combine path segments into a single list path
  // e.g., ["username", "watchlist"] -> "username/watchlist"
  // e.g., ["dave", "list", "official-top-250"] -> "dave/list/official-top-250"
  const pathSegments = props.params.path.split("/").filter(Boolean);
  const listPath = pathSegments.join("/");

  return <MovieList listPath={listPath} />;
}

import { PageProps } from "$fresh/server.ts";
import MovieList from "../../islands/MovieList.tsx";

export default function UserPage(props: PageProps) {
  const username = props.params.username;
  return <MovieList initialUsername={decodeURIComponent(username)} />;
}

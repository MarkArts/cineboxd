import { Handlers, PageProps } from "$fresh/server.ts";

const kv = await Deno.openKv();

export const handler: Handlers = {
  async GET(_req, ctx) {
    const { code } = ctx.params;

    const entry = await kv.get<string>(["shortlink", code]);

    if (!entry.value) {
      // Short link not found - show 404
      return ctx.render({ notFound: true });
    }

    // Redirect to the full URL
    return new Response(null, {
      status: 302,
      headers: { Location: entry.value },
    });
  },
};

export default function ShortLinkPage({ data }: PageProps<{ notFound?: boolean }>) {
  if (data?.notFound) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f1419",
          color: "#e1e8ed",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "3rem", marginBottom: "16px" }}>404</h1>
        <p style={{ color: "#71767b", marginBottom: "24px" }}>
          This short link doesn't exist or has expired.
        </p>
        <a
          href="/"
          style={{
            color: "#3b82f6",
            textDecoration: "none",
          }}
        >
          Go to Cineboxd →
        </a>
      </div>
    );
  }

  // This shouldn't render as we redirect, but just in case
  return <div>Redirecting...</div>;
}

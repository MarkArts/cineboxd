import { Handlers } from "$fresh/server.ts";

const kv = await Deno.openKv();

// Generate a random short code
function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const handler: Handlers = {
  // Create a new short link
  async POST(req) {
    try {
      const { url } = await req.json();

      if (!url || typeof url !== "string") {
        return new Response(JSON.stringify({ error: "URL is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate it's a relative path (for security)
      if (!url.startsWith("/")) {
        return new Response(
          JSON.stringify({ error: "Only relative URLs are allowed" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Check if we already have a short code for this URL
      const existingEntry = await kv.get<string>(["shortlink_url", url]);
      if (existingEntry.value) {
        return new Response(
          JSON.stringify({ code: existingEntry.value }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Generate unique short code
      let code = generateShortCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await kv.get(["shortlink", code]);
        if (!existing.value) break;
        code = generateShortCode();
        attempts++;
      }

      // Store both mappings (code -> url and url -> code)
      await kv.atomic()
        .set(["shortlink", code], url, { expireIn: 365 * 24 * 60 * 60 * 1000 }) // 1 year
        .set(["shortlink_url", url], code, {
          expireIn: 365 * 24 * 60 * 60 * 1000,
        })
        .commit();

      return new Response(JSON.stringify({ code }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Shortlink creation error:", error);
      return new Response(JSON.stringify({ error: "Failed to create shortlink" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Resolve a short code
  async GET(req) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response(JSON.stringify({ error: "Code is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const entry = await kv.get<string>(["shortlink", code]);

    if (!entry.value) {
      return new Response(JSON.stringify({ error: "Short link not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: entry.value }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};

import { defineConfig } from "$fresh/server.ts";

export default defineConfig({
  server: {
    // Bind all interfaces so the server is reachable from outside Docker
    hostname: "0.0.0.0",
    port: 8000,
  },
});

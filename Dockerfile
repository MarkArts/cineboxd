# syntax=docker/dockerfile:1

# ---- Build stage: build the Fresh production bundle (_fresh/) ----
# (Debian image: the `bin` image has no shell, so RUN doesn't work there)
FROM denoland/deno:debian-2.2.15 AS build

WORKDIR /app

# Copy config first so dependency download is cached in its own layer
COPY deno.json ./
RUN deno cache --no-check \
    https://deno.land/x/fresh@1.6.8/dev.ts \
    https://deno.land/x/fresh@1.6.8/server.ts

# Copy the rest of the source and build
COPY . .
RUN deno run -A dev.ts build

# ---- Runtime stage: serve the production build ----
FROM denoland/deno:debian-2.2.15

WORKDIR /app

# DENO_DIR holds the dependency cache; Deno KV data is also stored there,
# so keep it on a volume if you want the showtime cache to persist.
ENV DENO_DIR=/deno-dir

# Reuse the dependency cache from the build stage so the server
# starts instantly without re-downloading modules
COPY --from=build /deno-dir /deno-dir

# Copy only the files needed to serve the production build
COPY --from=build /app/deno.json /app/deno.lock ./
COPY --from=build /app/main.ts /app/fresh.config.ts /app/fresh.gen.ts ./
COPY --from=build /app/_fresh ./_fresh
COPY --from=build /app/routes ./routes
COPY --from=build /app/islands ./islands
COPY --from=build /app/utils ./utils
COPY --from=build /app/static ./static

EXPOSE 8000

# --unstable-otel activates Deno's built-in OpenTelemetry (spans for
# Deno.serve and outbound fetch); it exports to OTEL_EXPORTER_OTLP_ENDPOINT
# when set, and is a no-op without it.
CMD ["deno", "run", "-A", "--unstable-otel", "main.ts"]

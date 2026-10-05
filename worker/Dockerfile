# Cache prewarm worker: runs worker/main.ts in a loop. No HTTP port
# (it is a worker service, port null on the platform).

FROM denoland/deno:debian-2.2.15

WORKDIR /app

# Copy the whole source and warm the dependency cache (npm:ioredis, fresh,
# std) into the image so startup needs no downloads
COPY . .
RUN deno cache worker/main.ts

CMD ["deno", "run", "-A", "--unstable-otel", "worker/main.ts"]

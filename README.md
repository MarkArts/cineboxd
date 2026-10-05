# Cineboxd

This project provides showtime data for cineboxd lists which you can filter 

## live
https://cineboxd.gooncave.nl/

## setup

```bash
deno run dev
```

## Docker

Build and run the web server locally in a container:

```bash
docker build -t cineboxd .
docker run -d --name cineboxd -p 8000:8000 --env-file .env cineboxd
```

Then open http://localhost:8000.

- `--env-file .env` passes in `TMDB_API_KEY` (optional but recommended for poster/director enrichment).
- Add `-v cineboxd-kv:/deno-dir/location_data` to persist the Deno KV showtimes/metadata cache across container restarts.

To stop and remove the container:

```bash
docker rm -f cineboxd
```

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

## AtHome deployment

cineboxd runs on AtHome as a Dockerfile application with three services in the `main` track:

| Service  | Source                                                     | Reachability |
| -------- | ---------------------------------------------------------- | ------------ |
| `api`    | `Dockerfile` (the web server)                              | public       |
| `worker` | `worker/Dockerfile` (refreshes one list every ~3.4h)       | internal     |
| `valkey` | Helm chart `oci://registry-1.docker.io/bitnamicharts/valkey` | internal     |

Valkey runs with replication and sentinel (3 nodes). Every node keeps its data on its own persistent volume
(`replica.persistence`, 1Gi each on the encrypted tenant storage), with append-only persistence and a memory cap so the
cache evicts instead of growing past its container. The chart values on AtHome:

```yaml
architecture: replication
auth:
  enabled: false
networkPolicy:
  enabled: false
replica:
  replicaCount: 3
  persistence:
    enabled: true
    size: 1Gi
sentinel:
  enabled: true
commonConfiguration: |-
  appendonly yes
  save ""
  maxmemory 384mb
  maxmemory-policy allkeys-lru
```

`api` and `worker` find the current master through the sentinels, so they survive failovers:

| Variable             | Value                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `VALKEY_SENTINELS`   | `valkey-node-{0,1,2}.valkey-headless.<track namespace>.svc.cluster.local:26379`, comma-separated |
| `VALKEY_MASTER_NAME` | `myprimary`                                                                              |
| `TMDB_API_KEY`       | TMDB key (poster and director enrichment)                                                |

Locally, set `VALKEY_URL=redis://localhost:6379` to use a single Valkey, or leave both unset to cache in Deno KV.

## CI/CD

A [GitHub Actions workflow](.github/workflows/docker.yml) builds the Docker image on every PR (build-only) and on every push to `main` builds, pushes, and smoke-tests the image to GitHub Container Registry:

- `ghcr.io/markarts/cineboxd:latest`
- `ghcr.io/markarts/cineboxd:sha-<commit>`

Pull the published image with:

```bash
docker pull ghcr.io/markarts/cineboxd:latest
docker run -d --name cineboxd -p 8000:8000 --env-file .env ghcr.io/markarts/cineboxd:latest
```

# Valkey (Redis-compatible) cache server for the athome platform.
# Persistent data lives in /data (mounted volume); cache-eviction style
# memory cap keeps it from outgrowing its container.

FROM valkey/valkey:8-alpine

# No password: reachability is set to "internal" on the platform, so the
# service is only reachable inside the cluster.
CMD ["valkey-server", \
     "--port", "6379", \
     "--dir", "/data", \
     "--appendonly", "yes", \
     "--appenddirname", "appendonlydir", \
     "--save", "60 1", \
     "--maxmemory", "384mb", \
     "--maxmemory-policy", "allkeys-lru", \
     "--protected-mode", "no"]

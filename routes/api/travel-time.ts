/// <reference lib="deno.unstable" />
import { Handlers } from "$fresh/server.ts";
import { geocodeLocation } from "../../utils/geocoding.ts";

// NS API Configuration
const NS_API_KEY = Deno.env.get("NS_API_KEY") || "";
const NS_API_BASE =
  "https://gateway.apiportal.ns.nl/reisinformatie-api/api/v3";
const TRAVEL_TIME_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface TravelTimeRequest {
  fromLocation: string; // User's location text (e.g., "Amsterdam Centraal")
  fromLat?: string; // Pre-geocoded coordinates (optional)
  fromLng?: string;
  toLocation: string; // Theater address (e.g., "Pathé Arena, Amsterdam, Netherlands")
  toLat?: string; // Pre-geocoded coordinates (optional)
  toLng?: string;
}

interface TravelTimeResponse {
  duration: number; // Travel time in minutes (rounded up)
  fromLocation: string;
  toLocation: string;
  cached: boolean;
}

interface NSTrip {
  legs: Array<{
    origin: { plannedDateTime: string };
    destination: { plannedDateTime: string };
  }>;
}

interface NSTripsResponse {
  trips?: NSTrip[];
}

// Deno KV for caching
let kv: Deno.Kv | null = null;

async function getKv(): Promise<Deno.Kv | null> {
  if (kv) return kv;
  try {
    kv = await Deno.openKv();
    return kv;
  } catch (e) {
    console.warn("Deno KV not available:", e);
    return null;
  }
}

// Fetch travel time from NS API using coordinates (door-to-door)
async function fetchNSTravelTimeWithCoords(
  fromLat: string,
  fromLng: string,
  toLat: string,
  toLng: string,
): Promise<number | null> {
  if (!NS_API_KEY) {
    console.warn("NS_API_KEY not configured");
    return null;
  }

  try {
    const url = `${NS_API_BASE}/trips?` +
      `originLat=${fromLat}&` +
      `originLng=${fromLng}&` +
      `originWalk=true&` +
      `destinationLat=${toLat}&` +
      `destinationLng=${toLng}&` +
      `destinationWalk=true`;

    const response = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": NS_API_KEY,
      },
    });

    if (!response.ok) {
      console.error(`NS API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NSTripsResponse = await response.json();

    // Get the first trip (usually the fastest/next available)
    const firstTrip = data.trips?.[0];
    if (!firstTrip || !firstTrip.legs || firstTrip.legs.length === 0) {
      console.warn("No trips found in NS API response");
      return null;
    }

    // Calculate total journey duration from first leg departure to last leg arrival
    const firstLeg = firstTrip.legs[0];
    const lastLeg = firstTrip.legs[firstTrip.legs.length - 1];

    const departure = new Date(firstLeg.origin.plannedDateTime);
    const arrival = new Date(lastLeg.destination.plannedDateTime);

    // Calculate duration in minutes, always round up
    const durationMs = arrival.getTime() - departure.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));

    return durationMinutes;
  } catch (e) {
    console.error("NS API fetch failed:", e);
    return null;
  }
}

// Get cached geocoding result
async function getCachedGeocode(
  query: string,
): Promise<{ lat: string; lon: string } | null> {
  const store = await getKv();
  if (!store) return null;

  const key = ["geocode", query];
  const result = await store.get<{
    lat: string;
    lon: string;
    timestamp: number;
  }>(key);

  if (!result.value) return null;

  // Check if cache expired
  if (Date.now() - result.value.timestamp >= GEOCODE_CACHE_TTL_MS) {
    return null;
  }

  return { lat: result.value.lat, lon: result.value.lon };
}

// Set cached geocoding result
async function setCachedGeocode(
  query: string,
  lat: string,
  lon: string,
): Promise<void> {
  const store = await getKv();
  if (!store) return;

  const key = ["geocode", query];
  await store.set(key, { lat, lon, timestamp: Date.now() });
}

// Get cached travel time
async function getCachedTravelTime(
  fromLoc: string,
  toLoc: string,
): Promise<number | null> {
  const store = await getKv();
  if (!store) return null;

  const key = ["travel_time_v2", fromLoc, toLoc];
  const result = await store.get<{ duration: number; timestamp: number }>(key);

  if (!result.value) return null;

  // Check if cache expired
  if (Date.now() - result.value.timestamp >= TRAVEL_TIME_CACHE_TTL_MS) {
    return null;
  }

  return result.value.duration;
}

// Set cached travel time
async function setCachedTravelTime(
  fromLoc: string,
  toLoc: string,
  duration: number,
): Promise<void> {
  const store = await getKv();
  if (!store) return;

  const key = ["travel_time_v2", fromLoc, toLoc];
  await store.set(key, { duration, timestamp: Date.now() });
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const body: TravelTimeRequest = await req.json();

      if (!body.fromLocation || !body.toLocation) {
        return new Response(
          JSON.stringify({
            error: "fromLocation and toLocation are required",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Check cache first
      let duration = await getCachedTravelTime(
        body.fromLocation,
        body.toLocation,
      );
      let cached = true;

      if (duration === null) {
        // Get origin coordinates
        let fromLat = body.fromLat;
        let fromLng = body.fromLng;

        if (!fromLat || !fromLng) {
          // Try cache first
          const cachedFrom = await getCachedGeocode(body.fromLocation);
          if (cachedFrom) {
            fromLat = cachedFrom.lat;
            fromLng = cachedFrom.lon;
          } else {
            // Geocode the origin
            const fromResult = await geocodeLocation(body.fromLocation);
            if (!fromResult) {
              return new Response(
                JSON.stringify({
                  error: "Could not geocode origin location",
                  location: body.fromLocation,
                }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }
            fromLat = fromResult.lat;
            fromLng = fromResult.lon;
            await setCachedGeocode(body.fromLocation, fromLat, fromLng);
          }
        }

        // Get destination coordinates
        let toLat = body.toLat;
        let toLng = body.toLng;

        if (!toLat || !toLng) {
          // Try cache first
          const cachedTo = await getCachedGeocode(body.toLocation);
          if (cachedTo) {
            toLat = cachedTo.lat;
            toLng = cachedTo.lon;
          } else {
            // Geocode the destination
            const toResult = await geocodeLocation(body.toLocation);
            if (!toResult) {
              return new Response(
                JSON.stringify({
                  error: "Could not geocode destination location",
                  location: body.toLocation,
                }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }
            toLat = toResult.lat;
            toLng = toResult.lon;
            await setCachedGeocode(body.toLocation, toLat, toLng);
          }
        }

        // Fetch travel time from NS API with coordinates
        duration = await fetchNSTravelTimeWithCoords(fromLat, fromLng, toLat, toLng);
        cached = false;

        if (duration === null) {
          return new Response(
            JSON.stringify({
              error: "Could not fetch travel time from NS API",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Cache the result
        await setCachedTravelTime(body.fromLocation, body.toLocation, duration);
      }

      const response: TravelTimeResponse = {
        duration,
        fromLocation: body.fromLocation,
        toLocation: body.toLocation,
        cached,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Travel time API error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  },
};

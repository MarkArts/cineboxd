/// <reference lib="deno.unstable" />
import { Handlers } from "$fresh/server.ts";
import { getStationMapping } from "../../data/station-mappings.ts";

// NS API Configuration
const NS_API_KEY = Deno.env.get("NS_API_KEY") || "";
const NS_API_BASE =
  "https://gateway.apiportal.ns.nl/reisinformatie-api/api/v3";
const TRAVEL_TIME_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TravelTimeRequest {
  fromLocation: string; // User's location (city or station name)
  toTheater: string; // Theater name (e.g., "Pathé Arena")
  toCity?: string; // Fallback city if theater not found in mappings
}

interface TravelTimeResponse {
  duration: number; // Travel time in minutes (rounded up)
  fromStation: string;
  toStation: string;
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

// Fetch travel time from NS API
async function fetchNSTravelTime(
  fromCode: string,
  toCode: string,
): Promise<number | null> {
  if (!NS_API_KEY) {
    console.warn("NS_API_KEY not configured");
    return null;
  }

  try {
    const url = `${NS_API_BASE}/trips?fromStation=${fromCode}&toStation=${toCode}`;
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

// Get cached travel time
async function getCachedTravelTime(
  fromCode: string,
  toCode: string,
): Promise<number | null> {
  const store = await getKv();
  if (!store) return null;

  const key = ["travel_time", fromCode, toCode];
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
  fromCode: string,
  toCode: string,
  duration: number,
): Promise<void> {
  const store = await getKv();
  if (!store) return;

  const key = ["travel_time", fromCode, toCode];
  await store.set(key, { duration, timestamp: Date.now() });
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const body: TravelTimeRequest = await req.json();

      if (!body.fromLocation || !body.toTheater) {
        return new Response(
          JSON.stringify({
            error: "fromLocation and toTheater are required",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Resolve locations to station codes
      const fromStation = getStationMapping(body.fromLocation);
      let toStation = getStationMapping(body.toTheater);

      // If theater not found, try fallback to city
      if (!toStation && body.toCity) {
        toStation = getStationMapping(body.toCity);
      }

      if (!fromStation || !toStation) {
        return new Response(
          JSON.stringify({
            error: "Could not resolve location to station",
            fromLocation: body.fromLocation,
            toTheater: body.toTheater,
            toCity: body.toCity,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // Don't calculate if same station
      if (fromStation.stationCode === toStation.stationCode) {
        const response: TravelTimeResponse = {
          duration: 0,
          fromStation: fromStation.stationName,
          toStation: toStation.stationName,
          cached: true,
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check cache first
      let duration = await getCachedTravelTime(
        fromStation.stationCode,
        toStation.stationCode,
      );
      let cached = true;

      // Fetch from API if not cached
      if (duration === null) {
        duration = await fetchNSTravelTime(
          fromStation.stationCode,
          toStation.stationCode,
        );
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
        await setCachedTravelTime(
          fromStation.stationCode,
          toStation.stationCode,
          duration,
        );
      }

      const response: TravelTimeResponse = {
        duration,
        fromStation: fromStation.stationName,
        toStation: toStation.stationName,
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

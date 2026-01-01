// Google Places API geocoding utilities
// Used for converting addresses/locations to coordinates for travel time calculations

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const GOOGLE_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode";

export interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
  place_id?: string;
  address?: {
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    postcode?: string;
  };
}

/**
 * Geocode a text query to coordinates using Google Geocoding API
 * @param query - Location text (e.g., "Amsterdam Centraal", "Kalverstraat 92, Amsterdam")
 * @returns Geocoding result with coordinates or null if not found
 */
export async function geocodeLocation(
  query: string,
): Promise<GeocodingResult | null> {
  if (!query.trim() || !GOOGLE_MAPS_API_KEY) return null;

  const url = `${GOOGLE_GEOCODE_BASE}/json?` +
    `address=${encodeURIComponent(query)}&` +
    `components=country:NL&` + // Limit to Netherlands
    `key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Geocoding] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.error(`[Geocoding] No results for "${query}": ${data.status}`);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;

    return {
      lat: location.lat.toString(),
      lon: location.lng.toString(),
      display_name: result.formatted_address,
      place_id: result.place_id,
    };
  } catch (error) {
    console.error(`[Geocoding] Failed for "${query}":`, error);
    return null;
  }
}

/**
 * Search locations for autocomplete suggestions using Google Places Autocomplete
 * @param query - Partial location text (min 3 characters)
 * @returns Array of geocoding results (max 5)
 */
export async function searchLocations(
  query: string,
): Promise<GeocodingResult[]> {
  if (query.length < 3 || !GOOGLE_MAPS_API_KEY) return [];

  const url = `${GOOGLE_PLACES_BASE}/autocomplete/json?` +
    `input=${encodeURIComponent(query)}&` +
    `components=country:nl&` + // Limit to Netherlands
    `key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Autocomplete] API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.predictions) {
      return [];
    }

    // Convert predictions to GeocodingResult format
    // Note: Autocomplete doesn't return coordinates, need to geocode selected item
    return data.predictions.slice(0, 5).map((prediction: any) => ({
      lat: "",
      lon: "",
      display_name: prediction.description,
      place_id: prediction.place_id,
    }));
  } catch (error) {
    console.error(`[Autocomplete] Search failed for "${query}":`, error);
    return [];
  }
}

/**
 * Get coordinates for a place_id from Google Places Details API
 * @param placeId - Google Place ID from autocomplete
 * @returns Coordinates or null if not found
 */
export async function getPlaceDetails(
  placeId: string,
): Promise<{ lat: string; lon: string } | null> {
  if (!placeId || !GOOGLE_MAPS_API_KEY) return null;

  const url = `${GOOGLE_PLACES_BASE}/details/json?` +
    `place_id=${encodeURIComponent(placeId)}&` +
    `fields=geometry&` +
    `key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Place Details] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.result?.geometry?.location) {
      console.error(`[Place Details] No location for place_id: ${data.status}`);
      return null;
    }

    const location = data.result.geometry.location;
    return {
      lat: location.lat.toString(),
      lon: location.lng.toString(),
    };
  } catch (error) {
    console.error(`[Place Details] Failed for "${placeId}":`, error);
    return null;
  }
}

/**
 * Format display name for UI
 * @param result - Geocoding result
 * @returns Formatted string for display
 */
export function formatLocationName(result: GeocodingResult): string {
  return result.display_name;
}

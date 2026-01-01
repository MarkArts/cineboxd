// OpenStreetMap Nominatim geocoding utilities
// Used for converting addresses/locations to coordinates for travel time calculations

export interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    postcode?: string;
  };
}

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Cineboxd/1.0 (movie showtime finder)";

// Rate limiting: Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
}

/**
 * Geocode a text query to coordinates
 * @param query - Location text (e.g., "Amsterdam Centraal", "Kalverstraat 92, Amsterdam")
 * @returns Geocoding result with coordinates or null if not found
 */
export async function geocodeLocation(
  query: string,
): Promise<GeocodingResult | null> {
  if (!query.trim()) return null;

  await respectRateLimit();

  const url = `${NOMINATIM_BASE_URL}/search?` +
    `q=${encodeURIComponent(query)}&` +
    `format=json&` +
    `addressdetails=1&` +
    `limit=1&` +
    `countrycodes=nl`; // Limit to Netherlands

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      console.error(`[Geocoding] API error: ${response.status}`);
      return null;
    }

    const results: GeocodingResult[] = await response.json();
    return results[0] || null;
  } catch (error) {
    console.error(`[Geocoding] Failed for "${query}":`, error);
    return null;
  }
}

/**
 * Search locations for autocomplete suggestions
 * @param query - Partial location text (min 3 characters)
 * @returns Array of geocoding results (max 5)
 */
export async function searchLocations(
  query: string,
): Promise<GeocodingResult[]> {
  if (query.length < 3) return [];

  await respectRateLimit();

  const url = `${NOMINATIM_BASE_URL}/search?` +
    `q=${encodeURIComponent(query)}&` +
    `format=json&` +
    `addressdetails=1&` +
    `limit=5&` +
    `countrycodes=nl`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      console.error(`[Geocoding] API error: ${response.status}`);
      return [];
    }

    const results: GeocodingResult[] = await response.json();
    return results;
  } catch (error) {
    console.error(`[Geocoding] Search failed for "${query}":`, error);
    return [];
  }
}

/**
 * Format display name for UI
 * @param result - Geocoding result
 * @returns Formatted string for display
 */
export function formatLocationName(result: GeocodingResult): string {
  const { address } = result;
  if (!address) return result.display_name;

  const parts: string[] = [];

  if (address.road) parts.push(address.road);
  const city = address.city || address.town || address.village;
  if (city) parts.push(city);

  return parts.length > 0 ? parts.join(", ") : result.display_name;
}

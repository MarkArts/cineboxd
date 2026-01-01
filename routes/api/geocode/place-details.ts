import { Handlers } from "$fresh/server.ts";
import { getPlaceDetails } from "../../../utils/geocoding.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const placeId = url.searchParams.get("place_id");

      if (!placeId) {
        return new Response(
          JSON.stringify({ error: "place_id parameter is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const coords = await getPlaceDetails(placeId);

      if (!coords) {
        return new Response(
          JSON.stringify({ error: "Could not fetch place details" }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify(coords), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Place details API error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  },
};

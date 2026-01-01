import { useEffect, useRef, useState } from "preact/hooks";
import type { GeocodingResult } from "../utils/geocoding.ts";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: GeocodingResult) => void;
  placeholder?: string;
}

// Get place details from Google Places API
async function fetchPlaceDetails(placeId: string): Promise<{ lat: string; lon: string } | null> {
  try {
    const response = await fetch(`/api/geocode/place-details?place_id=${encodeURIComponent(placeId)}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("[Place Details] Failed:", error);
  }
  return null;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter location...",
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = (query: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);

      try {
        const url = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}&` +
          `format=json&` +
          `addressdetails=1&` +
          `limit=5&` +
          `countrycodes=nl`;

        const response = await fetch(url, {
          headers: { "User-Agent": "Cineboxd/1.0" },
        });

        if (response.ok) {
          const results: GeocodingResult[] = await response.json();
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      } catch (error) {
        console.error("[Autocomplete] Search failed:", error);
        setSuggestions([]);
      }

      setIsLoading(false);
    }, 500) as unknown as number;
  };

  // Handle input change
  const handleInput = (e: Event) => {
    const newValue = (e.target as HTMLInputElement).value;
    onChange(newValue);
    setSelectedIndex(-1);
    debouncedSearch(newValue);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: GeocodingResult) => {
    onChange(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]);

    // If place_id is available, fetch coordinates
    if (suggestion.place_id) {
      setIsLoading(true);
      const coords = await fetchPlaceDetails(suggestion.place_id);
      setIsLoading(false);

      if (coords) {
        onSelect({
          ...suggestion,
          lat: coords.lat,
          lon: coords.lon,
        });
      } else {
        console.error("Failed to get coordinates for selected location");
        onSelect(suggestion); // Pass without coords, will geocode later
      }
    } else {
      onSelect(suggestion);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestions]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          backgroundColor: "#0f1419",
          border: "1px solid #2f3336",
          borderRadius: "6px",
          color: "#e1e8ed",
          fontSize: "14px",
        }}
      />

      {isLoading && (
        <div
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#9ca3af",
            fontSize: "12px",
          }}
        >
          Loading...
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "#1e293b",
            border: "1px solid #2f3336",
            borderRadius: "6px",
            maxHeight: "300px",
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
          }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.lat}-${suggestion.lon}`}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 12px",
                textAlign: "left",
                backgroundColor: index === selectedIndex
                  ? "#1d4ed8"
                  : "transparent",
                border: "none",
                borderBottom: index < suggestions.length - 1
                  ? "1px solid #2f3336"
                  : "none",
                color: index === selectedIndex ? "white" : "#e1e8ed",
                cursor: "pointer",
                fontSize: "14px",
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div style={{ fontWeight: "500" }}>
                {suggestion.address?.road ||
                  suggestion.address?.city ||
                  suggestion.address?.town ||
                  "Unknown"}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: index === selectedIndex
                    ? "rgba(255,255,255,0.8)"
                    : "#9ca3af",
                  marginTop: "2px",
                }}
              >
                {suggestion.display_name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

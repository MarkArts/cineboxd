// Station mappings for Dutch theaters and cities with NS train stations
// Used to calculate travel times from user location to specific theater locations

export interface StationMapping {
  city: string;
  stationCode: string;
  stationName: string;
}

// Mapping from theater names to their nearest NS station
// This provides accurate travel times to specific theater locations
export const THEATER_STATION_MAPPINGS: Record<string, StationMapping> = {
  // Amsterdam theaters - all mapped to Amsterdam Centraal for now
  // TODO: Update with specific nearest stations for more accurate times
  "Pathé Arena": {
    city: "Amsterdam",
    stationCode: "ASD",
    stationName: "Amsterdam Centraal",
  },
  "Pathé City": {
    city: "Amsterdam",
    stationCode: "ASD",
    stationName: "Amsterdam Centraal",
  },
  "Pathé De Munt": {
    city: "Amsterdam",
    stationCode: "ASD",
    stationName: "Amsterdam Centraal",
  },
  "Pathé Noord": {
    city: "Amsterdam",
    stationCode: "ASD",
    stationName: "Amsterdam Centraal",
  },
  "Pathé Tuschinski": {
    city: "Amsterdam",
    stationCode: "ASD",
    stationName: "Amsterdam Centraal",
  },
  // Den Haag theaters - mapped to Den Haag Centraal
  // TODO: Ypenburg could use a specific station if available
  "Pathé Buitenhof": {
    city: "Den Haag",
    stationCode: "GVC",
    stationName: "Den Haag Centraal",
  },
  "Pathé Scheveningen": {
    city: "Den Haag",
    stationCode: "GVC",
    stationName: "Den Haag Centraal",
  },
  "Pathé Spuimarkt": {
    city: "Den Haag",
    stationCode: "GVC",
    stationName: "Den Haag Centraal",
  },
  "Pathé Ypenburg": {
    city: "Den Haag",
    stationCode: "GVC",
    stationName: "Den Haag Centraal",
  },
  // Rotterdam theaters
  "Pathé De Kuip": {
    city: "Rotterdam",
    stationCode: "RTD",
    stationName: "Rotterdam Centraal",
  },
  "Pathé Schouwburgplein": {
    city: "Rotterdam",
    stationCode: "RTD",
    stationName: "Rotterdam Centraal",
  },
  // Schiedam
  "Pathé Schiedam": {
    city: "Schiedam",
    stationCode: "SDM",
    stationName: "Schiedam Centrum",
  },
  // Utrecht theaters - mapped to Utrecht Centraal
  // TODO: Leidsche Rijn could use a specific station if available
  "Pathé Rembrandt": {
    city: "Utrecht",
    stationCode: "UT",
    stationName: "Utrecht Centraal",
  },
  "Pathé Leidsche Rijn": {
    city: "Utrecht",
    stationCode: "UT",
    stationName: "Utrecht Centraal",
  },
  // Tilburg theaters
  "Pathé Tilburg Centrum": {
    city: "Tilburg",
    stationCode: "TB",
    stationName: "Tilburg",
  },
  "Pathé Tilburg Stappegoor": {
    city: "Tilburg",
    stationCode: "TB",
    stationName: "Tilburg",
  },
  // Single-location cities
  "Pathé Amersfoort": {
    city: "Amersfoort",
    stationCode: "AMF",
    stationName: "Amersfoort Centraal",
  },
  "Pathé Arnhem": {
    city: "Arnhem",
    stationCode: "AH",
    stationName: "Arnhem Centraal",
  },
  "Pathé Breda": {
    city: "Breda",
    stationCode: "BD",
    stationName: "Breda",
  },
  "Pathé Delft": {
    city: "Delft",
    stationCode: "DT",
    stationName: "Delft",
  },
  "Pathé Ede": {
    city: "Ede",
    stationCode: "ED",
    stationName: "Ede-Wageningen",
  },
  "Pathé Eindhoven": {
    city: "Eindhoven",
    stationCode: "EHV",
    stationName: "Eindhoven Centraal",
  },
  "Pathé Groningen": {
    city: "Groningen",
    stationCode: "GN",
    stationName: "Groningen",
  },
  "Pathé Haarlem": {
    city: "Haarlem",
    stationCode: "HLM",
    stationName: "Haarlem",
  },
  "Pathé Helmond": {
    city: "Helmond",
    stationCode: "HM",
    stationName: "Helmond",
  },
  "Pathé Leeuwarden": {
    city: "Leeuwarden",
    stationCode: "LW",
    stationName: "Leeuwarden",
  },
  "Pathé Maastricht": {
    city: "Maastricht",
    stationCode: "MT",
    stationName: "Maastricht",
  },
  "Pathé Nijmegen": {
    city: "Nijmegen",
    stationCode: "NM",
    stationName: "Nijmegen",
  },
  "Pathé Vlissingen": {
    city: "Vlissingen",
    stationCode: "VS",
    stationName: "Vlissingen",
  },
  "Pathé Zaandam": {
    city: "Zaandam",
    stationCode: "ZD",
    stationName: "Zaandam",
  },
  "Pathé Zwolle": {
    city: "Zwolle",
    stationCode: "ZL",
    stationName: "Zwolle",
  },
};

// Fallback: City-level station mappings for user location input or Cineville theaters
export const CITY_STATION_MAPPINGS: Record<string, StationMapping> = {
  "Amsterdam": {
    city: "Amsterdam",
    stationCode: "ASD",
    stationName: "Amsterdam Centraal",
  },
  "Den Haag": {
    city: "Den Haag",
    stationCode: "GVC",
    stationName: "Den Haag Centraal",
  },
  "Rotterdam": {
    city: "Rotterdam",
    stationCode: "RTD",
    stationName: "Rotterdam Centraal",
  },
  "Schiedam": {
    city: "Schiedam",
    stationCode: "SDM",
    stationName: "Schiedam Centrum",
  },
  "Utrecht": {
    city: "Utrecht",
    stationCode: "UT",
    stationName: "Utrecht Centraal",
  },
  "Tilburg": {
    city: "Tilburg",
    stationCode: "TB",
    stationName: "Tilburg",
  },
  "Amersfoort": {
    city: "Amersfoort",
    stationCode: "AMF",
    stationName: "Amersfoort Centraal",
  },
  "Arnhem": {
    city: "Arnhem",
    stationCode: "AH",
    stationName: "Arnhem Centraal",
  },
  "Breda": {
    city: "Breda",
    stationCode: "BD",
    stationName: "Breda",
  },
  "Delft": {
    city: "Delft",
    stationCode: "DT",
    stationName: "Delft",
  },
  "Ede": {
    city: "Ede",
    stationCode: "ED",
    stationName: "Ede-Wageningen",
  },
  "Eindhoven": {
    city: "Eindhoven",
    stationCode: "EHV",
    stationName: "Eindhoven Centraal",
  },
  "Groningen": {
    city: "Groningen",
    stationCode: "GN",
    stationName: "Groningen",
  },
  "Haarlem": {
    city: "Haarlem",
    stationCode: "HLM",
    stationName: "Haarlem",
  },
  "Helmond": {
    city: "Helmond",
    stationCode: "HM",
    stationName: "Helmond",
  },
  "Leeuwarden": {
    city: "Leeuwarden",
    stationCode: "LW",
    stationName: "Leeuwarden",
  },
  "Maastricht": {
    city: "Maastricht",
    stationCode: "MT",
    stationName: "Maastricht",
  },
  "Nijmegen": {
    city: "Nijmegen",
    stationCode: "NM",
    stationName: "Nijmegen",
  },
  "Vlissingen": {
    city: "Vlissingen",
    stationCode: "VS",
    stationName: "Vlissingen",
  },
  "Zaandam": {
    city: "Zaandam",
    stationCode: "ZD",
    stationName: "Zaandam",
  },
  "Zwolle": {
    city: "Zwolle",
    stationCode: "ZL",
    stationName: "Zwolle",
  },
};

// Get station mapping for a theater name or city (case-insensitive)
export function getStationMapping(
  location: string,
): StationMapping | null {
  const normalized = location.trim();

  // Try theater-specific mapping first
  if (THEATER_STATION_MAPPINGS[normalized]) {
    return THEATER_STATION_MAPPINGS[normalized];
  }

  // Try city-level mapping
  if (CITY_STATION_MAPPINGS[normalized]) {
    return CITY_STATION_MAPPINGS[normalized];
  }

  // Try case-insensitive match for theaters
  const lowerLocation = normalized.toLowerCase();
  for (const [name, mapping] of Object.entries(THEATER_STATION_MAPPINGS)) {
    if (name.toLowerCase() === lowerLocation) {
      return mapping;
    }
  }

  // Try case-insensitive match for cities
  for (const [city, mapping] of Object.entries(CITY_STATION_MAPPINGS)) {
    if (city.toLowerCase() === lowerLocation) {
      return mapping;
    }
  }

  return null;
}

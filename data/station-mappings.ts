// Station mappings for Dutch cities with NS train stations
// Used to calculate travel times from user location to cinema cities

export interface StationMapping {
  city: string;
  stationCode: string;
  stationName: string;
}

// Mapping from city names to NS station codes
// Station codes are used by the NS API for journey planning
export const STATION_MAPPINGS: Record<string, StationMapping> = {
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

// Get station mapping for a city (case-insensitive)
export function getStationMapping(
  location: string,
): StationMapping | null {
  const normalized = location.trim();

  // Try direct match first
  if (STATION_MAPPINGS[normalized]) {
    return STATION_MAPPINGS[normalized];
  }

  // Try case-insensitive match
  const lowerLocation = normalized.toLowerCase();
  for (const [city, mapping] of Object.entries(STATION_MAPPINGS)) {
    if (city.toLowerCase() === lowerLocation) {
      return mapping;
    }
  }

  return null;
}

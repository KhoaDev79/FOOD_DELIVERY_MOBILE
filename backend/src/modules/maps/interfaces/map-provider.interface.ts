export interface GeocodeResult {
  addressLine: string;
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
  latitude: number;
  longitude: number;
}

export interface PlaceAutocompleteItem {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface DistanceMatrixResult {
  distanceKm: number;
  durationMinutes: number;
}

export interface IMapProvider {
  readonly name: string;
  reverseGeocode(lat: number, lng: number): Promise<GeocodeResult>;
  searchPlaces(query: string, lat?: number, lng?: number): Promise<PlaceAutocompleteItem[]>;
  getPlaceDetail(placeId: string): Promise<GeocodeResult | null>;
  getDistanceMatrix(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<DistanceMatrixResult>;
}


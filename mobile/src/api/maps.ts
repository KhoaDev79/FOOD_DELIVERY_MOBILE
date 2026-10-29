import { apiClient } from './client';

export interface GeocodeResult {
  addressLine: string;
  latitude: number;
  longitude: number;
}

export interface AutocompleteItem {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface DistanceMatrixResult {
  distanceKm: number;
  durationMinutes: number;
}

export const mapsApi = {
  reverseGeocode: (lat: number, lng: number): Promise<GeocodeResult> =>
    apiClient.get('/maps/reverse-geocode', { params: { lat, lng } }),

  searchPlaces: (q: string, lat?: number, lng?: number): Promise<AutocompleteItem[]> =>
    apiClient.get('/maps/autocomplete', { params: { q, lat, lng } }),

  getDistance: (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<DistanceMatrixResult> =>
    apiClient.get('/maps/distance', {
      params: { originLat, originLng, destLat, destLng },
    }),
};


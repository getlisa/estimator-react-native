import { api } from '@/services/apiClient';

/**
 * Address Component Interface
 */
export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * Address Interface
 */
export interface Address {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  formatted_address: string;
}

/**
 * Google Maps Place Interface
 */
export interface GoogleMapsPlace {
  place_id: string;
  name: string;
  formatted_address: string;
  address_components?: AddressComponent[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  address?: Address; // Normalized address
}

/**
 * Google Maps Search Response Interface
 */
export interface GoogleMapsSearchResponse {
  results: GoogleMapsPlace[];
  status: string;
  error_message?: string;
}

/**
 * Search Places Request Parameters
 */
export interface SearchPlacesParams {
  q: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

/**
 * Google Maps Service
 * Handles Google Maps API interactions
 */
export const googleMapsService = {
  /**
   * Search places using Google Maps API
   * GET /api/google-maps/search?q=query&lat=latitude&lng=longitude&radius=radius
   * 
   * @param params - Search parameters
   * @returns Search results with places
   */
  searchPlaces: async (params: SearchPlacesParams): Promise<GoogleMapsSearchResponse> => {
    const queryParams: Record<string, string> = {
      q: params.q,
    };

    if (params.lat !== undefined) {
      queryParams.lat = params.lat.toString();
    }
    if (params.lng !== undefined) {
      queryParams.lng = params.lng.toString();
    }
    if (params.radius !== undefined) {
      queryParams.radius = params.radius.toString();
    }

    const response = await api.get<{ results: GoogleMapsPlace[] }>('/google-maps/search', {
      params: queryParams,
    });

    return {
      results: response.results,
      status: 'OK',
    };
  },
};


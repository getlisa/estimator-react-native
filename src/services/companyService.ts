import { api } from '@/services/apiClient';

/**
 * Address Interface
 */
export interface Address {
  formatted_address: string;
  country: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
}

/**
 * Company Interface (matches backend response)
 */
export interface Company {
  id: number;
  name: string;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  geocoded_lat: number | null;
  geocoded_lng: number | null;
  address: Address | null;
  created_at: string;
  updated_at: string;
}

/**
 * Update Company Request Interface
 * Matches backend updateCompanySchema validation
 */
export interface UpdateCompanyRequest {
  name?: string;
  logo_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  geocoded_lat?: number | null;
  geocoded_lng?: number | null;
  address?: Address;
}

/**
 * Company Service
 * Handles company-related API operations
 */
export const companyService = {
  /**
   * Get company by ID
   * GET /api/companies/:id
   * 
   * @param id - Company ID
   * @returns Company details
   */
  getCompanyById: async (id: number): Promise<Company> => {
    const response = await api.get<{ company: Company }>(`/companies/${id}`);
    return response.company;
  },

  /**
   * Update company by ID (Admin only)
   * PUT /api/companies/:id
   * 
   * @param id - Company ID
   * @param data - Company data to update
   * @returns Updated company
   */
  updateCompany: async (id: number, data: UpdateCompanyRequest): Promise<Company> => {
    const response = await api.put<{ company: Company }>(`/companies/${id}`, data);
    return response.company;
  },
};


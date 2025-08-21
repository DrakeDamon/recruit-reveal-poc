/**
 * API Client for Databricks Backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

export interface QBData {
  id?: number;
  name: string;
  state: string;
  grad_year: number;
  Division: string;
  height_inches?: number;
  weight_lbs?: number;
  forty_yard_dash?: number;
  vertical_jump?: number;
  shuttle?: number;
  broad_jump?: number;
  bench_press?: number;
  senior_ypg?: number;
  senior_tds?: number;
  senior_comp_pct?: number;
  senior_int?: number;
  senior_att?: number;
  senior_cmp?: number;
  senior_yds?: number;
  senior_td_passes?: number;
}

export interface ListResponse<T> {
  rows: T[];
  count: number;
  total?: number;
  limit?: number;
}

export interface SearchParams {
  name?: string;
  state?: string;
  division?: 'Power 5' | 'FCS' | 'D2' | 'D3/NAIA';
  grad_year?: number;
  limit?: number;
}

export interface PredictionData {
  id: number;
  name: string;
  y_true: number;
  y_pred: number;
  prob_p5: number;
  prob_fcs: number;
  prob_d2: number;
  prob_d3: number;
  updated_at?: string;
}

export interface PredictionsResponse {
  available: boolean;
  rows: PredictionData[];
  count?: number;
  message?: string;
}

export interface HealthResponse {
  ok: boolean;
  status: string;
  timestamp: string;
  database?: {
    connected: boolean;
    catalog: string;
    schema: string;
  };
  environment?: string;
}

/**
 * Generic API request function
 */
export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error || `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  } catch (error) {
    console.error(`API Error (${path}):`, error);
    throw error;
  }
}

/**
 * API methods for QB data
 */
export const qbApi = {
  /**
   * Check API health and database connection
   */
  async health(): Promise<HealthResponse> {
    return api<HealthResponse>('/api/health');
  },

  /**
   * List QBs with optional filters
   */
  async list(params?: {
    division?: string;
    grad_year?: number;
    limit?: number;
  }): Promise<ListResponse<QBData>> {
    const queryParams = new URLSearchParams();
    
    if (params?.division) queryParams.append('division', params.division);
    if (params?.grad_year) queryParams.append('grad_year', params.grad_year.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    const path = queryString ? `/api/qb?${queryString}` : '/api/qb';
    
    return api<ListResponse<QBData>>(path);
  },

  /**
   * Search QBs with flexible filters
   */
  async search(params: SearchParams): Promise<ListResponse<QBData>> {
    return api<ListResponse<QBData>>('/api/qb/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Get prediction preview if available
   */
  async predictions(topN: number = 100): Promise<PredictionsResponse> {
    return api<PredictionsResponse>('/api/qb/predictions/preview', {
      method: 'POST',
      body: JSON.stringify({ topN }),
    });
  },
};

/**
 * React hook for fetching QB data
 */
import { useState, useEffect } from 'react';

export function useQBData(params?: Parameters<typeof qbApi.list>[0]) {
  const [data, setData] = useState<QBData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await qbApi.list(params);
        
        if (!cancelled) {
          setData(response.rows);
          setTotal(response.total || response.count);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch QB data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [params?.division, params?.grad_year, params?.limit]);

  return { data, loading, error, total, refetch: () => {} };
}

/**
 * React hook for API health check
 */
export function useApiHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await qbApi.health();
        
        if (!cancelled) {
          setHealth(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Health check failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkHealth();

    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { health, loading, error };
}

export default qbApi;
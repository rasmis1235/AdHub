import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';
import { setTokens, logout } from '../store/slices/authSlice';

// In dev: relative /api (proxied by Vite to localhost:8080)
// In production: https://api.rasmis1235.tech/api
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        refreshPromise = api
          .post<{ data: { accessToken: string; refreshToken?: string } }>(
            '/auth/refresh',
            storedRefreshToken ? { refreshToken: storedRefreshToken } : {}
          )
          .then((r) => {
            if (r.data.data?.refreshToken) {
              localStorage.setItem('refreshToken', r.data.data.refreshToken);
            }
            return r.data.data!.accessToken;
          })
          .catch((err) => {
            store.dispatch(logout());
            throw err;
          })
          .finally(() => { refreshPromise = null; });
      }

      try {
        const newToken = await refreshPromise;
        store.dispatch(setTokens({ accessToken: newToken }));
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export function extractError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { error?: string })?.error || 'Something went wrong';
  }
  return 'Something went wrong';
}

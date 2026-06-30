import { api } from "./api";
import type { Restaurant, RestaurantInput } from "../types/restaurant";

export type RestaurantFilters = {
  search?: string;
  category?: string;
  tag?: string;
  classification?: "NEW" | "RECOMMENDATION";
  favorite?: boolean;
  blacklisted?: boolean;
};

function toQueryString(filters: RestaurantFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const restaurantsApi = {
  list: (filters: RestaurantFilters = {}) =>
    api.get<Restaurant[]>(`/restaurants${toQueryString(filters)}`),
  get: (id: string) => api.get<Restaurant>(`/restaurants/${id}`),
  create: (input: RestaurantInput) => api.post<Restaurant>("/restaurants", input),
  update: (id: string, input: Partial<RestaurantInput>) =>
    api.put<Restaurant>(`/restaurants/${id}`, input),
  remove: (id: string) => api.delete<void>(`/restaurants/${id}`),
  markVisit: (id: string, body: { visitedAt?: string; rating?: number; notes?: string }) =>
    api.post(`/restaurants/${id}/visit`, body),
  setFavorite: (id: string, favorite: boolean) =>
    api.post<Restaurant>(`/restaurants/${id}/favorite`, { favorite }),
  setBlacklisted: (id: string, blacklisted: boolean) =>
    api.post<Restaurant>(`/restaurants/${id}/blacklist`, { blacklisted }),
};

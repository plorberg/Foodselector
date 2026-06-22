import { api } from "./api";

export type AppConfig = {
  defaultRepeatBlockDays: number;
  defaultRandomFactor: number;
  defaultSuggestionCount: number;
  enabledAnalyzers: {
    manual: boolean;
    osm: boolean;
    googlePlaces: boolean;
    openai: boolean;
  };
};

export type NamedEntity = { id: string; name: string };

export type DecisionProfile = {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  weights: Record<string, number>;
  randomFactor: number;
  repeatBlockDays: number;
  suggestionCount: number;
  isDefault: boolean;
};

export const configApi = {
  getConfig: () => api.get<AppConfig>("/config"),
  putConfig: (config: AppConfig) => api.put<AppConfig>("/config", config),
  getCategories: () => api.get<NamedEntity[]>("/categories"),
  addCategory: (name: string) => api.post<NamedEntity>("/categories", { name }),
  deleteCategory: (id: string) => api.delete<void>(`/categories/${id}`),
  getTags: () => api.get<NamedEntity[]>("/tags"),
  addTag: (name: string) => api.post<NamedEntity>("/tags", { name }),
  deleteTag: (id: string) => api.delete<void>(`/tags/${id}`),
  getProfiles: () => api.get<DecisionProfile[]>("/decision-profiles"),
  deleteProfile: (id: string) => api.delete<void>(`/decision-profiles/${id}`),
};

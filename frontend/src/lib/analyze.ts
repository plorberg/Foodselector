import { api } from "./api";
import type { AnalysisInput, AnalysisResult, GoogleMapsParseResult } from "../types/analysis";

export const analyzeApi = {
  manual: (input: AnalysisInput) => api.post<AnalysisResult>("/analyze/manual", input),
  osm: (input: AnalysisInput) => api.post<AnalysisResult>("/analyze/osm", input),
  googlePlaces: (input: AnalysisInput) => api.post<AnalysisResult>("/analyze/google-places", input),
  openai: (input: AnalysisInput) => api.post<AnalysisResult>("/analyze/openai", input),
  parseGoogleMapsLink: (url: string) =>
    api.post<GoogleMapsParseResult>("/parse/google-maps-link", { url }),
};

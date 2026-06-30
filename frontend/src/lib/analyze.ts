import { api } from "./api";
import type { AnalysisInput, AnalysisResult, GoogleMapsParseResult } from "../types/analysis";

export const analyzeApi = {
  googlePlaces: (input: AnalysisInput) => api.post<AnalysisResult>("/analyze/google-places", input),
  parseGoogleMapsLink: (url: string) =>
    api.post<GoogleMapsParseResult>("/parse/google-maps-link", { url }),
};

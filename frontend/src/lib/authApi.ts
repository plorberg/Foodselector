import { api } from "./api";
import type { AuthUser, Workspace } from "./auth";

export type AuthResponse = { token: string; user: AuthUser; workspaces: Workspace[] };

export const authApi = {
  google: (credential: string) => api.post<AuthResponse>("/auth/google", { credential }),
  devLogin: (email: string, name?: string) =>
    api.post<AuthResponse>("/auth/dev-login", { email, name }),
  me: () => api.get<{ user: AuthUser; workspaces: Workspace[] }>("/auth/me"),
};

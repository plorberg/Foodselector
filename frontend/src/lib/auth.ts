const TOKEN_KEY = "fs_token";
const WORKSPACE_KEY = "fs_workspace";

export type AuthUser = { id: string; email: string; name: string | null };
export type Workspace = { id: string; name: string; role: "OWNER" | "MEMBER" };

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getActiveWorkspace(): string | null {
  return localStorage.getItem(WORKSPACE_KEY);
}
export function setActiveWorkspace(id: string): void {
  localStorage.setItem(WORKSPACE_KEY, id);
}
export function clearActiveWorkspace(): void {
  localStorage.removeItem(WORKSPACE_KEY);
}

// Called by the API layer on a 401 so the app can drop the user back to login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}
export function handleUnauthorized(): void {
  clearToken();
  clearActiveWorkspace();
  onUnauthorized?.();
}

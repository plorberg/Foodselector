import { getActiveWorkspace, getToken, handleUnauthorized } from "./auth";

// Normalize VITE_API_URL so deployment misconfigurations don't break the app:
// strip a trailing slash, and ensure the base ends in "/api" (all backend
// routes live under /api). Both "https://host" and "https://host/api/" work.
function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? "/api").trim().replace(/\/+$/, "");
  if (raw === "" ) return "/api";
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const API_BASE = resolveApiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const workspaceId = getActiveWorkspace();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request_failed_${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

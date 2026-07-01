import { api } from "./api";
import type { Workspace } from "./auth";

export type Member = {
  userId: string;
  email: string;
  name: string | null;
  role: "OWNER" | "MEMBER";
};
export type PendingInvitation = { id: string; email: string };
export type MyInvitation = { id: string; workspaceName: string };

export const workspacesApi = {
  list: () => api.get<Workspace[]>("/workspaces"),
  create: (name: string) => api.post<Workspace>("/workspaces", { name }),
  members: (id: string) =>
    api.get<{ members: Member[]; pendingInvitations: PendingInvitation[] }>(
      `/workspaces/${id}/members`
    ),
  invite: (id: string, email: string) =>
    api.post<PendingInvitation>(`/workspaces/${id}/invitations`, { email }),
  revokeInvitation: (id: string, invitationId: string) =>
    api.delete<void>(`/workspaces/${id}/invitations/${invitationId}`),
  removeMember: (id: string, userId: string) =>
    api.delete<void>(`/workspaces/${id}/members/${userId}`),
};

export const invitationsApi = {
  mine: () => api.get<MyInvitation[]>("/invitations/mine"),
  accept: (id: string) => api.post<{ workspaceId: string }>(`/invitations/${id}/accept`),
};

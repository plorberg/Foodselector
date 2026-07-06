import { api } from "./api";
import type { Workspace } from "./auth";

export type Member = {
  userId: string;
  email: string;
  name: string | null;
  role: "OWNER" | "MEMBER";
};
export type PendingInvitation = { id: string; email: string; token: string };
export type InviteResult = PendingInvitation & { emailSent: boolean };
export type MyInvitation = { id: string; workspaceName: string };
export type InvitationInfo = { workspaceName: string; email: string; alreadyMember: boolean };

export function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

export const workspacesApi = {
  list: () => api.get<Workspace[]>("/workspaces"),
  create: (name: string) => api.post<Workspace>("/workspaces", { name }),
  members: (id: string) =>
    api.get<{ members: Member[]; pendingInvitations: PendingInvitation[] }>(
      `/workspaces/${id}/members`
    ),
  invite: (id: string, email: string) =>
    api.post<InviteResult>(`/workspaces/${id}/invitations`, { email }),
  revokeInvitation: (id: string, invitationId: string) =>
    api.delete<void>(`/workspaces/${id}/invitations/${invitationId}`),
  removeMember: (id: string, userId: string) =>
    api.delete<void>(`/workspaces/${id}/members/${userId}`),
};

export const invitationsApi = {
  mine: () => api.get<MyInvitation[]>("/invitations/mine"),
  accept: (id: string) => api.post<{ workspaceId: string }>(`/invitations/${id}/accept`),
  byToken: (token: string) => api.get<InvitationInfo>(`/invitations/by-token/${token}`),
  acceptByToken: (token: string) =>
    api.post<{ workspaceId: string }>("/invitations/accept-by-token", { token }),
};

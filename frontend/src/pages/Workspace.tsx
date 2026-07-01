import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  invitationsApi,
  workspacesApi,
  type Member,
  type MyInvitation,
  type PendingInvitation,
} from '../lib/workspacesApi'

export function Workspace() {
  const { activeWorkspace, refreshWorkspaces, switchWorkspace } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvitation[]>([])
  const [myInvites, setMyInvites] = useState<MyInvitation[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [newWsName, setNewWsName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const isOwner = activeWorkspace?.role === 'OWNER'

  async function loadMembers() {
    if (!activeWorkspace) return
    try {
      const data = await workspacesApi.members(activeWorkspace.id)
      setMembers(data.members)
      setPending(data.pendingInvitations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden.')
    }
  }

  async function loadMyInvites() {
    setMyInvites(await invitationsApi.mine().catch(() => []))
  }

  useEffect(() => {
    loadMembers()
    loadMyInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!activeWorkspace) return
    setError(null)
    setMessage(null)
    try {
      await workspacesApi.invite(activeWorkspace.id, inviteEmail)
      setInviteEmail('')
      setMessage('Einladung erstellt.')
      loadMembers()
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : 'error'))
    }
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const ws = await workspacesApi.create(newWsName)
      setNewWsName('')
      await refreshWorkspaces()
      switchWorkspace(ws.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler.')
    }
  }

  async function acceptInvite(id: string) {
    const { workspaceId } = await invitationsApi.accept(id)
    await refreshWorkspaces()
    switchWorkspace(workspaceId)
    loadMyInvites()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Verwaltung</h1>

      {myInvites.length > 0 && (
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-blue-800">Einladungen an dich</h2>
          <ul className="space-y-2 text-sm">
            {myInvites.map((i) => (
              <li key={i.id} className="flex items-center justify-between">
                <span>
                  Verwaltung <strong>{i.workspaceName}</strong>
                </span>
                <button
                  onClick={() => acceptInvite(i.id)}
                  className="rounded-md bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600"
                >
                  Annehmen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">
          Aktive Verwaltung: {activeWorkspace?.name}
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          {isOwner ? 'Du bist Owner.' : 'Du bist Mitglied.'}
        </p>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Mitglieder
        </h3>
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between py-1.5">
              <span>
                {m.name ? `${m.name} · ` : ''}
                {m.email}
              </span>
              <span className="text-xs text-slate-400">{m.role === 'OWNER' ? 'Owner' : 'Mitglied'}</span>
            </li>
          ))}
        </ul>

        {isOwner && (
          <>
            <form onSubmit={invite} className="flex gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="person@example.com einladen"
                className="input"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Einladen
              </button>
            </form>
            {pending.length > 0 && (
              <div className="mt-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Ausstehende Einladungen
                </h3>
                <ul className="space-y-1 text-sm">
                  {pending.map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span className="text-slate-600">{p.email}</span>
                      <button
                        onClick={async () => {
                          await workspacesApi.revokeInvitation(activeWorkspace!.id, p.id)
                          loadMembers()
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Zurückziehen
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Neue Verwaltung anlegen</h2>
        <form onSubmit={createWorkspace} className="flex gap-2">
          <input
            required
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            placeholder="Name der neuen Verwaltung"
            className="input"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Anlegen
          </button>
        </form>
      </section>
    </div>
  )
}

function translate(code: string): string {
  const map: Record<string, string> = {
    already_member: 'Diese Person ist bereits Mitglied.',
    owner_required: 'Nur der Owner darf einladen.',
  }
  return map[code] ?? 'Es ist ein Fehler aufgetreten.'
}

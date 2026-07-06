import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { invitationsApi, type InvitationInfo } from '../lib/workspacesApi'

// Landing page for invite links (/invite/:token). Unauthenticated visitors see
// the login screen first (App.tsx) and land back here after signing in.
export function InviteAccept() {
  const { token } = useParams<{ token: string }>()
  const { refreshWorkspaces, switchWorkspace } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) return
    invitationsApi
      .byToken(token)
      .then(setInfo)
      .catch(() => setError('Diese Einladung ist ungültig oder wurde bereits verwendet.'))
  }, [token])

  async function accept() {
    if (!token) return
    setAccepting(true)
    setError(null)
    try {
      const { workspaceId } = await invitationsApi.acceptByToken(token)
      await refreshWorkspaces()
      switchWorkspace(workspaceId)
      navigate('/')
    } catch {
      setError('Die Einladung konnte nicht angenommen werden.')
      setAccepting(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Einladung</h1>
      {error ? (
        <>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Zum Dashboard
          </button>
        </>
      ) : !info ? (
        <p className="text-sm text-slate-500">Lädt…</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-600">
            {info.alreadyMember ? (
              <>
                Du bist bereits Mitglied der Gruppe <strong>{info.workspaceName}</strong>.
              </>
            ) : (
              <>
                Du wurdest eingeladen, der Gruppe <strong>{info.workspaceName}</strong>{' '}
                beizutreten.
              </>
            )}
          </p>
          <button
            onClick={accept}
            disabled={accepting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {accepting ? 'Trete bei…' : info.alreadyMember ? 'Zur Gruppe' : 'Einladung annehmen'}
          </button>
        </>
      )}
    </div>
  )
}

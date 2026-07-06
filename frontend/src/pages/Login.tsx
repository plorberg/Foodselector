import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'

// Minimal typing for the Google Identity Services global.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function Login() {
  const { loginWithGoogle, devLogin } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [devEmail, setDevEmail] = useState('')

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      if (!window.google || !buttonRef.current) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        // After login App re-renders into the routed app at the current URL,
        // so deep links (e.g. /invite/<token>) survive the login screen.
        callback: async (r) => {
          try {
            await loginWithGoogle(r.credential)
          } catch {
            setError('Google-Anmeldung fehlgeschlagen.')
          }
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
      })
    }
    document.body.appendChild(script)
    return () => {
      script.remove()
    }
  }, [loginWithGoogle])

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await devLogin(devEmail)
    } catch {
      setError('Dev-Login fehlgeschlagen (nur lokal verfügbar).')
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">🍽️ Food Selector</h1>
      <p className="mb-4 text-sm text-slate-500">Bitte mit Google anmelden.</p>

      {GOOGLE_CLIENT_ID ? (
        <div ref={buttonRef} />
      ) : (
        <p className="text-sm text-amber-600">
          Google-Login ist nicht konfiguriert (VITE_GOOGLE_CLIENT_ID fehlt).
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {import.meta.env.DEV && (
        <form onSubmit={handleDevLogin} className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs text-slate-400">Nur lokal: Dev-Login</p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              placeholder="dev@example.com"
              className="input"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Login
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

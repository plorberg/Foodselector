import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  clearToken,
  getActiveWorkspace,
  getToken,
  setActiveWorkspace,
  setToken,
  setUnauthorizedHandler,
  type AuthUser,
  type Workspace,
} from './auth'
import { authApi, type AuthResponse } from './authApi'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  loginWithGoogle: (credential: string) => Promise<void>
  devLogin: (email: string, name?: string) => Promise<void>
  switchWorkspace: (id: string) => void
  refreshWorkspaces: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeId, setActiveId] = useState<string | null>(getActiveWorkspace())
  // Only loading while a stored token is being validated; without a token the
  // login screen can show immediately.
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  function applyWorkspaces(list: Workspace[]) {
    setWorkspaces(list)
    const stored = getActiveWorkspace()
    const active = list.find((w) => w.id === stored) ?? list[0]
    if (active) {
      setActiveWorkspace(active.id)
      setActiveId(active.id)
    }
  }

  function applyAuth(res: AuthResponse) {
    setToken(res.token)
    setUser(res.user)
    applyWorkspaces(res.workspaces)
  }

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setWorkspaces([])
      setActiveId(null)
    })
    if (!getToken()) return
    authApi
      .me()
      .then((res) => {
        setUser(res.user)
        applyWorkspaces(res.workspaces)
      })
      .catch(() => {
        clearToken()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function loginWithGoogle(credential: string) {
    applyAuth(await authApi.google(credential))
  }

  async function devLogin(email: string, name?: string) {
    applyAuth(await authApi.devLogin(email, name))
  }

  function switchWorkspace(id: string) {
    setActiveWorkspace(id)
    setActiveId(id)
  }

  async function refreshWorkspaces() {
    const res = await authApi.me()
    setUser(res.user)
    applyWorkspaces(res.workspaces)
  }

  function logout() {
    clearToken()
    localStorage.removeItem('fs_workspace')
    setUser(null)
    setWorkspaces([])
    setActiveId(null)
  }

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        workspaces,
        activeWorkspace,
        loginWithGoogle,
        devLogin,
        switchWorkspace,
        refreshWorkspaces,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

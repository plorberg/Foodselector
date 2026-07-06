import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Restaurants } from './pages/Restaurants'
import { RestaurantForm } from './pages/RestaurantForm'
import { RestaurantDetail } from './pages/RestaurantDetail'
import { Analyze } from './pages/Analyze'
import { Decide } from './pages/Decide'
import { Config } from './pages/Config'
import { ImportExport } from './pages/ImportExport'
import { InviteAccept } from './pages/InviteAccept'
import { Login } from './pages/Login'
import { Workspace } from './pages/Workspace'
import { useAuth } from './lib/AuthContext'
import { cycleThemePreference, themePreference, type ThemePreference } from './lib/theme'

const THEME_LABEL: Record<ThemePreference, { icon: string; title: string }> = {
  system: { icon: '🌓', title: 'Design: automatisch (folgt der Systemeinstellung)' },
  light: { icon: '☀️', title: 'Design: hell' },
  dark: { icon: '🌙', title: 'Design: dunkel' },
}

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/restaurants', label: 'Restaurants' },
  { to: '/analyze', label: 'Analysieren' },
  { to: '/decide', label: 'Entscheiden' },
  { to: '/config', label: 'Konfiguration' },
  { to: '/import-export', label: 'Import/Export' },
  { to: '/workspace', label: 'Gruppe' },
]

function App() {
  const { user, loading, logout, workspaces, activeWorkspace, switchWorkspace } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [themePref, setThemePref] = useState<ThemePreference>(() => themePreference())

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Lädt…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Login />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-900">🍽️ Food Selector</span>
              {workspaces.length > 0 && (
                <select
                  value={activeWorkspace?.id ?? ''}
                  onChange={(e) => switchWorkspace(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600"
                  title="Gruppe wechseln"
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.role === 'OWNER' ? ' (Owner)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <nav className="hidden gap-4 text-sm lg:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setThemePref(cycleThemePreference())}
                aria-label="Design wechseln"
                title={THEME_LABEL[themePref].title}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                {THEME_LABEL[themePref].icon}
                {themePref === 'system' && <span className="ml-1">Auto</span>}
              </button>
              <button
                onClick={logout}
                className="hidden rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 lg:inline"
              >
                Logout
              </button>
              <button
                type="button"
                aria-label="Menü"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="rounded-md border border-slate-300 p-1.5 text-slate-600 lg:hidden"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav className="mt-3 flex flex-col gap-1 text-sm lg:hidden">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-2 py-1.5 ${
                      isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="mt-1 rounded-md px-2 py-1.5 text-left text-slate-500"
              >
                Logout ({user.email})
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/restaurants/new" element={<RestaurantForm />} />
          <Route path="/restaurants/:id" element={<RestaurantDetail />} />
          <Route path="/restaurants/:id/edit" element={<RestaurantForm />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/decide" element={<Decide />} />
          <Route path="/config" element={<Config />} />
          <Route path="/import-export" element={<ImportExport />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

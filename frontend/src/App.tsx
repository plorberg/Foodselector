import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Restaurants } from './pages/Restaurants'
import { RestaurantForm } from './pages/RestaurantForm'
import { Analyze } from './pages/Analyze'
import { Decide } from './pages/Decide'
import { Config } from './pages/Config'
import { ImportExport } from './pages/ImportExport'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/restaurants', label: 'Restaurants' },
  { to: '/analyze', label: 'Analysieren' },
  { to: '/decide', label: 'Entscheiden' },
  { to: '/config', label: 'Konfiguration' },
  { to: '/import-export', label: 'Import/Export' },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-6">
            <span className="font-semibold text-slate-900">🍽️ Food Selector</span>
            {/* Inline nav on tablet/desktop */}
            <nav className="hidden gap-4 text-sm sm:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {/* Hamburger toggle on mobile */}
            <button
              type="button"
              aria-label="Menü"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-md border border-slate-300 p-1.5 text-slate-600 sm:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {/* Collapsible mobile nav */}
          {menuOpen && (
            <nav className="mt-3 flex flex-col gap-1 text-sm sm:hidden">
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
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/restaurants/new" element={<RestaurantForm />} />
          <Route path="/restaurants/:id" element={<RestaurantForm />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/decide" element={<Decide />} />
          <Route path="/config" element={<Config />} />
          <Route path="/import-export" element={<ImportExport />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

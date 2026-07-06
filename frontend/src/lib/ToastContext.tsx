import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Toast = {
  id: number
  message: string
  undo?: () => void
}

type ToastContextValue = {
  // Shows a brief confirmation. Pass `undo` to render an "Rückgängig" action.
  toast: (message: string, opts?: { undo?: () => void }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, opts?: { undo?: () => void }) => {
      const id = nextId.current++
      setToasts((prev) => [...prev.slice(-2), { id, message, undo: opts?.undo }])
      setTimeout(() => dismiss(id), opts?.undo ? 6000 : 3500)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span>{t.message}</span>
            {t.undo && (
              <button
                onClick={() => {
                  t.undo!()
                  dismiss(t.id)
                }}
                className="font-semibold text-amber-400 hover:text-amber-300"
              >
                Rückgängig
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Schließen"
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}

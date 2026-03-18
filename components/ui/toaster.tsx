"use client"

import * as React from "react"
import { ToastComponent, Toast } from "./toast"

const MAX_TOASTS = 5
let toastCounter = 0

interface ToasterContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

const ToasterContext = React.createContext<ToasterContextValue | undefined>(undefined)

export function useToast() {
  const context = React.useContext(ToasterContext)
  if (!context) {
    throw new Error("useToast must be used within ToasterProvider")
  }
  return context
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    setToasts((prev) => [...prev, { ...toast, id }].slice(-MAX_TOASTS))
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToasterContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </ToasterContext.Provider>
  )
}

interface ToasterProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

function Toaster({ toasts, onDismiss }: ToasterProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-2 p-4 pointer-events-none"
      dir="rtl"
      role="region"
      aria-label="התראות"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

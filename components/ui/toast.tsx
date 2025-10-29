"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
}

interface ToastProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const toastStyles: Record<ToastType, string> = {
  success: "bg-green-50 border-green-200 text-green-900",
  error: "bg-red-50 border-red-200 text-red-900",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
}

const toastIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✗",
  info: "ℹ",
  warning: "⚠",
}

export function ToastComponent({ toast, onDismiss }: ToastProps) {
  React.useEffect(() => {
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-md gap-3 rounded-lg border-2 p-4 shadow-lg animate-in slide-in-from-top-5",
        toastStyles[toast.type]
      )}
      dir="rtl"
    >
      <div className="flex-shrink-0 text-2xl">{toastIcons[toast.type]}</div>
      
      <div className="flex-1 space-y-1">
        <div className="font-semibold">{toast.title}</div>
        {toast.description && (
          <div className="text-sm opacity-90">{toast.description}</div>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-sm font-medium underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}


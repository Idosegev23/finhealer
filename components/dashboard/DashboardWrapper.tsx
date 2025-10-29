"use client"

import { ToasterProvider } from "@/components/ui/toaster"

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToasterProvider>
      {children}
    </ToasterProvider>
  )
}


"use client"

import { ToasterProvider } from "@/components/ui/toaster"
import { PendingExpensesProvider } from "@/contexts/PendingExpensesContext"

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToasterProvider>
      <PendingExpensesProvider>
        {children}
      </PendingExpensesProvider>
    </ToasterProvider>
  )
}


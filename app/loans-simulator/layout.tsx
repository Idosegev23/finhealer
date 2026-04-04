"use client";

import { PendingExpensesProvider } from "@/contexts/PendingExpensesContext";
import { ToasterProvider } from "@/components/ui/toaster";

export default function LoansSimulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToasterProvider>
      <PendingExpensesProvider>
        {children}
      </PendingExpensesProvider>
    </ToasterProvider>
  );
}


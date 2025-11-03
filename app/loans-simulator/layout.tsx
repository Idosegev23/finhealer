"use client";

import { PendingExpensesProvider } from "@/contexts/PendingExpensesContext";

export default function LoansSimulatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PendingExpensesProvider>
      {children}
    </PendingExpensesProvider>
  );
}


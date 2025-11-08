"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

interface PendingExpensesContextType {
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

const PendingExpensesContext = createContext<PendingExpensesContextType | undefined>(undefined);

export function PendingExpensesProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const response = await fetch('/api/expenses/pending');
      if (response.ok) {
        const data = await response.json();
        const total = (data.transactions || []).length;
        setCount(total);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching pending count:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    
    // רענון כל 3 דקות במקום כל 30 שניות
    // זה מספיק כי זה לא critical data שצריך real-time
    const interval = setInterval(fetchCount, 180000); // 3 minutes
    
    return () => clearInterval(interval);
  }, [fetchCount]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchCount();
  }, [fetchCount]);

  return (
    <PendingExpensesContext.Provider value={{ count, loading, refresh, lastUpdated }}>
      {children}
    </PendingExpensesContext.Provider>
  );
}

export function usePendingExpenses() {
  const context = useContext(PendingExpensesContext);
  if (context === undefined) {
    throw new Error('usePendingExpenses must be used within a PendingExpensesProvider');
  }
  return context;
}




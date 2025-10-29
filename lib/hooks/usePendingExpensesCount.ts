"use client"

import { useEffect, useState } from 'react';

export function usePendingExpensesCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      const response = await fetch('/api/expenses/pending');
      if (response.ok) {
        const data = await response.json();
        setCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching pending count:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();
    
    // רענון כל דקה
    const interval = setInterval(fetchCount, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    fetchCount();
  };

  return { count, loading, refresh };
}


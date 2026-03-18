'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/ui/toaster';

/**
 * Hook that wraps fetch calls with automatic error toasts.
 * Usage:
 *   const { fetchWithToast } = useFetchWithToast();
 *   const data = await fetchWithToast('/api/expenses/list');
 */
export function useFetchWithToast() {
  const { addToast } = useToast();

  const fetchWithToast = useCallback(async <T = any>(
    url: string,
    options?: RequestInit,
    successMessage?: string
  ): Promise<T | null> => {
    try {
      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok || data.error) {
        addToast({
          type: 'error',
          title: 'שגיאה',
          description: data.error || `שגיאה בתקשורת עם השרת (${res.status})`,
          duration: 5000,
        });
        return null;
      }

      if (successMessage) {
        addToast({
          type: 'success',
          title: successMessage,
          duration: 3000,
        });
      }

      return data as T;
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'שגיאת תקשורת',
        description: 'לא הצלחנו להתחבר לשרת. בדוק את החיבור לאינטרנט.',
        duration: 5000,
      });
      return null;
    }
  }, [addToast]);

  return { fetchWithToast };
}

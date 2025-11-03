'use client';

import { useEffect, useState } from 'react';
import { DrilldownPieChart } from './DrilldownPieChart';
import { TrendingDown } from 'lucide-react';

interface ChartDataItem {
  name: string;
  value: number;
  children?: ChartDataItem[];
  color?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export function ExpensesDrilldownChart() {
  const [initialData, setInitialData] = useState<ChartDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // טעינת נתונים ראשוניים (רמה 1)
  useEffect(() => {
    fetchLevel1Data();
  }, []);

  const fetchLevel1Data = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/dashboard/expenses-hierarchy?level=1');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      setInitialData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('שגיאה בטעינת נתונים');
    } finally {
      setIsLoading(false);
    }
  };

  // פונקציה לטעינת נתונים ברמות נוספות
  const handleSliceClick = async (item: ChartDataItem, currentLevel: number): Promise<ChartDataItem[]> => {
    try {
      let url = '/api/dashboard/expenses-hierarchy';
      const params = new URLSearchParams();

      // קביעת הרמה הבאה
      const nextLevel = currentLevel + 1;
      params.append('level', nextLevel.toString());

      // העברת מטא-דאטה מהרמה הקודמת
      if (item.metadata) {
        Object.entries(item.metadata).forEach(([key, value]) => {
          params.append(key, value);
        });
      }

      url += `?${params.toString()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch drill-down data');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching drill-down data:', err);
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-bold text-theme-primary">ניתוח הוצאות אינטראקטיבי</h3>
        </div>
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-bold text-theme-primary">ניתוח הוצאות אינטראקטיבי</h3>
        </div>
        <div className="h-[400px] flex flex-col items-center justify-center text-center p-8">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (initialData.length === 0) {
    return (
      <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-bold text-theme-primary">ניתוח הוצאות אינטראקטיבי</h3>
        </div>
        <div className="h-[400px] flex flex-col items-center justify-center text-center p-8">
          <TrendingDown className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h4 className="text-lg font-semibold text-theme-primary mb-2">
            אין עדיין נתוני הוצאות
          </h4>
          <p className="text-sm text-theme-secondary">
            התחל לרשום הוצאות כדי לראות ניתוח מפורט
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Icon Header */}
      <div className="absolute top-6 right-6 z-10">
        <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
          <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
      </div>
      
      <DrilldownPieChart
        title="ניתוח הוצאות אינטראקטיבי"
        description="לחץ על כל פרוסה כדי לצלול לעומק הנתונים 🔍"
        initialData={initialData}
        onSliceClick={handleSliceClick}
      />
    </div>
  );
}


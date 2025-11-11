'use client';

import { useEffect, useState } from 'react';
import { SunburstChart } from '@/components/charts/SunburstChart';
import { TrendingDown, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ChartDataItem {
  name: string;
  value: number;
  children?: ChartDataItem[];
  color?: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface PeriodInfo {
  startDate: string;
  endDate: string;
  periodLabel: string;
  period: string;
}

export function ExpensesDrilldownChart() {
  const [initialData, setInitialData] = useState<ChartDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('last_3_months');
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<string>('last_3_months'); // לשמירת תקופה נוכחית ל-drill-down

  // טעינת נתונים ראשוניים (רמה 1)
  useEffect(() => {
    fetchLevel1Data();
  }, [period]);

  const fetchLevel1Data = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/dashboard/expenses-hierarchy?level=1&period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      
      // התאמה לפורמט החדש של ה-API
      if (result.data) {
        setInitialData(result.data);
        setPeriodInfo(result.period);
        setCurrentPeriod(period);
      } else {
        // תאימות לאחור - אם ה-API עדיין מחזיר מערך ישיר
        setInitialData(Array.isArray(result) ? result : []);
      }
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
      params.append('period', currentPeriod); // שמירת תקופה נוכחית

      // העברת מטא-דאטה מהרמה הקודמת
      if (item.metadata) {
        Object.entries(item.metadata).forEach(([key, value]) => {
          params.append(key, String(value));
        });
      }

      url += `?${params.toString()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch drill-down data');
      }

      const result = await response.json();
      
      // התאמה לפורמט החדש של ה-API
      if (result.data) {
        return result.data;
      } else {
        // תאימות לאחור
        return Array.isArray(result) ? result : [];
      }
    } catch (err) {
      console.error('Error fetching drill-down data:', err);
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-phi-dark border border-phi-gold/30 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-phi-dark dark:text-white">ניתוח הוצאות אינטראקטיבי</h3>
          </div>
        </div>
        <div className="h-[500px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-phi-dark border border-phi-gold/30 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-phi-dark dark:text-white">ניתוח הוצאות אינטראקטיבי</h3>
          </div>
        </div>
        <div className="h-[500px] flex flex-col items-center justify-center text-center p-8">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (initialData.length === 0) {
    return (
      <div className="bg-white dark:bg-phi-dark border border-phi-gold/30 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-phi-dark dark:text-white">ניתוח הוצאות אינטראקטיבי</h3>
          </div>
        </div>
        <div className="h-[500px] flex flex-col items-center justify-center text-center p-8">
          <TrendingDown className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h4 className="text-lg font-semibold text-phi-dark dark:text-white mb-2">
            אין עדיין נתוני הוצאות
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            התחל לרשום הוצאות כדי לראות ניתוח מפורט
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-phi-dark border border-phi-gold/30 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-phi-dark dark:text-white">ניתוח הוצאות אינטראקטיבי</h3>
            {periodInfo && (
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" />
                תקופה: {periodInfo.periodLabel}
              </p>
            )}
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="בחר תקופה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month">חודש נוכחי</SelectItem>
            <SelectItem value="last_3_months">3 חודשים אחרונים</SelectItem>
            <SelectItem value="last_year">שנה אחרונה</SelectItem>
            <SelectItem value="all_time">כל הזמן</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SunburstChart
        title=""
        description="לחץ על כל פרוסה כדי לצלול לעומק הנתונים 🔍"
        initialData={initialData}
        onSliceClick={handleSliceClick}
      />
    </div>
  );
}







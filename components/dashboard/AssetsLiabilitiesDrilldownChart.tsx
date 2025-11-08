'use client';

import { useEffect, useState } from 'react';
import { DrilldownPieChart } from './DrilldownPieChart';
import { Scale } from 'lucide-react';

interface ChartDataItem {
  name: string;
  value: number;
  children?: ChartDataItem[];
  color?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export function AssetsLiabilitiesDrilldownChart() {
  const [initialData, setInitialData] = useState<ChartDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLevel1Data();
  }, []);

  const fetchLevel1Data = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/dashboard/assets-liabilities-hierarchy?level=1');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      setInitialData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching assets-liabilities data:', err);
      setError('שגיאה בטעינת נתונים');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliceClick = async (item: ChartDataItem, currentLevel: number): Promise<ChartDataItem[]> => {
    try {
      let url = '/api/dashboard/assets-liabilities-hierarchy';
      const params = new URLSearchParams();

      const nextLevel = currentLevel + 1;
      params.append('level', nextLevel.toString());

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
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-theme-primary">מאזן נכסים וחובות</h3>
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
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-theme-primary">מאזן נכסים וחובות</h3>
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
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-theme-primary">מאזן נכסים וחובות</h3>
        </div>
        <div className="h-[400px] flex flex-col items-center justify-center text-center p-8">
          <Scale className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h4 className="text-lg font-semibold text-theme-primary mb-2">
            אין עדיין נתונים פיננסיים
          </h4>
          <p className="text-sm text-theme-secondary">
            הוסף חשבונות, חיסכון והלוואות כדי לראות מאזן מפורט
          </p>
        </div>
      </div>
    );
  }

  // חישוב שווי נטו
  const netWorth = initialData.reduce((sum, item) => {
    if (item.metadata?.main_category === 'assets') {
      return sum + item.value;
    } else if (item.metadata?.main_category === 'liabilities') {
      return sum - item.value;
    }
    return sum;
  }, 0);

  return (
    <div className="relative">
      <div className="absolute top-6 right-6 z-10">
        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
          <Scale className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
      </div>
      
      <div className="space-y-4">
        {/* שווי נטו - באנר עליון */}
        <div className="bg-gradient-to-l from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-theme rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-theme-secondary text-sm font-medium">שווי נטו (נכסים - חובות):</span>
            <span className={`text-2xl font-bold ${netWorth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {netWorth >= 0 ? '+' : ''}₪{netWorth.toLocaleString('he-IL')}
            </span>
          </div>
        </div>

        <DrilldownPieChart
          title="מאזן נכסים וחובות"
          description="לחץ על נכסים או חובות לפירוט מלא ⚖️"
          initialData={initialData}
          onSliceClick={handleSliceClick}
        />
      </div>
    </div>
  );
}




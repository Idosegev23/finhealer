'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = [
  '#3A7BD5', // כחול
  '#7ED957', // ירוק
  '#F6A623', // כתום
  '#E74C3C', // אדום
  '#9B59B6', // סגול
  '#3498DB', // כחול בהיר
  '#E67E22', // כתום כהה
  '#1ABC9C', // טורקיז
  '#F39C12', // צהוב
  '#C0392B', // אדום כהה
];

interface ChartDataItem {
  name: string;
  value: number;
  children?: ChartDataItem[];
  color?: string;
  description?: string;
}

interface DrilldownLevel {
  name: string;
  data: ChartDataItem[];
  parentIndex?: number;
}

interface DrilldownPieChartProps {
  title: string;
  description?: string;
  initialData: ChartDataItem[];
  onSliceClick?: (item: ChartDataItem, level: number) => Promise<ChartDataItem[]>;
}

export function DrilldownPieChart({ 
  title, 
  description,
  initialData,
  onSliceClick 
}: DrilldownPieChartProps) {
  const [drilldownStack, setDrilldownStack] = useState<DrilldownLevel[]>([
    { name: title, data: initialData }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const currentLevel = drilldownStack[drilldownStack.length - 1];
  const currentData = currentLevel.data;

  // פונקציה לטיפול בלחיצה על פרוסת עוגה
  const handlePieClick = async (entry: ChartDataItem, index: number) => {
    // אם יש children מוכנים, נשתמש בהם
    if (entry.children && entry.children.length > 0) {
      setDrilldownStack([...drilldownStack, { 
        name: entry.name, 
        data: entry.children,
        parentIndex: index 
      }]);
      return;
    }

    // אחרת, אם יש callback, נבקש נתונים חדשים
    if (onSliceClick) {
      setIsLoading(true);
      try {
        const children = await onSliceClick(entry, drilldownStack.length);
        if (children && children.length > 0) {
          setDrilldownStack([...drilldownStack, { 
            name: entry.name, 
            data: children,
            parentIndex: index 
          }]);
        }
      } catch (error) {
        console.error('Error loading drill-down data:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // פונקציה לחזרה לרמה קודמת
  const goBack = () => {
    if (drilldownStack.length > 1) {
      setDrilldownStack(drilldownStack.slice(0, -1));
    }
  };

  // פונקציה לחזרה לבית
  const goHome = () => {
    setDrilldownStack([{ name: title, data: initialData }]);
  };

  // Custom label עם סכום ואחוז
  const renderLabel = (entry: any) => {
    const percent = ((entry.value / entry.payload.total) * 100).toFixed(0);
    return `${entry.name}: ${percent}%`;
  };

  // חישוב סך הכל
  const total = currentData.reduce((sum, item) => sum + item.value, 0);
  const dataWithTotal = currentData.map(item => ({ ...item, total }));

  return (
    <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-theme-primary mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-theme-secondary">{description}</p>
        )}
      </div>

      {/* Breadcrumbs */}
      {drilldownStack.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={goHome}
            className="h-8 px-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Home className="w-4 h-4" />
          </Button>
          
          {drilldownStack.map((level, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-theme-tertiary" />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (index < drilldownStack.length - 1) {
                    setDrilldownStack(drilldownStack.slice(0, index + 1));
                  }
                }}
                disabled={index === drilldownStack.length - 1}
                className={`h-8 px-3 text-sm ${
                  index === drilldownStack.length - 1
                    ? 'text-theme-primary font-semibold'
                    : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                {level.name}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentLevel.name}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={dataWithTotal}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderLabel}
                    outerRadius={120}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={(data, index) => handlePieClick(data, index)}
                    style={{ cursor: 'pointer' }}
                    animationBegin={0}
                    animationDuration={500}
                  >
                    {dataWithTotal.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color || COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [
                      `₪${value.toLocaleString('he-IL')}`,
                      'סכום'
                    ]}
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry: any) => {
                      const percent = ((entry.payload.value / total) * 100).toFixed(1);
                      return `${value} (${percent}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Summary */}
              <div className="mt-6 pt-4 border-t border-theme">
                <div className="flex justify-between items-center">
                  <span className="text-theme-secondary text-sm">סה״כ ברמה זו:</span>
                  <span className="text-xl font-bold text-theme-primary">
                    ₪{total.toLocaleString('he-IL')}
                  </span>
                </div>
              </div>

              {/* Instruction */}
              {currentData.some(item => item.children || onSliceClick) && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                    💡 לחץ על פרוסה בגרף כדי לראות פירוט מפורט יותר
                  </p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}



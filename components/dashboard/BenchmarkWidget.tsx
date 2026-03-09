'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Users, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Comparison {
  category: string;
  myMonthlyAvg: number;
  othersMonthlyAvg: number;
  diff: number;
  diffPercent: number;
  status: 'above' | 'below' | 'similar';
}

export default function BenchmarkWidget() {
  const [data, setData] = useState<{
    comparisons: Comparison[];
    summary: { myTotalMonthly: number; othersTotalMonthly: number; userCount: number };
    hasData: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/benchmarking')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data?.hasData) return null;

  const top5 = data.comparisons.slice(0, 5);
  const aboveCount = data.comparisons.filter(c => c.status === 'above').length;
  const belowCount = data.comparisons.filter(c => c.status === 'below').length;

  return (
    <Card className="bg-white border-phi-frost">
      <CardHeader className="pb-3">
        <CardTitle className="text-phi-dark text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-phi-gold" />
          אתה מול אחרים
        </CardTitle>
        <p className="text-xs text-phi-slate">
          השוואה לממוצע {data.summary.userCount} משתמשים | 3 חודשים אחרונים
        </p>
      </CardHeader>
      <CardContent>
        {/* Overview */}
        <div className="flex gap-4 mb-4 text-center">
          <div className="flex-1 p-3 bg-phi-bg rounded-lg">
            <p className="text-xs text-phi-slate">אתה</p>
            <p className="text-lg font-bold text-phi-dark">
              ₪{data.summary.myTotalMonthly.toLocaleString('he-IL')}
            </p>
          </div>
          <div className="flex-1 p-3 bg-phi-bg rounded-lg">
            <p className="text-xs text-phi-slate">ממוצע</p>
            <p className="text-lg font-bold text-phi-dark">
              ₪{data.summary.othersTotalMonthly.toLocaleString('he-IL')}
            </p>
          </div>
        </div>

        {/* Category comparisons */}
        <div className="space-y-2">
          {top5.map((comp, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-phi-bg transition-colors">
              <div className="flex-shrink-0">
                {comp.status === 'above' ? (
                  <TrendingUp className="w-4 h-4 text-red-500" />
                ) : comp.status === 'below' ? (
                  <TrendingDown className="w-4 h-4 text-green-500" />
                ) : (
                  <Minus className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-phi-dark truncate">{comp.category}</p>
                <p className="text-xs text-phi-slate">
                  אתה: ₪{comp.myMonthlyAvg.toLocaleString('he-IL')} | ממוצע: ₪{comp.othersMonthlyAvg.toLocaleString('he-IL')}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  comp.status === 'above'
                    ? 'border-red-300 text-red-600'
                    : comp.status === 'below'
                      ? 'border-green-300 text-green-600'
                      : 'border-gray-300 text-gray-500'
                }`}
              >
                {comp.status === 'above'
                  ? `+${comp.diffPercent}%`
                  : comp.status === 'below'
                    ? `${comp.diffPercent}%`
                    : 'דומה'}
              </Badge>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-3 pt-3 border-t border-phi-frost text-xs text-phi-slate flex justify-between">
          <span>מעל הממוצע: {aboveCount} קטגוריות</span>
          <span>מתחת: {belowCount} קטגוריות</span>
        </div>
      </CardContent>
    </Card>
  );
}

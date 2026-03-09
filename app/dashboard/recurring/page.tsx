'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw, Calendar, TrendingDown, TrendingUp,
  AlertTriangle, CheckCircle, CreditCard, Repeat,
  DollarSign, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface RecurringItem {
  vendor: string;
  category: string;
  type: 'income' | 'expense';
  averageAmount: number;
  frequency: string;
  occurrences: number;
  months: string[];
  lastDate: string;
  confidence: number;
}

export default function RecurringPage() {
  const [data, setData] = useState<{
    recurring: RecurringItem[];
    totalMonthlyExpenses: number;
    totalMonthlyIncome: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recurring');
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('Error loading recurring:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-phi-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-phi-gold mx-auto mb-4" />
          <p className="text-phi-slate text-lg">מנתח הוצאות חוזרות...</p>
        </div>
      </div>
    );
  }

  const recurring = data?.recurring || [];
  const filtered = recurring.filter(r => {
    if (filter !== 'all' && r.type !== filter) return false;
    if (search && !r.vendor.toLowerCase().includes(search.toLowerCase()) &&
        !r.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const expenses = recurring.filter(r => r.type === 'expense');
  const incomes = recurring.filter(r => r.type === 'income');

  return (
    <div className="min-h-screen bg-phi-bg py-8 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-phi-dark mb-2 flex items-center gap-3">
                <span className="text-phi-gold font-serif text-5xl">φ</span>
                מנויים והוצאות חוזרות
              </h1>
              <p className="text-phi-slate">
                {recurring.length} הוצאות/הכנסות חוזרות זוהו אוטומטית
              </p>
            </div>
            <Button onClick={loadData} variant="outline" className="border-phi-gold text-phi-gold">
              <RefreshCw className="w-4 h-4 ml-2" />
              רענן
            </Button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <TrendingDown className="w-10 h-10 opacity-80" />
                <Badge className="bg-white/20 text-white border-0">{expenses.length} פריטים</Badge>
              </div>
              <p className="text-red-100 text-sm mb-1">הוצאות חוזרות / חודש</p>
              <p className="text-3xl font-bold">₪{(data?.totalMonthlyExpenses || 0).toLocaleString('he-IL')}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-10 h-10 opacity-80" />
                <Badge className="bg-white/20 text-white border-0">{incomes.length} פריטים</Badge>
              </div>
              <p className="text-green-100 text-sm mb-1">הכנסות חוזרות / חודש</p>
              <p className="text-3xl font-bold">₪{(data?.totalMonthlyIncome || 0).toLocaleString('he-IL')}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-phi-dark to-phi-slate text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <DollarSign className="w-10 h-10 opacity-80" />
                <Badge className="bg-white/20 text-white border-0">נטו</Badge>
              </div>
              <p className="text-white/70 text-sm mb-1">יתרה חוזרת / חודש</p>
              <p className="text-3xl font-bold">
                ₪{((data?.totalMonthlyIncome || 0) - (data?.totalMonthlyExpenses || 0)).toLocaleString('he-IL')}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="flex gap-1 bg-white rounded-lg p-1 border border-phi-frost">
            {[
              { id: 'all', label: 'הכל' },
              { id: 'expense', label: 'הוצאות' },
              { id: 'income', label: 'הכנסות' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filter === f.id
                    ? 'bg-phi-gold text-white'
                    : 'text-phi-slate hover:bg-phi-bg'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-phi-slate" />
            <input
              type="text"
              placeholder="חפש ספק או קטגוריה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-sm border border-phi-frost rounded-lg bg-white"
            />
          </div>
        </div>

        {/* Recurring Items List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border-phi-frost">
            <CardHeader>
              <CardTitle className="text-phi-dark flex items-center gap-2">
                <Repeat className="w-5 h-5 text-phi-gold" />
                רשימת הוצאות/הכנסות חוזרות ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filtered.length > 0 ? (
                <div className="space-y-3">
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-phi-slate border-b border-phi-frost">
                    <div className="col-span-3">ספק</div>
                    <div className="col-span-2">קטגוריה</div>
                    <div className="col-span-2 text-center">סכום</div>
                    <div className="col-span-1 text-center">תדירות</div>
                    <div className="col-span-2 text-center">חודשים</div>
                    <div className="col-span-2 text-center">ביטחון</div>
                  </div>

                  {filtered.map((item, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border transition-colors ${
                        item.type === 'income'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-phi-frost hover:border-phi-gold/40'
                      }`}
                    >
                      {/* Desktop */}
                      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            {item.type === 'income' ? (
                              <TrendingUp className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <CreditCard className="w-4 h-4 text-red-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-phi-dark truncate">{item.vendor}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className={`font-bold ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {item.type === 'income' ? '+' : '-'}₪{item.averageAmount.toLocaleString('he-IL')}
                          </span>
                        </div>
                        <div className="col-span-1 text-center">
                          <Badge variant="secondary" className="text-[10px]">{item.frequency}</Badge>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm text-phi-slate">{item.occurrences} מתוך 6</span>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-1">
                            <Progress
                              value={item.confidence * 100}
                              className="h-2 flex-1 [&>div]:bg-phi-gold"
                            />
                            <span className="text-xs text-phi-slate w-8">
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mobile */}
                      <div className="md:hidden">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            {item.type === 'income' ? (
                              <TrendingUp className="w-4 h-4 text-green-600" />
                            ) : (
                              <CreditCard className="w-4 h-4 text-red-500" />
                            )}
                            <span className="font-medium text-phi-dark">{item.vendor}</span>
                          </div>
                          <span className={`font-bold ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {item.type === 'income' ? '+' : '-'}₪{item.averageAmount.toLocaleString('he-IL')}
                          </span>
                        </div>
                        <div className="flex gap-2 text-xs text-phi-slate">
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{item.frequency}</Badge>
                          <span>{item.occurrences} חודשים</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Repeat className="w-16 h-16 text-phi-frost mx-auto mb-4" />
                  <p className="text-phi-slate mb-2">
                    {search ? 'לא נמצאו תוצאות' : 'אין מספיק נתונים לזיהוי הוצאות חוזרות'}
                  </p>
                  <p className="text-sm text-phi-slate/70">
                    נדרשים לפחות 2 חודשים של נתונים לזיהוי דפוסים
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Savings Tip */}
        {expenses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <Card className="bg-gradient-to-r from-phi-dark to-phi-slate text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-phi-gold/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-phi-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">טיפ לחיסכון</h3>
                    <p className="text-white/80">
                      יש לך ₪{(data?.totalMonthlyExpenses || 0).toLocaleString('he-IL')} בהוצאות חוזרות חודשיות.
                      {(data?.totalMonthlyExpenses || 0) > 3000
                        ? ` בדוק אם יש מנויים שאתה לא משתמש בהם — ביטול של אחד או שניים יכול לחסוך מאות שקלים בשנה.`
                        : ` ההוצאות החוזרות שלך בשליטה. המשך לעקוב!`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, Calendar, AlertCircle, 
  RefreshCw, Sparkles, DollarSign, Clock,
  ChevronDown, ChevronUp, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BudgetCategoryCard from '@/components/budget/BudgetCategoryCard';
import BudgetFrequencyCard from '@/components/budget/BudgetFrequencyCard';

interface Budget {
  id: string;
  month: string;
  total_budget: number;
  total_spent: number;
  daily_budget: number;
  weekly_budget: number;
  daily_spent: number;
  weekly_spent: number;
  days_passed: number;
  days_remaining: number;
  status: string;
  savings_goal: number;
}

export default function BudgetPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7));
  const [budget, setBudget] = useState<Budget | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [frequencies, setFrequencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
  const [showFrequencies, setShowFrequencies] = useState(true);

  useEffect(() => {
    checkIfCanCreate();
    loadBudget();
  }, [currentMonth]);

  const checkIfCanCreate = async () => {
    try {
      const response = await fetch('/api/budget/analyze-history');
      if (response.ok) {
        const data = await response.json();
        setCanCreate(data.canCreateBudget);
      }
    } catch (error) {
      console.error('Error checking budget eligibility:', error);
    }
  };

  const loadBudget = async () => {
    setLoading(true);
    try {
      // TODO: יצירת API לשליפת תקציב קיים
      // לעכשיו נדמה שאין תקציב
      setBudget(null);
      setCategories([]);
      setFrequencies([]);
    } catch (error) {
      console.error('Error loading budget:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSmartBudget = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/budget/create-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          savingsGoalPercentage: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('✅ תקציב חכם נוצר בהצלחה!');
        loadBudget();
      } else {
        const error = await response.json();
        alert(`❌ ${error.error || 'שגיאה ביצירת תקציב'}`);
      }
    } catch (error) {
      console.error('Error creating budget:', error);
      alert('❌ שגיאה ביצירת תקציב');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">טוען תקציב...</p>
        </div>
      </div>
    );
  }

  // אם אין תקציב - מסך יצירה
  if (!budget) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-950 py-12 px-4" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-2xl">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-4">
              תקציב חכם 🎯
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              בואו ניצור תקציב מותאם אישית בהתבסס על ההיסטוריה שלך
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-800"
          >
            {canCreate ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full mb-6">
                  <TrendingUp className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  מוכן ליצירה! 🎉
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                  יש לנו מספיק נתונים כדי ליצור עבורך תקציב חכם ומותאם אישית.
                  התקציב יתבסס על:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                    <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">3 חודשים אחרונים</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      ניתוח מעמיק של ההוצאות שלך
                    </p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
                    <Target className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">מטרות אישיות</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      התאמה למטרות החיסכון שלך
                    </p>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
                    <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">מסוגלות פיננסית</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      בהתאם להכנסה ולמצב הכלכלי
                    </p>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6">
                    <Sparkles className="w-8 h-8 text-orange-600 dark:text-orange-400 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">המלצות AI</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      יעוץ חכם ומותאם אישית
                    </p>
                  </div>
                </div>

                <Button
                  onClick={createSmartBudget}
                  disabled={creating}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg px-10 h-14 shadow-xl"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-5 h-5 ml-2 animate-spin" />
                      יוצר תקציב חכם...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 ml-2" />
                      צור תקציב חכם
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 dark:bg-yellow-900 rounded-full mb-6">
                  <AlertCircle className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  עוד קצת נתונים...
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                  כדי ליצור תקציב חכם ומדויק, נדרשות לפחות <strong>30 תנועות</strong> מ-3 החודשים האחרונים.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 max-w-md mx-auto">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    💡 <strong>טיפ:</strong> המשך לרשום הוצאות או העלה דוחות בנק כדי שנוכל ליצור עבורך תקציב מותאם אישית!
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // אם יש תקציב - מסך ניהול
  const percentageUsed = budget.total_budget > 0 ? (budget.total_spent / budget.total_budget) * 100 : 0;
  const dailyPercentage = budget.daily_budget > 0 ? (budget.daily_spent / budget.daily_budget) * 100 : 0;
  const weeklyPercentage = budget.weekly_budget > 0 ? (budget.weekly_spent / budget.weekly_budget) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-12 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-3 flex items-center gap-3">
                <Wallet className="w-12 h-12 text-blue-600" />
                התקציב שלי
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                מעקב בזמן אמת אחר ההוצאות והתקציב
              </p>
            </div>
            
            <Select value={currentMonth} onValueChange={setCurrentMonth}>
              <SelectTrigger className="w-48 h-12 text-lg font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* TODO: Generate months dynamically */}
                <SelectItem value={currentMonth}>
                  {new Date(currentMonth + '-01').toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Budget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={`shadow-xl border-2 ${
              percentageUsed >= 100 ? 'border-red-500' : 
              percentageUsed >= 90 ? 'border-yellow-500' : 
              'border-green-500'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Wallet className="w-10 h-10 text-blue-600" />
                  <Badge variant="outline" className={
                    percentageUsed >= 100 ? 'border-red-500 text-red-700' :
                    percentageUsed >= 90 ? 'border-yellow-500 text-yellow-700' :
                    'border-green-500 text-green-700'
                  }>
                    {Math.round(percentageUsed)}%
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">תקציב חודשי</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                  ₪{budget.total_budget.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">
                  הוצאו: ₪{budget.total_spent.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Daily Budget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="w-10 h-10 text-purple-600" />
                  <Badge variant="outline">יומי</Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">תקציב יומי</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                  ₪{budget.daily_budget?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-gray-500">
                  הוצאו היום: ₪{budget.daily_spent?.toLocaleString() || 0}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Weekly Budget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Calendar className="w-10 h-10 text-orange-600" />
                  <Badge variant="outline">שבועי</Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">תקציב שבועי</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                  ₪{budget.weekly_budget?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-gray-500">
                  הוצאו השבוע: ₪{budget.weekly_spent?.toLocaleString() || 0}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Days Remaining */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="shadow-xl bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <TrendingUp className="w-10 h-10" />
                  <Badge className="bg-white/20 text-white border-0">חיסכון</Badge>
                </div>
                <p className="text-sm text-green-100 mb-1">מטרת חיסכון</p>
                <p className="text-3xl font-black mb-2">
                  ₪{budget.savings_goal?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-green-100">
                  {budget.days_remaining || 0} ימים נשארו
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Budget by Frequency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              תקציב לפי סוג הוצאה
            </h2>
            <Button
              variant="ghost"
              onClick={() => setShowFrequencies(!showFrequencies)}
            >
              {showFrequencies ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
          
          <AnimatePresence>
            {showFrequencies && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {frequencies.map((freq, index) => (
                  <BudgetFrequencyCard key={freq.id} {...freq} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Budget by Category */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              תקציב לפי קטגוריה
            </h2>
            <Button
              variant="ghost"
              onClick={() => setShowCategories(!showCategories)}
            >
              {showCategories ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
          
          <AnimatePresence>
            {showCategories && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {categories.map((category, index) => (
                  <BudgetCategoryCard key={category.id} {...category} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}


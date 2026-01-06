'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, TrendingUp, Calendar, AlertCircle, 
  RefreshCw, Sparkles, DollarSign, Clock,
  ChevronDown, ChevronUp, Target, Users, Home,
  CreditCard, ShoppingBag, Lock, Zap, Star,
  PieChart, BarChart3, ArrowRight, AlertTriangle,
  CheckCircle, FileText, MessageCircle, XCircle
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface MissingDataItem {
  field: string;
  label: string;
  importance: 'critical' | 'important' | 'nice_to_have';
}

interface BudgetData {
  budget: any;
  categories: any[];
  frequencies: any[];
  vendorBreakdown: any[];
  expenseTypes: {
    fixed: { total: number; avgMonthly: number; categories: string[] };
    variable: { total: number; avgMonthly: number; categories: string[] };
    special: { total: number; avgMonthly: number; categories: string[] };
  };
  summary: {
    avgMonthlyIncome: number;
    avgMonthlyExpenses: number;
    avgMonthlySavings: number;
    monthsAnalyzed: number;
    transactionsCount: number;
    documentsCount: number;
    goalsCount: number;
  };
  profileContext: {
    numPeople: number;
    housingType: string | null;
    incomeLevel: string | null;
    hasProfile: boolean;
    profileCompleted: boolean;
  };
  profile: {
    maritalStatus: string;
    childrenCount: number;
    city: string;
    totalMonthlyIncome: number;
    totalFixedExpenses: number;
    ownsHome: boolean;
    ownsCar: boolean;
    totalDebt: number;
    currentSavings: number;
  } | null;
  goals: any[];
  missingData: MissingDataItem[];
  profileCompleteness: number;
  currentPhase: string;
}

export default function BudgetPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7));
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'vendors'>('overview');

  useEffect(() => {
    loadBudget();
  }, [currentMonth]);

  const loadBudget = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/budget?month=${currentMonth}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
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
          savingsGoalPercentage: data?.profileContext?.incomeLevel === 'גבוהה' ? 15 : 10
        })
      });

      if (response.ok) {
        loadBudget();
      } else {
        const error = await response.json();
        alert(`❌ ${error.error || 'שגיאה ביצירת תקציב'}`);
      }
    } catch (error) {
      console.error('Error creating budget:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-phi-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-phi-gold mx-auto mb-4"></div>
          <p className="text-phi-slate text-lg">טוען תקציב...</p>
        </div>
      </div>
    );
  }

  const hasBudget = data?.budget;
  const { summary, profileContext, expenseTypes, vendorBreakdown, categories, missingData, profileCompleteness, currentPhase, goals } = data || {};

  // נתונים חסרים קריטיים
  const criticalMissing = missingData?.filter(m => m.importance === 'critical') || [];
  const importantMissing = missingData?.filter(m => m.importance === 'important') || [];
  const hasCriticalMissing = criticalMissing.length > 0;

    return (
    <div className="min-h-screen bg-phi-bg py-8 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Missing Data Alert */}
        {hasCriticalMissing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800 mb-2">נתונים חסרים לבניית תקציב</h3>
                    <p className="text-red-700 text-sm mb-4">
                      כדי לבנות תקציב מדויק, צריך להשלים את המידע הבא:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                      {criticalMissing.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-red-700">
                          <XCircle className="w-4 h-4 text-red-500" />
                          {item.label}
                        </div>
                      ))}
                      {importantMissing.slice(0, 4).map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-orange-700">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          {item.label}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {!profileContext?.hasProfile && (
                        <Link href="/reflection">
                          <Button className="bg-red-600 hover:bg-red-700 text-white">
                            <FileText className="w-4 h-4 ml-2" />
                            מלא שאלון שיקוף
                          </Button>
                        </Link>
                      )}
                      {missingData?.some(m => m.field === 'documents') && (
                        <Button variant="outline" className="border-red-300 text-red-700">
                          <MessageCircle className="w-4 h-4 ml-2" />
                          שלח מסמכים ב-WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Profile Completeness */}
        {profileCompleteness !== undefined && profileCompleteness < 100 && !hasCriticalMissing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-yellow-800">השלמת פרופיל</span>
                      <span className="text-sm font-bold text-yellow-800">{profileCompleteness}%</span>
                </div>
                    <Progress value={profileCompleteness} className="h-2 [&>div]:bg-yellow-500" />
                  </div>
                  <Link href="/reflection">
                    <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-700">
                      השלם
                    </Button>
                  </Link>
                  </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Current Phase Banner */}
        {currentPhase && currentPhase !== 'monitoring' && currentPhase !== 'budget' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <Card className="bg-phi-dark text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-serif text-phi-gold">φ</span>
                    <div>
                      <span className="text-sm text-gray-300">שלב נוכחי:</span>
                      <span className="font-bold mr-2">{getPhaseLabel(currentPhase)}</span>
                  </div>
                  </div>
                  <Button size="sm" className="bg-phi-gold hover:bg-phi-coral text-white">
                    <MessageCircle className="w-4 h-4 ml-2" />
                    המשך ב-WhatsApp
                </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-phi-dark mb-2 flex items-center gap-3">
                <span className="text-phi-gold font-serif text-5xl">φ</span>
                תקציב חכם
              </h1>
              <p className="text-phi-slate">
                מבוסס על {summary?.monthsAnalyzed || 0} חודשים • {summary?.transactionsCount || 0} תנועות
              </p>
            </div>
            
            <div className="flex gap-3">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="px-4 py-2 border border-phi-frost rounded-lg bg-white text-phi-dark"
              >
                {generateMonthOptions().map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              
              {!hasBudget && (
                <Button
                  onClick={createSmartBudget}
                  disabled={creating}
                  className="bg-phi-gold hover:bg-phi-coral text-white"
                >
                  {creating ? (
                    <><RefreshCw className="w-4 h-4 ml-2 animate-spin" /> יוצר...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 ml-2" /> צור תקציב חכם</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Profile Context Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
        >
          <Card className={`bg-white border-phi-frost ${!profileContext?.hasProfile ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profileContext?.hasProfile ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Users className={`w-5 h-5 ${profileContext?.hasProfile ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm text-phi-slate">נפשות</p>
                  {profileContext?.hasProfile ? (
                    <p className="text-xl font-bold text-phi-dark">{profileContext?.numPeople || 1}</p>
                  ) : (
                    <p className="text-sm text-red-500">חסר</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white border-phi-frost ${!profileContext?.housingType ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profileContext?.housingType ? 'bg-purple-100' : 'bg-gray-100'}`}>
                  <Home className={`w-5 h-5 ${profileContext?.housingType ? 'text-purple-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm text-phi-slate">מגורים</p>
                  {profileContext?.housingType ? (
                    <p className="text-xl font-bold text-phi-dark">{profileContext.housingType}</p>
                  ) : (
                    <p className="text-sm text-red-500">חסר</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white border-phi-frost ${!profileContext?.incomeLevel ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profileContext?.incomeLevel ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <TrendingUp className={`w-5 h-5 ${profileContext?.incomeLevel ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm text-phi-slate">רמת הכנסה</p>
                  {profileContext?.incomeLevel ? (
                    <p className="text-xl font-bold text-phi-dark">{profileContext.incomeLevel}</p>
                  ) : (
                    <p className="text-sm text-red-500">חסר</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-phi-frost">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-phi-gold/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-phi-gold" />
                </div>
                <div>
                  <p className="text-sm text-phi-slate">יעדים</p>
                  <p className="text-xl font-bold text-phi-dark">
                    {goals?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white border-phi-frost ${!summary?.documentsCount ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${summary?.documentsCount ? 'bg-teal-100' : 'bg-gray-100'}`}>
                  <FileText className={`w-5 h-5 ${summary?.documentsCount ? 'text-teal-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm text-phi-slate">מסמכים</p>
                  {summary?.documentsCount ? (
                    <p className="text-xl font-bold text-phi-dark">{summary.documentsCount}</p>
                  ) : (
                    <p className="text-sm text-red-500">חסר</p>
                  )}
                </div>
              </div>
              </CardContent>
            </Card>
          </motion.div>

        {/* Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-10 h-10 opacity-80" />
                <Badge className="bg-white/20 text-white border-0">ממוצע חודשי</Badge>
              </div>
              <p className="text-green-100 text-sm mb-1">הכנסות</p>
              <p className="text-3xl font-bold">₪{(summary?.avgMonthlyIncome || 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <CreditCard className="w-10 h-10 opacity-80" />
                <Badge className="bg-white/20 text-white border-0">ממוצע חודשי</Badge>
              </div>
              <p className="text-red-100 text-sm mb-1">הוצאות</p>
              <p className="text-3xl font-bold">₪{(summary?.avgMonthlyExpenses || 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className={`border-0 ${(summary?.avgMonthlySavings || 0) >= 0 
            ? 'bg-gradient-to-br from-phi-mint to-teal-500 text-white' 
            : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                <Wallet className="w-10 h-10 opacity-80" />
                <Badge className="bg-white/20 text-white border-0">ממוצע חודשי</Badge>
                </div>
              <p className="text-white/80 text-sm mb-1">יתרה</p>
              <p className="text-3xl font-bold">₪{(summary?.avgMonthlySavings || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
          </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-phi-frost">
          {[
            { id: 'overview', label: 'סקירה כללית', icon: PieChart },
            { id: 'categories', label: 'קטגוריות', icon: BarChart3 },
            { id: 'vendors', label: 'ממוצע שורת הוצאה', icon: ShoppingBag },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-phi-gold text-phi-gold'
                  : 'border-transparent text-phi-slate hover:text-phi-dark'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
          <motion.div
              key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* קבועות */}
              <Card className="bg-white border-phi-frost">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-phi-dark">הוצאות קבועות</CardTitle>
                      <p className="text-sm text-phi-slate">התחייבויות חודשיות</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-phi-dark mb-4">
                    ₪{(expenseTypes?.fixed?.avgMonthly || 0).toLocaleString()}
                    <span className="text-sm font-normal text-phi-slate">/חודש</span>
                  </p>
                  <div className="space-y-2">
                    {expenseTypes?.fixed?.categories?.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-phi-slate">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        {cat}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* משתנות */}
              <Card className="bg-white border-phi-frost">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-phi-dark">הוצאות משתנות</CardTitle>
                      <p className="text-sm text-phi-slate">ניתנות לשינוי</p>
                    </div>
                </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-phi-dark mb-4">
                    ₪{(expenseTypes?.variable?.avgMonthly || 0).toLocaleString()}
                    <span className="text-sm font-normal text-phi-slate">/חודש</span>
                  </p>
                  <div className="space-y-2">
                    {expenseTypes?.variable?.categories?.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-phi-slate">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        {cat}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* מיוחדות */}
              <Card className="bg-white border-phi-frost">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Star className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-phi-dark">הוצאות מיוחדות</CardTitle>
                      <p className="text-sm text-phi-slate">חד פעמיות</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-phi-dark mb-4">
                    ₪{(expenseTypes?.special?.avgMonthly || 0).toLocaleString()}
                    <span className="text-sm font-normal text-phi-slate">/חודש</span>
                  </p>
                  <div className="space-y-2">
                    {expenseTypes?.special?.categories?.slice(0, 5).map((cat, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-phi-slate">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        {cat}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-white border-phi-frost">
                <CardHeader>
                  <CardTitle className="text-phi-dark">תקציב לפי קטגוריות</CardTitle>
                </CardHeader>
                <CardContent>
                  {categories && categories.length > 0 ? (
                    <div className="space-y-4">
                      {categories.map((cat, i) => {
                        const percentage = cat.allocated_amount > 0 
                          ? Math.min(100, (cat.spent_amount / cat.allocated_amount) * 100) 
                          : 0;
                        const isOver = percentage > 100;
                        
                        return (
                          <div key={i} className="p-4 rounded-lg bg-phi-bg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-phi-dark">{cat.category_name}</span>
                              <div className="text-left">
                                <span className={`font-bold ${isOver ? 'text-red-600' : 'text-phi-dark'}`}>
                                  ₪{(cat.spent_amount || 0).toLocaleString()}
                                </span>
                                <span className="text-phi-slate"> / ₪{(cat.allocated_amount || 0).toLocaleString()}</span>
                              </div>
                            </div>
                            <Progress 
                              value={Math.min(percentage, 100)} 
                              className={`h-2 ${isOver ? '[&>div]:bg-red-500' : '[&>div]:bg-phi-mint'}`}
                            />
                            <div className="flex justify-between mt-1 text-xs text-phi-slate">
                              <span>{Math.round(percentage)}% נוצל</span>
                              <span className={isOver ? 'text-red-600' : 'text-green-600'}>
                                {isOver 
                                  ? `חריגה של ₪${((cat.spent_amount || 0) - (cat.allocated_amount || 0)).toLocaleString()}`
                                  : `נותרו ₪${((cat.allocated_amount || 0) - (cat.spent_amount || 0)).toLocaleString()}`
                                }
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart3 className="w-16 h-16 text-phi-frost mx-auto mb-4" />
                      <p className="text-phi-slate mb-4">אין קטגוריות תקציב עדיין</p>
                      <Button onClick={createSmartBudget} disabled={creating} className="bg-phi-gold text-white">
                        <Sparkles className="w-4 h-4 ml-2" />
                        צור תקציב חכם
                      </Button>
                    </div>
                  )}
              </CardContent>
            </Card>
          </motion.div>
          )}

          {activeTab === 'vendors' && (
            <motion.div
              key="vendors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-white border-phi-frost">
                <CardHeader>
                  <CardTitle className="text-phi-dark flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-phi-gold" />
                    ממוצע שורת הוצאה (Top 20)
                  </CardTitle>
                  <p className="text-sm text-phi-slate">ממוצע חודשי לפי ספק/מקום</p>
                </CardHeader>
                <CardContent>
                  {vendorBreakdown && vendorBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {vendorBreakdown.map((vendor, i) => {
                        const maxAmount = vendorBreakdown[0]?.avgMonthly || 1;
                        const percentage = (vendor.avgMonthly / maxAmount) * 100;
                        
                        return (
                          <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-phi-bg transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-phi-frost flex items-center justify-center text-phi-slate font-bold">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-phi-dark truncate max-w-[200px]">
                                  {vendor.vendor}
                                </span>
                                <span className="font-bold text-phi-dark">
                                  ₪{vendor.avgMonthly.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-phi-frost rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-phi-gold rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-phi-slate whitespace-nowrap">
                                  {vendor.monthlyCount}x/חודש
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {vendor.category}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <ShoppingBag className="w-16 h-16 text-phi-frost mx-auto mb-4" />
                      <p className="text-phi-slate">אין מספיק נתונים</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recommendations */}
        {hasBudget && data?.budget?.confidence && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <Card className="bg-gradient-to-r from-phi-dark to-phi-slate text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-phi-gold/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-phi-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">המלצת φ</h3>
                    <p className="text-white/80">
                      {(summary?.avgMonthlySavings || 0) < 0 
                        ? 'ההוצאות גבוהות מההכנסות. מומלץ לבדוק את ההוצאות המשתנות ולחפש דרכים לחסוך.'
                        : (expenseTypes?.variable?.avgMonthly || 0) > (expenseTypes?.fixed?.avgMonthly || 0)
                          ? 'ההוצאות המשתנות שלך גבוהות. יש פוטנציאל משמעותי לחיסכון!'
                          : 'מצב טוב! רוב ההוצאות קבועות ויציבות. המשך לעקוב אחרי התקציב.'
                      }
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-sm text-white/60">רמת ביטחון:</span>
                      <div className="flex-1 max-w-32 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-phi-gold rounded-full"
                          style={{ width: `${(data?.budget?.confidence || 0.7) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">
                        {Math.round((data?.budget?.confidence || 0.7) * 100)}%
                      </span>
                    </div>
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

function generateMonthOptions() {
  const months = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = date.toISOString().substring(0, 7);
    const label = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }
  
  return months;
}

function getPhaseLabel(phase: string): string {
  const phases: Record<string, string> = {
    'reflection': '🪞 שיקוף',
    'document_scanning': '📄 סריקת מסמכים',
    'classification_income': '💰 סיווג הכנסות',
    'classification_expense': '💸 סיווג הוצאות',
    'behavior': '📊 ניתוח התנהגות',
    'goals': '🎯 הגדרת יעדים',
    'budget': '💼 תקציב',
    'monitoring': '👁️ מעקב',
    'unknown': '❓ לא ידוע'
  };
  return phases[phase] || phase;
}

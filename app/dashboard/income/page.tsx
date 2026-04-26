"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

import {
  Plus,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Loader2,
  BarChart3,
  List,
  Grid3x3,
} from 'lucide-react';
import WhatsAppBanner from '@/components/dashboard/WhatsAppBanner';
import ConversationalIncomeWizard from '@/components/income/ConversationalIncomeWizard';
import IncomeTable from '@/components/income/IncomeTable';
import { SmartIncomeCalculator } from '@/components/income/SmartIncomeCalculator';
import AdvancedTransactionsTable from '@/components/shared/AdvancedTransactionsTable';
import { StatCard, PageWrapper, PageHeader } from '@/components/ui/design-system';

// ============================================================================
// טיפוסים
// ============================================================================

interface IncomeSource {
  id: string;
  source_name: string;
  employment_type: string;
  gross_amount: number | null;
  net_amount: number | null;
  actual_bank_amount: number | null;
  payment_frequency: string;
  is_primary: boolean;
  active: boolean;
  employer_name?: string;
  created_at: string;
}

interface Stats {
  total: number;
  totalMonthlyIncome: number;
  primaryCount: number;
  typeBreakdown: Record<string, number>;
  totalMonthlyIncomeFromTransactions?: number;
  transactionIncomeCount?: number;
  totalCombinedIncome?: number;
}

// ============================================================================
// קומפוננטה ראשית
// ============================================================================

export default function IncomePage() {
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [transactionIncome, setTransactionIncome] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeSource | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [isFallbackMonth, setIsFallbackMonth] = useState(false);
  const [hasUserPickedMonth, setHasUserPickedMonth] = useState(false);

  useEffect(() => {
    loadIncome();
  }, [selectedMonth]);

  const loadIncome = async () => {
    setLoading(true);
    try {
      // Only pass month explicitly if user manually picked one — otherwise let
      // the API fall back to the latest month with data.
      const url = hasUserPickedMonth
        ? `/api/income/list?active=true&month=${selectedMonth}`
        : `/api/income/list?active=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setIncomeSources(data.incomeSources || []);
        setTransactionIncome(data.transactionIncome || []);
        setStats(data.stats || null);
        // Sync month picker with what the API actually used
        if (data.activeMonth && data.activeMonth !== selectedMonth) {
          setSelectedMonth(data.activeMonth);
        }
        setIsFallbackMonth(!!data.isFallbackMonth);
      }
    } catch (error) {
      console.error('Error loading income:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper maxWidth="wide">
      <WhatsAppBanner message="רוצה להוסיף מקור הכנסה? לעדכן תלוש משכורת? דבר עם הבוט! 💼" />

      {/* Month Selector */}
      <div className="flex flex-col items-center gap-1 mb-4">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => {
              const d = new Date(selectedMonth + '-01');
              d.setMonth(d.getMonth() - 1);
              setSelectedMonth(d.toISOString().substring(0, 7));
              setHasUserPickedMonth(true);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
          >
            ←
          </button>
          <span className="text-lg font-semibold text-gray-800 min-w-[140px] text-center">
            {new Date(selectedMonth + '-01').toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => {
              const d = new Date(selectedMonth + '-01');
              d.setMonth(d.getMonth() + 1);
              const next = d.toISOString().substring(0, 7);
              if (next <= new Date().toISOString().substring(0, 7)) {
                setSelectedMonth(next);
                setHasUserPickedMonth(true);
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
            disabled={selectedMonth >= new Date().toISOString().substring(0, 7)}
          >
            →
          </button>
        </div>
        {isFallbackMonth && (
          <p className="text-xs text-gray-500">החודש הנוכחי ריק — מציג את החודש האחרון עם דאטה</p>
        )}
      </div>
      
      {/* Header */}
      <PageHeader
        title="ההכנסות שלי"
        subtitle="נהל את כל מקורות ההכנסה שלך במקום אחד"
        action={
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            {incomeSources.length > 0 && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-2 rounded-md transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={loadIncome}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Add Income */}
            <Button
              onClick={() => setShowWizard(true)}
              className="bg-phi-mint hover:bg-phi-mint/90 text-white"
            >
              <Plus className="w-4 h-4 ml-2" />
              הוסף הכנסה
            </Button>
          </div>
        }
      />

      {loading && incomeSources.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-phi-gold animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          {stats && (incomeSources.length > 0 || transactionIncome.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard
                label="הכנסה ממקורות קבועים"
                value={SmartIncomeCalculator.formatAmount(stats.totalMonthlyIncome)}
                icon={DollarSign}
                tone="balance"
              />
              <StatCard
                label="הכנסה מתנועות החודש"
                value={`₪${stats.totalMonthlyIncomeFromTransactions?.toLocaleString('he-IL') || '0'}`}
                subtitle={`${stats.transactionIncomeCount || 0} תנועות`}
                icon={TrendingUp}
                tone="income"
              />
              <StatCard
                label="סה״כ הכנסה כוללת"
                value={`₪${stats.totalCombinedIncome?.toLocaleString('he-IL') || '0'}`}
                icon={BarChart3}
                tone="income"
              />
              <StatCard
                label="מספר מקורות"
                value={stats.total.toString()}
                subtitle="מקורות קבועים"
                icon={BarChart3}
                tone="neutral"
              />
            </div>
          )}

          {/* הכנסות מתנועות סרוקות - טבלה מתקדמת */}
          {transactionIncome.length > 0 && (
            <div className="mb-8">
              <AdvancedTransactionsTable
                transactions={transactionIncome}
                title="💰 הכנסות מתנועות סרוקות"
                type="income"
                showCategory={true}
                showPaymentMethod={false}
              />
            </div>
          )}

          {/* Main Content */}
          {incomeSources.length === 0 && transactionIncome.length === 0 ? (
            <EmptyState onAddIncome={() => setShowWizard(true)} />
          ) : incomeSources.length > 0 ? (
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-4">💼 מקורות הכנסה קבועים</h3>
              <IncomeTable
                incomeSources={incomeSources}
                onRefresh={loadIncome}
                onEdit={(income) => {
                  setEditingIncome(income);
                  setShowWizard(true);
                }}
              />
            </>
          ) : null}
        </>
      )}

      {/* Wizard Modal */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowWizard(false);
              setEditingIncome(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <ConversationalIncomeWizard
                editMode={!!editingIncome}
                incomeId={editingIncome?.id}
                initialData={editingIncome ? {
                  source_name: editingIncome.source_name,
                  employment_type: editingIncome.employment_type,
                  actual_bank_amount: editingIncome.actual_bank_amount,
                  gross_amount: editingIncome.gross_amount,
                  net_amount: editingIncome.net_amount,
                  payment_frequency: editingIncome.payment_frequency,
                  employer_name: editingIncome.employer_name,
                  is_primary: editingIncome.is_primary,
                } : {}}
                onSuccess={() => {
                  setShowWizard(false);
                  setEditingIncome(null);
                  loadIncome();
                }}
                onCancel={() => {
                  setShowWizard(false);
                  setEditingIncome(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}

// ============================================================================
// קומפוננטות עזר
// ============================================================================

function EmptyState({ onAddIncome }: { onAddIncome: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 bg-white rounded-xl border border-dashed border-phi-gold/40"
    >
      <motion.div 
        className="w-24 h-24 rounded-full bg-white shadow-lg flex items-center justify-center mx-auto mb-6"
        animate={{ 
          scale: [1, 1.05, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <DollarSign className="w-12 h-12 text-phi-dark" />
      </motion.div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        עדיין לא הוספת הכנסות
      </h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        בואו נתחיל! הוספת מקורות הכנסה תעזור לנו לתת לך תובנות טובות יותר ולנהל את התקציב שלך בצורה חכמה.
      </p>
      
      {/* Benefits List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8 text-right">
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-blue-100">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-semibold text-gray-900 mb-1">ניתוח חכם</h3>
          <p className="text-sm text-gray-600">נחשב אוטומטית את הניכויים והמסים</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-purple-100">
          <div className="text-2xl mb-2">💡</div>
          <h3 className="font-semibold text-gray-900 mb-1">תובנות מותאמות</h3>
          <p className="text-sm text-gray-600">נזהה הזדמנויות לחסוך כסף</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-green-100">
          <div className="text-2xl mb-2">🎯</div>
          <h3 className="font-semibold text-gray-900 mb-1">תכנון מדויק</h3>
          <p className="text-sm text-gray-600">נבנה תקציב חכם בהתאם להכנסות</p>
        </div>
      </div>

      <Button
        onClick={onAddIncome}
        size="lg"
        className="bg-phi-mint hover:bg-phi-mint/90 text-white"
      >
        <Plus className="w-5 h-5 ml-2" />
        הוסף הכנסה ראשונה
      </Button>
      <p className="text-sm text-gray-500 mt-4">
        זה לוקח רק דקה ⏱️
      </p>
    </motion.div>
  );
}

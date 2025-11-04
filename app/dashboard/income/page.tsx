"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import ConversationalIncomeWizard from '@/components/income/ConversationalIncomeWizard';
import IncomeTable from '@/components/income/IncomeTable';
import { SmartIncomeCalculator } from '@/components/income/SmartIncomeCalculator';

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
}

// ============================================================================
// קומפוננטה ראשית
// ============================================================================

export default function IncomePage() {
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    loadIncome();
  }, []);

  const loadIncome = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/income/list?active=true');
      const data = await response.json();

      if (data.success) {
        setIncomeSources(data.incomeSources || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error loading income:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            💰 ההכנסות שלי
          </h1>
          <p className="text-gray-600">
            נהל את כל מקורות ההכנסה שלך במקום אחד
          </p>
        </div>

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
            className="bg-[#7ED957] hover:bg-[#6BC847] text-white"
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף הכנסה
          </Button>
        </div>
      </div>

      {loading && incomeSources.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          {stats && incomeSources.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatsCard
                title="סה״כ הכנסה חודשית"
                value={SmartIncomeCalculator.formatAmount(stats.totalMonthlyIncome)}
                icon={DollarSign}
                color="blue"
              />
              <StatsCard
                title="מספר מקורות"
                value={stats.total.toString()}
                icon={BarChart3}
                color="green"
              />
              <StatsCard
                title="שיעור צמיחה"
                value="+8%"
                subtitle="לעומת חודש שעבר"
                icon={TrendingUp}
                color="purple"
              />
            </div>
          )}

          {/* Main Content */}
          {incomeSources.length === 0 ? (
            <EmptyState onAddIncome={() => setShowWizard(true)} />
          ) : (
            <IncomeTable
              incomeSources={incomeSources}
              onRefresh={loadIncome}
              onEdit={(income) => {
                // TODO: implement edit
                alert('עריכה תתווסף בקרוב');
              }}
            />
          )}
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
            onClick={() => setShowWizard(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <ConversationalIncomeWizard
                onSuccess={() => {
                  setShowWizard(false);
                  loadIncome();
                }}
                onCancel={() => setShowWizard(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// קומפוננטות עזר
// ============================================================================

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  color?: 'blue' | 'green' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl ${colors[color]} flex items-center justify-center`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onAddIncome }: { onAddIncome: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20 bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl"
    >
      <div className="w-24 h-24 rounded-full bg-white shadow-lg flex items-center justify-center mx-auto mb-6">
        <DollarSign className="w-12 h-12 text-[#3A7BD5]" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">
        עדיין לא הוספת הכנסות
      </h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        בואו נתחיל! הוספת מקורות הכנסה תעזור לנו לתת לך תובנות טובות יותר ולנהל את התקציב שלך בצורה חכמה.
      </p>
      <Button
        onClick={onAddIncome}
        size="lg"
        className="bg-[#7ED957] hover:bg-[#6BC847] text-white"
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

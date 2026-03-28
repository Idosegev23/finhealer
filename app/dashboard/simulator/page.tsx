'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, TrendingUp, TrendingDown, Landmark,
  PiggyBank, DollarSign, Calendar, Percent,
  ChevronDown, ChevronUp, Target, CheckCircle2,
  Info, Sparkles, ArrowRight, Loader2, Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { PageWrapper } from '@/components/ui/design-system';

type SimType = 'loan' | 'savings';

// Israel average rates (2024-2025)
const ISRAEL_DEFAULTS = {
  loan: {
    avgRate: 5.5, // ריבית ממוצעת להלוואה צרכנית
    avgManagementFee: 0.25, // דמי ניהול ממוצעים (אחוז)
    setupFeeRange: '200-1,000',
  },
  savings: {
    avgRate: 3.8, // ריבית ממוצעת על פיקדון
    avgManagementFee: 0.5, // דמי ניהול ממוצעים לחיסכון
    setupFeeRange: '0-100',
  },
};

interface SimResult {
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  totalCost: number; // includes fees
  effectiveRate: number;
  amortization: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

function calculateLoan(
  amount: number,
  annualRate: number,
  months: number,
  setupFee: number,
  monthlyMgmtFee: number
): SimResult {
  const monthlyRate = annualRate / 100 / 12;
  let monthlyPayment: number;

  if (monthlyRate === 0) {
    monthlyPayment = amount / months;
  } else {
    monthlyPayment =
      (amount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
  }

  // Add monthly management fee
  const mgmtFeeMonthly = (amount * monthlyMgmtFee) / 100 / 12;
  const totalMgmtFees = mgmtFeeMonthly * months;

  const amortization = [];
  let balance = amount;

  for (let m = 1; m <= months; m++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance = Math.max(0, balance - principal);
    amortization.push({
      month: m,
      payment: Math.round(monthlyPayment + mgmtFeeMonthly),
      principal: Math.round(principal),
      interest: Math.round(interest),
      balance: Math.round(balance),
    });
  }

  const totalPayments = monthlyPayment * months;
  const totalInterest = totalPayments - amount;
  const totalCost = totalPayments + setupFee + totalMgmtFees;
  const effectiveRate = amount > 0 ? ((totalCost - amount) / amount / (months / 12)) * 100 : 0;

  return {
    monthlyPayment: Math.round(monthlyPayment + mgmtFeeMonthly),
    totalPayments: Math.round(totalPayments + totalMgmtFees),
    totalInterest: Math.round(totalInterest),
    totalCost: Math.round(totalCost),
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    amortization,
  };
}

function calculateSavings(
  monthlyDeposit: number,
  annualRate: number,
  months: number,
  setupFee: number,
  annualMgmtFee: number
): SimResult {
  const monthlyRate = annualRate / 100 / 12;
  const amortization = [];
  let balance = -setupFee; // start negative if there's a setup fee

  for (let m = 1; m <= months; m++) {
    balance += monthlyDeposit;
    const interest = balance > 0 ? balance * monthlyRate : 0;
    balance += interest;
    // Deduct monthly management fee
    const mgmtFee = balance > 0 ? (balance * annualMgmtFee) / 100 / 12 : 0;
    balance -= mgmtFee;

    amortization.push({
      month: m,
      payment: Math.round(monthlyDeposit),
      principal: Math.round(monthlyDeposit),
      interest: Math.round(interest - mgmtFee),
      balance: Math.round(balance),
    });
  }

  const totalDeposited = monthlyDeposit * months;
  const totalInterest = Math.round(balance - totalDeposited + setupFee);
  const effectiveRate = totalDeposited > 0 ? (totalInterest / totalDeposited / (months / 12)) * 100 : 0;

  return {
    monthlyPayment: monthlyDeposit,
    totalPayments: Math.round(totalDeposited),
    totalInterest: Math.max(0, totalInterest),
    totalCost: Math.round(balance),
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    amortization,
  };
}

export default function SimulatorPage() {
  const [simType, setSimType] = useState<SimType>('loan');
  const [amount, setAmount] = useState(50000);
  const [rate, setRate] = useState(5.5);
  const [months, setMonths] = useState(36);
  const [setupFee, setSetupFee] = useState(0);
  const [mgmtFee, setMgmtFee] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [useMarketDefaults, setUseMarketDefaults] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);

  // Apply market defaults
  const applyDefaults = () => {
    const defaults = ISRAEL_DEFAULTS[simType];
    setRate(defaults.avgRate);
    setMgmtFee(defaults.avgManagementFee);
    setUseMarketDefaults(true);
  };

  const result = useMemo(() => {
    if (simType === 'loan') {
      return calculateLoan(amount, rate, months, setupFee, mgmtFee);
    }
    return calculateSavings(amount, rate, months, setupFee, mgmtFee);
  }, [simType, amount, rate, months, setupFee, mgmtFee]);

  const saveAsGoal = async () => {
    setSavingGoal(true);
    try {
      const goalData = simType === 'loan'
        ? {
            name: `סגירת הלוואה - ₪${amount.toLocaleString('he-IL')}`,
            goal_type: 'debt_payoff',
            target_amount: result.totalCost,
            monthly_allocation: result.monthlyPayment,
            deadline: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            funding_notes: `הלוואה: ₪${amount.toLocaleString('he-IL')}, ריבית ${rate}%, ${months} חודשים. תשלום חודשי: ₪${result.monthlyPayment.toLocaleString('he-IL')}`,
          }
        : {
            name: `חיסכון - ₪${result.totalCost.toLocaleString('he-IL')}`,
            goal_type: 'savings_goal',
            target_amount: result.totalCost,
            monthly_allocation: amount,
            deadline: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            funding_notes: `חיסכון חודשי: ₪${amount.toLocaleString('he-IL')}, ריבית ${rate}%, ${months} חודשים. צפי סופי: ₪${result.totalCost.toLocaleString('he-IL')}`,
          };

      const res = await fetch('/api/goals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData),
      });

      if (res.ok) {
        setGoalSaved(true);
      } else {
        alert('שגיאה בשמירת היעד');
      }
    } catch {
      alert('שגיאה בשמירת היעד');
    } finally {
      setSavingGoal(false);
    }
  };

  const isLoan = simType === 'loan';

  return (
    <PageWrapper>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-phi-dark flex items-center gap-3 mb-2">
            <Calculator className="w-8 h-8 text-phi-gold" />
            סימולטור פיננסי
          </h1>
          <p className="text-phi-slate">חשב הלוואה או חיסכון, ושמור כיעד אוטומטי</p>
        </div>

        {/* Type Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => { setSimType('loan'); setUseMarketDefaults(false); setGoalSaved(false); }}
            variant={isLoan ? 'default' : 'outline'}
            className={`flex-1 gap-2 py-6 text-lg ${isLoan ? 'bg-phi-dark text-white' : 'border-phi-frost'}`}
          >
            <Landmark className="w-5 h-5" />
            הלוואה
          </Button>
          <Button
            onClick={() => { setSimType('savings'); setUseMarketDefaults(false); setGoalSaved(false); }}
            variant={!isLoan ? 'default' : 'outline'}
            className={`flex-1 gap-2 py-6 text-lg ${!isLoan ? 'bg-phi-dark text-white' : 'border-phi-frost'}`}
          >
            <PiggyBank className="w-5 h-5" />
            חיסכון / פיקדון
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card className="bg-white border-phi-frost">
            <CardHeader>
              <CardTitle className="text-phi-dark flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-phi-gold" />
                פרמטרים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-phi-dark mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-phi-gold" />
                  {isLoan ? 'סכום הלוואה' : 'הפקדה חודשית'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                    className="flex-1 px-4 py-3 border-2 border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent text-lg font-bold text-phi-dark"
                    dir="ltr"
                  />
                  <span className="text-phi-slate font-medium">₪</span>
                </div>
                <Slider
                  value={[amount]}
                  onValueChange={([v]) => setAmount(v)}
                  min={isLoan ? 1000 : 100}
                  max={isLoan ? 500000 : 20000}
                  step={isLoan ? 1000 : 100}
                  className="mt-3"
                />
              </div>

              {/* Rate */}
              <div>
                <label className="text-sm font-medium text-phi-dark mb-2 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-phi-gold" />
                  ריבית שנתית
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(Math.max(0, Number(e.target.value)))}
                    className="flex-1 px-4 py-3 border-2 border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent text-lg font-bold text-phi-dark"
                    dir="ltr"
                    step="0.1"
                  />
                  <span className="text-phi-slate font-medium">%</span>
                </div>
                <Slider
                  value={[rate]}
                  onValueChange={([v]) => setRate(Math.round(v * 10) / 10)}
                  min={0}
                  max={isLoan ? 20 : 10}
                  step={0.1}
                  className="mt-3"
                />
              </div>

              {/* Period */}
              <div>
                <label className="text-sm font-medium text-phi-dark mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-phi-gold" />
                  תקופה (חודשים)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={months}
                    onChange={(e) => setMonths(Math.max(1, Number(e.target.value)))}
                    className="flex-1 px-4 py-3 border-2 border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent text-lg font-bold text-phi-dark"
                    dir="ltr"
                  />
                  <span className="text-phi-slate font-medium text-sm">
                    = {Math.floor(months / 12)} שנים {months % 12 > 0 ? `ו-${months % 12} חודשים` : ''}
                  </span>
                </div>
                <Slider
                  value={[months]}
                  onValueChange={([v]) => setMonths(v)}
                  min={1}
                  max={isLoan ? 120 : 240}
                  step={1}
                  className="mt-3"
                />
              </div>

              {/* Setup Fee */}
              <div>
                <label className="text-sm font-medium text-phi-dark mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-phi-slate" />
                  דמי הקמה (חד פעמי)
                </label>
                <input
                  type="number"
                  value={setupFee}
                  onChange={(e) => setSetupFee(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-3 border-2 border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent font-bold text-phi-dark"
                  dir="ltr"
                  placeholder="0"
                />
              </div>

              {/* Advanced Toggle */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-phi-gold hover:text-phi-coral flex items-center gap-1 transition"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  אפשרויות מתקדמות
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-4">
                        {/* Management Fee */}
                        <div>
                          <label className="text-sm font-medium text-phi-dark mb-2 flex items-center gap-2">
                            דמי ניהול שנתיים (%)
                          </label>
                          <input
                            type="number"
                            value={mgmtFee}
                            onChange={(e) => setMgmtFee(Math.max(0, Number(e.target.value)))}
                            className="w-full px-4 py-3 border-2 border-phi-frost rounded-lg focus:ring-2 focus:ring-phi-gold focus:border-transparent font-bold text-phi-dark"
                            dir="ltr"
                            step="0.05"
                            placeholder="0"
                          />
                        </div>

                        {/* Market Defaults */}
                        <Button
                          onClick={applyDefaults}
                          variant="outline"
                          className="w-full border-phi-gold text-phi-gold hover:bg-phi-gold/10 gap-2"
                        >
                          <Info className="w-4 h-4" />
                          החל ממוצע שוק ישראלי
                        </Button>

                        {useMarketDefaults && (
                          <div className="bg-phi-bg rounded-lg p-3 text-sm text-phi-slate space-y-1">
                            <p>ריבית ממוצעת: <b>{ISRAEL_DEFAULTS[simType].avgRate}%</b></p>
                            <p>דמי ניהול ממוצעים: <b>{ISRAEL_DEFAULTS[simType].avgManagementFee}%</b></p>
                            <p>דמי הקמה נפוצים: <b>₪{ISRAEL_DEFAULTS[simType].setupFeeRange}</b></p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="space-y-6">
            <Card className="bg-white border-phi-frost">
              <CardHeader>
                <CardTitle className="text-phi-dark flex items-center gap-2">
                  {isLoan ? <TrendingDown className="w-5 h-5 text-red-500" /> : <TrendingUp className="w-5 h-5 text-phi-mint" />}
                  תוצאות
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Main result card */}
                <div className={`rounded-xl p-6 mb-6 ${isLoan ? 'bg-gradient-to-br from-red-50 to-orange-50' : 'bg-gradient-to-br from-green-50 to-emerald-50'}`}>
                  <p className="text-sm text-phi-slate mb-1">
                    {isLoan ? 'תשלום חודשי' : 'ערך צפוי בסוף התקופה'}
                  </p>
                  <p className={`text-4xl font-bold ${isLoan ? 'text-red-700' : 'text-green-700'}`}>
                    ₪{(isLoan ? result.monthlyPayment : result.totalCost).toLocaleString('he-IL')}
                  </p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-phi-bg">
                    <p className="text-xs text-phi-slate mb-1">
                      {isLoan ? 'סה״כ תשלומים' : 'סה״כ הפקדות'}
                    </p>
                    <p className="text-xl font-bold text-phi-dark">
                      ₪{result.totalPayments.toLocaleString('he-IL')}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-phi-bg">
                    <p className="text-xs text-phi-slate mb-1">
                      {isLoan ? 'סה״כ ריבית' : 'סה״כ רווח מריבית'}
                    </p>
                    <p className={`text-xl font-bold ${isLoan ? 'text-red-600' : 'text-green-600'}`}>
                      ₪{result.totalInterest.toLocaleString('he-IL')}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-phi-bg">
                    <p className="text-xs text-phi-slate mb-1">
                      {isLoan ? 'עלות כוללת (כולל עמלות)' : 'ערך סופי'}
                    </p>
                    <p className="text-xl font-bold text-phi-dark">
                      ₪{result.totalCost.toLocaleString('he-IL')}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-phi-bg">
                    <p className="text-xs text-phi-slate mb-1">ריבית אפקטיבית</p>
                    <p className="text-xl font-bold text-phi-dark">{result.effectiveRate}%</p>
                  </div>
                </div>

                {/* Setup fee note */}
                {setupFee > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    כולל דמי הקמה חד פעמיים: ₪{setupFee.toLocaleString('he-IL')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save as Goal */}
            <Card className="bg-gradient-to-br from-phi-gold/10 to-phi-gold/5 border-phi-gold/30">
              <CardContent className="p-6">
                {goalSaved ? (
                  <div className="text-center py-2">
                    <CheckCircle2 className="w-10 h-10 text-phi-mint mx-auto mb-2" />
                    <p className="font-bold text-phi-dark">היעד נשמר בהצלחה!</p>
                    <p className="text-sm text-phi-slate">ניתן לעקוב אחריו בדף היעדים</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <Target className="w-6 h-6 text-phi-gold" />
                      <div>
                        <p className="font-bold text-phi-dark">שמור כיעד</p>
                        <p className="text-sm text-phi-slate">
                          {isLoan
                            ? `יעד סגירת הלוואה — ₪${result.monthlyPayment.toLocaleString('he-IL')}/חודש`
                            : `יעד חיסכון — ₪${result.totalCost.toLocaleString('he-IL')} בסוף התקופה`
                          }
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={saveAsGoal}
                      disabled={savingGoal}
                      className="w-full bg-phi-gold hover:bg-phi-coral text-white gap-2"
                    >
                      {savingGoal ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      הוסף כיעד אוטומטי
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Amortization Table */}
            <Card className="bg-white border-phi-frost">
              <CardHeader>
                <button
                  onClick={() => setShowAmortization(!showAmortization)}
                  className="flex items-center justify-between w-full"
                >
                  <CardTitle className="text-phi-dark text-base">
                    לוח סילוקין / פירוט חודשי
                  </CardTitle>
                  {showAmortization ? <ChevronUp className="w-5 h-5 text-phi-slate" /> : <ChevronDown className="w-5 h-5 text-phi-slate" />}
                </button>
              </CardHeader>
              <AnimatePresence>
                {showAmortization && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <CardContent>
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-white">
                            <tr className="text-phi-slate border-b border-phi-frost">
                              <th className="py-2 text-right">חודש</th>
                              <th className="py-2 text-right">תשלום</th>
                              <th className="py-2 text-right">{isLoan ? 'קרן' : 'הפקדה'}</th>
                              <th className="py-2 text-right">ריבית</th>
                              <th className="py-2 text-right">יתרה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.amortization.map((row) => (
                              <tr key={row.month} className="border-b border-phi-frost/50 hover:bg-phi-bg">
                                <td className="py-2 text-phi-dark">{row.month}</td>
                                <td className="py-2 font-medium text-phi-dark">₪{row.payment.toLocaleString('he-IL')}</td>
                                <td className="py-2 text-phi-slate">₪{row.principal.toLocaleString('he-IL')}</td>
                                <td className={`py-2 ${isLoan ? 'text-red-600' : 'text-green-600'}`}>
                                  ₪{row.interest.toLocaleString('he-IL')}
                                </td>
                                <td className="py-2 font-medium text-phi-dark">₪{row.balance.toLocaleString('he-IL')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        </div>
    </PageWrapper>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PlusCircle, MinusCircle, TrendingDown, TrendingUp, Calendar, DollarSign, Calculator } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface Loan {
  id: number;
  name: string;
  amount: number;
  interest: number;
  months: number;
}

const COLORS = ["#3A7BD5", "#7ED957", "#F6A623", "#E74C3C", "#9B59B6"];

export default function LoansSimulatorPage() {
  const [loans, setLoans] = useState<Loan[]>([
    { id: 1, name: "הלוואה 1", amount: 50000, interest: 8, months: 60 },
  ]);

  const [consolidatedInterest, setConsolidatedInterest] = useState(5);
  const [consolidatedMonths, setConsolidatedMonths] = useState(60);

  // Add new loan
  const addLoan = () => {
    if (loans.length < 5) {
      setLoans([
        ...loans,
        {
          id: loans.length + 1,
          name: `הלוואה ${loans.length + 1}`,
          amount: 20000,
          interest: 8,
          months: 36,
        },
      ]);
    }
  };

  // Remove loan
  const removeLoan = (id: number) => {
    if (loans.length > 1) {
      setLoans(loans.filter((l) => l.id !== id));
    }
  };

  // Update loan
  const updateLoan = (id: number, field: keyof Loan, value: any) => {
    setLoans(
      loans.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  // Calculate monthly payment
  const calculateMonthlyPayment = (
    principal: number,
    annualRate: number,
    months: number
  ): number => {
    if (annualRate === 0) return principal / months;
    const monthlyRate = annualRate / 100 / 12;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  };

  // Calculate total interest
  const calculateTotalInterest = (
    principal: number,
    monthlyPayment: number,
    months: number
  ): number => {
    return monthlyPayment * months - principal;
  };

  // Calculations
  const currentLoans = useMemo(() => {
    return loans.map((loan) => {
      const monthlyPayment = calculateMonthlyPayment(
        loan.amount,
        loan.interest,
        loan.months
      );
      const totalInterest = calculateTotalInterest(
        loan.amount,
        monthlyPayment,
        loan.months
      );
      return {
        ...loan,
        monthlyPayment,
        totalInterest,
        totalPayment: loan.amount + totalInterest,
      };
    });
  }, [loans]);

  const currentTotals = useMemo(() => {
    return currentLoans.reduce(
      (acc, loan) => ({
        principal: acc.principal + loan.amount,
        monthlyPayment: acc.monthlyPayment + loan.monthlyPayment,
        totalInterest: acc.totalInterest + loan.totalInterest,
        totalPayment: acc.totalPayment + loan.totalPayment,
      }),
      { principal: 0, monthlyPayment: 0, totalInterest: 0, totalPayment: 0 }
    );
  }, [currentLoans]);

  const consolidatedLoan = useMemo(() => {
    const monthlyPayment = calculateMonthlyPayment(
      currentTotals.principal,
      consolidatedInterest,
      consolidatedMonths
    );
    const totalInterest = calculateTotalInterest(
      currentTotals.principal,
      monthlyPayment,
      consolidatedMonths
    );
    return {
      monthlyPayment,
      totalInterest,
      totalPayment: currentTotals.principal + totalInterest,
    };
  }, [currentTotals.principal, consolidatedInterest, consolidatedMonths]);

  const savings = useMemo(() => {
    return {
      monthlyPayment: currentTotals.monthlyPayment - consolidatedLoan.monthlyPayment,
      totalInterest: currentTotals.totalInterest - consolidatedLoan.totalInterest,
      totalPayment: currentTotals.totalPayment - consolidatedLoan.totalPayment,
    };
  }, [currentTotals, consolidatedLoan]);

  // Chart data
  const comparisonData = [
    {
      name: "קרן",
      לפני: currentTotals.principal,
      אחרי: currentTotals.principal,
    },
    {
      name: "ריבית",
      לפני: currentTotals.totalInterest,
      אחרי: consolidatedLoan.totalInterest,
    },
    {
      name: 'סה&quot;כ תשלום',
      לפני: currentTotals.totalPayment,
      אחרי: consolidatedLoan.totalPayment,
    },
  ];

  const pieData = currentLoans.map((loan) => ({
    name: loan.name,
    value: loan.amount,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8" dir="rtl">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E2A3B] to-[#3A7BD5] text-white rounded-2xl p-8 mb-8 shadow-2xl animate-scale-in">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Calculator className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">סימולטור איחוד הלוואות</h1>
              <p className="text-sm text-blue-200">כלי חכם לחישוב חיסכון אמיתי</p>
            </div>
          </div>
          <p className="text-gray-200 leading-relaxed">
            גלה כמה כסף תחסוך על ידי איחוד ההלוואות שלך להלוואה אחת עם ריבית נמוכה יותר.
            <strong className="text-white"> החיסכון יכול להגיע לאלפי שקלים בשנה! </strong>
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Current Loans */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">ההלוואות הנוכחיות שלך</h2>
                <Button
                  onClick={addLoan}
                  disabled={loans.length >= 5}
                  size="sm"
                  className="bg-[#7ED957] hover:bg-[#6BC949] text-white"
                >
                  <PlusCircle className="w-4 h-4 ml-2" />
                  הוסף הלוואה
                </Button>
              </div>

              <div className="space-y-6">
                {loans.map((loan) => (
                  <div key={loan.id} className="border border-gray-200 rounded-lg p-4 relative">
                    {loans.length > 1 && (
                      <button
                        onClick={() => removeLoan(loan.id)}
                        className="absolute top-2 left-2 text-red-500 hover:text-red-700"
                      >
                        <MinusCircle className="w-5 h-5" />
                      </button>
                    )}

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">שם ההלוואה</Label>
                        <Input
                          value={loan.name}
                          onChange={(e) => updateLoan(loan.id, "name", e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">סכום (₪)</Label>
                        <Input
                          type="number"
                          value={loan.amount}
                          onChange={(e) =>
                            updateLoan(loan.id, "amount", Number(e.target.value))
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">
                          ריבית שנתית ({loan.interest}%)
                        </Label>
                        <Slider
                          value={[loan.interest]}
                          onValueChange={([value]) =>
                            updateLoan(loan.id, "interest", value)
                          }
                          max={25}
                          min={1}
                          step={0.5}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">
                          תקופה ({loan.months} חודשים)
                        </Label>
                        <Slider
                          value={[loan.months]}
                          onValueChange={([value]) =>
                            updateLoan(loan.id, "months", value)
                          }
                          max={240}
                          min={6}
                          step={6}
                          className="mt-2"
                        />
                      </div>

                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">תשלום חודשי:</span>
                          <span className="font-bold text-[#3A7BD5]">
                            ₪{currentLoans.find((l) => l.id === loan.id)?.monthlyPayment.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Current Totals */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-bold text-gray-900 mb-3">סיכום נוכחי</h3>
                <div className="flex justify-between">
                  <span className="text-gray-600">סה&quot;כ קרן:</span>
                  <span className="font-bold">
                    ₪{currentTotals.principal.toLocaleString("he-IL")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">תשלום חודשי כולל:</span>
                  <span className="font-bold text-[#3A7BD5]">
                    ₪{currentTotals.monthlyPayment.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">סה&quot;כ ריבית:</span>
                  <span className="font-bold text-orange-600">
                    ₪{currentTotals.totalInterest.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Consolidated Loan */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">הלוואה מאוחדת</h2>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">
                    ריבית שנתית ({consolidatedInterest}%)
                  </Label>
                  <Slider
                    value={[consolidatedInterest]}
                    onValueChange={([value]) => setConsolidatedInterest(value)}
                    max={15}
                    min={2}
                    step={0.25}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    הלוואות מאוחדות בדרך כלל מגיעות עם ריבית נמוכה יותר
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">
                    תקופה ({consolidatedMonths} חודשים)
                  </Label>
                  <Slider
                    value={[consolidatedMonths]}
                    onValueChange={([value]) => setConsolidatedMonths(value)}
                    max={240}
                    min={12}
                    step={6}
                    className="mt-2"
                  />
                </div>

                <div className="mt-6 bg-blue-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">תשלום חודשי:</span>
                    <span className="font-bold text-[#3A7BD5]">
                      ₪{consolidatedLoan.monthlyPayment.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">סה&quot;כ ריבית:</span>
                    <span className="font-bold text-orange-600">
                      ₪{consolidatedLoan.totalInterest.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Results & Charts */}
          <div className="space-y-6">
            {/* Savings Summary */}
            <div className="bg-gradient-to-r from-[#7ED957] to-[#6BC949] text-white rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <TrendingDown className="w-6 h-6" />
                החיסכון שלך
              </h2>

              <div className="space-y-4">
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-sm">חיסכון חודשי</span>
                  </div>
                  <div className="text-3xl font-bold">
                    ₪{savings.monthlyPayment.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                  </div>
                  {savings.monthlyPayment > 0 && (
                    <div className="text-sm mt-1">
                      {((savings.monthlyPayment / currentTotals.monthlyPayment) * 100).toFixed(1)}% פחות
                    </div>
                  )}
                </div>

                <div className="bg-white/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm">חיסכון כולל על ריבית</span>
                  </div>
                  <div className="text-3xl font-bold">
                    ₪{savings.totalInterest.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="bg-white/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="text-sm">הפרש תקופת החזר</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {consolidatedMonths} חודשים
                  </div>
                  <div className="text-sm mt-1">
                    ({(consolidatedMonths / 12).toFixed(1)} שנים)
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                השוואה: לפני ואחרי
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip
                    formatter={(value: number) => `₪${value.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`}
                  />
                  <Legend />
                  <Bar dataKey="לפני" fill="#F6A623" name="לפני איחוד" />
                  <Bar dataKey="אחרי" fill="#7ED957" name="אחרי איחוד" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart - Loan Distribution */}
            {loans.length > 1 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  התפלגות ההלוואות
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ₪${entry.value.toLocaleString("he-IL")}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => `₪${value.toLocaleString("he-IL")}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-300 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">⚠️</span>
                </div>
                <div>
                  <h4 className="font-bold text-yellow-900 mb-2">חשוב לדעת</h4>
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    זהו סימולטור משוער המבוסס על נוסחאות מתמטיות. החישובים אינם לוקחים בחשבון עמלות פירעון מוקדם,
                    עלויות נוספות או שינויי ריבית עתידיים.
                  </p>
                  <p className="text-sm text-yellow-800 leading-relaxed mt-2">
                    <strong>לפני שמקבלים החלטה:</strong> התייעצו עם יועץ פיננסי או נציג הבנק לקבלת הצעה מדויקת.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


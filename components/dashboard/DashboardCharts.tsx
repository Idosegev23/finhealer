"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, DollarSign } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";

const COLORS = ["#3A7BD5", "#7ED957", "#F6A623", "#E74C3C", "#9B59B6", "#3498DB", "#E67E22", "#1ABC9C"];

interface ExpensesByMonthData {
  month: string;
  amount: number;
}

interface ExpensesByCategoryData {
  name: string;
  value: number;
}

interface Loan {
  id: string;
  lender_name: string;
  original_amount: number;
  current_balance: number;
}

export function DashboardCharts({ loans }: { loans: Loan[] }) {
  const [expensesByMonth, setExpensesByMonth] = useState<ExpensesByMonthData[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpensesByCategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartsData();
  }, []);

  const fetchChartsData = async () => {
    try {
      const [monthlyRes, categoryRes] = await Promise.all([
        fetch("/api/dashboard/expenses-by-month"),
        fetch("/api/dashboard/expenses-by-category"),
      ]);

      if (monthlyRes.ok) {
        const monthlyData = await monthlyRes.json();
        setExpensesByMonth(monthlyData);
      }

      if (categoryRes.ok) {
        const categoryData = await categoryRes.json();
        setExpensesByCategory(categoryData);
      }
    } catch (error) {
      console.error("Error fetching charts data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate loans progress data
  const loansProgressData = loans.map((loan) => {
    const paid = loan.original_amount - loan.current_balance;
    const remaining = loan.current_balance;
    return {
      name: loan.lender_name.length > 15 ? loan.lender_name.substring(0, 15) + "..." : loan.lender_name,
      שולם: Math.round(paid),
      נותר: Math.round(remaining),
    };
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm animate-pulse"
          >
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-8">
      {/* First Row: Monthly Expenses and Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Expenses Line Chart */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-theme-primary">מעקב הוצאות חודשיות</h3>
              <InfoTooltip
                content="גרף המציג את ההוצאות שלך ב-6 החודשים האחרונים - עוזר לזהות מגמות ולשפר ניהול כספי"
                type="info"
              />
            </div>
          </div>
          {expensesByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={expensesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--text-secondary)" }}
                  stroke="var(--border-color)"
                />
                <YAxis
                  tick={{ fill: "var(--text-secondary)" }}
                  stroke="var(--border-color)"
                />
                <RechartsTooltip
                  formatter={(value: number) =>
                    `₪${value.toLocaleString("he-IL")}`
                  }
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#3A7BD5"
                  strokeWidth={2}
                  dot={{ fill: "#3A7BD5", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="הוצאות"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-theme-secondary">
              אין עדיין נתוני הוצאות להצגה
            </div>
          )}
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <PieIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-theme-primary">פילוח הוצאות</h3>
              <InfoTooltip
                content="חלוקת ההוצאות החודשיות שלך לפי קטגוריות - מאפשר לזהות לאן הכסף הולך"
                type="info"
              />
            </div>
          </div>
          {expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ₪${entry.value.toLocaleString("he-IL")}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number) =>
                    `₪${value.toLocaleString("he-IL")}`
                  }
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-theme-secondary">
              אין עדיין נתוני הוצאות להצגה
            </div>
          )}
        </div>
      </div>

      {/* Second Row: Loans Progress */}
      {loansProgressData.length > 0 && (
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-theme-primary">התקדמות פרעון הלוואות</h3>
              <InfoTooltip
                content="גרף המציג כמה כבר שילמת מכל הלוואה (ירוק) לעומת כמה עוד נשאר (אדום)"
                type="info"
              />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={loansProgressData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis type="number" tick={{ fill: "var(--text-secondary)" }} stroke="var(--border-color)" />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: "var(--text-secondary)" }}
                stroke="var(--border-color)"
                width={100}
              />
              <RechartsTooltip
                formatter={(value: number) =>
                  `₪${value.toLocaleString("he-IL")}`
                }
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="שולם" stackId="a" fill="#7ED957" />
              <Bar dataKey="נותר" stackId="a" fill="#E74C3C" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


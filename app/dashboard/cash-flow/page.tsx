/**
 * Cash Flow Dashboard - דף תחזית תזרים מזומנים
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Line, Bar } from 'recharts';
import { LineChart, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CashFlowAnalysis } from '@/lib/finance/cash-flow-projector';

export default function CashFlowPage() {
  const [analysis, setAnalysis] = useState<CashFlowAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  
  useEffect(() => {
    loadCashFlowProjection();
  }, [months]);
  
  async function loadCashFlowProjection() {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/cash-flow/projection?months=${months}`);
      const data = await response.json();
      
      if (data.success) {
        setAnalysis(data.data);
      }
      
    } catch (error) {
      console.error('Error loading cash flow projection:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold"></div>
      </div>
    );
  }
  
  if (!analysis || analysis.projections.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              אין מספיק נתונים היסטוריים לתחזית תזרים. שלח עוד דוחות בנק.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  // הכנת נתונים לגרפים
  const chartData = analysis.projections.map(p => ({
    month: new Date(p.month).toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }),
    income: p.projected_income,
    expenses: p.projected_expenses,
    balance: p.projected_balance,
    netFlow: p.net_cash_flow,
  }));
  
  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">תחזית תזרים מזומנים</h1>
          <p className="text-gray-600">
            תחזית ל-{analysis.summary.total_months} חודשים קדימה מבוססת על {analysis.projections[0]?.confidence_level}% ביטחון
          </p>
        </div>
        
        {/* אזהרות */}
        {analysis.warnings.length > 0 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="font-bold mb-2">⚠️ התראות תזרים:</div>
              {analysis.warnings.map((warning, i) => (
                <div key={i}>• {warning}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        
        {/* סיכום */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">חודשים שליליים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {analysis.summary.negative_months_count}
              </div>
              <p className="text-xs text-gray-500 mt-1">מתוך {analysis.summary.total_months} חודשים</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">עודף חודשי ממוצע</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${analysis.summary.average_monthly_surplus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analysis.summary.average_monthly_surplus >= 0 ? '+' : ''}
                {analysis.summary.average_monthly_surplus.toLocaleString('he-IL')} ₪
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">יתרה נמוכה ביותר</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${analysis.summary.lowest_balance_amount >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {analysis.summary.lowest_balance_amount.toLocaleString('he-IL')} ₪
              </div>
              <p className="text-xs text-gray-500 mt-1">{analysis.summary.lowest_balance_month}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">המלצות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-phi-gold">
                {analysis.recommendations.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">המלצות לשיפור</p>
            </CardContent>
          </Card>
        </div>
        
        {/* גרף יתרה צפויה */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>יתרה צפויה לאורך זמן</CardTitle>
            <CardDescription>מעקב אחר יתרת החשבון החזויה</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `${value.toLocaleString('he-IL')} ₪`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#A96B48" 
                  strokeWidth={3}
                  name="יתרה צפויה"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* גרף הכנסות vs הוצאות */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>הכנסות vs הוצאות צפויות</CardTitle>
            <CardDescription>השוואה חודשית</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `${value.toLocaleString('he-IL')} ₪`} />
                <Legend />
                <Bar dataKey="income" fill="#8FBCBB" name="הכנסות" />
                <Bar dataKey="expenses" fill="#D08770" name="הוצאות" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* המלצות */}
        {analysis.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>💡 המלצות φ לשיפור תזרים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.recommendations.map((rec, i) => (
                  <div 
                    key={i}
                    className={`p-4 rounded-lg border ${
                      rec.priority === 'high' ? 'border-red-200 bg-red-50' :
                      rec.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded ${
                        rec.priority === 'high' ? 'bg-red-100' :
                        rec.priority === 'medium' ? 'bg-yellow-100' :
                        'bg-gray-100'
                      }`}>
                        {rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{rec.recommendation_text}</p>
                        {rec.impact_amount > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            💰 השפעה: {rec.impact_amount.toLocaleString('he-IL')} ₪
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

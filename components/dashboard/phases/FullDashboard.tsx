'use client';

import { Activity, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Dashboard לשלב 5: Monitoring (בקרה רציפה)
 * מטרה: ליווי ארוך טווח עם כל הכלים
 */
export function FullDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">לוח הבקרה שלך 📊</h1>
          <p className="mt-2 text-gray-600">
            סקירה מלאה של המצב הפיננסי שלך
          </p>
        </div>
        <div className="text-left">
          <p className="text-sm text-gray-500">ציון בריאות פיננסית</p>
          <p className="text-4xl font-bold text-green-600">85</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">הכנסות החודש</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₪15,000</p>
            <p className="text-xs text-green-600 mt-1">↑ 5% מחודש שעבר</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">הוצאות החודש</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₪8,500</p>
            <p className="text-xs text-gray-600 mt-1">71% מהתקציב</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">חיסכון</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₪6,500</p>
            <p className="text-xs text-green-600 mt-1">43% מההכנסה</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">חובות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₪120,000</p>
            <p className="text-xs text-gray-600 mt-1">3 הלוואות פעילות</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              התראות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 p-3 bg-amber-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">הוצאות בילויים גבוהות</p>
                <p className="text-gray-600">עברת 90% מהתקציב בקטגוריה זו</p>
              </div>
            </div>
            
            <div className="flex gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">חודש מצוין!</p>
                <p className="text-gray-600">חסכת 43% מההכנסה - כל הכבוד</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              התקדמות יעדים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>קופת חירום</span>
                <span className="font-semibold">40%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 w-2/5" />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>חופשה משפחתית</span>
                <span className="font-semibold">63%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: '63%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>פעולות מהירות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Link href="/dashboard/data/expenses">
              <Button variant="outline" className="w-full">
                💸 הוסף הוצאה
              </Button>
            </Link>
            <Link href="/dashboard/data/income">
              <Button variant="outline" className="w-full">
                💰 הוסף הכנסה
              </Button>
            </Link>
            <Link href="/dashboard/reports/expenses">
              <Button variant="outline" className="w-full">
                📊 דוחות
              </Button>
            </Link>
            <Link href="/dashboard/goals">
              <Button variant="outline" className="w-full">
                🎯 יעדים
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

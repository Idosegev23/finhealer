'use client';

import { PiggyBank, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Dashboard לשלב 3: Budget (תקציב אוטומטי)
 * מטרה: יצירת תקציב חכם מבוסס היסטוריה
 */
export function BudgetDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">התקציב החכם שלך 💰</h1>
        <p className="mt-2 text-gray-600">
          המערכת הציעה תקציב מותאם אישית בהתאם להתנהלות שלך
        </p>
      </div>

      {/* Progress Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-blue-600" />
            שלב 3 מתוך 5: תקציב חכם
          </CardTitle>
          <CardDescription>
            עכשיו אנחנו עוקבים אחרי התקציב ומעדכנים אותך
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">הוצאות החודש</span>
              <span className="font-semibold">₪8,500 / ₪12,000</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: '71%' }} />
            </div>
            <p className="text-xs text-gray-500">
              נשארו לך עוד ₪3,500 החודש
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Budget Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-medium">הוצאות קבועות</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₪5,200</p>
            <p className="text-xs text-gray-600 mt-1">בתוך התקציב</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-medium">הוצאות משתנות</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₪2,800</p>
            <p className="text-xs text-gray-600 mt-1">קרוב למגבלה</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-medium">הוצאות מיוחדות</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₪500</p>
            <p className="text-xs text-gray-600 mt-1">טוב מאוד</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>📊 תקציב מפורט</CardTitle>
            <CardDescription>
              ראה פירוט מלא לפי קטגוריות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/reports/budget">
              <Button className="w-full">צפה בתקציב</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>⚙️ התאם תקציב</CardTitle>
            <CardDescription>
              שנה את התקציב לפי הצרכים שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/budget">
              <Button variant="outline" className="w-full">ערוך</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


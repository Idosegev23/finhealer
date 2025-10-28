'use client';

import { TrendingUp, Calendar, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Dashboard לשלב 2: Behavior (התנהלות והרגלים)
 * מטרה: זיהוי דפוסי הוצאה בפועל
 */
export function BehaviorDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">מעקב התנהלות 📊</h1>
        <p className="mt-2 text-gray-600">
          עכשיו אנחנו עוקבים אחרי ההוצאות שלך בזמן אמת ומזהים דפוסים
        </p>
      </div>

      {/* Progress Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            שלב 2 מתוך 5: זיהוי דפוסים
          </CardTitle>
          <CardDescription>
            נאסוף נתונים למשך 30 ימים לפחות
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>ימים של מעקב:</span>
              <span className="font-semibold">15 / 30</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-600 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>💸 הוסף הוצאה</CardTitle>
            <CardDescription>
              רשום הוצאה חדשה או סרוק קבלה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/data/expenses">
              <Button className="w-full">הוסף</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>📈 דוחות</CardTitle>
            <CardDescription>
              ראה את הניתוח של ההוצאות שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/reports/expenses">
              <Button variant="outline" className="w-full">צפה</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>💡 תובנות</CardTitle>
            <CardDescription>
              דפוסים שזיהינו עד כה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              בקרוב
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            טיפ השבוע
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            כדאי לרשום הוצאות באופן יומי - ככה לא תשכח כלום ותראה תמונה מדויקת יותר.
            אפשר להשתמש בבוט WhatsApp להוספה מהירה!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


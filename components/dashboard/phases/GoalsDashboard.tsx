'use client';

import { Target, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Dashboard לשלב 4: Goals (יעדים ומטרות)
 * מטרה: הגדרת יעדים אישיים ומשפחתיים
 */
export function GoalsDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">היעדים שלך 🎯</h1>
        <p className="mt-2 text-gray-600">
          הגדרת יעדים עוזרת לך להישאר ממוקד ומועיל
        </p>
      </div>

      {/* Progress Card */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            שלב 4 מתוך 5: יעדים ומטרות
          </CardTitle>
          <CardDescription>
            הגדרת יעדים פיננסיים קצרי וארוכי טווח
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            יש לך 3 יעדים פעילים - כל הכבוד!
          </p>
        </CardContent>
      </Card>

      {/* Goals Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">קופת חירום</CardTitle>
            <CardDescription>יעד: ₪30,000</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>התקדמות</span>
                <span className="font-semibold">₪12,000 (40%)</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 w-2/5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">חופשה משפחתית</CardTitle>
            <CardDescription>יעד: ₪15,000</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>התקדמות</span>
                <span className="font-semibold">₪9,500 (63%)</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600" style={{ width: '63%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              יעד חדש
            </CardTitle>
            <CardDescription>
              הוסף יעד פיננסי חדש
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/goals">
              <Button className="w-full">הוסף יעד</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              כל היעדים
            </CardTitle>
            <CardDescription>
              ראה את כל היעדים והתקדמות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/goals">
              <Button variant="outline" className="w-full">צפה</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Tip */}
      <Card>
        <CardHeader>
          <CardTitle>💡 טיפ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            יעדים קטנים ומדודים יותר קלים להשגה. התחל עם יעד של 3-6 חודשים במקום שנה.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


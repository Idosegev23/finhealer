'use client';

import { ArrowLeft, CheckCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Dashboard לשלב 1: Reflection (שיקוף עבר)
 * מטרה: הבנת דפוסי הוצאה היסטוריים
 */
export function OnboardingDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">שלום! בואו נתחיל את המסע 🚀</h1>
        <p className="mt-2 text-gray-600">
          השלב הראשון הוא להבין את המצב הכספי הנוכחי שלך. זה יעזור לנו לבנות תוכנית מותאמת אישית.
        </p>
      </div>

      {/* Progress Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            שלב 1 מתוך 5: שיקוף עבר
          </CardTitle>
          <CardDescription>
            נאסוף מידע על 3-6 החודשים האחרונים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm">הרשמה הושלמה</span>
            </div>
            <div className="flex items-center gap-3 text-gray-400">
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              <span className="text-sm">מילוי שאלון Reflection</span>
            </div>
            <div className="flex items-center gap-3 text-gray-400">
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              <span className="text-sm">סיום והעברה לשלב הבא</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>🎯 מלא שאלון Reflection</CardTitle>
            <CardDescription>
              נאסוף מידע על ההכנסות, ההוצאות, החובות והנכסים שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/reflection">
              <Button className="w-full">התחל עכשיו</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>📚 למד על המסע</CardTitle>
            <CardDescription>
              קרא על 5 השלבים של תהליך ההבראה הפיננסית
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/guide">
              <Button variant="outline" className="w-full">למד עוד</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>💡 טיפ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            אל תדאג אם אין לך את כל הנתונים במדויק. אפשר להעריך ולעדכן מאוחר יותר.
            החשוב הוא להתחיל!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


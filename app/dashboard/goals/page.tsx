'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Plus, TrendingUp } from 'lucide-react';

/**
 * דף יעדים - מציג יעדים קיימים ומאפשר הוספה
 */
export default function GoalsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">היעדים שלי 🎯</h1>
          <p className="mt-2 text-gray-600">
            הגדר יעדים פיננסיים ועקוב אחרי ההתקדמות
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          יעד חדש
        </Button>
      </div>

      {/* Empty State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            התחל להגדיר יעדים
          </CardTitle>
          <CardDescription>
            יעדים עוזרים לך להישאר ממוקד ולשפר את המצב הכלכלי
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Goal Type Cards */}
            <div className="p-4 border rounded-lg hover:border-blue-500 transition-colors cursor-pointer">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">קופת חירום</h3>
              <p className="text-sm text-gray-600">
                חסוך 3-6 חודשי הכנסה למקרה חירום
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:border-purple-500 transition-colors cursor-pointer">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">יעד חיסכון</h3>
              <p className="text-sm text-gray-600">
                חופשה, רכב, דירה - כל מה שתרצה
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:border-green-500 transition-colors cursor-pointer">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">פרישה מוקדמת</h3>
              <p className="text-sm text-gray-600">
                תכנן את העתיד הכלכלי שלך
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              צור יעד ראשון
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>💡 טיפים להצלחה</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✅ הגדר יעדים ספציפיים ומדידים</li>
            <li>✅ פרק יעדים גדולים ליעדים קטנים יותר</li>
            <li>✅ עקוב אחרי ההתקדמות באופן קבוע</li>
            <li>✅ חגוג הצלחות - גם את הקטנות!</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}


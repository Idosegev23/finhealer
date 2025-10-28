import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Target, TrendingUp, Wallet, PiggyBank } from 'lucide-react';

/**
 * דף מדריך - 5 השלבים של מסע ההבראה הפיננסית
 */
export default function GuidePage() {
  const phases = [
    {
      number: 1,
      name: 'Reflection - שיקוף עבר',
      icon: BookOpen,
      description: 'הבנת המצב הנוכחי',
      color: 'blue',
      steps: [
        'איסוף נתונים על 3-6 חודשים אחרונים',
        'הכנסות, הוצאות, חובות ונכסים',
        'מילוי שאלון Reflection',
        'קבלת תמונת מצב 360 מעלות',
      ],
    },
    {
      number: 2,
      name: 'Behavior - התנהלות',
      icon: TrendingUp,
      description: 'זיהוי דפוסי הוצאה',
      color: 'green',
      steps: [
        'מעקב יומי אחר הוצאות',
        'זיהוי דפוסים והרגלים',
        'הבנת טריגרים להוצאות',
        '30 ימים של מעקב לפחות',
      ],
    },
    {
      number: 3,
      name: 'Budget - תקציב חכם',
      icon: Wallet,
      description: 'תוכנית פעולה מבוססת נתונים',
      color: 'purple',
      steps: [
        'המערכת מציעה תקציב אוטומטי',
        'התאמה אישית לפי צרכים',
        'חלוקה: קבוע, משתנה, מיוחד',
        'מעקב שבועי וחודשי',
      ],
    },
    {
      number: 4,
      name: 'Goals - יעדים',
      icon: Target,
      description: 'הגדרת יעדים אישיים',
      color: 'orange',
      steps: [
        'קופת חירום (3-6 חודשים)',
        'יעדי חיסכון קצרי טווח',
        'יעדי חיסכון ארוכי טווח',
        'מעקב אחר התקדמות',
      ],
    },
    {
      number: 5,
      name: 'Monitoring - ליווי',
      icon: PiggyBank,
      description: 'בקרה רציפה ושיפור מתמיד',
      color: 'indigo',
      steps: [
        'Dashboard מלא עם כל הנתונים',
        'התראות חכמות',
        'דוחות חודשיים',
        'שיפור מתמיד',
      ],
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">מסע ההבראה הפיננסית 🚀</h1>
        <p className="text-lg text-gray-600">
          5 שלבים שיובילו אותך לשליטה מלאה במצב הכלכלי שלך
        </p>
      </div>

      <div className="space-y-6">
        {phases.map((phase, idx) => {
          const Icon = phase.icon;
          return (
            <Card key={phase.number} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`h-16 w-16 rounded-full ${colorClasses[phase.color]} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl mb-2">
                      שלב {phase.number}: {phase.name}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {phase.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {phase.steps.map((step, stepIdx) => (
                    <li key={stepIdx} className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span className="text-gray-700">{step}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle>🎯 החשוב ביותר</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            כל שלב בנוי על השלב הקודם. המפתח להצלחה הוא סבלנות, עקביות ונכונות ללמוד.
            לא צריך להיות מושלם - צריך להתחיל! 💪
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

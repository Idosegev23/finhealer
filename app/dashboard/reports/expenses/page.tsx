'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingDown, ArrowRight } from 'lucide-react';

/**
 * דף ניתוח הוצאות - מפנה לדף expenses הקיים
 */
export default function ExpensesReportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ניתוח הוצאות 📉</h1>
        <p className="mt-2 text-gray-600">
          גרפים ופירוט מלא של ההוצאות שלך
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            סקירת הוצאות חודשית
          </CardTitle>
          <CardDescription>
            חודש אחר חודש, קטגוריה אחר קטגוריה
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/expenses">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              צפה בהוצאות
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


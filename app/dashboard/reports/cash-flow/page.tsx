'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowRight } from 'lucide-react';

/**
 * דף תזרים מזומנים
 */
export default function CashFlowReportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">תזרים מזומנים 💹</h1>
        <p className="mt-2 text-gray-600">
          הכנסות מול הוצאות - תזרים חודשי
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            ניתוח תזרים
          </CardTitle>
          <CardDescription>
            יתרות חשבון, הכנסות והוצאות לפי חודש
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/cash-flow">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              צפה בתזרים
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


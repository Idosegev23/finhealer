'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, ArrowRight } from 'lucide-react';

/**
 * דף תמונת מצב כללית - מפנה לדף overview הקיים
 */
export default function OverviewReportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">תמונת מצב כללית 🎯</h1>
        <p className="mt-2 text-gray-600">
          סקירה מלאה של כל המצב הפיננסי שלך
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            תמונת מצב 360°
          </CardTitle>
          <CardDescription>
            נכסים, חובות, הכנסות והוצאות במבט אחד
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/overview">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              צפה בתמונת מצב
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


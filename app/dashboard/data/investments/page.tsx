'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ArrowRight } from 'lucide-react';

/**
 * דף השקעות - מפנה לדף הקיים
 */
export default function InvestmentsDataPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">השקעות 📈</h1>
        <p className="mt-2 text-gray-600">
          נהל את תיק ההשקעות שלך
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            ניהול השקעות
          </CardTitle>
          <CardDescription>
            מניות, אגרות חוב, קרנות נאמנות, קריפטו ועוד
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/investments">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              עבור לדף השקעות
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


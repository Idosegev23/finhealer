'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PiggyBank, ArrowRight } from 'lucide-react';

/**
 * דף חיסכון - מפנה לדף הקיים
 */
export default function SavingsDataPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">חיסכון 💎</h1>
        <p className="mt-2 text-gray-600">
          נהל את חשבונות החיסכון והפיקדונות שלך
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            ניהול חיסכון
          </CardTitle>
          <CardDescription>
            הוסף חשבון חיסכון, פיקדון או קופת גמל
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/savings">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              עבור לדף חיסכון
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


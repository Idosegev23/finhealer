'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight } from 'lucide-react';

/**
 * דף ביטוח - מפנה לדף הקיים
 */
export default function InsuranceDataPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ביטוח 🛡️</h1>
        <p className="mt-2 text-gray-600">
          נהל את הפוליסות והביטוחים שלך
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            ניהול ביטוחים
          </CardTitle>
          <CardDescription>
            הוסף ביטוח חיים, בריאות, רכב ועוד
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/insurance">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              עבור לדף ביטוח
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


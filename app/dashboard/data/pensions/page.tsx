'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, ArrowRight } from 'lucide-react';

/**
 * דף פנסיה - מפנה לדף הקיים
 */
export default function PensionsDataPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">פנסיה 🏛️</h1>
        <p className="mt-2 text-gray-600">
          נהל את החיסכון הפנסיוני שלך
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            ניהול פנסיה
          </CardTitle>
          <CardDescription>
            קרנות פנסיה, קופות גמל, קרנות השתלמות וביטוח מנהלים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/pensions">
            <Button className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              עבור לדף פנסיה
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


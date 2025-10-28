'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, DollarSign } from 'lucide-react';

/**
 * דף הזנת הכנסות
 * מקורות הכנסה קבועים (שכיר/עצמאי/פרילנס) + תלושי שכר
 */
export default function IncomeDataPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [sourceName, setSourceName] = useState('');
  const [employmentType, setEmploymentType] = useState('employee');
  const [grossAmount, setGrossAmount] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/income/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_name: sourceName,
          employment_type: employmentType,
          gross_amount: parseFloat(grossAmount),
          net_amount: parseFloat(netAmount),
          notes,
          is_primary: true,
          active: true,
        }),
      });

      if (response.ok) {
        alert('✅ מקור הכנסה נוסף בהצלחה!');
        // Reset form
        setSourceName('');
        setGrossAmount('');
        setNetAmount('');
        setNotes('');
      } else {
        alert('❌ שגיאה בהוספת מקור הכנסה');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ שגיאה בהוספת מקור הכנסה');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">הוסף הכנסה 💰</h1>
        <p className="mt-2 text-gray-600">
          הזן מקור הכנסה קבוע (משכורת/עסק/פרילנס)
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              הכנסה קבועה
            </CardTitle>
            <CardDescription>
              הזן מקור הכנסה חודשי או שנתי
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="sourceName">שם מקור ההכנסה *</Label>
                <Input
                  id="sourceName"
                  placeholder="לדוגמה: משכורת, עסק, פרילנס"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="employmentType">סוג תעסוקה *</Label>
                <select
                  id="employmentType"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                >
                  <option value="employee">שכיר</option>
                  <option value="self_employed">עצמאי</option>
                  <option value="freelance">פרילנסר</option>
                  <option value="business">בעל עסק</option>
                  <option value="rental">הכנסה משכירות</option>
                  <option value="investment">השקעות</option>
                  <option value="pension">פנסיה</option>
                  <option value="other">אחר</option>
                </select>
              </div>

              <div>
                <Label htmlFor="grossAmount">הכנסה ברוטו (לפני ניכויים) *</Label>
                <Input
                  id="grossAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="netAmount">הכנסה נטו (אחרי ניכויים) *</Label>
                <Input
                  id="netAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={netAmount}
                  onChange={(e) => setNetAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="notes">הערות</Label>
                <Textarea
                  id="notes"
                  placeholder="הערות נוספות (אופציונלי)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'שומר...' : 'הוסף מקור הכנסה'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Payslip Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              תלוש משכורת
            </CardTitle>
            <CardDescription>
              העלה תלוש משכורת לזיהוי אוטומטי
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  גרור קובץ לכאן או לחץ לבחירה
                </p>
                <p className="text-xs text-gray-500">
                  PDF או תמונה (עד 10MB)
                </p>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="mt-4"
                />
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  💡 מה נזהה אוטומטית?
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• שכר ברוטו ונטו</li>
                  <li>• ניכויי מס וביטוח לאומי</li>
                  <li>• הפקדות לפנסיה</li>
                  <li>• זיכויים והטבות</li>
                </ul>
              </div>

              <Button className="w-full" disabled>
                העלה תלוש (בקרוב)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


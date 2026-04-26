'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ExpenseCategorySelector from '@/components/expenses/expense-category-selector';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { Upload, PenLine } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';

/**
 * דף הזנת הוצאות - 2 מצבים
 * 1. סריקה (OCR) - העלאת דוח בנק/אשראי
 * 2. הזנה ידנית - טופס פשוט
 */
export default function ExpensesDataPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual entry state
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [expenseType, setExpenseType] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          vendor,
          date,
          notes,
          payment_method: paymentMethod,
          expense_category: categoryName,
          expense_category_id: categoryId,
          expense_type: expenseType,
        }),
      });

      if (response.ok) {
        addToast({ title: 'הוצאה נוספה בהצלחה!', type: 'success' });
        // Reset form
        setAmount('');
        setVendor('');
        setNotes('');
        setCategoryId('');
        setCategoryName('');
        setExpenseType('');
      } else {
        const errorData = await response.json();
        addToast({ title: errorData.error || 'שגיאה בהוספת הוצאה', type: 'error' });
      }
    } catch (error) {
      console.error('Error:', error);
      addToast({ title: 'שגיאה בהוספת הוצאה', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">הוסף הוצאה</h1>
          <p className="text-sm text-gray-500 mt-1">הזן הוצאה חדשה או סרוק פירוט ויזה/אשראי</p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>בחר שיטת הזנה</CardTitle>
          <CardDescription>
            הזנה ידנית מהירה או סריקה אוטומטית של פירוט ויזה
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">
                <PenLine className="h-4 w-4 mr-2" />
                הזנה ידנית
              </TabsTrigger>
              <TabsTrigger value="scan">
                <Upload className="h-4 w-4 mr-2" />
                סריקת פירוט ויזה
              </TabsTrigger>
            </TabsList>

            {/* Manual Entry */}
            <TabsContent value="manual" className="space-y-4 mt-6">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="amount">סכום *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="vendor">ספק</Label>
                    <Input
                      id="vendor"
                      placeholder="שם העסק"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="date">תאריך *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">אמצעי תשלום</Label>
                    <select
                      id="paymentMethod"
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="credit">כרטיס אשראי</option>
                      <option value="debit">חיוב מיידי</option>
                      <option value="cash">מזומן</option>
                      <option value="bank_transfer">העברה בנקאית</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label>קטגוריה *</Label>
                  <ExpenseCategorySelector
                    onChange={(category) => {
                      setCategoryId(category.id);
                      setCategoryName(category.name);
                      setExpenseType(category.expense_type);
                    }}
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
                  {isSubmitting ? 'שומר...' : 'הוסף הוצאה'}
                </Button>
              </form>
            </TabsContent>

            {/* File Upload - Credit Card Statements Only */}
            <TabsContent value="scan" className="space-y-4 mt-6">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💳</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      סריקת פירוט ויזה/אשראי
                    </p>
                    <ul className="text-sm text-blue-800 space-y-1 mr-4 list-disc">
                      <li>העלה PDF של פירוט ויזה (כאל/מקס/ישראכרט/לאומי קארד וכו&apos;)</li>
                      <li>המערכת תזהה את כל ההוצאות ותסווג אותן אוטומטית לקטגוריות</li>
                      <li>תוכל לאשר או לערוך את הסיווג לפני השמירה</li>
                    </ul>
                  </div>
                </div>
              </div>
              <DocumentUploader
                documentType="credit"
                onSuccess={(data) => {
                  console.log('✅ Credit statement uploaded:', data);
                }}
                onError={(error) => {
                  addToast({ title: error, type: 'error' });
                }}
                acceptedFormats=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                maxSizeMB={20}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}


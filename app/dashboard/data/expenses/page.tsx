'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ExpenseCategorySelector } from '@/components/expenses/expense-category-selector';
import { Upload, PenLine } from 'lucide-react';

/**
 * דף הזנת הוצאות - 2 מצבים
 * 1. סריקה (OCR) - העלאת דוח בנק/אשראי
 * 2. הזנה ידנית - טופס פשוט
 */
export default function ExpensesDataPage() {
  const [activeTab, setActiveTab] = useState('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual entry state
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [categoryId, setCategoryId] = useState('');
  const [expenseType, setExpenseType] = useState('');

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('bank');

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
          expense_category_id: categoryId,
          expense_type: expenseType,
        }),
      });

      if (response.ok) {
        alert('✅ הוצאה נוספה בהצלחה!');
        // Reset form
        setAmount('');
        setVendor('');
        setNotes('');
      } else {
        alert('❌ שגיאה בהוספת הוצאה');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ שגיאה בהוספת הוצאה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const response = await fetch('/api/expenses/upload-statement', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ הדוח הועלה בהצלחה! מזהה: ${data.statementId}`);
        setFile(null);
      } else {
        alert('❌ שגיאה בהעלאת הדוח');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ שגיאה בהעלאת הדוח');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">הוסף הוצאה 💸</h1>
        <p className="mt-2 text-gray-600">
          הזן הוצאה חדשה או סרוק דוח בנק/אשראי
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>בחר שיטת הזנה</CardTitle>
          <CardDescription>
            הזנה ידנית מהירה או סריקה אוטומטית של דוח
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
                סריקת דוח
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
                    onSelect={(category) => {
                      setCategoryId(category.id);
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

            {/* File Upload */}
            <TabsContent value="scan" className="space-y-4 mt-6">
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <Label htmlFor="documentType">סוג דוח</Label>
                  <select
                    id="documentType"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  >
                    <option value="bank">דוח בנק</option>
                    <option value="credit">דוח אשראי</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="file">העלה קובץ</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    PDF, תמונה או Excel (עד 50MB)
                  </p>
                </div>

                {file && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting || !file}>
                  {isSubmitting ? 'מעלה...' : 'סרוק דוח'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}


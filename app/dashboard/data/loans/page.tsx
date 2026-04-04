'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toaster';

/**
 * דף הזנת הלוואות
 */
export default function LoansDataPage() {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [lenderName, setLenderName] = useState('');
  const [loanType, setLoanType] = useState('personal');
  const [originalAmount, setOriginalAmount] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/loans/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lender_name: lenderName,
          loan_type: loanType,
          original_amount: parseFloat(originalAmount),
          current_balance: parseFloat(currentBalance),
          monthly_payment: parseFloat(monthlyPayment),
          interest_rate: parseFloat(interestRate),
          active: true,
        }),
      });

      if (response.ok) {
        addToast({ title: 'הלוואה נוספה בהצלחה!', type: 'success' });
        // Reset
        setLenderName('');
        setOriginalAmount('');
        setCurrentBalance('');
        setMonthlyPayment('');
        setInterestRate('');
      } else {
        addToast({ title: 'שגיאה בהוספת הלוואה', type: 'error' });
      }
    } catch (error) {
      console.error('Error:', error);
      addToast({ title: 'שגיאה בהוספת הלוואה', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">הוסף הלוואה 🏦</h1>
        <p className="mt-2 text-gray-600">
          הזן פרטי הלוואה או עבור לסימולטור איחוד
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle>הלוואה חדשה</CardTitle>
            <CardDescription>הזן פרטי הלוואה ידנית</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="lenderName">שם המלווה *</Label>
                <Input
                  id="lenderName"
                  placeholder="שם הבנק או המלווה"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="loanType">סוג הלוואה *</Label>
                <select
                  id="loanType"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                >
                  <option value="personal">הלוואה אישית</option>
                  <option value="mortgage">משכנתא</option>
                  <option value="car">הלוואת רכב</option>
                  <option value="student">הלוואת סטודנטים</option>
                  <option value="credit">כרטיס אשראי</option>
                  <option value="business">עסקית</option>
                  <option value="other">אחר</option>
                </select>
              </div>

              <div>
                <Label htmlFor="originalAmount">סכום מקורי *</Label>
                <Input
                  id="originalAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={originalAmount}
                  onChange={(e) => setOriginalAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="currentBalance">יתרה נוכחית *</Label>
                <Input
                  id="currentBalance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={currentBalance}
                  onChange={(e) => setCurrentBalance(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="monthlyPayment">תשלום חודשי *</Label>
                <Input
                  id="monthlyPayment"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="interestRate">ריבית שנתית (%)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'שומר...' : 'הוסף הלוואה'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loan Simulator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              סימולטור איחוד
            </CardTitle>
            <CardDescription>
              רוצה לאחד הלוואות? בדוק כמה תחסוך
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-2">
                💡 הסימולטור מאפשר:
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• להשוות בין מסלולים שונים</li>
                <li>• לראות חיסכון פוטנציאלי</li>
                <li>• להגיש בקשה לאיחוד</li>
                <li>• להעלות מסמכים נדרשים</li>
              </ul>
            </div>

            <Link href="/loans-simulator">
              <Button className="w-full">
                פתח סימולטור איחוד
              </Button>
            </Link>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}


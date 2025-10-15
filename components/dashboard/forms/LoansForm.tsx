'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  Plus, Trash2, Upload, Scan, Loader2, CheckCircle, XCircle, FileText, 
  DollarSign, Home, Car, GraduationCap, CreditCard, Building2, Save, ArrowRight 
} from 'lucide-react';

interface Loan {
  id?: string;
  lender_name: string;
  loan_number?: string;
  loan_type: 'mortgage' | 'personal' | 'car' | 'student' | 'credit' | 'business' | 'other';
  original_amount: number | null;
  current_balance: number | null;
  monthly_payment: number | null;
  interest_rate?: number | null;
  start_date?: string;
  end_date?: string;
  remaining_payments?: number | null;
  notes?: string;
}

interface LoansFormProps {
  initialLoans: any[];
}

const loanTypes = [
  { value: 'mortgage', label: 'משכנתא', icon: <Home className="w-4 h-4" /> },
  { value: 'personal', label: 'הלוואה אישית', icon: <DollarSign className="w-4 h-4" /> },
  { value: 'car', label: 'הלוואת רכב', icon: <Car className="w-4 h-4" /> },
  { value: 'student', label: 'הלוואת לימודים', icon: <GraduationCap className="w-4 h-4" /> },
  { value: 'credit', label: 'מסגרת אשראי', icon: <CreditCard className="w-4 h-4" /> },
  { value: 'business', label: 'הלוואת עסק', icon: <Building2 className="w-4 h-4" /> },
  { value: 'other', label: 'אחר', icon: <FileText className="w-4 h-4" /> },
];

export default function LoansForm({ initialLoans }: LoansFormProps) {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>(
    initialLoans.map(loan => ({
      id: loan.id,
      lender_name: loan.lender_name,
      loan_number: loan.loan_number,
      loan_type: loan.loan_type,
      original_amount: loan.original_amount,
      current_balance: loan.current_balance,
      monthly_payment: loan.monthly_payment,
      interest_rate: loan.interest_rate,
      start_date: loan.start_date,
      end_date: loan.end_date,
      remaining_payments: loan.remaining_payments,
      notes: loan.notes
    }))
  );
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [statementPreview, setStatementPreview] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const addLoan = () => {
    const newLoan: Loan = {
      lender_name: '',
      loan_type: 'personal',
      original_amount: null,
      current_balance: null,
      monthly_payment: null,
    };
    setLoans(prev => [...prev, newLoan]);
  };

  const updateLoan = (index: number, field: keyof Loan, value: any) => {
    setLoans(prev =>
      prev.map((loan, i) =>
        i === index ? { ...loan, [field]: value } : loan
      )
    );
  };

  const removeLoan = (index: number) => {
    setLoans(prev => prev.filter((_, i) => i !== index));
  };

  const handleScanLoanStatement = async (statementFile: File | null) => {
    if (!statementFile) return;

    setIsScanning(true);
    setScanError(null);
    setScanSuccess(false);

    try {
      const formData = new FormData();
      formData.append('loanStatement', statementFile);

      const response = await fetch('/api/ocr/loan-statement', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan loan statement');
      }

      const result = await response.json();
      const scannedLoan = result.data;

      const newLoan: Loan = {
        lender_name: scannedLoan.lenderName || '',
        loan_number: scannedLoan.loanNumber || '',
        loan_type: scannedLoan.loanType || 'personal',
        original_amount: scannedLoan.originalAmount || null,
        current_balance: scannedLoan.currentBalance || null,
        monthly_payment: scannedLoan.monthlyPayment || null,
        interest_rate: scannedLoan.interestRate || null,
        start_date: scannedLoan.startDate || '',
        end_date: scannedLoan.endDate || '',
        remaining_payments: scannedLoan.remainingPayments || null,
        notes: scannedLoan.notes || '',
      };

      setLoans(prev => [...prev, newLoan]);
      setScanSuccess(true);
      setTimeout(() => {
        setShowScanner(false);
        setScanSuccess(false);
      }, 2000);

    } catch (error: any) {
      console.error('Scan error:', error);
      setScanError(error.message || 'שגיאה בסריקה');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage('');

    try {
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loans })
      });

      if (!response.ok) {
        throw new Error('Failed to save loans');
      }

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving loans:', error);
      alert('אירעה שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const getTypeInfo = (type: string) => loanTypes.find(t => t.value === type) || loanTypes[0];
  const totalDebt = loans.reduce((sum, loan) => sum + (loan.current_balance || 0), 0);
  const totalMonthly = loans.reduce((sum, loan) => sum + (loan.monthly_payment || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-l from-[#F6A623] to-[#F68B23] text-white rounded-2xl p-6 shadow-xl"
      >
        <div className="grid md:grid-cols-2 gap-4 text-center">
          <div>
            <h3 className="text-sm font-semibold mb-1 opacity-90">סך החוב הנוכחי</h3>
            <p className="text-4xl font-bold">{totalDebt.toLocaleString('he-IL')} ₪</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1 opacity-90">תשלום חודשי כולל</h3>
            <p className="text-4xl font-bold">{totalMonthly.toLocaleString('he-IL')} ₪</p>
          </div>
        </div>
      </motion.div>

      {/* OCR Scanner */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowScanner(!showScanner)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-l from-[#3A7BD5] to-[#7ED957] text-white rounded-lg hover:shadow-lg transition-all font-semibold"
        >
          <Scan className="w-5 h-5" />
          {showScanner ? 'סגור סורק דוח סילוקין' : 'סרוק דוח סילוקין (מילוי אוטומטי!)'}
        </button>

        {showScanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-6 bg-gradient-to-br from-[#E8F4FD] to-[#F5F6F8] border-2 border-[#3A7BD5] rounded-xl"
          >
            <div className="space-y-4">
              <div className="text-center">
                <FileText className="w-12 h-12 text-[#3A7BD5] mx-auto mb-3" />
                <h3 className="font-semibold text-[#1E2A3B] mb-2">העלאת דוח סילוקין</h3>
                <p className="text-sm text-[#555555]">המערכת תמלא אוטומטית את כל הפרטים מהדוח</p>
              </div>

              {!isScanning && !scanSuccess && (
                <div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setStatementPreview(file.name);
                        }
                      }}
                      className="hidden"
                      id="loan-statement-upload"
                    />
                    <div className="border-2 border-dashed border-[#3A7BD5] rounded-lg p-6 cursor-pointer hover:bg-white transition-colors text-center">
                      {statementPreview ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-6 h-6 text-[#3A7BD5]" />
                          <p className="text-sm text-[#1E2A3B] font-medium">{statementPreview}</p>
                        </div>
                      ) : (
                        <div className="py-4">
                          <Upload className="w-10 h-10 text-[#3A7BD5] mx-auto mb-2" />
                          <p className="text-sm text-[#555555]">לחץ להעלאה או גרור קובץ לכאן</p>
                          <p className="text-xs text-[#888888] mt-1">PDF, JPG, PNG</p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}

              {isScanning && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-[#3A7BD5] mx-auto mb-3 animate-spin" />
                  <p className="text-[#1E2A3B] font-semibold">סורק ומנתח...</p>
                  <p className="text-sm text-[#555555] mt-1">זה יכול לקחת כמה שניות</p>
                </div>
              )}

              {scanSuccess && (
                <div className="text-center py-8 bg-[#E8F5E9] rounded-lg">
                  <CheckCircle className="w-12 h-12 text-[#7ED957] mx-auto mb-3" />
                  <p className="text-[#1E2A3B] font-semibold">סריקה הושלמה בהצלחה!</p>
                  <p className="text-sm text-[#555555] mt-1">הפרטים מולאו אוטומטית</p>
                </div>
              )}

              {scanError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">{scanError}</p>
                    <p className="text-xs text-red-700 mt-1">נסה שוב או מלא ידנית</p>
                  </div>
                </div>
              )}

              {statementPreview && !isScanning && !scanSuccess && (
                <Button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('loan-statement-upload') as HTMLInputElement;
                    handleScanLoanStatement(input?.files?.[0] || null);
                  }}
                  className="w-full bg-[#3A7BD5] hover:bg-[#2E5EA5]"
                >
                  <Scan className="w-4 h-4 mr-2" />
                  התחל סריקה
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Add Loan Button */}
      <div className="flex justify-center">
        <Button
          type="button"
          onClick={addLoan}
          className="bg-[#7ED957] hover:bg-[#6BBF4A] text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          הוסף הלוואה ידנית
        </Button>
      </div>

      {loans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-[#888888]">עדיין לא הוספת הלוואות</p>
          <p className="text-xs text-[#888888] mt-1">לחץ על &quot;הוסף הלוואה&quot; או סרוק דוח סילוקין</p>
        </div>
      )}

      {/* Loans List */}
      <div className="space-y-4">
        <AnimatePresence>
          {loans.map((loan, index) => {
            const typeInfo = getTypeInfo(loan.loan_type);
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 relative"
              >
                {/* Remove Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLoan(index)}
                  className="absolute top-3 left-3 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  {/* שם מלווה */}
                  <div>
                    <Label htmlFor={`lenderName-${index}`} className="text-[#1E2A3B] font-medium">שם המלווה</Label>
                    <Input
                      id={`lenderName-${index}`}
                      value={loan.lender_name}
                      onChange={(e) => updateLoan(index, 'lender_name', e.target.value)}
                      placeholder="לדוגמה: בנק הפועלים"
                      className="mt-1"
                    />
                  </div>

                  {/* סוג הלוואה */}
                  <div>
                    <Label htmlFor={`loanType-${index}`} className="text-[#1E2A3B] font-medium">סוג הלוואה</Label>
                    <Select
                      value={loan.loan_type}
                      onValueChange={(value: any) => updateLoan(index, 'loan_type', value)}
                    >
                      <SelectTrigger id={`loanType-${index}`} className="w-full mt-1">
                        <SelectValue placeholder="בחר סוג הלוואה" />
                      </SelectTrigger>
                      <SelectContent>
                        {loanTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              {type.icon}
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* סכום מקורי */}
                  <div>
                    <Label htmlFor={`originalAmount-${index}`} className="text-[#1E2A3B] font-medium">סכום מקורי</Label>
                    <div className="relative mt-1">
                      <Input
                        id={`originalAmount-${index}`}
                        type="number"
                        value={loan.original_amount || ''}
                        onChange={(e) => updateLoan(index, 'original_amount', parseFloat(e.target.value) || null)}
                        placeholder="0"
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                  </div>

                  {/* יתרה נוכחית */}
                  <div>
                    <Label htmlFor={`currentBalance-${index}`} className="text-[#1E2A3B] font-medium">יתרת חוב</Label>
                    <div className="relative mt-1">
                      <Input
                        id={`currentBalance-${index}`}
                        type="number"
                        value={loan.current_balance || ''}
                        onChange={(e) => updateLoan(index, 'current_balance', parseFloat(e.target.value) || null)}
                        placeholder="0"
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                  </div>

                  {/* תשלום חודשי */}
                  <div>
                    <Label htmlFor={`monthlyPayment-${index}`} className="text-[#1E2A3B] font-medium">תשלום חודשי</Label>
                    <div className="relative mt-1">
                      <Input
                        id={`monthlyPayment-${index}`}
                        type="number"
                        value={loan.monthly_payment || ''}
                        onChange={(e) => updateLoan(index, 'monthly_payment', parseFloat(e.target.value) || null)}
                        placeholder="0"
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#E8F5E9] border border-[#7ED957] rounded-lg p-4 text-center"
        >
          <p className="text-[#1E2A3B] font-semibold">{successMessage}</p>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard')}
          disabled={loading}
        >
          ביטול
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="bg-[#3A7BD5] hover:bg-[#2E5EA5] text-white px-8"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              שמור והמשך
              <ArrowRight className="w-4 h-4 mr-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}


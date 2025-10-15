'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Upload, Scan, Loader2, CheckCircle, XCircle, FileText, DollarSign } from 'lucide-react';

interface Loan {
  id: string;
  lenderName: string;
  loanNumber?: string;
  loanType: 'mortgage' | 'personal' | 'car' | 'student' | 'credit' | 'business' | 'other';
  originalAmount: number;
  currentBalance: number;
  monthlyPayment: number;
  interestRate?: number;
  startDate?: string;
  endDate?: string;
  remainingPayments?: number;
  notes?: string;
}

interface LoansSectionProps {
  onSave: (loans: Loan[]) => Promise<void>;
  initialLoans?: Loan[];
}

const loanTypes = [
  { value: 'mortgage', label: 'משכנתא', icon: '🏠' },
  { value: 'personal', label: 'הלוואה אישית', icon: '💰' },
  { value: 'car', label: 'הלוואת רכב', icon: '🚗' },
  { value: 'student', label: 'הלוואת לימודים', icon: '🎓' },
  { value: 'credit', label: 'מסגרת אשראי', icon: '💳' },
  { value: 'business', label: 'הלוואת עסק', icon: '🏢' },
  { value: 'other', label: 'אחר', icon: '📋' },
];

export default function LoansSection({ onSave, initialLoans = [] }: LoansSectionProps) {
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [saving, setSaving] = useState(false);
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<number | null>(null);

  const addLoan = () => {
    const newLoan: Loan = {
      id: Math.random().toString(36).substr(2, 9),
      lenderName: '',
      loanType: 'personal',
      originalAmount: 0,
      currentBalance: 0,
      monthlyPayment: 0,
    };
    setLoans([...loans, newLoan]);
  };

  const updateLoan = (id: string, field: keyof Loan, value: any) => {
    setLoans(loans.map(loan => 
      loan.id === id ? { ...loan, [field]: value } : loan
    ));
  };

  const removeLoan = (id: string) => {
    setLoans(loans.filter(l => l.id !== id));
  };

  const handleScanStatement = async (index: number, file: File) => {
    setScanningIndex(index);
    setScanError(null);
    setScanSuccess(null);

    try {
      const formData = new FormData();
      formData.append('statement', file);

      const response = await fetch('/api/ocr/loan-statement', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan statement');
      }

      const result = await response.json();
      const loanData = result.data;

      // Update loan with scanned data
      const loan = loans[index];
      const updatedLoan = {
        ...loan,
        lenderName: loanData.lenderName || loan.lenderName,
        loanNumber: loanData.loanNumber || loan.loanNumber,
        loanType: loanData.loanType || loan.loanType,
        originalAmount: loanData.originalAmount || loan.originalAmount,
        currentBalance: loanData.currentBalance || loan.currentBalance,
        monthlyPayment: loanData.monthlyPayment || loan.monthlyPayment,
        interestRate: loanData.interestRate || loan.interestRate,
        startDate: loanData.startDate || loan.startDate,
        endDate: loanData.endDate || loan.endDate,
        remainingPayments: loanData.remainingPayments || loan.remainingPayments,
      };

      const updatedLoans = [...loans];
      updatedLoans[index] = updatedLoan;
      setLoans(updatedLoans);

      setScanSuccess(index);
      setTimeout(() => setScanSuccess(null), 3000);

    } catch (error: any) {
      console.error('Scan error:', error);
      setScanError(error.message || 'שגיאה בסריקת הדוח');
    } finally {
      setScanningIndex(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(loans);
    } catch (error) {
      console.error('Save error:', error);
      alert('שגיאה בשמירת ההלוואות');
    } finally {
      setSaving(false);
    }
  };

  const totalDebt = loans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
  const totalMonthlyPayment = loans.reduce((sum, loan) => sum + (loan.monthlyPayment || 0), 0);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">הלוואות והתחייבויות 💳</h2>
        <p className="text-[#555555]">פירוט כל ההלוואות וההתחייבויות שלך</p>
        <div className="inline-block bg-[#FFF3E0] px-4 py-2 rounded-lg mt-3">
          <p className="text-xs text-[#F6A623]">
            <strong>💡 טיפ:</strong> העלה דוח סילוקין לכל הלוואה למילוי אוטומטי מדויק!
          </p>
        </div>
      </div>

      {/* Add Loan Button */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-[#1E2A3B]">רשימת הלוואות</h3>
        <Button
          type="button"
          onClick={addLoan}
          className="gap-2 bg-[#3A7BD5] hover:bg-[#2E5EA5]"
        >
          <Plus className="w-4 h-4" />
          הוסף הלוואה
        </Button>
      </div>

      {loans.length === 0 && (
        <div className="text-center py-12 bg-[#F5F6F8] rounded-lg border-2 border-dashed border-gray-300">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-[#888888]">עדיין לא הוספת הלוואות</p>
          <p className="text-xs text-[#888888] mt-1">לחץ על "הוסף הלוואה" כדי להתחיל</p>
        </div>
      )}

      {/* Loans List */}
      <div className="space-y-4">
        {loans.map((loan, index) => {
          const typeInfo = loanTypes.find(t => t.value === loan.loanType) || loanTypes[0];
          const isScanning = scanningIndex === index;
          const isSuccess = scanSuccess === index;

          return (
            <div 
              key={loan.id}
              className="bg-white rounded-lg border-2 border-gray-200 p-6 hover:border-[#3A7BD5] transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{typeInfo.icon}</div>
                  <div>
                    <h4 className="font-semibold text-[#1E2A3B]">
                      {loan.lenderName || `הלוואה ${index + 1}`}
                    </h4>
                    <p className="text-sm text-[#888888]">{typeInfo.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* OCR Upload */}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleScanStatement(index, file);
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                      disabled={isScanning}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-[#7ED957] text-[#7ED957] hover:bg-[#E8F5E9]"
                      disabled={isScanning}
                      asChild
                    >
                      <span>
                        {isScanning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            סורק...
                          </>
                        ) : (
                          <>
                            <Scan className="w-4 h-4" />
                            סרוק דוח סילוקין
                          </>
                        )}
                      </span>
                    </Button>
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeLoan(loan.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Success/Error Messages */}
              {isSuccess && (
                <div className="mb-4 p-3 bg-[#E8F5E9] border border-[#7ED957] rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[#7ED957]" />
                  <p className="text-sm text-[#1E2A3B] font-medium">
                    הדוח נסרק בהצלחה! הפרטים מולאו אוטומטית
                  </p>
                </div>
              )}

              {scanError && scanningIndex === null && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-900">{scanError}</p>
                </div>
              )}

              {/* Form Fields */}
              <div className="grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Lender Name */}
                  <div>
                    <Label className="text-xs text-[#555555]">שם המלווה</Label>
                    <Input
                      value={loan.lenderName}
                      onChange={(e) => updateLoan(loan.id, 'lenderName', e.target.value)}
                      placeholder="לדוגמה: בנק הפועלים"
                      className="mt-1"
                    />
                  </div>

                  {/* Loan Type */}
                  <div>
                    <Label className="text-xs text-[#555555]">סוג הלוואה</Label>
                    <Select 
                      value={loan.loanType} 
                      onValueChange={(val) => updateLoan(loan.id, 'loanType', val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {loanTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* Original Amount */}
                  <div>
                    <Label className="text-xs text-[#555555]">סכום מקורי</Label>
                    <div className="relative mt-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={loan.originalAmount || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                          updateLoan(loan.id, 'originalAmount', value);
                        }}
                        placeholder="0"
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                  </div>

                  {/* Current Balance */}
                  <div>
                    <Label className="text-xs text-[#555555] font-semibold">יתרת חוב נוכחית ⭐</Label>
                    <div className="relative mt-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={loan.currentBalance || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                          updateLoan(loan.id, 'currentBalance', value);
                        }}
                        placeholder="0"
                        className="text-left pr-10 border-[#F6A623] font-semibold"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                  </div>

                  {/* Monthly Payment */}
                  <div>
                    <Label className="text-xs text-[#555555] font-semibold">תשלום חודשי ⭐</Label>
                    <div className="relative mt-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={loan.monthlyPayment || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0;
                          updateLoan(loan.id, 'monthlyPayment', value);
                        }}
                        placeholder="0"
                        className="text-left pr-10 border-[#F6A623] font-semibold"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]">₪</span>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* Interest Rate */}
                  <div>
                    <Label className="text-xs text-[#555555]">ריבית שנתית (%)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={loan.interestRate || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateLoan(loan.id, 'interestRate', value);
                      }}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>

                  {/* Start Date */}
                  <div>
                    <Label className="text-xs text-[#555555]">תאריך התחלה</Label>
                    <Input
                      type="date"
                      value={loan.startDate || ''}
                      onChange={(e) => updateLoan(loan.id, 'startDate', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <Label className="text-xs text-[#555555]">תאריך סיום משוער</Label>
                    <Input
                      type="date"
                      value={loan.endDate || ''}
                      onChange={(e) => updateLoan(loan.id, 'endDate', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs text-[#555555]">הערות (אופציונלי)</Label>
                  <Input
                    value={loan.notes || ''}
                    onChange={(e) => updateLoan(loan.id, 'notes', e.target.value)}
                    placeholder="מידע נוסף על ההלוואה..."
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {loans.length > 0 && (
        <div className="bg-gradient-to-l from-[#FFEBEE] to-[#FFF3E0] border-2 border-[#D64541] rounded-lg p-6">
          <h3 className="font-semibold text-[#1E2A3B] mb-4">📊 סיכום התחייבויות:</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-[#888888]">סה״כ יתרת חוב</p>
              <p className="text-2xl font-bold text-[#D64541]">
                {totalDebt.toLocaleString('he-IL')} ₪
              </p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <p className="text-xs text-[#888888]">סה״כ תשלום חודשי</p>
              <p className="text-2xl font-bold text-[#F6A623]">
                {totalMonthlyPayment.toLocaleString('he-IL')} ₪
              </p>
            </div>
          </div>

          {/* Breakdown by type */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-[#888888] mb-2">פירוט לפי סוג:</p>
            <div className="space-y-1 text-sm">
              {loanTypes.map(type => {
                const loansOfType = loans.filter(l => l.loanType === type.value);
                const total = loansOfType.reduce((sum, l) => sum + (l.currentBalance || 0), 0);
                if (total === 0) return null;

                return (
                  <div key={type.value} className="flex justify-between items-center">
                    <span className="text-[#555555]">{type.icon} {type.label}</span>
                    <span className="font-medium text-[#1E2A3B]">
                      {total.toLocaleString('he-IL')} ₪
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || loans.length === 0}
          className="px-8 bg-[#3A7BD5] hover:bg-[#2E5EA5]"
        >
          {saving ? 'שומר...' : 'שמור הלוואות'}
        </Button>
      </div>
    </div>
  );
}


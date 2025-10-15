'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wallet, Save, ArrowRight, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface CashFlowFormProps {
  initialBalance: number;
}

export default function CashFlowForm({ initialBalance }: CashFlowFormProps) {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(initialBalance);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage('');

    try {
      const response = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_account_balance: balance,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save balance');
      }

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving balance:', error);
      alert('אירעה שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance Input Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-[#3A7BD5] to-[#7ED957] rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">יתרת חשבון עו&quot;ש</h2>
          <p className="text-sm text-[#888888] text-center">
            הזן את היתרה הנוכחית בחשבון העובר ושב שלך
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Label htmlFor="balance" className="text-lg font-medium text-[#1E2A3B] mb-3 block text-center">
            יתרה נוכחית
          </Label>
          <div className="relative">
            <Input
              id="balance"
              type="number"
              value={balance || ''}
              onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="text-center text-3xl font-bold h-20 pr-16"
            />
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-bold text-[#3A7BD5]">₪</span>
          </div>

          {/* Visual Indicator */}
          <div className="mt-6 p-4 rounded-lg bg-[#F5F6F8] flex items-center justify-center gap-3">
            {balance > 0 ? (
              <>
                <TrendingUp className="w-6 h-6 text-[#7ED957]" />
                <span className="text-sm text-[#555555]">
                  יתרה חיובית - מצב תקין ✓
                </span>
              </>
            ) : balance < 0 ? (
              <>
                <TrendingDown className="w-6 h-6 text-[#F6A623]" />
                <span className="text-sm text-[#555555]">
                  יתרה שלילית - משיכת יתר
                </span>
              </>
            ) : (
              <span className="text-sm text-[#888888]">
                הזן את היתרה הנוכחית
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-[#E8F4FD] to-[#E8F5E9] p-6 rounded-xl border-2 border-[#3A7BD5]/30"
      >
        <div className="flex items-start gap-3">
          <div className="text-3xl">💡</div>
          <div>
            <h3 className="font-bold text-[#1E2A3B] mb-2">למה זה חשוב?</h3>
            <ul className="space-y-2 text-sm text-[#555555]">
              <li className="flex items-start gap-2">
                <span className="text-[#7ED957] mt-0.5">✓</span>
                <span>מאפשר לנו לחשב את תזרים המזומנים החודשי שלך</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7ED957] mt-0.5">✓</span>
                <span>עוזר לזהות אם אתה חי מחודש לחודש או יש לך מרווח נשימה</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7ED957] mt-0.5">✓</span>
                <span>נקודת התחלה לבניית קרן חירום</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

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


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, Save, ArrowRight, Loader2, TrendingDown, DollarSign, Building, Bitcoin } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { useToast } from '@/components/ui/toaster';

interface InvestmentsFormProps {
  initialData: any;
}

interface InvestmentAmounts {
  stocks_israel: number;
  stocks_foreign: number;
  bonds: number;
  mutual_funds: number;
  crypto: number;
  real_estate: number;
  other: number;
}

export default function InvestmentsForm({ initialData }: InvestmentsFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const existingTotal = initialData?.investments || 0;
  const [hasInvestments, setHasInvestments] = useState<boolean | null>(
    existingTotal > 0 ? true : null
  );
  const [amounts, setAmounts] = useState<InvestmentAmounts>(() => {
    if (initialData?.investments_breakdown) {
      return { stocks_israel: 0, stocks_foreign: 0, bonds: 0, mutual_funds: 0, crypto: 0, real_estate: 0, other: 0, ...initialData.investments_breakdown };
    }
    return { stocks_israel: 0, stocks_foreign: 0, bonds: 0, mutual_funds: 0, crypto: 0, real_estate: 0, other: 0 };
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const updateAmount = (field: keyof InvestmentAmounts, value: number) => {
    setAmounts(prev => ({ ...prev, [field]: value }));
  };

  const calculateTotal = () => {
    return Object.values(amounts).reduce((sum, val) => sum + val, 0);
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage('');

    try {
      const totalInvestments = calculateTotal();
      
      const response = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investments: totalInvestments,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save investments');
      }

      // סימון הסקציה כ-completed
      await fetch('/api/user/section/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subsection: 'investments' })
      });

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);

    } catch (error) {
      console.error('Error saving investments:', error);
      addToast({ title: 'אירעה שגיאה בשמירת הנתונים', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing investments summary */}
      {existingTotal > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-200"
        >
          <h3 className="text-lg font-bold text-[#1E2A3B] mb-2">סה&quot;כ השקעות רשומות</h3>
          <p className="text-3xl font-bold text-phi-mint">
            {existingTotal.toLocaleString('he-IL')} ₪
          </p>
          <p className="text-sm text-gray-500 mt-2">עדכן למטה אם יש שינויים</p>
        </motion.div>
      )}

      {/* Main Question */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-phi-mint to-[#6BBF4A] rounded-full flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1E2A3B]">יש לך תיק השקעות?</h2>
            <p className="text-sm text-[#888888]">מניות, אג&quot;ח, קרנות נאמנות, קריפטו וכו&apos;</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => setHasInvestments(true)}
            className={`p-6 rounded-xl border-2 transition-all ${
              hasInvestments === true
                ? 'border-phi-mint bg-green-50'
                : 'border-gray-200 hover:border-phi-mint hover:bg-phi-bg'
            }`}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="font-bold text-[#1E2A3B]">כן, יש לי השקעות</div>
              <div className="text-xs text-[#888888] mt-1">אספר עליהן</div>
            </div>
          </button>

          <button
            onClick={() => setHasInvestments(false)}
            className={`p-6 rounded-xl border-2 transition-all ${
              hasInvestments === false
                ? 'border-[#3A7BD5] bg-[#E8F4FD]'
                : 'border-gray-200 hover:border-[#3A7BD5] hover:bg-phi-bg'
            }`}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">❌</div>
              <div className="font-bold text-[#1E2A3B]">אין לי השקעות</div>
              <div className="text-xs text-[#888888] mt-1">רק חסכונות רגילים</div>
            </div>
          </button>
        </div>
      </motion.div>

      {/* Investment Details (if has investments) */}
      {hasInvestments === true && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Total Summary */}
          <div className="bg-gradient-to-l from-phi-mint to-[#6BBF4A] text-white rounded-2xl p-6 shadow-xl">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">סך כל ההשקעות</h3>
              <p className="text-5xl font-bold">
                {calculateTotal().toLocaleString('he-IL')} ₪
              </p>
            </div>
          </div>

          {/* Investment Types */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
            <h3 className="text-xl font-bold text-[#1E2A3B] mb-6 flex items-center gap-2">
              פרט את ההשקעות שלך
              <InfoTooltip content="הזן סכומים משוערים - לא צריך להיות מדויק לגמרי" type="info" />
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* מניות ישראל */}
              <div>
                <Label className="text-sm text-[#555555] flex items-center gap-1 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  מניות בישראל
                  <InfoTooltip content="מניות בבורסה בת&quot;א" />
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amounts.stocks_israel || ''}
                    onChange={(e) => updateAmount('stocks_israel', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-left pr-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                </div>
              </div>

              {/* מניות חו"ל */}
              <div>
                <Label className="text-sm text-[#555555] flex items-center gap-1 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  מניות בחו&quot;ל
                  <InfoTooltip content="מניות בארה&quot;ב, אירופה וכו&apos;" />
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amounts.stocks_foreign || ''}
                    onChange={(e) => updateAmount('stocks_foreign', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-left pr-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                </div>
              </div>

              {/* אג"ח */}
              <div>
                <Label className="text-sm text-[#555555] flex items-center gap-1 mb-2">
                  <TrendingDown className="w-4 h-4 text-indigo-500" />
                  אגרות חוב (אג&quot;ח)
                  <InfoTooltip content="אגרות חוב ממשלתיות או קונצרניות" />
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amounts.bonds || ''}
                    onChange={(e) => updateAmount('bonds', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-left pr-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                </div>
              </div>

              {/* קרנות נאמנות */}
              <div>
                <Label className="text-sm text-[#555555] flex items-center gap-1 mb-2">
                  <DollarSign className="w-4 h-4 text-purple-500" />
                  קרנות נאמנות
                  <InfoTooltip content="קרנות נאמנות וקרנות מדד" />
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amounts.mutual_funds || ''}
                    onChange={(e) => updateAmount('mutual_funds', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-left pr-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                </div>
              </div>

              {/* קריפטו */}
              <div>
                <Label className="text-sm text-[#555555] flex items-center gap-1 mb-2">
                  <Bitcoin className="w-4 h-4 text-orange-500" />
                  מטבעות דיגיטליים
                  <InfoTooltip content="ביטקוין, אתריום וכו&apos;" />
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amounts.crypto || ''}
                    onChange={(e) => updateAmount('crypto', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-left pr-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                </div>
              </div>

              {/* נדל"ן להשקעה */}
          <div>
                <Label className="text-sm text-[#555555] flex items-center gap-1 mb-2">
                  <Building className="w-4 h-4 text-cyan-500" />
                  נדל&quot;ן להשקעה
                  <InfoTooltip content="דירות להשכרה, חנויות, מגרשים" />
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amounts.real_estate || ''}
                    onChange={(e) => updateAmount('real_estate', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-left pr-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                </div>
              </div>

              {/* אחר */}
              <div className="md:col-span-2">
                <Label className="text-sm text-[#555555] flex items-center gap-1 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  השקעות אחרות
                  <InfoTooltip content="סחורות, אומנות, יין, וכו&apos;" />
            </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amounts.other || ''}
                    onChange={(e) => updateAmount('other', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="text-left pr-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

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
                <span className="text-phi-mint mt-0.5">✓</span>
                <span>מאפשר לנו לתת לך תמונה מלאה של <strong>השווי הנקי</strong> שלך</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-phi-mint mt-0.5">✓</span>
                <span>עוזר להעריך אם יש לך <strong>פיזור סיכונים נכון</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-phi-mint mt-0.5">✓</span>
                <span>נוכל להמליץ על אסטרטגיות השקעה מתאימות לגילך ומצבך</span>
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
          className="bg-green-50 border border-phi-mint rounded-lg p-4 text-center"
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
          disabled={loading || hasInvestments === null}
          className="bg-phi-dark hover:bg-[#2E5EA5] text-white px-8"
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


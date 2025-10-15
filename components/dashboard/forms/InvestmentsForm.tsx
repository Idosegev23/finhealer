'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TrendingUp, Save, ArrowRight, Loader2 } from 'lucide-react';

interface InvestmentsFormProps {
  initialData: any;
}

export default function InvestmentsForm({ initialData }: InvestmentsFormProps) {
  const router = useRouter();
  const [hasInvestments, setHasInvestments] = useState<boolean | null>(null);
  const [investmentsDetails, setInvestmentsDetails] = useState<string>(initialData.investments_details || '');
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
          has_investments: hasInvestments,
          investments_details: investmentsDetails,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save investments');
      }

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving investments:', error);
      alert('אירעה שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Question */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#7ED957] to-[#6BBF4A] rounded-full flex items-center justify-center">
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
                ? 'border-[#7ED957] bg-[#E8F5E9]'
                : 'border-gray-200 hover:border-[#7ED957] hover:bg-[#F5F6F8]'
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
                : 'border-gray-200 hover:border-[#3A7BD5] hover:bg-[#F5F6F8]'
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

      {/* Details (if has investments) */}
      {hasInvestments === true && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
        >
          <h3 className="text-xl font-bold text-[#1E2A3B] mb-4">ספר לנו קצת יותר</h3>

          <div>
            <Label htmlFor="investmentsDetails" className="text-sm font-medium text-[#555555] mb-2 block">
              פרט את ההשקעות שלך (סכומים משוערים)
            </Label>
            <textarea
              id="investmentsDetails"
              value={investmentsDetails}
              onChange={(e) => setInvestmentsDetails(e.target.value)}
              placeholder="לדוגמה:&#10;• מניות בארה&quot;ב - ~200,000 ₪&#10;• מניות בישראל - ~100,000 ₪&#10;• קרנות נאמנות - ~150,000 ₪&#10;• ביטקוין - ~50,000 ₪"
              className="w-full p-4 border border-gray-300 rounded-lg resize-none h-48 focus:outline-none focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-[#888888] mt-2">
              💡 לא צריך לפרט כל מניה - מספיק פירוט כללי לפי סוג נכס
            </p>
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
                <span className="text-[#7ED957] mt-0.5">✓</span>
                <span>מאפשר לנו לתת לך תמונה מלאה של <strong>השווי הנקי</strong> שלך</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7ED957] mt-0.5">✓</span>
                <span>עוזר להעריך אם יש לך <strong>פיזור סיכונים נכון</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7ED957] mt-0.5">✓</span>
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
          disabled={loading || hasInvestments === null}
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


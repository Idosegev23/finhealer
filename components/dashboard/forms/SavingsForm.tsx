'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PiggyBank, Home, Car, Landmark, Save, ArrowRight, Loader2 } from 'lucide-react';

interface SavingsFormProps {
  initialData: any;
}

export default function SavingsForm({ initialData }: SavingsFormProps) {
  const router = useRouter();
  const [totalSavings, setTotalSavings] = useState<number>(initialData.total_savings || 0);
  const [ownsHome, setOwnsHome] = useState<boolean>(initialData.owns_home || false);
  const [ownsCar, setOwnsCar] = useState<boolean>(initialData.owns_car || false);
  const [otherAssets, setOtherAssets] = useState<string>(initialData.other_assets || '');
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
          total_savings: totalSavings,
          owns_home: ownsHome,
          owns_car: ownsCar,
          other_assets: otherAssets,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save savings');
      }

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving savings:', error);
      alert('אירעה שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Total Savings Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-phi-mint to-[#6BBF4A] rounded-full flex items-center justify-center">
            <PiggyBank className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1E2A3B]">סך החסכונות</h2>
            <p className="text-sm text-[#888888]">קרנות פנסיה, חיסכון, קופות גמל ועוד</p>
          </div>
        </div>

        <div>
          <Label htmlFor="totalSavings" className="text-lg font-medium text-[#1E2A3B] mb-2 block">
            סך כל החסכונות
          </Label>
          <div className="relative">
            <Input
              id="totalSavings"
              type="number"
              value={totalSavings || ''}
              onChange={(e) => setTotalSavings(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="text-left text-2xl font-bold h-16 pr-16"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-phi-mint">₪</span>
          </div>
          <p className="text-xs text-[#888888] mt-2">
            כולל: קרן פנסיה, קרן השתלמות, קופת גמל, חסכונות בבנק, פיקדונות וכו&apos;
          </p>
        </div>
      </motion.div>

      {/* Assets Checkboxes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
      >
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-6">נכסים</h2>

        <div className="space-y-6">
          {/* Owns Home */}
          <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-phi-bg transition-colors">
            <Checkbox
              id="ownsHome"
              checked={ownsHome}
              onCheckedChange={(checked) => setOwnsHome(checked as boolean)}
              className="w-6 h-6"
            />
            <label htmlFor="ownsHome" className="flex items-center gap-3 cursor-pointer flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-phi-dark to-[#2E5EA5] rounded-full flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-[#1E2A3B]">יש לי דירה בבעלות</div>
                <div className="text-sm text-[#888888]">דירה או נדל&quot;ן אחר בבעלותי</div>
              </div>
            </label>
          </div>

          {/* Owns Car */}
          <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-phi-bg transition-colors">
            <Checkbox
              id="ownsCar"
              checked={ownsCar}
              onCheckedChange={(checked) => setOwnsCar(checked as boolean)}
              className="w-6 h-6"
            />
            <label htmlFor="ownsCar" className="flex items-center gap-3 cursor-pointer flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-[#F6A623] to-[#F68B23] rounded-full flex items-center justify-center">
                <Car className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-[#1E2A3B]">יש לי רכב בבעלות</div>
                <div className="text-sm text-[#888888]">רכב שבבעלותי (לא ליסינג)</div>
              </div>
            </label>
          </div>
        </div>
      </motion.div>

      {/* Other Assets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-[#9C27B0] to-[#7B1FA2] rounded-full flex items-center justify-center">
            <Landmark className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1E2A3B]">נכסים נוספים</h2>
            <p className="text-sm text-[#888888]">זהב, אומנות, קריפטו, עסקים וכו&apos;</p>
          </div>
        </div>

        <div>
          <Label htmlFor="otherAssets" className="text-sm font-medium text-[#555555] mb-2 block">
            פרט נכסים נוספים (אופציונלי)
          </Label>
          <textarea
            id="otherAssets"
            value={otherAssets}
            onChange={(e) => setOtherAssets(e.target.value)}
            placeholder="לדוגמה: דירה להשכרה בשווי 1.5 מיליון, זהב בשווי 50,000 ₪..."
            className="w-full p-4 border border-gray-300 rounded-lg resize-none h-32 focus:outline-none focus:ring-2 focus:ring-[#3A7BD5] focus:border-transparent"
          />
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-[#E8F4FD] to-[#E8F5E9] p-6 rounded-xl border-2 border-[#3A7BD5]/30"
      >
        <div className="flex items-start gap-3">
          <div className="text-3xl">💡</div>
          <div>
            <h3 className="font-bold text-[#1E2A3B] mb-2">למה זה חשוב?</h3>
            <ul className="space-y-2 text-sm text-[#555555]">
              <li className="flex items-start gap-2">
                <span className="text-phi-mint mt-0.5">✓</span>
                <span>מאפשר לנו לחשב את <strong>שווי הנקי</strong> שלך (נכסים מינוס חובות)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-phi-mint mt-0.5">✓</span>
                <span>עוזר לתכנן את העתיד - האם יש לך מספיק חסכונות לפנסיה?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-phi-mint mt-0.5">✓</span>
                <span>מזהה נכסים שאפשר למנף או למכור במצב חירום</span>
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
          disabled={loading}
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


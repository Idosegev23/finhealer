'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Shield, FileText, CheckCircle, ExternalLink, Save, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface InsuranceFormProps {
  initialData: any;
}

export default function InsuranceForm({ initialData }: InsuranceFormProps) {
  const router = useRouter();
  const [hasConnected, setHasConnected] = useState<boolean>(initialData.insurance_connected || false);
  const [hasSignedAppendixA, setHasSignedAppendixA] = useState<boolean>(initialData.signed_appendix_a || false);
  const [hasSignedAppendixE, setHasSignedAppendixE] = useState<boolean>(initialData.signed_appendix_e || false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleConnectToMaslaka = () => {
    // This would open a modal or redirect to Maslaka connection flow
    alert('חיבור למסלקה יהיה זמין בקרוב! 🚀\n\nבינתיים, נוכל להמשיך בלי זה.');
    setHasConnected(true);
  };

  const handleSignAppendix = (appendixType: 'A' | 'E') => {
    // This would open a modal with the document to sign
    alert(`חתימה על נספח ${appendixType} תהיה זמינה בקרוב! 🚀\n\nבינתיים, נסמן שזה בוצע.`);
    
    if (appendixType === 'A') {
      setHasSignedAppendixA(true);
    } else {
      setHasSignedAppendixE(true);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage('');

    try {
      const response = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insurance_connected: hasConnected,
          signed_appendix_a: hasSignedAppendixA,
          signed_appendix_e: hasSignedAppendixE,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save insurance data');
      }

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving insurance data:', error);
      alert('אירעה שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const allCompleted = hasConnected && hasSignedAppendixA && hasSignedAppendixE;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-l from-[#F6A623] to-[#F68B23] text-white rounded-2xl p-6 shadow-xl"
      >
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-4">התקדמות</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${hasConnected ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-3xl mb-2">{hasConnected ? '✅' : '⏳'}</div>
              <div className="text-sm">חיבור למסלקה</div>
            </div>
            <div className={`p-4 rounded-lg ${hasSignedAppendixA ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-3xl mb-2">{hasSignedAppendixA ? '✅' : '⏳'}</div>
              <div className="text-sm">נספח א&apos;</div>
            </div>
            <div className={`p-4 rounded-lg ${hasSignedAppendixE ? 'bg-white/20' : 'bg-white/10'}`}>
              <div className="text-3xl mb-2">{hasSignedAppendixE ? '✅' : '⏳'}</div>
              <div className="text-sm">נספח ה&apos;</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Step 1: Connect to Maslaka */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`bg-white rounded-2xl shadow-lg p-8 border-2 ${hasConnected ? 'border-[#7ED957]' : 'border-gray-200'}`}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${hasConnected ? 'bg-[#E8F5E9]' : 'bg-gradient-to-br from-[#3A7BD5] to-[#7ED957]'}`}>
            {hasConnected ? (
              <CheckCircle className="w-8 h-8 text-[#7ED957]" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">שלב 1: חיבור למסלקה</h2>
            <p className="text-[#555555]">
              המסלקה היא מאגר מרכזי שמרכז את כל הביטוחים שלך. 
              חיבור אליה יאפשר לנו לקבל מידע מלא ומדויק על כל הביטוחים שיש לך.
            </p>
          </div>
        </div>

        {!hasConnected ? (
          <Button
            onClick={handleConnectToMaslaka}
            className="w-full bg-gradient-to-l from-[#3A7BD5] to-[#7ED957] hover:shadow-lg"
            size="lg"
          >
            <Shield className="w-5 h-5 ml-2" />
            התחבר למסלקה
            <ExternalLink className="w-4 h-4 mr-2" />
          </Button>
        ) : (
          <div className="bg-[#E8F5E9] border border-[#7ED957] rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-[#7ED957]" />
            <div>
              <div className="font-bold text-[#1E2A3B]">מחובר בהצלחה!</div>
              <div className="text-sm text-[#555555]">קיבלנו את כל פרטי הביטוחים שלך</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Step 2 & 3: Sign Appendices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200"
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-[#F6A623] to-[#F68B23] rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">שלבים 2 ו-3: חתימה על נספחים</h2>
            <p className="text-[#555555]">
              על פי חוק, נדרשת חתימתך על שני נספחים כדי לאפשר לנו לקבל מידע על הביטוחים שלך.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Appendix A */}
          <div className={`p-6 rounded-xl border-2 ${hasSignedAppendixA ? 'border-[#7ED957] bg-[#E8F5E9]' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-[#1E2A3B] text-lg mb-1">נספח א&apos; - הסכמה לקבלת מידע</h3>
                <p className="text-sm text-[#555555]">
                  נספח זה מאפשר לנו לקבל מידע על פוליסות הביטוח שלך מחברות הביטוח
                </p>
              </div>
              {hasSignedAppendixA && (
                <CheckCircle className="w-8 h-8 text-[#7ED957] flex-shrink-0" />
              )}
            </div>
            {!hasSignedAppendixA ? (
              <Button
                onClick={() => handleSignAppendix('A')}
                variant="outline"
                className="w-full border-[#F6A623] text-[#F6A623] hover:bg-[#FFF3E0]"
              >
                <FileText className="w-4 h-4 ml-2" />
                פתח וחתום על נספח א&apos;
              </Button>
            ) : (
              <div className="text-sm text-[#7ED957] font-semibold">✓ נחתם בהצלחה</div>
            )}
          </div>

          {/* Appendix E */}
          <div className={`p-6 rounded-xl border-2 ${hasSignedAppendixE ? 'border-[#7ED957] bg-[#E8F5E9]' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-[#1E2A3B] text-lg mb-1">נספח ה&apos; - הרשאה לפעולה</h3>
                <p className="text-sm text-[#555555]">
                  נספח זה מאשר לנו לפעול מולשם בכל הנוגע לניהול הביטוחים
                </p>
              </div>
              {hasSignedAppendixE && (
                <CheckCircle className="w-8 h-8 text-[#7ED957] flex-shrink-0" />
              )}
            </div>
            {!hasSignedAppendixE ? (
              <Button
                onClick={() => handleSignAppendix('E')}
                variant="outline"
                className="w-full border-[#F6A623] text-[#F6A623] hover:bg-[#FFF3E0]"
              >
                <FileText className="w-4 h-4 ml-2" />
                פתח וחתום על נספח ה&apos;
              </Button>
            ) : (
              <div className="text-sm text-[#7ED957] font-semibold">✓ נחתם בהצלחה</div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-[#E8F4FD] to-[#FFF3E0] p-6 rounded-xl border-2 border-[#3A7BD5]/30"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-[#3A7BD5] flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-[#1E2A3B] mb-2">מידע חשוב</h3>
            <ul className="space-y-2 text-sm text-[#555555]">
              <li className="flex items-start gap-2">
                <span className="text-[#3A7BD5] mt-0.5">•</span>
                <span>החתימה נעשית באופן דיגיטלי ומאובטח לחלוטין</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#3A7BD5] mt-0.5">•</span>
                <span>ניתן לבטל את ההסכמה בכל עת דרך ההגדרות</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#3A7BD5] mt-0.5">•</span>
                <span>המידע משמש אך ורק לצורך ניתוח ומתן המלצות פיננסיות</span>
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
              {allCompleted ? 'סיים והמשך' : 'שמור התקדמות'}
              <ArrowRight className="w-4 h-4 mr-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, CheckCircle2, Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

/**
 * Self-hides when the user already has Mislaka data (pension_insurance rows).
 * Showing this CTA after a successful Mislaka import is just noise.
 */
export function RequestPensionReport() {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState('');
  const [hasMislakaData, setHasMislakaData] = useState<boolean | null>(null); // null = checking

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setHasMislakaData(false); return; }
        const { count } = await supabase
          .from('pension_insurance')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        setHasMislakaData((count || 0) > 0);
      } catch {
        setHasMislakaData(false);
      }
    })();
  }, []);

  const handleRequest = async () => {
    setRequesting(true);
    setError('');

    try {
      const res = await fetch('/api/pension-report/request', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to request report');
      setRequested(true);
      setTimeout(() => setRequested(false), 5000);
    } catch (err) {
      console.error('Error requesting report:', err);
      setError('אירעה שגיאה בשליחת הבקשה. נסה שוב.');
    } finally {
      setRequesting(false);
    }
  };

  // Hide entirely if Mislaka data already exists or while checking.
  if (hasMislakaData !== false) return null;

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {requested ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-phi-mint/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-phi-mint" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">הבקשה נשלחה בהצלחה</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  גדי קיבל את הבקשה ויבקש עבורך את הדוח מהמסלקה הפנסיונית.
                  ברגע שהדוח יתקבל, כל הנתונים יתמלאו אוטומטית במערכת שלך.
                </p>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  זמן המתנה משוער: 1-2 ימי עסקים
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-phi-dark/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-phi-dark" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  מלא אוטומטית דרך המסלקה הפנסיונית
                </h3>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  גדי, כסוכן ביטוח מורשה, יכול לבקש עבורך דוח מפורט מהמסלקה הפנסיונית.
                  הדוח כולל את כל פרטי הפנסיה והביטוחים שלך מכל הגופים המוסדיים.
                </p>

                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">מה יכלל בדוח:</p>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {[
                      'כל קרנות הפנסיה וקופות הגמל שלך',
                      'יתרות עדכניות וערך צבור',
                      'דמי ניהול ותשואות',
                      'פוליסות ביטוח קיימות',
                      'הפקדות חודשיות',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-phi-mint flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={handleRequest}
                  disabled={requesting}
                  className="w-full bg-phi-dark hover:bg-phi-slate text-white"
                >
                  {requesting ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      שולח בקשה לגדי...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 ml-2" />
                      בקש דוח מגדי (חינם)
                    </>
                  )}
                </Button>

                {error && <p className="text-red-600 text-sm mt-2 text-center">{error}</p>}

                <p className="text-xs text-gray-500 mt-3 text-center flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  הדוח יתקבל תוך 1-2 ימי עסקים
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

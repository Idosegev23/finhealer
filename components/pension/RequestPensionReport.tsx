'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function RequestPensionReport() {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState('');

  const handleRequest = async () => {
    setRequesting(true);
    setError('');

    try {
      const res = await fetch('/api/pension-report/request', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to request report');
      }

      setRequested(true);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setRequested(false);
      }, 5000);

    } catch (err) {
      console.error('Error requesting report:', err);
      setError('אירעה שגיאה בשליחת הבקשה. נסה שוב.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {requested ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-green-50 border-2 border-green-500 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-900 mb-2">
                  הבקשה נשלחה בהצלחה! ✓
                </h3>
                <p className="text-green-800 text-sm leading-relaxed">
                  גדי קיבל את הבקשה ויבקש עבורך את הדוח מהמסלקה הפנסיונית.
                  <br />
                  ברגע שהדוח יתקבל, כל הנתונים יתמלאו אוטומטית במערכת שלך 🎉
                </p>
                <p className="text-green-700 text-xs mt-2">
                  זמן המתנה משוער: 1-2 ימי עסקים
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2">
                  מלא אוטומטית דרך המסלקה הפנסיונית
                </h3>
                <p className="text-blue-800 text-sm mb-4 leading-relaxed">
                  גדי, כסוכן ביטוח מורשה, יכול לבקש עבורך דוח מפורט מהמסלקה הפנסיונית.
                  הדוח יכלול את כל פרטי הפנסיה והביטוחים שלך מכל הגופים המוסדיים.
                </p>
                
                <div className="bg-white/70 rounded-lg p-4 mb-4">
                  <h4 className="font-bold text-blue-900 text-sm mb-2">מה יכלל בדוח:</h4>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">✓</span>
                      <span>כל קרנות הפנסיה וקופות הגמל שלך</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">✓</span>
                      <span>יתרות עדכניות וערך צבור</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">✓</span>
                      <span>דמי ניהול ותשואות</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">✓</span>
                      <span>פוליסות ביטוח קיימות</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">✓</span>
                      <span>הפקדות חודשיות</span>
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleRequest}
                  disabled={requesting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                >
                  {requesting ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      שולח בקשה לגדי...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 ml-2" />
                      בקש דוח מגדי (חינם!)
                    </>
                  )}
                </Button>

                {error && (
                  <p className="text-red-600 text-sm mt-2 text-center">{error}</p>
                )}

                <p className="text-xs text-blue-600 mt-3 text-center">
                  <Clock className="w-3 h-3 inline ml-1" />
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


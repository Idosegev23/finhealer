'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle, MessageCircle, ExternalLink, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';

interface WhatsAppRedirectProps {
  phone: string;
  userName?: string;
}

export function WhatsAppRedirect({ phone, userName }: WhatsAppRedirectProps) {
  // מספר הWhatsApp של הבוט (Phi)
  const botPhoneNumber = '972544266506';
  const waLink = `https://wa.me/${botPhoneNumber}?text=היי`;
  
  // פורמט מספר הטלפון להצגה
  const displayPhone = phone.startsWith('972') 
    ? `0${phone.slice(3)}` 
    : phone;

  return (
    <div className="min-h-screen bg-gradient-to-br from-phi-bg via-white to-phi-mint/10 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        {/* Success Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-6"
          >
            <div className="relative inline-block">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-phi-gold rounded-full flex items-center justify-center border-2 border-white"
              >
                <span className="text-white font-serif text-lg">φ</span>
              </motion.div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-2xl font-bold text-phi-dark mb-2">
              ההרשמה הושלמה בהצלחה! 🎉
            </h1>
            <p className="text-gray-600 mb-6">
              {userName ? `שלום ${userName}! ` : ''}
              שלחנו לך הודעה ב-WhatsApp למספר
              <span className="font-medium text-phi-dark block mt-1" dir="ltr">
                {displayPhone}
              </span>
            </p>
          </motion.div>

          {/* WhatsApp Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <MessageCircle className="w-6 h-6" />
              <span>המשך ב-WhatsApp</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 bg-gradient-to-r from-phi-bg to-phi-frost rounded-xl p-4 text-right"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                <Smartphone className="w-5 h-5 text-phi-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-phi-dark text-sm mb-1">
                  מה קורה עכשיו?
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  φ (פאי) המאמן הפיננסי שלך מחכה לך ב-WhatsApp!
                  <br />
                  הוא ישאל אותך כמה שאלות קצרות ויעזור לך להתחיל.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Steps Preview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-right"
          >
            <h4 className="text-sm font-medium text-gray-500 mb-3">השלבים הבאים:</h4>
            <div className="space-y-2">
              {[
                'היכרות קצרה (שם, גיל, מצב משפחתי)',
                'שליחת דוחות בנק/אשראי',
                'קבלת תמונה פיננסית מלאה',
              ].map((step, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-5 h-5 bg-phi-mint/30 rounded-full flex items-center justify-center text-xs font-medium text-phi-dark">
                    {index + 1}
                  </div>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dashboard Link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 pt-6 border-t border-gray-100"
          >
            <p className="text-sm text-gray-500 mb-3">
              רוצה לצפות בנתונים שלך?
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-phi-slate hover:text-phi-dark transition-colors text-sm font-medium"
            >
              <span>צפה בדשבורד</span>
              <span className="text-xs text-gray-400">(צפייה בלבד)</span>
            </Link>
          </motion.div>
        </div>

        {/* Bottom Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-sm text-gray-500 mt-6"
        >
          לא קיבלת הודעה? בדוק את הWhatsApp שלך או{' '}
          <a href={waLink} className="text-green-600 hover:underline">
            לחץ כאן לפתוח שיחה
          </a>
        </motion.p>
      </motion.div>
    </div>
  );
}

export default WhatsAppRedirect;


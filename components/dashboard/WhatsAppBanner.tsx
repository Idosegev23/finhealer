'use client';

import { MessageCircle, Sparkles, Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { WHATSAPP_BOT_NUMBER } from '@/lib/constants';

interface WhatsAppBannerProps {
  message?: string;
  showButton?: boolean;
}

export default function WhatsAppBanner({
  message = 'כל הפעולות מתבצעות דרך WhatsApp - הדשבורד הוא לצפייה בלבד 👀',
  showButton = true,
}: WhatsAppBannerProps) {
  const whatsappUrl = `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=היי`;

  return (
    <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-2 border-green-200 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 text-center md:text-right">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">WhatsApp-First</h3>
            <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
              <Eye className="w-3 h-3" />
              <span>צפייה בלבד</span>
            </div>
          </div>
          <p className="text-gray-700 text-sm">
            {message}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            רישום הוצאות • העלאת מסמכים • שאלות • בניית תקציב • יעדים - הכל דרך φ ב-WhatsApp! 🤖
          </p>
        </div>

        {/* Button */}
        {showButton && (
          <Link
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 group"
          >
            <MessageCircle className="w-5 h-5" />
            <span>פתח WhatsApp</span>
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </Link>
        )}
      </div>
    </div>
  );
}

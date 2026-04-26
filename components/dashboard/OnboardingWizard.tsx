'use client';

import { useState } from 'react';
import { FileText, MessageSquare, CheckCircle, ArrowLeft, Upload, Smartphone } from 'lucide-react';
import Link from 'next/link';

interface Props {
  userName: string;
  hasTransactions: boolean;
  phase: string;
}

export function OnboardingWizard({ userName, hasTransactions, phase }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Only show for new users in early phases with no data
  if (dismissed || hasTransactions || !['data_collection', 'start', 'waiting_for_document'].includes(phase)) {
    return null;
  }

  const steps = [
    {
      number: 1,
      title: 'העלה דוח בנק',
      description: 'שלח דוח עו"ש של 3 חודשים אחרונים — PDF מהאפליקציה או מאתר הבנק',
      icon: <FileText className="w-5 h-5" />,
      color: 'bg-amber-500',
      action: (
        <div className="flex gap-2 mt-3">
          <Link
            href="/dashboard/scan-center"
            className="flex items-center gap-2 bg-phi-dark text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-phi-slate transition"
          >
            <Upload className="w-3.5 h-3.5" />
            העלה במחשב
          </Link>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''}?text=היי`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition"
          >
            <Smartphone className="w-3.5 h-3.5" />
            או בוואטסאפ
          </a>
        </div>
      ),
    },
    {
      number: 2,
      title: 'סווג תנועות',
      description: 'אני אנתח את ההוצאות ונסווג אותן ביחד — שכירות, סופר, חשבונות...',
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'bg-blue-500',
      action: null,
    },
    {
      number: 3,
      title: 'קבל תמונה מלאה',
      description: 'תקציב חכם, יעדי חיסכון, תובנות — הכל מותאם אישית בשבילך',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'bg-purple-500',
      action: null,
    },
  ];

  return (
    <div className="bg-gradient-to-bl from-amber-50 via-white to-purple-50 rounded-2xl p-6 shadow-sm border border-amber-100">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {userName ? `${userName}, ` : ''}בוא נתחיל!
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            3 צעדים פשוטים לתמונה פיננסית מלאה
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          הסתר
        </button>
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className={`flex gap-4 ${i === 0 ? 'opacity-100' : 'opacity-60'}`}
          >
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full ${step.color} flex items-center justify-center text-white flex-shrink-0`}>
                {step.icon}
              </div>
              {i < steps.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 my-1 flex-1" />
              )}
            </div>
            <div className="pb-4">
              <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
              {step.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

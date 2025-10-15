'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DataCollectionSection } from './DataCollectionSection';
import DataCollectionProgress from './DataCollectionProgress';
import { 
  DollarSign, 
  Receipt, 
  CreditCard, 
  PiggyBank, 
  Wallet,
  TrendingUp,
  Shield
} from 'lucide-react';

interface DataCollectionDashboardProps {
  userName?: string;
  sections: {
    income: boolean;
    expenses: boolean;
    loans: boolean;
    savings: boolean;
    cash_flow: boolean;
    investments: boolean;
    insurance: boolean;
  };
}

export default function DataCollectionDashboard({ userName, sections }: DataCollectionDashboardProps) {
  // Prepare sections for progress component
  const progressSections = [
    {
      category: 'מידע פיננסי 💰',
      subsections: [
        { name: 'הכנסות', completed: sections.income },
        { name: 'הוצאות קבועות', completed: sections.expenses },
        { name: 'הלוואות והתחייבויות', completed: sections.loans },
        { name: 'חסכונות ונכסים', completed: sections.savings },
        { name: 'יתרת חשבון עו״ש', completed: sections.cash_flow },
      ]
    },
    {
      category: 'השקעות 📈',
      subsections: [
        { name: 'תיק השקעות', completed: sections.investments },
      ]
    },
    {
      category: 'ביטוחים 🛡️',
      subsections: [
        { name: 'ביטוחים ומסלקה', completed: sections.insurance },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F6F8] via-white to-[#F5F6F8] px-4 py-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-[#1E2A3B] mb-2">
            {userName ? `שלום ${userName}! ` : 'שלום! '}👋
          </h1>
          <p className="text-lg text-[#555555] mb-1">
            בואו נשלים את תמונת המצב הפיננסי שלך
          </p>
          <p className="text-sm text-[#888888]">
            מלא את הרובריקות בקצב שלך - הן יעלמו אחרי שתשלים אותן
          </p>
        </motion.div>

        {/* Progress Overview */}
        <DataCollectionProgress 
          sections={progressSections}
        />

        {/* Financial Information Category */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            <h2 className="text-2xl font-bold text-[#1E2A3B] flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-[#3A7BD5]" />
              מידע פיננסי
            </h2>
            <p className="text-sm text-[#888888] mt-1">
              הכנסות, הוצאות, הלוואות וחסכונות
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Income */}
            {!sections.income && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <DataCollectionSection
                  title="הכנסות 💰"
                  description="מקורות הכנסה, משכורת, הכנסות נוספות"
                  status="pending"
                  onEdit={() => window.location.href = '/dashboard/income'}
                  icon={DollarSign}
                />
              </motion.div>
            )}

            {/* Expenses */}
            {!sections.expenses && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <DataCollectionSection
                  title="הוצאות קבועות 🏠"
                  description="משכנתא, שכר דירה, ביטוחים, תקשורת"
                  status="pending"
                  onEdit={() => window.location.href = '/dashboard/expenses'}
                  icon={Receipt}
                />
              </motion.div>
            )}

            {/* Loans */}
            {!sections.loans && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <DataCollectionSection
                  title="הלוואות והתחייבויות 💳"
                  description="הלוואות, כרטיסי אשראי, חובות. כולל OCR דוחות סילוקין"
                  status="pending"
                  onEdit={() => window.location.href = '/dashboard/loans'}
                  icon={CreditCard}
                />
              </motion.div>
            )}

            {/* Savings & Assets */}
            {!sections.savings && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <DataCollectionSection
                  title="חסכונות ונכסים 🏦"
                  description="חיסכון, קרנות פנסיה, דירות, רכב"
                  status="pending"
                  onEdit={() => window.location.href = '/dashboard/savings'}
                  icon={PiggyBank}
                />
              </motion.div>
            )}

            {/* Current Account */}
            {!sections.cash_flow && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
              >
                <DataCollectionSection
                  title="יתרת חשבון עו״ש 💵"
                  description="יתרה נוכחית בחשבון העדכני"
                  status="pending"
                  onEdit={() => window.location.href = '/dashboard/cash-flow'}
                  icon={Wallet}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* Investments Category */}
        {!sections.investments && (
          <div className="mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-4"
            >
              <h2 className="text-2xl font-bold text-[#1E2A3B] flex items-center gap-2">
                <TrendingUp className="w-7 h-7 text-[#7ED957]" />
                השקעות
              </h2>
              <p className="text-sm text-[#888888] mt-1">
                תיק השקעות, קרנות נאמנות, קריפטו
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
            >
              <DataCollectionSection
                title="תיק השקעות 📈"
                description="מניות, אג״ח, קרנות, קריפטו ועוד"
                status="pending"
                onEdit={() => window.location.href = '/dashboard/investments'}
                icon={TrendingUp}
              />
            </motion.div>
          </div>
        )}

        {/* Insurance Category */}
        {!sections.insurance && (
          <div className="mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
              className="mb-4"
            >
              <h2 className="text-2xl font-bold text-[#1E2A3B] flex items-center gap-2">
                <Shield className="w-7 h-7 text-[#F6A623]" />
                ביטוחים
              </h2>
              <p className="text-sm text-[#888888] mt-1">
                חיבור למסלקה לסקירה אוטומטית של כל הביטוחים
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0 }}
            >
              <DataCollectionSection
                title="ביטוחים 🛡️"
                description="חיבור למסלקה + חתימה על נספחים א׳ וה׳"
                status="pending"
                onEdit={() => window.location.href = '/dashboard/insurance'}
                icon={Shield}
              />
            </motion.div>
          </div>
        )}

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="bg-gradient-to-br from-[#E8F4FD] to-[#E8F5E9] p-6 rounded-2xl border-2 border-[#3A7BD5]/30"
        >
          <div className="flex items-start gap-3">
            <div className="text-3xl">💡</div>
            <div>
              <h3 className="font-bold text-[#1E2A3B] mb-2">מדוע חשוב למלא את כל המידע?</h3>
              <ul className="space-y-2 text-sm text-[#555555]">
                <li className="flex items-start gap-2">
                  <span className="text-[#7ED957] mt-0.5">✓</span>
                  <span><strong>ניתוח מדויק יותר:</strong> ככל שיש לנו יותר מידע, כך התובנות מדויקות יותר</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#7ED957] mt-0.5">✓</span>
                  <span><strong>המלצות מותאמות:</strong> נוכל להציע לך צעדים קונקרטיים לשיפור</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#7ED957] mt-0.5">✓</span>
                  <span><strong>תקציב אוטומטי:</strong> נייצר לך תקציב מבוסס על ההתנהלות האמיתית שלך</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#7ED957] mt-0.5">✓</span>
                  <span><strong>הכל באפס:</strong> אין חובה למלא הכל עכשיו - תוכל לחזור בכל עת</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


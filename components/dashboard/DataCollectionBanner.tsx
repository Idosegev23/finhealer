'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { DataCollectionDashboard } from './DataCollectionDashboard';

interface DataCollectionBannerProps {
  userName?: string;
  daysOfData: number;
  hasBankStatement: boolean;
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

export default function DataCollectionBanner({ userName, daysOfData, hasBankStatement, sections }: DataCollectionBannerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Calculate progress
  const totalSections = Object.keys(sections).length;
  const completedSections = Object.values(sections).filter(Boolean).length;
  const percentage = Math.round((completedSections / totalSections) * 100);
  const remainingSections = totalSections - completedSections;

  if (isDismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="bg-gradient-to-l from-phi-dark to-phi-mint rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    השלם את תמונת המצב הפיננסי שלך 📊
                  </h3>
                  <p className="text-white/90 text-sm mb-3">
                    {remainingSections === 0 
                      ? '🎉 מעולה! השלמת את כל הרובריקות!'
                      : `עוד ${remainingSections} רובריקות נותרו להשלמה`
                    }
                  </p>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-white rounded-full shadow-lg"
                      />
                    </div>
                    <span className="text-white font-bold text-lg min-w-[60px] text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button 
                        size="lg"
                        className="bg-white text-phi-dark hover:bg-gray-100 font-bold shadow-lg px-8"
                      >
                        {remainingSections === 0 ? 'צפה בפרטים' : 'השלם עכשיו'}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
                      <SheetHeader className="mb-6">
                        <SheetTitle className="text-2xl">השלם את תמונת המצב שלך</SheetTitle>
                        <SheetDescription>
                          מלא את הרובריקות בקצב שלך - הן יעלמו אחרי שתשלים אותן
                        </SheetDescription>
                      </SheetHeader>
                      <DataCollectionDashboard daysOfData={daysOfData} hasBankStatement={hasBankStatement} />
                    </SheetContent>
                  </Sheet>

                  {/* Minimize/Expand */}
                  <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    {isMinimized ? (
                      <ChevronDown className="w-5 h-5 text-white" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-white" />
                    )}
                  </button>

                  {/* Dismiss */}
                  <button
                    onClick={() => setIsDismissed(true)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Minimized State - Quick Stats */}
              <AnimatePresence>
                {!isMinimized && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 pt-4 border-t border-white/20"
                  >
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {Object.entries(sections).filter(([key, val]) => 
                            key === 'income' || key === 'expenses' || key === 'loans' || 
                            key === 'savings' || key === 'cash_flow'
                          ).filter(([_, val]) => val).length}/5
                        </div>
                        <div className="text-xs text-white/80">מידע פיננסי</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {sections.investments ? '1' : '0'}/1
                        </div>
                        <div className="text-xs text-white/80">השקעות</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {sections.insurance ? '1' : '0'}/1
                        </div>
                        <div className="text-xs text-white/80">ביטוחים</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


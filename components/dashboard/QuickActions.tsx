'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Receipt, Target, X } from 'lucide-react';
import { QuickExpenseForm } from './QuickExpenseForm';

export function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<'expense' | 'receipt' | 'goal' | null>(null);

  const handleAction = (action: 'expense' | 'receipt' | 'goal') => {
    setActiveAction(action);
    setIsOpen(false);

    if (action === 'receipt') {
      // Trigger file upload
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          // Handle receipt upload
          console.log('Upload receipt:', file);
          // TODO: Implement receipt upload
        }
      };
      input.click();
      setActiveAction(null);
    } else if (action === 'goal') {
      // Navigate to goals
      window.location.href = '/goals?new=true';
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 left-6 z-50">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="absolute bottom-16 left-0 space-y-3 mb-2"
            >
              {/* Quick Expense */}
              <button
                onClick={() => handleAction('expense')}
                className="flex items-center gap-3 bg-white shadow-lg rounded-full py-3 px-5 hover:shadow-xl transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-secondary pr-2">הוצאה מהירה</span>
              </button>

              {/* Upload Receipt */}
              <button
                onClick={() => handleAction('receipt')}
                className="flex items-center gap-3 bg-white shadow-lg rounded-full py-3 px-5 hover:shadow-xl transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                  <Receipt className="w-5 h-5 text-success" />
                </div>
                <span className="font-medium text-secondary pr-2">העלה קבלה</span>
              </button>

              {/* New Goal */}
              <button
                onClick={() => handleAction('goal')}
                className="flex items-center gap-3 bg-white shadow-lg rounded-full py-3 px-5 hover:shadow-xl transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
                  <Target className="w-5 h-5 text-warning" />
                </div>
                <span className="font-medium text-secondary pr-2">מטרה חדשה</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all
            ${isOpen ? 'bg-danger' : 'bg-primary'}
          `}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Plus className="w-6 h-6 text-white" />
            )}
          </motion.div>
        </motion.button>
      </div>

      {/* Quick Expense Modal */}
      <AnimatePresence>
        {activeAction === 'expense' && (
          <QuickExpenseForm onClose={() => setActiveAction(null)} />
        )}
      </AnimatePresence>
    </>
  );
}


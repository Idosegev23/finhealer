'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { QuickExpenseForm } from './QuickExpenseForm';

export function QuickAddFAB() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        aria-label="הוסף הוצאה מהירה"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Quick Expense Modal */}
      {isOpen && (
        <QuickExpenseForm onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

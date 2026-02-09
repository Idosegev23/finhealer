/**
 * Goal Deposit Modal
 * Modal להוספת הפקדה ליעד
 */

'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@/lib/supabase/client';
import type { Goal } from '@/types/goals';

interface GoalDepositModalProps {
  goal: Goal;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GoalDepositModal({
  goal,
  isOpen,
  onClose,
  onSuccess,
}: GoalDepositModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const supabase = createClientComponentClient();
  
  if (!isOpen) return null;
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const amountNum = parseFloat(amount);
      
      if (isNaN(amountNum) || amountNum <= 0) {
        setError('סכום לא תקין');
        setLoading(false);
        return;
      }
      
      // יצירת תנועה עם goal_id
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        setError('משתמש לא מחובר');
        setLoading(false);
        return;
      }
      
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.user.id,
          goal_id: goal.id,
          type: 'income',
          amount: amountNum,
          description: description || `הפקדה ליעד: ${goal.name}`,
          tx_date: date,
          status: 'confirmed',
          category: null,
          income_category: 'savings',
        });
      
      if (txError) {
        console.error('Failed to create transaction:', txError);
        setError('שגיאה ביצירת הפקדה');
        setLoading(false);
        return;
      }
      
      // סגור והודע על הצלחה
      setAmount('');
      setDescription('');
      onSuccess();
      onClose();
      
    } catch (err) {
      console.error('Error:', err);
      setError('שגיאה לא צפויה');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">הוסף הפקדה</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="mb-4 p-4 bg-phi-frost rounded-lg">
          <p className="text-sm text-gray-600">יעד:</p>
          <p className="text-lg font-bold text-gray-900">{goal.name}</p>
          <p className="text-sm text-gray-600 mt-2">
            יתרה נוכחית: {goal.current_amount.toLocaleString('he-IL')} ₪ / {goal.target_amount.toLocaleString('he-IL')} ₪
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סכום (₪) *
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
              placeholder="100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              הערות (אופציונלי)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
              placeholder="הערות על ההפקדה..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-phi-gold hover:bg-phi-dark text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'שומר...' : 'הוסף הפקדה'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

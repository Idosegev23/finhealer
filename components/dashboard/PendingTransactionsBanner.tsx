'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function PendingTransactionsBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingCount();
    
    // רענון כל 30 שניות
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingCount = async () => {
    try {
      const response = await fetch('/api/expenses/pending');
      if (!response.ok) return;
      
      const data = await response.json();
      const total = (data.transactions || []).length;
      setPendingCount(total);
    } catch (error) {
      console.error('Failed to load pending count:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || pendingCount === 0) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 shadow-md animate-in slide-in-from-top-5" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        {/* Right: Icon + Message */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-blue-900">
              יש לך {pendingCount} תנועות ממתינות לאישור! 🎉
            </h3>
            <p className="text-sm text-blue-700">
              סרקנו את המסמכים שלך ומצאנו תנועות חדשות - בוא נאשר אותן
            </p>
          </div>
        </div>

        {/* Left: Action Button */}
        <Link href="/dashboard/expenses/pending">
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            לאישור התנועות
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}


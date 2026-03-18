'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';

export function DedupAlert() {
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetch('/api/transactions/dedup')
      .then(res => res.json())
      .then(data => {
        if (data.potentialDuplicates > 0) {
          setDuplicateCount(data.potentialDuplicates);
        }
      })
      .catch(() => {});
  }, []);

  if (duplicateCount === 0 || dismissed) return null;

  const handleDedup = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/transactions/dedup', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.matched > 0) {
        addToast({ type: 'success', title: `תוקנו ${data.matched} כפילויות`, duration: 4000 });
        setDuplicateCount(0);
        setDismissed(true);
        window.location.reload();
      } else {
        addToast({ type: 'info', title: 'לא נמצאו כפילויות לתיקון', duration: 3000 });
        setDismissed(true);
      }
    } catch {
      addToast({ type: 'error', title: 'שגיאה בתיקון כפילויות', duration: 4000 });
      setDismissed(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          זיהינו {duplicateCount} עסקאות שעלולות להיספר פעמיים
        </p>
        <p className="text-xs text-amber-600 mt-1">
          חיובי כרטיס אשראי שמופיעים גם בדוח הבנק וגם בפירוט כרטיס האשראי
        </p>
      </div>
      <button
        onClick={handleDedup}
        disabled={running}
        className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex-shrink-0"
      >
        {running ? 'מתקן...' : 'תקן עכשיו'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 text-xs flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

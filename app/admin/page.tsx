'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, Clock, UserPlus, FileText, MessageSquare, Activity, Lock } from 'lucide-react';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  trialUsers: number;
  newThisWeek: number;
  docsProcessed: number;
  messagesToday: number;
  activeToday: number;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async res => {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (res.status === 403) {
          setAuthError('אין לך הרשאת אדמין');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8" dir="rtl">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{authError}</h2>
          <p className="text-sm text-gray-600 mb-6">
            הדף הזה זמין רק לאדמינים. אם זו טעות, פנה לעידו.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-phi-dark text-white rounded-lg text-sm font-medium hover:bg-phi-dark/90"
          >
            חזרה לדשבורד
          </button>
        </div>
      </div>
    );
  }

  // Brand palette — phi-dark for primary stats, phi-gold for "needs attention",
  // phi-mint for positive engagement metrics. No rainbow.
  const cards = stats ? [
    { label: 'סה״כ משתמשים', value: stats.totalUsers, icon: Users, color: 'bg-phi-dark' },
    { label: 'מנויים פעילים', value: stats.activeUsers, icon: UserCheck, color: 'bg-phi-mint' },
    { label: 'תקופת נסיון', value: stats.trialUsers, icon: Clock, color: 'bg-phi-gold' },
    { label: 'חדשים השבוע', value: stats.newThisWeek, icon: UserPlus, color: 'bg-phi-dark' },
    { label: 'פעילים היום', value: stats.activeToday, icon: Activity, color: 'bg-phi-mint' },
    { label: 'מסמכים שעובדו', value: stats.docsProcessed, icon: FileText, color: 'bg-phi-slate' },
    { label: 'הודעות היום', value: stats.messagesToday, icon: MessageSquare, color: 'bg-phi-slate' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">לוח בקרה</h1>
          <p className="text-gray-600">סקירה כללית של המערכת</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold mx-auto" />
            <p className="mt-4 text-gray-600">טוען נתונים...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`${card.color} p-3 rounded-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{card.value.toLocaleString('he-IL')}</p>
                  <p className="text-sm text-gray-500 mt-1">{card.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Users, UserCheck, Clock, UserPlus, FileText, MessageSquare, Activity } from 'lucide-react';

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: 'סה״כ משתמשים', value: stats.totalUsers, icon: Users, color: 'bg-blue-500' },
    { label: 'מנויים פעילים', value: stats.activeUsers, icon: UserCheck, color: 'bg-green-500' },
    { label: 'תקופת נסיון', value: stats.trialUsers, icon: Clock, color: 'bg-yellow-500' },
    { label: 'חדשים השבוע', value: stats.newThisWeek, icon: UserPlus, color: 'bg-purple-500' },
    { label: 'פעילים היום', value: stats.activeToday, icon: Activity, color: 'bg-cyan-500' },
    { label: 'מסמכים שעובדו', value: stats.docsProcessed, icon: FileText, color: 'bg-indigo-500' },
    { label: 'הודעות היום', value: stats.messagesToday, icon: MessageSquare, color: 'bg-pink-500' },
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

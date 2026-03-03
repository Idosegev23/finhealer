'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowRight, Save } from 'lucide-react';

interface UserDetail {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  subscription_status: string | null;
  phase: string | null;
  onboarding_state: string | null;
  created_at: string;
  last_wa_interaction: string | null;
  trial_expires_at: string | null;
  wa_opt_in: boolean;
  is_admin: boolean;
}

interface UserStats {
  transactionCount: number;
  documents: Array<{ id: string; file_name: string; bank_name: string | null; doc_type: string | null; status: string; created_at: string }>;
  goals: Array<{ id: string; name: string; target_amount: number; current_amount: number; status: string }>;
  messageCount: number;
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Editable fields
  const [editStatus, setEditStatus] = useState('');
  const [editPhase, setEditPhase] = useState('');
  const [editTrialExpires, setEditTrialExpires] = useState('');

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(res => res.json())
      .then(data => {
        setUser(data.user);
        setStats(data.stats);
        setEditStatus(data.user?.subscription_status || '');
        setEditPhase(data.user?.phase || '');
        setEditTrialExpires(data.user?.trial_expires_at?.split('T')[0] || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setMessage('');

    const updates: Record<string, any> = {};
    if (editStatus !== user?.subscription_status) updates.subscription_status = editStatus;
    if (editPhase !== user?.phase) updates.phase = editPhase;
    if (editTrialExpires && editTrialExpires !== user?.trial_expires_at?.split('T')[0]) {
      updates.trial_expires_at = new Date(editTrialExpires).toISOString();
    }

    if (Object.keys(updates).length === 0) {
      setMessage('אין שינויים לשמור');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setMessage('נשמר בהצלחה!');
      } else {
        setMessage('שגיאה בשמירה');
      }
    } catch {
      setMessage('שגיאה בשמירה');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold mx-auto" />
          <p className="mt-4 text-gray-600">טוען פרטי משתמש...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <p className="text-gray-600">משתמש לא נמצא</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowRight className="w-4 h-4" />
          חזרה לרשימת משתמשים
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.name || user.full_name || 'ללא שם'}</h1>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {user.email && <p>אימייל: {user.email}</p>}
                {user.phone && <p>טלפון: <span className="font-mono">{user.phone}</span></p>}
                <p>הצטרף: {new Date(user.created_at).toLocaleDateString('he-IL')}</p>
                {user.last_wa_interaction && (
                  <p>אינטראקציה אחרונה: {new Date(user.last_wa_interaction).toLocaleString('he-IL')}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {user.wa_opt_in && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">WhatsApp</span>
              )}
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                {user.onboarding_state || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.transactionCount.toLocaleString('he-IL')}</p>
              <p className="text-xs text-gray-500">תנועות</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.documents.length}</p>
              <p className="text-xs text-gray-500">מסמכים</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.goals.length}</p>
              <p className="text-xs text-gray-500">יעדים</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.messageCount.toLocaleString('he-IL')}</p>
              <p className="text-xs text-gray-500">הודעות WA</p>
            </div>
          </div>
        )}

        {/* Edit Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">עריכת משתמש</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס מנוי</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="active">פעיל</option>
                <option value="trial">נסיון</option>
                <option value="cancelled">בוטל</option>
                <option value="inactive">לא פעיל</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שלב</label>
              <select
                value={editPhase}
                onChange={(e) => setEditPhase(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="data_collection">איסוף נתונים</option>
                <option value="behavior">התנהגות</option>
                <option value="budget">תקציב</option>
                <option value="goals">יעדים</option>
                <option value="monitoring">מעקב</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תוקף נסיון</label>
              <input
                type="date"
                value={editTrialExpires}
                onChange={(e) => setEditTrialExpires(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-phi-dark text-white rounded-lg text-sm font-medium hover:bg-phi-dark/90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
            {message && <p className="text-sm text-gray-600">{message}</p>}
          </div>
        </div>

        {/* Documents */}
        {stats && stats.documents.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">מסמכים אחרונים</h2>
            <div className="space-y-2">
              {stats.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.file_name || 'ללא שם'}</p>
                    <p className="text-xs text-gray-500">{doc.bank_name} · {doc.doc_type}</p>
                  </div>
                  <div className="text-left">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      doc.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {doc.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{new Date(doc.created_at).toLocaleDateString('he-IL')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        {stats && stats.goals.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">יעדים</h2>
            <div className="space-y-3">
              {stats.goals.map((goal) => {
                const progress = goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0;
                return (
                  <div key={goal.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-gray-900">{goal.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        goal.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {goal.status}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-phi-gold rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {goal.current_amount.toLocaleString('he-IL')} / {goal.target_amount.toLocaleString('he-IL')} ₪ ({progress}%)
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Save, MessageSquare, Send, StickyNote, Trash2 } from 'lucide-react';

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

interface AdvisorNote {
  id: string;
  note_text: string;
  advisor_id: string;
  created_at: string;
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Editable fields
  const [editStatus, setEditStatus] = useState('');
  const [editPhase, setEditPhase] = useState('');
  const [editTrialExpires, setEditTrialExpires] = useState('');

  // Advisor notes state
  const [notes, setNotes] = useState<AdvisorNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Send-message state
  const [waMessage, setWaMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function addNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: newNote.trim() }),
      });
      if (res.ok) {
        setNewNote('');
        fetchNotes();
      }
    } catch { /* ignore */ }
    setSavingNote(false);
  }

  async function sendDirectMessage() {
    if (!waMessage.trim()) return;
    setSendingMessage(true);
    setSendStatus(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: waMessage.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendStatus({ ok: true, text: `נשלח בהצלחה ל-${data.sent_to}` });
        setWaMessage('');
        fetchNotes(); // the message also gets logged as a note
      } else {
        setSendStatus({ ok: false, text: data.error || 'שגיאה בשליחה' });
      }
    } catch (err: any) {
      setSendStatus({ ok: false, text: err.message || 'שגיאה בשליחה' });
    }
    setSendingMessage(false);
  }

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(async res => {
        if (res.status === 401) { router.push('/login'); return null; }
        if (res.status === 403) { router.push('/dashboard'); return null; }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setUser(data.user);
        setStats(data.stats);
        setEditStatus(data.user?.subscription_status || '');
        setEditPhase(data.user?.phase || '');
        setEditTrialExpires(data.user?.trial_expires_at?.split('T')[0] || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, router]);

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
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
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

        {/* Section: Send WhatsApp message directly to user */}
        {user.phone && user.wa_opt_in && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              שליחת הודעה ב-WhatsApp
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              ההודעה תישלח כיועץ (גדי), לא כבוט. תיווסף אוטומטית כהערה.
            </p>
            <textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              placeholder="היי, רציתי לבדוק איך אתה מתקדם השבוע..."
              rows={4}
              maxLength={4000}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">{waMessage.length}/4000</p>
              <button
                onClick={sendDirectMessage}
                disabled={sendingMessage || !waMessage.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendingMessage ? 'שולח...' : 'שלח'}
              </button>
            </div>
            {sendStatus && (
              <p className={`mt-3 text-sm ${sendStatus.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {sendStatus.text}
              </p>
            )}
          </div>
        )}

        {/* Section: Advisor Notes */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-600" />
            הערות יועץ
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            הערות פרטיות שלך על המשתמש. לא נשלחות אליו, ועוזרות לזכור הקשר משיחה לשיחה.
          </p>

          {/* Add new note */}
          <div className="mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="לדוגמה: התקשר 25/4. דאגה מהלוואת רכב. ביקש לחשוב על איחוד."
              rows={3}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-400">{newNote.length}/5000</p>
              <button
                onClick={addNote}
                disabled={savingNote || !newNote.trim()}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingNote ? 'שומר...' : 'הוסף הערה'}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <p className="text-sm text-gray-400 italic">עדיין אין הערות.</p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.note_text}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(note.created_at).toLocaleString('he-IL', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

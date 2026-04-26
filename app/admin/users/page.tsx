'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface UserRow {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  subscription_status: string | null;
  phase: string | null;
  created_at: string;
  last_wa_interaction: string | null;
  trial_expires_at: string | null;
  wa_opt_in: boolean;
}

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  trial: 'נסיון',
  cancelled: 'בוטל',
  inactive: 'לא פעיל',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trial: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  inactive: 'bg-gray-100 text-gray-800',
};

const phaseLabels: Record<string, string> = {
  data_collection: 'איסוף נתונים',
  behavior: 'התנהגות',
  budget: 'תקציב',
  goals: 'יעדים',
  monitoring: 'מעקב',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (phaseFilter) params.set('phase', phaseFilter);
    params.set('page', String(page));

    try {
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 403) { router.push('/dashboard'); return; }
      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [search, statusFilter, phaseFilter, page, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">משתמשים</h1>
          <p className="text-gray-600">{total} משתמשים במערכת</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי שם, טלפון, אימייל..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-phi-gold/50"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">כל הסטטוסים</option>
            <option value="active">פעיל</option>
            <option value="trial">נסיון</option>
            <option value="cancelled">בוטל</option>
            <option value="inactive">לא פעיל</option>
          </select>

          {/* Phase filter */}
          <select
            value={phaseFilter}
            onChange={(e) => { setPhaseFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">כל השלבים</option>
            <option value="data_collection">איסוף נתונים</option>
            <option value="behavior">התנהגות</option>
            <option value="budget">תקציב</option>
            <option value="goals">יעדים</option>
            <option value="monitoring">מעקב</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold mx-auto" />
            <p className="mt-4 text-gray-600">טוען משתמשים...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">לא נמצאו משתמשים</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">טלפון</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שלב</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">WA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">אינטראקציה אחרונה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">הצטרף</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{u.name || u.full_name || '—'}</div>
                        {u.email && <div className="text-xs text-gray-500">{u.email}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {u.phone || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[u.subscription_status || ''] || 'bg-gray-100 text-gray-800'}`}>
                          {statusLabels[u.subscription_status || ''] || u.subscription_status || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {phaseLabels[u.phase || ''] || u.phase || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {u.wa_opt_in ? <span className="text-green-600">V</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.last_wa_interaction
                          ? new Date(u.last_wa_interaction).toLocaleDateString('he-IL')
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="text-phi-gold hover:text-phi-dark font-medium"
                        >
                          פרטים
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <p className="text-sm text-gray-600">עמוד {page} מתוך {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

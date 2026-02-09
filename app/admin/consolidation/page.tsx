/**
 * Admin Consolidation Requests Page
 * דף ניהול בקשות איחוד הלוואות לגדי
 */

'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@/lib/supabase/client';
import type { ConsolidationRequest } from '@/types/loans';
import Link from 'next/link';

export default function AdminConsolidationPage() {
  const [requests, setRequests] = useState<ConsolidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    fetchRequests();
  }, [filter]);
  
  async function fetchRequests() {
    setLoading(true);
    
    let query = supabase
      .from('loan_consolidation_requests')
      .select(`
        *,
        user:users(full_name, email, phone)
      `)
      .order('created_at', { ascending: false });
    
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch requests:', error);
    } else {
      setRequests(data as any || []);
    }
    
    setLoading(false);
  }
  
  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      pending_documents: 'bg-yellow-100 text-yellow-800',
      documents_received: 'bg-blue-100 text-blue-800',
      sent_to_advisor: 'bg-purple-100 text-purple-800',
      advisor_reviewing: 'bg-indigo-100 text-indigo-800',
      offer_sent: 'bg-green-100 text-green-800',
      accepted: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    
    const labels: Record<string, string> = {
      pending_documents: 'ממתין למסמכים',
      documents_received: 'התקבלו מסמכים',
      sent_to_advisor: 'נשלח ליועץ',
      advisor_reviewing: 'בבדיקה',
      offer_sent: 'הצעה נשלחה',
      accepted: 'התקבל',
      rejected: 'נדחה',
      cancelled: 'בוטל',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ניהול בקשות איחוד הלוואות
          </h1>
          <p className="text-gray-600">
            כל הבקשות לאיחוד הלוואות ממשתמשי Phi
          </p>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'all'
                  ? 'bg-phi-dark text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              הכל ({requests.length})
            </button>
            <button
              onClick={() => setFilter('pending_documents')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'pending_documents'
                  ? 'bg-phi-dark text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ממתינים למסמכים
            </button>
            <button
              onClick={() => setFilter('documents_received')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'documents_received'
                  ? 'bg-phi-dark text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              התקבלו מסמכים
            </button>
            <button
              onClick={() => setFilter('sent_to_advisor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'sent_to_advisor'
                  ? 'bg-phi-dark text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              נשלח ליועץ
            </button>
            <button
              onClick={() => setFilter('offer_sent')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === 'offer_sent'
                  ? 'bg-phi-dark text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              הצעות שנשלחו
            </button>
          </div>
        </div>
        
        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold mx-auto"></div>
            <p className="mt-4 text-gray-600">טוען בקשות...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">אין בקשות בסטטוס זה</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    לקוח
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    הלוואות
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    סכום כולל
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    תשלום חודשי
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    מסמכים
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    תאריך יצירה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request: any) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {request.user?.full_name || 'לא צוין'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.user?.phone || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.loans_count} הלוואות
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₪{request.total_balance.toLocaleString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₪{request.total_monthly_payment.toLocaleString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.documents_received}/{request.documents_needed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/admin/consolidation/${request.id}`}
                        className="text-phi-gold hover:text-phi-dark font-medium"
                      >
                        צפה בפרטים
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

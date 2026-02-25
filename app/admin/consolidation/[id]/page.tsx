/**
 * Admin Consolidation Request Detail Page
 * דף פרטי בקשה בודדת + עדכון סטטוס
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@/lib/supabase/client';
import type { ConsolidationRequest } from '@/types/loans';
import Link from 'next/link';

export default function ConsolidationRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  
  // Form state
  const [status, setStatus] = useState('');
  const [advisorNotes, setAdvisorNotes] = useState('');
  const [proposedRate, setProposedRate] = useState('');
  const [proposedMonthly, setProposedMonthly] = useState('');
  const [estimatedSavings, setEstimatedSavings] = useState('');
  
  const supabase = createClientComponentClient();
  const id = params.id as string;
  
  useEffect(() => {
    fetchRequest();
  }, [id]);
  
  async function fetchRequest() {
    setLoading(true);
    
    const res = await fetch(`/api/loans/consolidation/${id}`);
    const json = await res.json();
    
    if (json.data) {
      setRequest(json.data);
      setStatus(json.data.status);
      setAdvisorNotes(json.data.advisor_notes || '');
      setProposedRate(json.data.proposed_rate?.toString() || '');
      setProposedMonthly(json.data.proposed_monthly_payment?.toString() || '');
      setEstimatedSavings(json.data.estimated_savings?.toString() || '');
    }
    
    setLoading(false);
  }
  
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);
    
    const res = await fetch(`/api/loans/consolidation/${id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        advisor_notes: advisorNotes,
        proposed_rate: proposedRate ? parseFloat(proposedRate) : null,
        proposed_monthly_payment: proposedMonthly ? parseFloat(proposedMonthly) : null,
        estimated_savings: estimatedSavings ? parseFloat(estimatedSavings) : null,
      }),
    });
    
    if (res.ok) {
      alert('הבקשה עודכנה בהצלחה!');
      fetchRequest();
    } else {
      alert('שגיאה בעדכון הבקשה');
    }
    
    setUpdating(false);
  }
  
  async function handleSendLead() {
    if (!confirm('האם לשלוח את הליד לגדי עכשיו?')) {
      return;
    }
    
    setUpdating(true);
    
    const res = await fetch(`/api/loans/consolidation/${id}/send-lead`, {
      method: 'POST',
    });
    
    if (res.ok) {
      alert('הליד נשלח בהצלחה לגדי!');
      fetchRequest();
    } else {
      alert('שגיאה בשליחת הליד');
    }
    
    setUpdating(false);
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold"></div>
      </div>
    );
  }
  
  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">בקשה לא נמצאה</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/admin/consolidation"
            className="text-phi-gold hover:text-phi-dark text-sm font-medium"
          >
            ← חזרה לרשימת בקשות
          </Link>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            בקשת איחוד הלוואות
          </h1>
          <p className="text-gray-600">
            נוצרה ב-{new Date(request.created_at).toLocaleDateString('he-IL', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Client Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">פרטי לקוח</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">שם:</span>
                <p className="font-medium">{request.user?.name || request.user?.full_name || 'לא צוין'}</p>
              </div>
              <div>
                <span className="text-gray-600">טלפון:</span>
                <p className="font-medium">{request.user?.phone || 'לא צוין'}</p>
              </div>
              <div>
                <span className="text-gray-600">אימייל:</span>
                <p className="font-medium">{request.user?.email || 'לא צוין'}</p>
              </div>
            </div>
          </div>
          
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">סיכום בקשה</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">מספר הלוואות:</span>
                <p className="font-medium text-2xl">{request.loans_count}</p>
              </div>
              <div>
                <span className="text-gray-600">סה״כ יתרה:</span>
                <p className="font-medium text-2xl">₪{request.total_balance.toLocaleString('he-IL')}</p>
              </div>
              <div>
                <span className="text-gray-600">תשלום חודשי נוכחי:</span>
                <p className="font-medium text-2xl">₪{request.total_monthly_payment.toLocaleString('he-IL')}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Loans */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">פרטי הלוואות</h2>
          {request.loans && request.loans.length > 0 ? (
            <div className="space-y-4">
              {request.loans.map((loan: any, idx: number) => (
                <div key={loan.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">הלוואה {idx + 1}: {loan.creditor || 'לא צוין'}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">יתרה:</span>
                      <p className="font-medium">₪{loan.current_balance?.toLocaleString('he-IL') || '0'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">תשלום חודשי:</span>
                      <p className="font-medium">₪{loan.monthly_payment?.toLocaleString('he-IL') || '0'}</p>
                    </div>
                    {loan.interest_rate && (
                      <div>
                        <span className="text-gray-600">ריבית:</span>
                        <p className="font-medium">{loan.interest_rate}%</p>
                      </div>
                    )}
                    {loan.remaining_months && (
                      <div>
                        <span className="text-gray-600">חודשים נותרים:</span>
                        <p className="font-medium">{loan.remaining_months}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">אין נתוני הלוואות</p>
          )}
        </div>
        
        {/* Documents */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            מסמכים ({request.documents_received}/{request.documents_needed})
          </h2>
          {request.loan_documents && request.loan_documents.length > 0 ? (
            <div className="space-y-2">
              {request.loan_documents.map((doc: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span>{doc.filename}</span>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-phi-gold hover:text-phi-dark font-medium text-sm"
                  >
                    הורד
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">אין מסמכים</p>
          )}
        </div>
        
        {/* Update Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">עדכון בקשה</h2>
          
          {request.status === 'documents_received' && !request.lead_sent_at && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-900 mb-3">
                כל המסמכים התקבלו. האם לשלוח את הליד לגדי?
              </p>
              <button
                onClick={handleSendLead}
                disabled={updating}
                className="bg-phi-gold hover:bg-phi-dark text-white font-medium py-2 px-4 rounded disabled:opacity-50"
              >
                {updating ? 'שולח...' : 'שלח ליד לגדי'}
              </button>
            </div>
          )}
          
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סטטוס
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
              >
                <option value="pending_documents">ממתין למסמכים</option>
                <option value="documents_received">התקבלו מסמכים</option>
                <option value="sent_to_advisor">נשלח ליועץ</option>
                <option value="advisor_reviewing">בבדיקה</option>
                <option value="offer_sent">הצעה נשלחה</option>
                <option value="accepted">התקבל</option>
                <option value="rejected">נדחה</option>
                <option value="cancelled">בוטל</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                הערות יועץ
              </label>
              <textarea
                value={advisorNotes}
                onChange={(e) => setAdvisorNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
                placeholder="הערות והמלצות..."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ריבית מוצעת (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
                  placeholder="3.5"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  תשלום חודשי מוצע (₪)
                </label>
                <input
                  type="number"
                  value={proposedMonthly}
                  onChange={(e) => setProposedMonthly(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
                  placeholder="5000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  חיסכון משוער (₪/חודש)
                </label>
                <input
                  type="number"
                  value={estimatedSavings}
                  onChange={(e) => setEstimatedSavings(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-phi-gold"
                  placeholder="800"
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={updating}
                className="bg-phi-dark hover:bg-phi-gold text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50"
              >
                {updating ? 'מעדכן...' : 'עדכן בקשה'}
              </button>
              
              <button
                type="button"
                onClick={() => router.back()}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-lg"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

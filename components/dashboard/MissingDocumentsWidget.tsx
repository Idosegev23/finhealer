'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, CreditCard, FileCheck, Building2, AlertCircle, Upload, X, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MissingDocument {
  id: string;
  document_type: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  card_last_4: string | null;
  expected_amount: number | null;
  priority: number;
  description: string | null;
  instructions: string | null;
  created_at: string;
}

export default function MissingDocumentsWidget() {
  const [missingDocs, setMissingDocs] = useState<MissingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchMissingDocuments();
  }, []);

  async function fetchMissingDocuments() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('missing_documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching missing documents:', error);
        return;
      }

      setMissingDocs(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip(docId: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('missing_documents')
        .update({ status: 'skipped' } as any)
        .eq('id', docId);

      if (error) {
        console.error('Error skipping document:', error);
        return;
      }

      // Remove from list
      setMissingDocs(prev => prev.filter(doc => doc.id !== docId));
    } catch (error) {
      console.error('Error:', error);
    }
  }

  function handleUpload(doc: MissingDocument) {
    // Navigate to scan center with pre-selected document type
    router.push(`/dashboard/scan-center?type=${doc.document_type}&required=${doc.id}`);
  }

  function getDocumentIcon(type: string) {
    switch (type) {
      case 'credit':
        return <CreditCard className="w-8 h-8" />;
      case 'payslip':
        return <FileCheck className="w-8 h-8" />;
      case 'mortgage':
      case 'loan':
        return <Building2 className="w-8 h-8" />;
      default:
        return <FileText className="w-8 h-8" />;
    }
  }

  function getDocumentTypeLabel(type: string) {
    const labels: Record<string, string> = {
      credit: 'דוח אשראי',
      payslip: 'תלוש משכורת',
      mortgage: 'דוח משכנתא',
      loan: 'דוח הלוואה',
      insurance: 'דוח ביטוח',
      pension: 'דוח פנסיה',
      savings: 'דוח חיסכון',
      investment: 'דוח השקעות',
    };
    return labels[type] || type;
  }

  function formatPeriod(start: string | null, end: string | null) {
    if (!start || !end) return '';
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-100 rounded-xl"></div>
            <div className="h-24 bg-gray-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (missingDocs.length === 0) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-lg p-8 border-2 border-green-200">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-4 rounded-full">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-green-900 mb-2">
              🎉 כל המסמכים הועלו!
            </h3>
            <p className="text-lg text-green-700">
              אין מסמכים חסרים כרגע. התמונה הפיננסית שלך מלאה!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const uploadedCount = 0; // TODO: Calculate from total vs pending
  const totalCount = missingDocs.length;

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 border-3 border-amber-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 p-4 rounded-full">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>
          <div>
            <h3 className="text-3xl font-extrabold text-gray-900">
              📋 מה חסר לתמונה מלאה?
            </h3>
            <p className="text-lg text-gray-600 mt-1">
              {totalCount} מסמכים ממתינים להעלאה
            </p>
          </div>
        </div>
        
        <button
          onClick={() => router.push('/dashboard/missing-documents')}
          className="text-blue-600 hover:text-blue-800 font-bold text-lg hover:underline"
        >
          ראה הכל →
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span className="font-bold">התקדמות: {uploadedCount}/{totalCount}</span>
          <span className="font-bold">{Math.round((uploadedCount / totalCount) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${(uploadedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Missing Documents List */}
      <div className="space-y-4">
        {missingDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200 hover:border-amber-400 transition-all shadow-md hover:shadow-xl"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="bg-white p-3 rounded-lg shadow-md text-amber-600">
                {getDocumentIcon(doc.document_type)}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-xl font-extrabold text-gray-900 mb-1">
                      ⚠️ {getDocumentTypeLabel(doc.document_type)}
                      {doc.card_last_4 && ` ****${doc.card_last_4}`}
                    </h4>
                    {doc.description && (
                      <p className="text-base text-gray-700 font-semibold">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Period */}
                {(doc.period_start || doc.period_end) && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-gray-600">תקופה נדרשת:</span>
                    <span className="text-base font-extrabold text-amber-700">
                      {formatPeriod(doc.period_start, doc.period_end)}
                    </span>
                  </div>
                )}

                {/* Amount */}
                {doc.expected_amount && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-gray-600">סכום:</span>
                    <span className="text-xl font-extrabold text-gray-900">
                      {doc.expected_amount.toLocaleString('he-IL')} ₪
                    </span>
                  </div>
                )}

                {/* Instructions - Expandable */}
                {doc.instructions && (
                  <div className="mb-3">
                    <button
                      onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-bold hover:underline"
                    >
                      {expandedDoc === doc.id ? '▼ הסתר הוראות' : '▶ הצג הוראות'}
                    </button>
                    {expandedDoc === doc.id && (
                      <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-base text-gray-700 leading-relaxed">
                          {doc.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpload(doc)}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    העלה דוח
                  </button>
                  <button
                    onClick={() => handleSkip(doc.id)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold text-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    דלג
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View All Link */}
      {missingDocs.length >= 5 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/dashboard/missing-documents')}
            className="text-blue-600 hover:text-blue-800 font-extrabold text-xl hover:underline"
          >
            ראה את כל המסמכים החסרים ({totalCount}) →
          </button>
        </div>
      )}
    </div>
  );
}


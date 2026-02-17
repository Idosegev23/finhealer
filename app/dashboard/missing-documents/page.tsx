'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, CreditCard, FileCheck, Building2, AlertCircle, Upload, X, CheckCircle, Filter, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import WhatsAppBanner from '@/components/dashboard/WhatsAppBanner';

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
  related_transaction_id: string | null;
}

export default function MissingDocumentsPage() {
  const [missingDocs, setMissingDocs] = useState<MissingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
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
        .order('priority', { ascending: false });

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

      setMissingDocs(prev => prev.filter(doc => doc.id !== docId));
    } catch (error) {
      console.error('Error:', error);
    }
  }

  function handleUpload(doc: MissingDocument) {
    router.push(`/dashboard/scan-center?type=${doc.document_type}&required=${doc.id}`);
  }

  function getDocumentIcon(type: string) {
    switch (type) {
      case 'credit':
        return <CreditCard className="w-10 h-10" />;
      case 'payslip':
        return <FileCheck className="w-10 h-10" />;
      case 'mortgage':
      case 'loan':
        return <Building2 className="w-10 h-10" />;
      default:
        return <FileText className="w-10 h-10" />;
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

  const filteredDocs = filterType === 'all' 
    ? missingDocs.filter(d => d.status === 'pending') 
    : missingDocs.filter(doc => doc.document_type === filterType && doc.status === 'pending');

  const documentTypes = Array.from(new Set(missingDocs.map(doc => doc.document_type)));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-2xl w-1/2 mb-8"></div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200 rounded-2xl"></div>
              <div className="h-48 bg-gray-200 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (missingDocs.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-6 flex items-center gap-3 text-gray-600 hover:text-gray-900 font-bold text-xl transition-all hover:scale-105"
          >
            <ArrowLeft className="w-6 h-6" />
            חזרה לדשבורד
          </button>

          {/* Success Message */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl shadow-2xl p-12 border-4 border-green-200 text-center">
            <div className="bg-green-100 p-8 rounded-full w-32 h-32 mx-auto mb-8 flex items-center justify-center">
              <CheckCircle className="w-20 h-20 text-green-600" />
            </div>
            <h1 className="text-5xl font-extrabold text-green-900 mb-4">
              🎉 כל המסמכים הועלו!
            </h1>
            <p className="text-2xl text-green-700 mb-8">
              אין מסמכים חסרים כרגע. התמונה הפיננסית שלך מלאה!
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-10 py-5 rounded-2xl font-extrabold text-2xl shadow-2xl hover:shadow-3xl transition-all hover:scale-110"
            >
              חזרה לדשבורד
            </button>
          </div>
        </div>
      </div>
    );
  }

  const uploadedCount = missingDocs.filter(d => d.status === 'uploaded').length;
  const totalCount = missingDocs.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <WhatsAppBanner message="רוצה להעלות מסמך? שלח אותו דרך WhatsApp! 📄" />
        
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 flex items-center gap-3 text-gray-600 hover:text-gray-900 font-bold text-xl transition-all hover:scale-105"
        >
          <ArrowLeft className="w-6 h-6" />
          חזרה לדשבורד
        </button>

        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 border-4 border-amber-300 mb-8">
          <div className="flex items-center gap-6 mb-6">
            <div className="bg-amber-100 p-6 rounded-full">
              <AlertCircle className="w-16 h-16 text-amber-600" />
            </div>
            <div>
              <h1 className="text-5xl font-extrabold text-gray-900 mb-2">
                📋 מסמכים חסרים
              </h1>
              <p className="text-2xl text-gray-600">
                {totalCount} מסמכים ממתינים להעלאה לתמונה פיננסית מלאה
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-lg text-gray-600 mb-3 font-bold">
              <span>התקדמות: {uploadedCount}/{totalCount}</span>
              <span>{Math.round((uploadedCount / totalCount) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 shadow-lg"
                style={{ width: `${(uploadedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-6 h-6 text-gray-600" />
              <span className="text-lg font-bold text-gray-700">סינון:</span>
            </div>
            <button
              onClick={() => setFilterType('all')}
              className={`px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              הכל ({missingDocs.length})
            </button>
            {documentTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                  filterType === type
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {getDocumentTypeLabel(type)} ({missingDocs.filter(d => d.document_type === type).length})
              </button>
            ))}
          </div>
        </div>

        {/* Missing Documents List */}
        <div className="space-y-6">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl p-8 border-3 border-amber-200 hover:border-amber-400 transition-all shadow-xl hover:shadow-2xl"
            >
              <div className="flex items-start gap-6">
                {/* Icon */}
                <div className="bg-gradient-to-br from-amber-100 to-orange-100 p-5 rounded-2xl shadow-lg text-amber-600">
                  {getDocumentIcon(doc.document_type)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                        ⚠️ {getDocumentTypeLabel(doc.document_type)}
                        {doc.card_last_4 && ` ****${doc.card_last_4}`}
                      </h2>
                      {doc.description && (
                        <p className="text-xl text-gray-700 font-semibold">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Period */}
                  {(doc.period_start || doc.period_end) && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg font-bold text-gray-600">תקופה נדרשת:</span>
                      <span className="text-xl font-extrabold text-amber-700">
                        {formatPeriod(doc.period_start, doc.period_end)}
                      </span>
                    </div>
                  )}

                  {/* Amount */}
                  {doc.expected_amount && (
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-lg font-bold text-gray-600">סכום:</span>
                      <span className="text-2xl font-extrabold text-gray-900">
                        {doc.expected_amount.toLocaleString('he-IL')} ₪
                      </span>
                    </div>
                  )}

                  {/* Instructions - Expandable */}
                  {doc.instructions && (
                    <div className="mb-4">
                      <button
                        onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                        className="text-lg text-blue-600 hover:text-blue-800 font-bold hover:underline"
                      >
                        {expandedDoc === doc.id ? '▼ הסתר הוראות' : '▶ הצג הוראות'}
                      </button>
                      {expandedDoc === doc.id && (
                        <div className="mt-3 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                          <p className="text-lg text-gray-700 leading-relaxed">
                            {doc.instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleUpload(doc)}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-5 rounded-2xl font-extrabold text-2xl shadow-2xl hover:shadow-3xl transition-all hover:scale-105 flex items-center justify-center gap-3"
                    >
                      <Upload className="w-7 h-7" />
                      העלה דוח
                    </button>
                    <button
                      onClick={() => handleSkip(doc.id)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-8 py-5 rounded-2xl font-bold text-2xl transition-all hover:scale-105 flex items-center justify-center gap-3"
                    >
                      <X className="w-7 h-7" />
                      דלג
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State for Filtered Results */}
        {filteredDocs.length === 0 && filterType !== 'all' && (
          <div className="bg-white rounded-2xl p-12 text-center border-2 border-gray-200">
            <p className="text-2xl text-gray-600 font-bold">
              אין מסמכים מסוג {getDocumentTypeLabel(filterType)}
            </p>
            <button
              onClick={() => setFilterType('all')}
              className="mt-6 text-blue-600 hover:text-blue-800 font-bold text-xl hover:underline"
            >
              הצג את כל המסמכים
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


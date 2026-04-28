"use client"

/**
 * 🔒 SCAN CENTER - HIDDEN PAGE
 * 
 * This page is HIDDEN from navigation.
 * All document scanning happens via WhatsApp (WhatsApp-first approach).
 * The Desktop dashboard is VIEW-ONLY and reflects WhatsApp data.
 * 
 * This page is kept for potential future use or admin purposes.
 */

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageWrapper, PageHeader, InsightBanner } from '@/components/ui/design-system';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toaster';
import {
  Banknote,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Shield,
  Home,
  Receipt,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  Calendar,
  FileCheck,
  AlertCircle,
  Lock,
} from 'lucide-react';

type DocumentType = 
  | 'bank'           // דוח תנועות בנק
  | 'credit'         // דוח אשראי
  | 'loan'           // דוח הלוואות
  | 'savings'        // דוח חסכונות
  | 'investment'     // דוח השקעות
  | 'pension'        // דוח פנסיוני
  | 'insurance'      // דוח ביטוח
  | 'mortgage'       // דוח משכנתא
  | 'payslip';       // תלוש משכורת

interface DocumentTypeConfig {
  type: DocumentType;
  title: string;
  description: string;
  icon: any;
  color: string;
  dataExtracted: string;
}

const documentTypes: DocumentTypeConfig[] = [
  {
    type: 'bank',
    title: 'דוח תנועות בנק',
    description: 'יתרת חשבון עדכנית, הוצאות והכנסות',
    icon: Banknote,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    dataExtracted: 'יתרה, הוצאות, הכנסות',
  },
  {
    type: 'credit',
    title: 'דוח פירוט אשראי',
    description: 'כל העסקאות באשראי',
    icon: CreditCard,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    dataExtracted: 'הוצאות אשראי',
  },
  {
    type: 'payslip',
    title: 'תלוש משכורת',
    description: 'הכנסה, פנסיה, מיסים, ביטוח לאומי',
    icon: Receipt,
    color: 'bg-green-50 text-green-600 border-green-200',
    dataExtracted: 'הכנסה נטו, ניכויים, זיכויים',
  },
  {
    type: 'loan',
    title: 'דוח פירוט הלוואות',
    description: 'יתרת הלוואות, תשלומים, ריביות',
    icon: DollarSign,
    color: 'bg-red-50 text-red-600 border-red-200',
    dataExtracted: 'יתרה, תשלום חודשי, ריבית',
  },
  {
    type: 'savings',
    title: 'דוח חסכונות',
    description: 'חשבונות חיסכון, קרנות',
    icon: PiggyBank,
    color: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    dataExtracted: 'יתרות, תשואות',
  },
  {
    type: 'investment',
    title: 'דוח השקעות',
    description: 'תיק ההשקעות המלא',
    icon: TrendingUp,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    dataExtracted: 'נכסים, שווי, תשואה',
  },
  {
    type: 'pension',
    title: 'דוח מסלקה פנסיונית',
    description: 'קרנות פנסיה, גמל, השתלמות, ביטוח חיים',
    icon: Shield,
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    dataExtracted: 'יתרות, הפקדות, כיסויים ביטוחיים',
  },
  {
    type: 'insurance',
    title: 'דוח ביטוח',
    description: 'כל הביטוחים ממסלקה',
    icon: Shield,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    dataExtracted: 'פוליסות, פרמיות, כיסויים',
  },
  {
    type: 'mortgage',
    title: 'דוח משכנתא',
    description: 'יתרה, ריביות, מסלולים',
    icon: Home,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    dataExtracted: 'יתרה לסילוק, תשלום, מסלולים',
  },
];

interface ScannedDocument {
  id: string;
  file_name: string;
  document_type: string;
  status: string;
  created_at: string;
  transactions_extracted: number;
  transactions_created: number;
  error_message?: string;
  progress_percent?: number | null;
  processing_stage?: string | null;
}

function ScanCenterContent() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const requiredDocId = searchParams?.get('required');
  const preselectedType = searchParams?.get('type') as DocumentType | null;
  
  const [activeType, setActiveType] = useState<DocumentType | null>(preselectedType);
  const [scannedDocs, setScannedDocs] = useState<ScannedDocument[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [hasBankStatement, setHasBankStatement] = useState(false);
  const [checkingBankStatement, setCheckingBankStatement] = useState(true);

  useEffect(() => {
    loadScannedHistory();
    checkForBankStatement();
  }, []);

  // Live updates — when status changes (pending → processing → completed/failed),
  // refresh the history so the user sees progress without clicking refresh.
  useEffect(() => {
    let channel: any = null;
    let userId: string | null = null;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
      channel = supabase
        .channel(`uploaded_statements:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'uploaded_statements', filter: `user_id=eq.${userId}` },
          () => loadScannedHistory(),
        )
        .subscribe();
    })();
    return () => {
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    if (preselectedType) {
      // Deep-link from /missing-documents — scroll to the uploader so the
      // user lands directly on the action. Selection of the type is no
      // longer required (auto-detect handles it), but we keep the scroll
      // so the entry experience is consistent.
      setTimeout(() => {
        const uploader = window.document.getElementById('document-uploader');
        uploader?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [preselectedType]);

  const checkForBankStatement = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Check if user has uploaded any bank statement
      const { data, error } = await supabase
        .from('uploaded_statements')
        .select('id')
        .eq('user_id', user.id)
        .eq('file_type', 'bank_statement')
        .eq('status', 'completed')
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasBankStatement(true);
      }
    } catch (error) {
      console.error('Error checking for bank statement:', error);
      addToast({ title: 'שגיאה בבדיקת דוח בנק', type: 'error' });
    } finally {
      setCheckingBankStatement(false);
    }
  };

  const loadScannedHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch('/api/documents/list');
      const data = await response.json();
      
      if (data.success) {
        setScannedDocs(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to load scanned history:', error);
      addToast({ title: 'שגיאה בטעינת היסטוריית סריקות', type: 'error' });
    } finally {
      setLoadingHistory(false);
    }
  };

  const [showCatalog, setShowCatalog] = useState(false);

  return (
    <PageWrapper>
      <PageHeader
        title="מרכז סריקה"
        subtitle="גרור כל מסמך פיננסי — Phi מזהה את הסוג, את החודש, ומסווג אוטומטית"
      />

      {/* Hero uploader — single big drop zone, no type selection required.
          Per-file editing inside the component handles type override + month. */}
      <Card id="document-uploader" className="border-2 border-phi-gold mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-phi-gold" />
            העלאת מסמכים
          </CardTitle>
          <CardDescription>
            PDF / JPG / PNG / Excel / CSV · ניתן להעלות מספר קבצים יחד · עד 50MB לקובץ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentUploader
            documentType="auto"
            onSuccess={(data) => {
              console.log('✅ Documents uploaded:', data);
              loadScannedHistory();
            }}
            onError={(error) => {
              addToast({ title: error, type: 'error' });
            }}
            acceptedFormats=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
            maxSizeMB={50}
          />
        </CardContent>
      </Card>

      {/* Quick guidance — only when there's no bank statement yet */}
      {!checkingBankStatement && !hasBankStatement && (
        <InsightBanner variant="info" icon={AlertCircle} title="התחל מדוח הבנק">
          הדרך המהירה לתמונה פיננסית מלאה: העלה דוח תנועות בנק. ה-Phi יזהה אוטומטית אילו דוחות
          נוספים חסרים (אשראי, מסלקה, ביטוח, תלושי שכר) ויבקש אותם לפי הצורך.
        </InsightBanner>
      )}

      {/* Catalog of supported types — collapsed by default, available as
          reference for users who want to know exactly what we extract. */}
      <Card className="mb-6">
        <button
          type="button"
          onClick={() => setShowCatalog((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-right hover:bg-gray-50 transition-colors"
        >
          <div>
            <h3 className="font-semibold text-gray-900">מה Phi יודע לעבד?</h3>
            <p className="text-xs text-phi-slate mt-0.5">{documentTypes.length} סוגי דוחות נתמכים</p>
          </div>
          <div className="text-phi-slate text-sm">
            {showCatalog ? '▼ הסתר' : '▶ הצג רשימה'}
          </div>
        </button>
        {showCatalog && (
          <div className="border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-gray-50">
            {documentTypes.map((docType) => {
              const Icon = docType.icon;
              return (
                <div key={docType.type} className="flex items-start gap-3 bg-white rounded-lg p-3">
                  <div className={`p-2 rounded-lg ${docType.color} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{docType.title}</p>
                    <p className="text-xs text-gray-600 truncate">{docType.description}</p>
                    <p className="text-[11px] text-phi-slate mt-1">📊 {docType.dataExtracted}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Scanned Documents History */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              📂 היסטוריית סריקות
            </h2>
            <p className="text-gray-600 text-sm">
              כל המסמכים שהעלת ומה נוצר מהם
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadScannedHistory}
            disabled={loadingHistory}
          >
            {loadingHistory ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מרענן...
              </>
            ) : (
              'רענן'
            )}
          </Button>
        </div>

        {loadingHistory ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">טוען היסטוריה...</p>
            </CardContent>
          </Card>
        ) : scannedDocs.length === 0 ? (
          <Card className="bg-gray-50">
            <CardContent className="py-12 text-center">
              <FileCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                אין עדיין היסטוריה
              </h3>
              <p className="text-phi-slate text-sm">
                העלה את הדוח הראשון שלך כדי להתחיל!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {scannedDocs.map((doc) => (
              <DocumentHistoryCard key={doc.id} document={doc} />
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

// ============================================================================
// Document History Card Component
// ============================================================================

interface DocumentHistoryCardProps {
  document: ScannedDocument;
}

function DocumentHistoryCard({ document }: DocumentHistoryCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          text: 'הושלם',
          className: 'bg-green-100 text-green-800',
        };
      case 'processing':
        return {
          icon: Loader2,
          text: 'מעבד...',
          className: 'bg-blue-100 text-blue-800',
        };
      case 'failed':
        return {
          icon: XCircle,
          text: 'נכשל',
          className: 'bg-red-100 text-red-800',
        };
      default:
        return {
          icon: Clock,
          text: 'ממתין',
          className: 'bg-yellow-100 text-yellow-800',
        };
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const typeConfig = documentTypes.find((dt) => dt.type === type);
    return typeConfig?.title || type;
  };

  const getActionLink = (doc: ScannedDocument) => {
    if (doc.status !== 'completed') return null;

    // Different links based on document type
    switch (doc.document_type) {
      case 'bank':
      case 'credit':
        return { href: '/dashboard/expenses/pending', text: 'לתנועות ממתינות' };
      case 'loan':
      case 'mortgage':
        return { href: '/dashboard/loans', text: 'לדף הלוואות' };
      case 'pension':
        return { href: '/dashboard/pensions', text: 'לדף פנסיה' };
      case 'insurance':
        return { href: '/dashboard/insurance', text: 'לדף ביטוחים' };
      case 'payslip':
        return { href: '/dashboard/income', text: 'לדף הכנסות' };
      default:
        return { href: '/dashboard', text: 'לדשבורד' };
    }
  };

  const statusBadge = getStatusBadge(document.status);
  const StatusIcon = statusBadge.icon;
  const actionLink = getActionLink(document);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Document Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <h3 className="font-semibold text-gray-900 truncate">
                {document.file_name}
              </h3>
              <Badge variant="outline" className="flex-shrink-0">
                {getDocumentTypeLabel(document.document_type)}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-sm text-phi-slate">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(document.created_at).toLocaleDateString('he-IL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>

              {document.status === 'completed' && (
                <>
                  <span className="w-1 h-1 bg-gray-400 rounded-full" />
                  <span>
                    {document.transactions_created || 0} תנועות נוצרו
                  </span>
                </>
              )}

              {(document.status === 'processing' || document.status === 'pending') && document.processing_stage && (
                <>
                  <span className="w-1 h-1 bg-gray-400 rounded-full" />
                  <span className="text-phi-dark">{document.processing_stage}</span>
                </>
              )}
            </div>

            {/* Progress bar while processing */}
            {(document.status === 'processing' || document.status === 'pending') && (
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-phi-gold rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(15, Math.min(95, document.progress_percent ?? 25))}%` }}
                />
              </div>
            )}

            {document.error_message && (
              <p className="mt-2 text-sm text-red-600">
                ⚠️ {document.error_message}
              </p>
            )}
          </div>

          {/* Right: Status & Action */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge className={statusBadge.className}>
              <StatusIcon
                className={`w-4 h-4 ml-1 ${
                  document.status === 'processing' ? 'animate-spin' : ''
                }`}
              />
              {statusBadge.text}
            </Badge>

            {actionLink && (
              <Link href={actionLink.href}>
                <Button size="sm" variant="outline">
                  {actionLink.text}
                  <ExternalLink className="w-4 h-4 mr-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page with Suspense Boundary
// ============================================================================

export default function ScanCenterPage() {
  return (
    <Suspense fallback={
      <PageWrapper>
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
            <p className="text-phi-slate">טוען...</p>
          </CardContent>
        </Card>
      </PageWrapper>
    }>
      <ScanCenterContent />
    </Suspense>
  );
}


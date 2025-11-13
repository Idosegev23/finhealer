"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import Link from 'next/link';
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
}

export default function ScanCenterPage() {
  const [activeType, setActiveType] = useState<DocumentType | null>(null);
  const [scannedDocs, setScannedDocs] = useState<ScannedDocument[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadScannedHistory();
  }, []);

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
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            🔍 מרכז סריקה
          </h1>
          <Badge className="bg-green-100 text-green-700 border-green-300">
            ✅ פעיל
          </Badge>
        </div>
        <p className="text-gray-600">
          העלה דוחות בנק ופירוט אשראי - נזהה ונסווג את ההוצאות אוטומטית עם AI
        </p>
        <p className="text-sm text-blue-600 mt-2">
          💡 <strong>טיפ:</strong> אחרי העלאה מוצלחת תישאר כאן - תוכל להעלות מסמכים נוספים ברציפות!
        </p>
        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-1">
                איך זה עובד?
              </p>
              <ol className="text-sm text-blue-800 space-y-1 mr-4">
                <li>1. בחר סוג דוח (בנק או אשראי)</li>
                <li>2. העלה קובץ PDF</li>
                <li>3. המערכת תזהה ותסווג את ההוצאות לקטגוריות</li>
                <li>4. אשר או ערוך לפני השמירה</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Document Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {documentTypes.map((docType) => {
          const Icon = docType.icon;
          const isActive = activeType === docType.type;
          const isEnabled = docType.type === 'bank' || docType.type === 'credit';

          return (
            <Card
              key={docType.type}
              className={`transition-all ${
                isEnabled 
                  ? `cursor-pointer hover:shadow-lg ${isActive ? 'ring-2 ring-blue-500 shadow-lg' : ''}` 
                  : 'cursor-not-allowed opacity-40'
              }`}
              onClick={() => {
                if (isEnabled) {
                  setActiveType(docType.type);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-3 rounded-lg ${docType.color} flex-shrink-0`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">
                        {docType.title}
                      </CardTitle>
                      {isEnabled && (
                        <Badge className="bg-green-100 text-green-700 text-xs">✓ פעיל</Badge>
                      )}
                      {!isEnabled && (
                        <Badge className="bg-gray-100 text-gray-500 text-xs">בקרוב</Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {docType.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 mb-2">
                  📊 נתונים שנחלץ:
                </div>
                <div className="text-sm text-gray-700">
                  {docType.dataExtracted}
                </div>
                {isActive && isEnabled && (
                  <div className="mt-4 text-xs text-blue-600 font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    נבחר - העלה את הדוח למטה
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Document Uploader */}
      {activeType && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              העלאת {documentTypes.find((d) => d.type === activeType)?.title}
            </CardTitle>
            <CardDescription>
              העלה את הקובץ והמערכת תעבד אותו אוטומטית ברקע
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUploader
              documentType={activeType}
              onSuccess={(data) => {
                console.log('✅ Document uploaded:', data);
                // Refresh history to show new document
                loadScannedHistory();
                // Keep selection active so user can upload more documents
                // Don't reset activeType - let user continue scanning
              }}
              onError={(error) => {
                alert(`❌ שגיאה: ${error}`);
              }}
              acceptedFormats=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
              maxSizeMB={50}
            />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!activeType && (
        <Card className="bg-gray-50 border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              בחר סוג דוח להעלאה
            </h3>
            <p className="text-gray-500 text-sm">
              לחץ על אחד הכרטיסים למעלה כדי להתחיל
            </p>
          </CardContent>
        </Card>
      )}

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
              <p className="text-gray-500 text-sm">
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
    </div>
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

            <div className="flex items-center gap-4 text-sm text-gray-500">
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
            </div>

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


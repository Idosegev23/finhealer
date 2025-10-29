"use client"

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
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
    title: 'דוח חיסכון פנסיוני',
    description: 'פנסיה וקרן השתלמות ממסלקה',
    icon: Shield,
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    dataExtracted: 'צבירה, הפקדות, תשואה',
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

export default function ScanCenterPage() {
  const [activeType, setActiveType] = useState<DocumentType | null>(null);

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🔍 מרכז סריקה
        </h1>
        <p className="text-gray-600">
          העלה דוחות פיננסיים מכל הסוגים - נזהה ונעבד אותם אוטומטית עם AI
        </p>
      </div>

      {/* Document Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {documentTypes.map((docType) => {
          const Icon = docType.icon;
          const isActive = activeType === docType.type;

          return (
            <Card
              key={docType.type}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isActive ? 'ring-2 ring-blue-500 shadow-lg' : ''
              }`}
              onClick={() => setActiveType(isActive ? null : docType.type)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-3 rounded-lg ${docType.color} flex-shrink-0`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">
                      {docType.title}
                    </CardTitle>
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
                {isActive && (
                  <div className="mt-4 text-xs text-blue-600 font-medium">
                    ✓ נבחר - העלה את הדוח למטה
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
                // Reset selection after successful upload
                setTimeout(() => setActiveType(null), 2000);
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
    </div>
  );
}


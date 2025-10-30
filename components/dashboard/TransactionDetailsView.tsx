'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Unlink, 
  Calendar,
  Store,
  CreditCard,
  DollarSign
} from 'lucide-react';

interface TransactionDetail {
  id: string;
  amount: number;
  vendor: string;
  date: string;
  category?: string;
  expense_category?: string;
  payment_method?: string;
  notes?: string;
}

interface TransactionDetailsViewProps {
  transactionId: string;
  amount: number;
  vendor: string;
  onUnlink?: () => Promise<void>;
}

export default function TransactionDetailsView({
  transactionId,
  amount,
  vendor,
  onUnlink,
}: TransactionDetailsViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [details, setDetails] = useState<TransactionDetail[]>([]);
  const [statistics, setStatistics] = useState<{
    totalAmount: number;
    categoryBreakdown: Record<string, number>;
    detailCount: number;
  } | null>(null);

  useEffect(() => {
    if (expanded && details.length === 0) {
      fetchDetails();
    }
  }, [expanded]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/details`);
      const data = await response.json();

      if (data.success && data.hasDetails) {
        setDetails(data.details);
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!onUnlink) return;

    if (!confirm('האם אתה בטוח שרוצה לבטל את הקישור? התנועות המפורטות יחזרו לרשימה הכללית.')) {
      return;
    }

    setUnlinking(true);
    try {
      await onUnlink();
      setDetails([]);
      setStatistics(null);
      setExpanded(false);
    } catch (error) {
      console.error('Failed to unlink transaction:', error);
    } finally {
      setUnlinking(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'מזון': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'תחבורה': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'בילויים': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'קניות': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      'חשבונות': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  if (!details || details.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          הצג פירוט
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </Button>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="p-0 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="text-right">
                <CardTitle className="text-base">
                  פירוט מדוח אשראי
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {details.length} תנועות • {statistics?.totalAmount.toFixed(2)} ₪
                </p>
              </div>
            </div>
          </Button>

          <div className="flex items-center gap-2">
            {onUnlink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlink}
                disabled={unlinking}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <Unlink className="h-4 w-4 ml-1" />
                בטל קישור
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8 p-0"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Category Breakdown */}
          {statistics && Object.keys(statistics.categoryBreakdown).length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm font-medium mb-2">פילוח לפי קטגוריות:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statistics.categoryBreakdown).map(([category, amt]) => (
                  <Badge
                    key={category}
                    variant="secondary"
                    className={getCategoryColor(category)}
                  >
                    {category}: {amt.toFixed(2)} ₪
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Transaction Details */}
          <div className="space-y-2">
            {details.map((detail, index) => (
              <div
                key={detail.id}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        #{index + 1}
                      </span>
                      <p className="font-medium">{detail.vendor}</p>
                      {detail.expense_category && (
                        <Badge
                          variant="outline"
                          className={getCategoryColor(detail.expense_category)}
                        >
                          {detail.expense_category}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(detail.date).toLocaleDateString('he-IL')}
                      </span>
                      {detail.payment_method && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {detail.payment_method}
                        </span>
                      )}
                    </div>

                    {detail.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {detail.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-left">
                    <p className="text-lg font-semibold whitespace-nowrap">
                      {detail.amount.toFixed(2)} ₪
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium">סה״כ פירוט:</span>
            </div>
            <span className="text-lg font-bold">
              {statistics?.totalAmount.toFixed(2)} ₪
            </span>
          </div>

          {/* Difference Warning */}
          {statistics && Math.abs(amount - statistics.totalAmount) > 0.01 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ הפרש של {Math.abs(amount - statistics.totalAmount).toFixed(2)} ₪ 
                בין הסכום בדוח הבנק לפירוט באשראי
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}


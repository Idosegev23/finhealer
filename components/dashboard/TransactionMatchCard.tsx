'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Link2, AlertCircle } from 'lucide-react';

interface Transaction {
  id: string;
  amount: number;
  vendor: string;
  date: string;
  category?: string;
  document_type?: string;
}

interface Match {
  transaction: Transaction;
  confidence: number;
}

interface TransactionMatchCardProps {
  parentTransaction: Transaction;
  matches: Match[];
  onLink: (parentId: string, detailIds: string[], documentId?: string) => Promise<void>;
  onDismiss: () => void;
}

export default function TransactionMatchCard({
  parentTransaction,
  matches,
  onLink,
  onDismiss,
}: TransactionMatchCardProps) {
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleMatch = (matchId: string) => {
    setSelectedMatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  const handleLink = async () => {
    if (selectedMatches.size === 0) return;

    setLoading(true);
    try {
      await onLink(
        parentTransaction.id,
        Array.from(selectedMatches),
        matches[0]?.transaction.document_type
      );
      setSelectedMatches(new Set());
    } catch (error) {
      console.error('Failed to link transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  if (matches.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="text-lg">התאמות פוטנציאליות</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                מצאנו {matches.length} תנועות שעשויות לפרט את התנועה הזו
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Parent Transaction */}
        <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              תנועה מקורית (דוח בנק)
            </span>
            <Badge variant="outline">{parentTransaction.document_type || 'bank'}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{parentTransaction.vendor}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(parentTransaction.date).toLocaleDateString('he-IL')}
              </p>
            </div>
            <p className="text-lg font-bold">
              {parentTransaction.amount.toFixed(2)} ₪
            </p>
          </div>
        </div>

        {/* Matching Transactions */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            פירוט אפשרי מדוחות אשראי:
          </p>
          
          {matches.map((match) => (
            <div
              key={match.transaction.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedMatches.has(match.transaction.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
              onClick={() => toggleMatch(match.transaction.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{match.transaction.vendor}</p>
                    <Badge
                      variant="secondary"
                      className={getConfidenceColor(match.confidence)}
                    >
                      {(match.confidence * 100).toFixed(0)}% התאמה
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      {new Date(match.transaction.date).toLocaleDateString('he-IL')}
                    </span>
                    {match.transaction.category && (
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                        {match.transaction.category}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold whitespace-nowrap">
                    {match.transaction.amount.toFixed(2)} ₪
                  </p>
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
                    selectedMatches.has(match.transaction.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    {selectedMatches.has(match.transaction.id) && (
                      <Check className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        {selectedMatches.size > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">מה קורה כשאני מקשר?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>התנועות המפורטות ייעלמו מרשימת התנועות הכללית</li>
                <li>הן יוצגו כפירוט תחת התנועה המקורית</li>
                <li>הסכום הכולל לא ישתנה - רק יהיה לך יותר פרטים</li>
              </ul>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handleLink}
            disabled={selectedMatches.size === 0 || loading}
            className="flex-1"
          >
            {loading ? (
              'מקשר...'
            ) : (
              <>
                <Link2 className="h-4 w-4 ml-2" />
                קשר {selectedMatches.size} תנועות
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onDismiss} disabled={loading}>
            אולי מאוחר יותר
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


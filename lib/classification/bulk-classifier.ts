/**
 * Bulk Classifier - סיווג מרוכז של תנועות
 * 
 * כשיש הרבה תנועות מאותו ספק, מציעים לסווג את כולן יחד
 */

import { createServiceClient } from '@/lib/supabase/server';
import { 
  normalizeVendorName, 
  getSuggestionForVendor,
  learnFromConfirmation 
} from './learning-engine';

// ============================================================================
// Types
// ============================================================================

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  description?: string;
  vendor?: string;
  category_id?: string;
  type: 'income' | 'expense';
  status: string;
  tx_date: string;
}

export interface VendorGroup {
  vendorName: string;
  normalizedVendor: string;
  transactions: Transaction[];
  count: number;
  totalAmount: number;
  type: 'income' | 'expense';
  suggestedCategory?: {
    id: string;
    name: string;
    confidence: number;
  };
}

export interface BulkClassificationResult {
  groups: VendorGroup[];
  ungroupedTransactions: Transaction[];
  totalTransactions: number;
  totalAutoClassifiable: number;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_GROUP_SIZE = 2;  // מינימום 2 תנועות לקבוצה

// ============================================================================
// Grouping Functions
// ============================================================================

/**
 * קיבוץ תנועות לפי vendor
 */
export function groupTransactionsByVendor(
  transactions: Transaction[]
): Map<string, VendorGroup> {
  const groups = new Map<string, VendorGroup>();
  
  for (const tx of transactions) {
    if (!tx.vendor) continue;
    
    const normalizedVendor = normalizeVendorName(tx.vendor);
    if (!normalizedVendor) continue;
    
    const existing = groups.get(normalizedVendor);
    
    if (existing) {
      existing.transactions.push(tx);
      existing.count++;
      existing.totalAmount += tx.amount;
    } else {
      groups.set(normalizedVendor, {
        vendorName: tx.vendor,
        normalizedVendor,
        transactions: [tx],
        count: 1,
        totalAmount: tx.amount,
        type: tx.type,
      });
    }
  }
  
  return groups;
}

/**
 * קבלת קבוצות לסיווג מרוכז עם הצעות
 */
export async function getBulkClassificationGroups(
  userId: string,
  transactions: Transaction[]
): Promise<BulkClassificationResult> {
  const groupsMap = groupTransactionsByVendor(transactions);
  const groups: VendorGroup[] = [];
  const ungroupedTransactions: Transaction[] = [];
  let totalAutoClassifiable = 0;
  
  for (const group of Array.from(groupsMap.values())) {
    // קבל הצעת סיווג
    const suggestion = await getSuggestionForVendor(userId, group.vendorName);
    
    if (suggestion) {
      group.suggestedCategory = {
        id: suggestion.categoryId,
        name: suggestion.categoryName,
        confidence: suggestion.confidence,
      };
      
      if (suggestion.shouldAutoApply) {
        totalAutoClassifiable += group.count;
      }
    }
    
    if (group.count >= MIN_GROUP_SIZE) {
      groups.push(group);
    } else {
      ungroupedTransactions.push(...group.transactions);
    }
  }
  
  // מיון לפי כמות תנועות (יורד)
  groups.sort((a, b) => b.count - a.count);
  
  return {
    groups,
    ungroupedTransactions,
    totalTransactions: transactions.length,
    totalAutoClassifiable,
  };
}

// ============================================================================
// Bulk Classification Actions
// ============================================================================

/**
 * סיווג כל התנועות של vendor מסוים
 */
export async function classifyVendorTransactions(
  userId: string,
  vendorName: string,
  categoryId: string,
  categoryName: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = createServiceClient();
  const normalizedVendor = normalizeVendorName(vendorName);
  
  if (!normalizedVendor || !categoryId) {
    return { success: false, count: 0, error: 'Missing vendor or category' };
  }
  
  try {
    // מצא את כל התנועות של ה-vendor הזה
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, vendor')
      .eq('user_id', userId)
      .in('status', ['pending', 'proposed'])
      .is('category_id', null);
    
    if (fetchError) throw fetchError;
    
    // סנן לפי vendor (נורמליזציה)
    const matchingTxIds = transactions
      ?.filter(tx => normalizeVendorName(tx.vendor || '') === normalizedVendor)
      .map(tx => tx.id) || [];
    
    if (matchingTxIds.length === 0) {
      return { success: true, count: 0 };
    }
    
    // עדכן את כל התנועות
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        category_id: categoryId,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .in('id', matchingTxIds);
    
    if (updateError) throw updateError;
    
    // למד מהסיווג
    await learnFromConfirmation(userId, vendorName, categoryId, categoryName);
    
    return { success: true, count: matchingTxIds.length };
  } catch (error) {
    console.error('Error in bulk classification:', error);
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * סיווג אוטומטי של כל ה-groups עם confidence גבוה
 */
export async function autoClassifyAllHighConfidence(
  userId: string,
  transactions: Transaction[]
): Promise<{
  classifiedGroups: Array<{ vendor: string; category: string; count: number }>;
  totalClassified: number;
}> {
  const { groups } = await getBulkClassificationGroups(userId, transactions);
  const classifiedGroups: Array<{ vendor: string; category: string; count: number }> = [];
  let totalClassified = 0;
  
  for (const group of groups) {
    if (
      group.suggestedCategory && 
      group.suggestedCategory.confidence >= 0.90
    ) {
      const result = await classifyVendorTransactions(
        userId,
        group.vendorName,
        group.suggestedCategory.id,
        group.suggestedCategory.name
      );
      
      if (result.success && result.count > 0) {
        classifiedGroups.push({
          vendor: group.vendorName,
          category: group.suggestedCategory.name,
          count: result.count,
        });
        totalClassified += result.count;
      }
    }
  }
  
  return { classifiedGroups, totalClassified };
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * יצירת הודעת סיכום לסיווג מרוכז
 */
export function formatBulkClassificationMessage(
  groups: VendorGroup[],
  ungroupedCount: number
): string {
  if (groups.length === 0 && ungroupedCount === 0) {
    return 'אין תנועות לסיווג 🎉';
  }
  
  const lines: string[] = [];
  
  if (groups.length > 0) {
    lines.push('📊 *תנועות לפי ספק:*\n');
    
    for (const group of groups.slice(0, 5)) {  // מקסימום 5
      const amountStr = group.totalAmount.toLocaleString('he-IL');
      const emoji = group.type === 'income' ? '💚' : '💸';
      
      if (group.suggestedCategory && group.suggestedCategory.confidence >= 0.70) {
        lines.push(
          `${emoji} ${group.count}x *${group.vendorName}* (${amountStr} ₪)\n` +
          `   הצעה: *${group.suggestedCategory.name}* (${Math.round(group.suggestedCategory.confidence * 100)}%)`
        );
      } else {
        lines.push(`${emoji} ${group.count}x *${group.vendorName}* (${amountStr} ₪)`);
      }
    }
    
    if (groups.length > 5) {
      lines.push(`\n...ועוד ${groups.length - 5} ספקים`);
    }
  }
  
  if (ungroupedCount > 0) {
    lines.push(`\n📝 ${ungroupedCount} תנועות בודדות לסיווג`);
  }
  
  return lines.join('\n');
}

/**
 * הודעת אישור סיווג מרוכז
 */
export function formatBulkConfirmationMessage(
  classifiedGroups: Array<{ vendor: string; category: string; count: number }>
): string {
  if (classifiedGroups.length === 0) {
    return '';
  }
  
  const lines: string[] = ['✅ *סיווגתי אוטומטית:*\n'];
  
  for (const group of classifiedGroups) {
    lines.push(`• ${group.count}x *${group.vendor}* → *${group.category}*`);
  }
  
  lines.push('\nרוצה לשנות? כתוב "תקן [שם ספק]"');
  
  return lines.join('\n');
}


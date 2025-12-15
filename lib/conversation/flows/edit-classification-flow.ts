/**
 * Edit Classification Flow
 * טיפול בבקשות לתיקון ועריכת סיווגים דרך WhatsApp
 * 
 * פקודות:
 * - "תקן [vendor]" - שינוי קטגוריה
 * - "בטל [vendor]" - מחיקת pattern
 * - "הראה כללים" - רשימת patterns
 */

import { createServiceClient } from '@/lib/supabase/server';
import { 
  getAllUserPatterns, 
  learnFromCorrection,
  deletePattern,
  normalizeVendorName 
} from '@/lib/classification/learning-engine';

// ============================================================================
// Types
// ============================================================================

interface EditResponse {
  message: string;
  success: boolean;
  requiresCategory?: boolean;
  vendorToEdit?: string;
}

// ============================================================================
// Command Detection
// ============================================================================

/**
 * זיהוי פקודות עריכה
 */
export function detectEditCommand(message: string): {
  type: 'fix' | 'delete' | 'show' | null;
  vendor?: string;
} {
  const text = message.trim();
  
  // "תקן רמי לוי" / "תקנ מעדנות" / "שנה סופר"
  const fixMatch = text.match(/^(תקן|תקנ|שנה|ערוך)\s+(.+)$/i);
  if (fixMatch) {
    return { type: 'fix', vendor: fixMatch[2].trim() };
  }
  
  // "בטל רמי לוי" / "מחק כלל סופר"
  const deleteMatch = text.match(/^(בטל|מחק|הסר)\s+(כלל\s+)?(.+)$/i);
  if (deleteMatch) {
    return { type: 'delete', vendor: deleteMatch[3].trim() };
  }
  
  // "הראה כללים" / "כללי סיווג" / "patterns"
  if (/^(הראה\s*כללים|כללי\s*סיווג|patterns|דפוסים)/i.test(text)) {
    return { type: 'show' };
  }
  
  return { type: null };
}

// ============================================================================
// Handle Commands
// ============================================================================

/**
 * טיפול בפקודת "תקן [vendor]"
 */
export async function handleFixCommand(
  userId: string,
  vendorName: string
): Promise<EditResponse> {
  const supabase = createServiceClient();
  
  // בדוק אם יש pattern כזה
  const patterns = await getAllUserPatterns(userId);
  const normalizedInput = normalizeVendorName(vendorName);
  
  const matchingPattern = patterns.find(p => 
    p.pattern_key === normalizedInput ||
    p.pattern_key.includes(normalizedInput) ||
    normalizedInput.includes(p.pattern_key)
  );
  
  if (!matchingPattern) {
    // בדוק אם יש תנועות עם vendor כזה
    const { data: transactions } = await supabase
      .from('transactions')
      .select('vendor')
      .eq('user_id', userId)
      .not('vendor', 'is', null)
      .limit(100);
    
    const similarVendors = transactions
      ?.map(t => t.vendor)
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .filter(v => {
        const norm = normalizeVendorName(v || '');
        return norm.includes(normalizedInput) || normalizedInput.includes(norm);
      })
      .slice(0, 5);
    
    if (similarVendors && similarVendors.length > 0) {
      return {
        message: `לא מצאתי כלל בשם "${vendorName}".\n\nאולי התכוונת ל:\n${similarVendors.map(v => `• ${v}`).join('\n')}`,
        success: false,
      };
    }
    
    return {
      message: `לא מצאתי כלל או ספק בשם "${vendorName}".\n\nלצפייה בכל הכללים כתוב: *הראה כללים*`,
      success: false,
    };
  }
  
  // מצאנו - שאל לאיזה קטגוריה לשנות
  const categoryName = matchingPattern.pattern_value.category_name || 'לא ידוע';
  
  return {
    message: `מצאתי! *${matchingPattern.pattern_key}* מסווג כרגע כ-*${categoryName}*.\n\nלאיזה קטגוריה לשנות? כתוב את שם הקטגוריה.`,
    success: true,
    requiresCategory: true,
    vendorToEdit: matchingPattern.pattern_key,
  };
}

/**
 * השלמת תיקון עם קטגוריה חדשה
 */
export async function completeFixWithCategory(
  userId: string,
  vendorName: string,
  newCategoryName: string
): Promise<EditResponse> {
  const supabase = createServiceClient();
  
  // מצא את הקטגוריה
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('user_id', userId);
  
  // חיפוש fuzzy
  const normalizedInput = newCategoryName.toLowerCase().trim();
  const matchingCategory = categories?.find(c => 
    c.name.toLowerCase() === normalizedInput ||
    c.name.toLowerCase().includes(normalizedInput) ||
    normalizedInput.includes(c.name.toLowerCase())
  );
  
  if (!matchingCategory) {
    const availableCategories = categories?.slice(0, 8).map(c => c.name) || [];
    return {
      message: `לא מצאתי קטגוריה בשם "${newCategoryName}".\n\nקטגוריות זמינות:\n${availableCategories.map(c => `• ${c}`).join('\n')}`,
      success: false,
      requiresCategory: true,
      vendorToEdit: vendorName,
    };
  }
  
  // עדכן את ה-pattern
  await learnFromCorrection(userId, vendorName, matchingCategory.id, matchingCategory.name);
  
  // עדכן גם תנועות קיימות עם vendor זה
  const normalized = normalizeVendorName(vendorName);
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, vendor')
    .eq('user_id', userId)
    .eq('status', 'confirmed');
  
  const matchingTxIds = transactions
    ?.filter(tx => normalizeVendorName(tx.vendor || '') === normalized)
    .map(tx => tx.id) || [];
  
  if (matchingTxIds.length > 0) {
    await supabase
      .from('transactions')
      .update({ category_id: matchingCategory.id })
      .in('id', matchingTxIds);
  }
  
  return {
    message: `✅ עודכן!\n\n*${vendorName}* יסווג מעכשיו כ-*${matchingCategory.name}*.\n${matchingTxIds.length > 0 ? `\nגם עדכנתי ${matchingTxIds.length} תנועות קיימות.` : ''}`,
    success: true,
  };
}

/**
 * טיפול בפקודת "בטל [vendor]"
 */
export async function handleDeleteCommand(
  userId: string,
  vendorName: string
): Promise<EditResponse> {
  const patterns = await getAllUserPatterns(userId);
  const normalizedInput = normalizeVendorName(vendorName);
  
  const matchingPattern = patterns.find(p => 
    p.pattern_key === normalizedInput ||
    p.pattern_key.includes(normalizedInput)
  );
  
  if (!matchingPattern) {
    return {
      message: `לא מצאתי כלל בשם "${vendorName}".`,
      success: false,
    };
  }
  
  // מחק את ה-pattern
  const deleted = await deletePattern(userId, matchingPattern.pattern_key);
  
  if (deleted) {
    return {
      message: `✅ נמחק!\n\nהכלל עבור *${matchingPattern.pattern_key}* הוסר.\n\nבפעם הבאה שתהיה תנועה מספק זה, אשאל מחדש.`,
      success: true,
    };
  }
  
  return {
    message: 'אירעה שגיאה במחיקת הכלל. נסה שוב.',
    success: false,
  };
}

/**
 * טיפול בפקודת "הראה כללים"
 */
export async function handleShowPatternsCommand(
  userId: string
): Promise<EditResponse> {
  const patterns = await getAllUserPatterns(userId);
  
  if (patterns.length === 0) {
    return {
      message: 'אין עדיין כללי סיווג.\n\nכללים נוצרים אוטומטית כשאתה מסווג תנועות.',
      success: true,
    };
  }
  
  const lines: string[] = ['📋 *כללי הסיווג שלך:*\n'];
  
  // קבץ לפי confidence
  const highConf = patterns.filter(p => p.confidence_score >= 0.9);
  const medConf = patterns.filter(p => p.confidence_score >= 0.7 && p.confidence_score < 0.9);
  const lowConf = patterns.filter(p => p.confidence_score < 0.7);
  
  if (highConf.length > 0) {
    lines.push('✅ *אוטומטי (90%+):*');
    for (const p of highConf.slice(0, 5)) {
      lines.push(`• ${p.pattern_key} → ${p.pattern_value.category_name}`);
    }
    if (highConf.length > 5) lines.push(`  ...ועוד ${highConf.length - 5}`);
    lines.push('');
  }
  
  if (medConf.length > 0) {
    lines.push('🔶 *בינוני (70-90%):*');
    for (const p of medConf.slice(0, 5)) {
      lines.push(`• ${p.pattern_key} → ${p.pattern_value.category_name}`);
    }
    if (medConf.length > 5) lines.push(`  ...ועוד ${medConf.length - 5}`);
    lines.push('');
  }
  
  if (lowConf.length > 0) {
    lines.push('⚪ *למידה (<70%):*');
    for (const p of lowConf.slice(0, 3)) {
      lines.push(`• ${p.pattern_key} → ${p.pattern_value.category_name}`);
    }
    if (lowConf.length > 3) lines.push(`  ...ועוד ${lowConf.length - 3}`);
  }
  
  lines.push('\n*פקודות:*');
  lines.push('• תקן [ספק] - שנה קטגוריה');
  lines.push('• בטל [ספק] - מחק כלל');
  
  return {
    message: lines.join('\n'),
    success: true,
  };
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * טיפול בכל פקודות העריכה
 */
export async function handleEditClassificationMessage(
  userId: string,
  message: string,
  pendingEdit?: { vendor: string }
): Promise<EditResponse | null> {
  // בדוק אם יש עריכה ממתינה (צריך קטגוריה)
  if (pendingEdit?.vendor) {
    return await completeFixWithCategory(userId, pendingEdit.vendor, message);
  }
  
  // זהה פקודה
  const command = detectEditCommand(message);
  
  if (command.type === null) {
    return null;  // לא פקודת עריכה
  }
  
  switch (command.type) {
    case 'fix':
      return await handleFixCommand(userId, command.vendor!);
    
    case 'delete':
      return await handleDeleteCommand(userId, command.vendor!);
    
    case 'show':
      return await handleShowPatternsCommand(userId);
  }
}


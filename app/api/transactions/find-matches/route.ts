import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: POST /api/transactions/find-matches
 * מטרה: מציאת התאמות בין תנועות חדשות (אשראי) לתנועות קיימות (בנק)
 * 
 * Body: {
 *   transactionIds: string[] - מערך של IDs של תנועות שצריך למצוא להן התאמה
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transactionIds } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid transactionIds' },
        { status: 400 }
      );
    }

    // שלוף את התנועות החדשות (שצריך למצוא להן התאמה)
    const { data: newTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .in('id', transactionIds)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    if (!newTransactions || newTransactions.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // שלוף תנועות קיימות שעשויות להתאים
    // חיפוש תנועות מאותו חודש בלבד (אופטימיזציה)
    const dates = newTransactions.map((t: any) => new Date(t.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // הרחב טווח ב±7 ימים
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    const { data: existingTransactions, error: existError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', minDate.toISOString().split('T')[0])
      .lte('date', maxDate.toISOString().split('T')[0])
      .eq('is_summary', true)
      .eq('has_details', false) // רק תנועות שעדיין לא יש להן פירוט
      .neq('status', 'rejected');

    if (existError) {
      console.error('Error fetching existing transactions:', existError);
      return NextResponse.json(
        { error: 'Failed to fetch existing transactions' },
        { status: 500 }
      );
    }

    // מצא התאמות לכל תנועה חדשה
    const results = newTransactions.map((newTx: any) => {
      const potentialMatches = findPotentialMatches(newTx, existingTransactions || []);
      
      return {
        transactionId: newTx.id,
        transaction: newTx,
        matches: potentialMatches,
        hasMatches: potentialMatches.length > 0,
        bestMatch: potentialMatches.length > 0 ? potentialMatches[0] : null,
      };
    });

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Find matches error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * פונקציית עזר: מציאת התאמות פוטנציאליות לתנועה
 */
function findPotentialMatches(newTransaction: any, existingTransactions: any[]): any[] {
  const matches: any[] = [];
  const newAmount = parseFloat(newTransaction.amount);
  const newDate = new Date(newTransaction.date);

  for (const existing of existingTransactions) {
    const existingAmount = parseFloat(existing.amount);
    const existingDate = new Date(existing.date);
    
    // חישוב ציון התאמה
    const score = calculateMatchScore(
      {
        amount: newAmount,
        date: newDate,
        vendor: newTransaction.vendor || '',
        category: newTransaction.category || '',
      },
      {
        amount: existingAmount,
        date: existingDate,
        vendor: existing.vendor || '',
        category: existing.category || '',
        notes: existing.notes || '',
      }
    );

    // רק התאמות עם ציון מעל 0.5
    if (score.total >= 0.5) {
      matches.push({
        id: existing.id,
        transaction: existing,
        confidence: score.total,
        reasons: score.reasons,
        breakdown: score.breakdown,
      });
    }
  }

  // מיין לפי ציון (גבוה לנמוך)
  matches.sort((a, b) => b.confidence - a.confidence);

  // החזר רק top 3
  return matches.slice(0, 3);
}

/**
 * פונקציית עזר: חישוב ציון התאמה
 */
function calculateMatchScore(
  newTx: { amount: number; date: Date; vendor: string; category: string },
  existingTx: { amount: number; date: Date; vendor: string; category: string; notes: string }
): { total: number; reasons: string[]; breakdown: Record<string, number> } {
  const reasons: string[] = [];
  const breakdown: Record<string, number> = {};
  
  // 1. התאמת סכום (40% מהציון)
  const amountDiff = Math.abs(newTx.amount - existingTx.amount);
  const amountPercentDiff = (amountDiff / existingTx.amount) * 100;
  
  let amountScore = 0;
  if (amountPercentDiff <= 2) {
    amountScore = 1.0; // התאמה מושלמת
    reasons.push(`סכום זהה (${newTx.amount} ₪)`);
  } else if (amountPercentDiff <= 5) {
    amountScore = 0.8;
    reasons.push(`סכום דומה מאוד (הפרש ${amountDiff.toFixed(2)} ₪)`);
  } else if (amountPercentDiff <= 10) {
    amountScore = 0.5;
    reasons.push(`סכום קרוב (הפרש ${amountPercentDiff.toFixed(1)}%)`);
  } else {
    amountScore = 0.2;
  }
  breakdown.amount = amountScore * 0.4;

  // 2. התאמת תאריך (30% מהציון)
  const daysDiff = Math.abs((newTx.date.getTime() - existingTx.date.getTime()) / (1000 * 60 * 60 * 24));
  
  let dateScore = 0;
  if (daysDiff <= 1) {
    dateScore = 1.0;
    reasons.push('אותו תאריך או יום אחד הפרש');
  } else if (daysDiff <= 3) {
    dateScore = 0.8;
    reasons.push(`הפרש ${Math.floor(daysDiff)} ימים`);
  } else if (daysDiff <= 7) {
    dateScore = 0.5;
    reasons.push(`באותו שבוע (${Math.floor(daysDiff)} ימים)`);
  } else {
    dateScore = 0.2;
  }
  breakdown.date = dateScore * 0.3;

  // 3. התאמת שם ספק (20% מהציון)
  let vendorScore = 0;
  const newVendor = (newTx.vendor || '').toLowerCase().trim();
  const existingVendor = (existingTx.vendor || '').toLowerCase().trim();
  const existingNotes = (existingTx.notes || '').toLowerCase().trim();

  if (newVendor && existingVendor) {
    if (existingVendor.includes(newVendor) || newVendor.includes(existingVendor)) {
      vendorScore = 1.0;
      reasons.push(`שם ספק תואם: ${newVendor}`);
    } else if (existingNotes.includes(newVendor)) {
      vendorScore = 0.7;
      reasons.push(`שם ספק מופיע בהערות`);
    } else {
      // בדיקת דמיון חלקי (למשל "ויזה" ו-"visa")
      const similarity = calculateStringSimilarity(newVendor, existingVendor);
      if (similarity > 0.6) {
        vendorScore = similarity;
        reasons.push(`ספק דומה`);
      }
    }
  }
  breakdown.vendor = vendorScore * 0.2;

  // 4. התאמת קטגוריה (10% מהציון)
  let categoryScore = 0;
  if (newTx.category && existingTx.category) {
    if (newTx.category === existingTx.category) {
      categoryScore = 1.0;
      reasons.push('אותה קטגוריה');
    }
  }
  breakdown.category = categoryScore * 0.1;

  // חישוב ציון כולל
  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    total: Math.round(total * 100) / 100, // עיגול ל-2 ספרות
    reasons,
    breakdown,
  };
}

/**
 * פונקציית עזר: חישוב דמיון בין שתי מחרוזות
 * באמצעות Levenshtein distance מפושט
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  // ספירת תווים משותפים
  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }
  
  return matches / longer.length;
}


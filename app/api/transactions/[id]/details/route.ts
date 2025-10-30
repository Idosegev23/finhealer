import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: GET /api/transactions/[id]/details
 * מטרה: שליפת פירוט מלא של תנועה כולל סטטיסטיקות
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactionId = params.id;

    // 1. שלוף את התנועה הראשית
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', user.id)
      .single();

    if (txError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // 2. אם אין פירוט, החזר רק את התנועה
    const txData = transaction as any;
    if (!txData.has_details) {
      return NextResponse.json({
        success: true,
        transaction,
        hasDetails: false,
        details: [],
        statistics: null,
      });
    }

    // 3. שלוף את הפירוט
    const { data: details, error: detailsError } = await supabase
      .from('transaction_details')
      .select('*')
      .eq('parent_transaction_id', transactionId)
      .order('date', { ascending: true });

    if (detailsError) {
      console.error('Failed to fetch details:', detailsError);
      return NextResponse.json(
        { error: 'Failed to fetch transaction details' },
        { status: 500 }
      );
    }

    // 4. חישוב סטטיסטיקות
    const statistics = calculateStatistics(transaction, details || []);

    return NextResponse.json({
      success: true,
      transaction,
      hasDetails: true,
      details: details || [],
      detailsCount: details?.length || 0,
      statistics,
    });
  } catch (error: any) {
    console.error('Get transaction details error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * פונקציית עזר: חישוב סטטיסטיקות פירוט
 */
function calculateStatistics(transaction: any, details: any[]) {
  if (!details || details.length === 0) {
    return null;
  }

  // סה"כ סכום פירוט
  const totalDetailsAmount = details.reduce((sum, detail) => {
    return sum + parseFloat(detail.amount || 0);
  }, 0);

  // הפרש בין תנועה ראשית לפירוט
  const parentAmount = parseFloat(transaction.amount || 0);
  const difference = Math.abs(parentAmount - totalDetailsAmount);
  const differencePercent = parentAmount > 0 ? (difference / parentAmount) * 100 : 0;

  // פיזור לפי קטגוריות
  const byCategory: Record<string, { count: number; total: number; items: any[] }> = {};
  for (const detail of details) {
    const category = detail.expense_category || detail.category || 'אחר';
    if (!byCategory[category]) {
      byCategory[category] = { count: 0, total: 0, items: [] };
    }
    byCategory[category].count++;
    byCategory[category].total += parseFloat(detail.amount || 0);
    byCategory[category].items.push(detail);
  }

  // מיון לפי סכום (גבוה לנמוך)
  const categoriesArray = Object.entries(byCategory).map(([name, data]) => ({
    name,
    count: data.count,
    total: data.total,
    percentage: totalDetailsAmount > 0 ? (data.total / totalDetailsAmount) * 100 : 0,
    items: data.items,
  }));
  categoriesArray.sort((a, b) => b.total - a.total);

  // פיזור לפי סוג הוצאה (קבועה/משתנה/מיוחדת)
  const byType: Record<string, { count: number; total: number }> = {
    fixed: { count: 0, total: 0 },
    variable: { count: 0, total: 0 },
    special: { count: 0, total: 0 },
  };
  for (const detail of details) {
    const type = detail.expense_type || 'variable';
    if (byType[type]) {
      byType[type].count++;
      byType[type].total += parseFloat(detail.amount || 0);
    }
  }

  // פיזור לפי ספק (top 5)
  const byVendor: Record<string, { count: number; total: number }> = {};
  for (const detail of details) {
    const vendor = detail.vendor || 'לא צוין';
    if (!byVendor[vendor]) {
      byVendor[vendor] = { count: 0, total: 0 };
    }
    byVendor[vendor].count++;
    byVendor[vendor].total += parseFloat(detail.amount || 0);
  }
  const vendorsArray = Object.entries(byVendor).map(([name, data]) => ({
    name,
    count: data.count,
    total: data.total,
  }));
  vendorsArray.sort((a, b) => b.total - a.total);
  const topVendors = vendorsArray.slice(0, 5);

  // טווח תאריכים
  const dates = details.map(d => new Date(d.date).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const dateRange = {
    from: minDate.toISOString().split('T')[0],
    to: maxDate.toISOString().split('T')[0],
    days: Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  };

  // ממוצעים
  const averageAmount = totalDetailsAmount / details.length;
  const maxAmount = Math.max(...details.map(d => parseFloat(d.amount || 0)));
  const minAmount = Math.min(...details.map(d => parseFloat(d.amount || 0)));

  return {
    summary: {
      parentAmount: parentAmount.toFixed(2),
      totalDetailsAmount: totalDetailsAmount.toFixed(2),
      difference: difference.toFixed(2),
      differencePercent: differencePercent.toFixed(2),
      isMatching: differencePercent < 5, // הפרש קטן מ-5% נחשב התאמה
    },
    breakdown: {
      byCategory: categoriesArray,
      byType: Object.entries(byType).map(([name, data]) => ({
        type: name,
        count: data.count,
        total: data.total,
        percentage: totalDetailsAmount > 0 ? (data.total / totalDetailsAmount) * 100 : 0,
      })),
      topVendors,
    },
    metrics: {
      count: details.length,
      average: averageAmount.toFixed(2),
      max: maxAmount.toFixed(2),
      min: minAmount.toFixed(2),
      dateRange,
    },
  };
}


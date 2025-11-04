import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: /api/income/list
 * שליפת כל מקורות ההכנסה של המשתמש
 * 
 * Query params:
 * - active: true/false (ברירת מחדל: true)
 * - type: employment_type לסינון
 * - is_primary: true/false
 * - sort: name/amount/created_at (ברירת מחדל: created_at)
 * - order: asc/desc (ברירת מחדל: desc)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // פרמטרים
    const { searchParams } = new URL(request.url);
    const activeFilter = searchParams.get('active');
    const typeFilter = searchParams.get('type');
    const isPrimaryFilter = searchParams.get('is_primary');
    const sortBy = searchParams.get('sort') || 'created_at';
    const order = searchParams.get('order') || 'desc';

    // שאילתה בסיסית
    let query = (supabase as any)
      .from('income_sources')
      .select('*')
      .eq('user_id', user.id);

    // פילטרים
    if (activeFilter !== null) {
      query = query.eq('active', activeFilter === 'true');
    }

    if (typeFilter) {
      query = query.eq('employment_type', typeFilter);
    }

    if (isPrimaryFilter !== null) {
      query = query.eq('is_primary', isPrimaryFilter === 'true');
    }

    // מיון
    const validSortFields = ['source_name', 'gross_amount', 'actual_bank_amount', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(sortField, { ascending: order === 'asc' });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const incomeSources = data || [];

    // חישוב סטטיסטיקות
    const stats = {
      total: incomeSources.length,
      totalMonthlyIncome: incomeSources
        .filter((source: any) => source.active && source.payment_frequency === 'monthly')
        .reduce((sum: number, source: any) => sum + (source.actual_bank_amount || 0), 0),
      primaryCount: incomeSources.filter((source: any) => source.is_primary).length,
      typeBreakdown: incomeSources.reduce((acc: any, source: any) => {
        const type = source.employment_type || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({
      success: true,
      incomeSources,
      stats,
      count: incomeSources.length,
    });
  } catch (error) {
    console.error('[/api/income/list] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשליפת מקורות הכנסה' },
      { status: 500 }
    );
  }
}

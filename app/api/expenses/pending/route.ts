import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route: GET /api/expenses/pending
 * מטרה: שליפת הוצאות ממתינות לאישור
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // שליפת הוצאות ממתינות
    const { data: expenses, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('status', 'proposed')
      .eq('source', 'ocr')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending expenses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch expenses' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expenses: expenses || [],
      count: expenses?.length || 0,
    });
  } catch (error: any) {
    console.error('Pending expenses error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


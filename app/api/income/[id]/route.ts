import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: /api/income/[id]
 * CRUD operations למקור הכנסה ספציפי
 */

/**
 * GET: שליפת מקור הכנסה ספציפי
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await (supabase as any)
      .from('income_sources')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'מקור הכנסה לא נמצא' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, income: data });
  } catch (error) {
    console.error('[/api/income/[id]] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשליפת מקור הכנסה' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: עדכון מקור הכנסה
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // שדות מותרים לעדכון
    const allowedFields = [
      'source_name',
      'employment_type',
      'gross_amount',
      'net_amount',
      'actual_bank_amount',
      'employer_name',
      'pension_contribution',
      'advanced_study_fund',
      'other_deductions',
      'payment_frequency',
      'is_primary',
      'active',
      'notes',
      'is_variable',
      'min_amount',
      'max_amount',
    ];

    // סינון שדות
    const updates: Record<string, any> = {};
    allowedFields.forEach(field => {
      if (field in body) {
        updates[field] = body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 });
    }

    // הוספת updated_at
    updates.updated_at = new Date().toISOString();

    // עדכון
    const { data, error } = await (supabase as any)
      .from('income_sources')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'מקור הכנסה לא נמצא' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, income: data });
  } catch (error) {
    console.error('[/api/income/[id]] PATCH Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בעדכון מקור הכנסה' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: מחיקה רכה של מקור הכנסה (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // בדיקה האם לעשות מחיקה קשה או רכה
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // מחיקה קשה - למחוק לגמרי
      const { error } = await (supabase as any)
        .from('income_sources')
        .delete()
        .eq('id', params.id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
    } else {
      // מחיקה רכה - סימון כלא פעיל
      const { error } = await (supabase as any)
        .from('income_sources')
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'מקור הכנסה נמחק לצמיתות' : 'מקור הכנסה סומן כלא פעיל',
      deleted: hardDelete,
    });
  } catch (error) {
    console.error('[/api/income/[id]] DELETE Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה במחיקת מקור הכנסה' },
      { status: 500 }
    );
  }
}


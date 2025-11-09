import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: /api/income
 * יצירת מקור הכנסה חדש
 * 
 * POST body:
 * {
 *   source_name: string (required);
 *   employment_type: string (required);
 *   gross_amount?: number;
 *   net_amount?: number;
 *   actual_bank_amount?: number;
 *   employer_name?: string;
 *   pension_contribution?: number;
 *   advanced_study_fund?: number;
 *   other_deductions?: number;
 *   payment_frequency?: 'monthly' | 'weekly' | 'one_time' | 'variable';
 *   is_primary?: boolean;
 *   notes?: string;
 *   is_variable?: boolean;
 *   min_amount?: number;
 *   max_amount?: number;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('✅ Credit statement uploaded:', body);

    // ולידציה בסיסית
    if (!body.source_name || !body.employment_type) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה: source_name, employment_type' },
        { status: 400 }
      );
    }

    // ולידציה בסיסית של סכומים
    const actualAmount = body.actual_bank_amount ?? null;
    const grossAmount = body.gross_amount ?? null;
    const netAmount = body.net_amount ?? null;

    // בדיקה שיש לפחות סכום אחד
    if (!actualAmount && !grossAmount && !netAmount) {
      return NextResponse.json(
        { error: 'חובה למלא לפחות סכום אחד (נכנס לבנק/נטו/ברוטו)' },
        { status: 400 }
      );
    }

    // בדיקת יחסים בסיסיים
    if (grossAmount && netAmount && grossAmount < netAmount) {
      return NextResponse.json(
        { error: 'ברוטו לא יכול להיות נמוך מנטו' },
        { status: 400 }
      );
    }

    if (netAmount && actualAmount && netAmount < actualAmount) {
      return NextResponse.json(
        { error: 'נטו לא יכול להיות נמוך מסכום בנק' },
        { status: 400 }
      );
    }

    // הכנת נתונים להכנסה
    const incomeData: any = {
      user_id: user.id,
      source_name: body.source_name.trim(),
      employment_type: body.employment_type,
      gross_amount: grossAmount ?? 0,
      net_amount: netAmount ?? 0,
      actual_bank_amount: actualAmount ?? 0,
      employer_name: body.employer_name?.trim() || null,
      pension_contribution: body.pension_contribution ?? 0,
      advanced_study_fund: body.advanced_study_fund ?? 0,
      other_deductions: body.other_deductions ?? 0,
      payment_frequency: body.payment_frequency || 'monthly',
      is_primary: body.is_primary ?? false,
      active: true,
      notes: body.notes?.trim() || null,
      is_variable: body.is_variable ?? false,
      min_amount: body.min_amount ?? null,
      max_amount: body.max_amount ?? null,
      
      // שדות ישראליים חדשים
      vat_status: body.vat_status || 'not_applicable',
      includes_vat: body.includes_vat ?? false,
      vat_amount: body.vat_amount ?? null,
      has_withholding_tax: body.has_withholding_tax ?? false,
      withholding_tax_amount: body.withholding_tax_amount ?? null,
      is_hybrid: body.is_hybrid ?? false,
      hybrid_salary_part: body.hybrid_salary_part ?? null,
      hybrid_freelance_part: body.hybrid_freelance_part ?? null,
      capital_gain_tax_paid: body.capital_gain_tax_paid ?? false,
      capital_gain_tax_rate: body.capital_gain_tax_rate ?? null,
      allowance_type: body.allowance_type || null,
      is_tax_exempt: body.is_tax_exempt ?? false,
      detailed_breakdown: body.detailed_breakdown ?? null,
    };

    console.log('💾 Saving income data:', incomeData);

    // יצירה
    const { data, error } = await (supabase as any)
      .from('income_sources')
      .insert([incomeData])
      .select()
      .single();

    if (error) {
      console.error('[/api/income] Insert Error:', error);
      
      // טיפול בשגיאות ספציפיות
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'מקור הכנסה בשם זה כבר קיים' },
          { status: 409 }
        );
      }

      throw error;
    }

    console.log('✅ Income created successfully:', data.id);

    return NextResponse.json({
      success: true,
      income: data,
      message: 'מקור הכנסה נוצר בהצלחה!',
    }, { status: 201 });

  } catch (error) {
    console.error('[/api/income] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'שגיאה ביצירת מקור הכנסה',
        details: error instanceof Error ? error.stack : undefined 
      },
      { status: 500 }
    );
  }
}

/**
 * GET: שליפת כל מקורות ההכנסה (קיצור ל-/api/income/list)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await (supabase as any)
      .from('income_sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      incomeSources: data || [],
      count: (data || []).length,
    });

  } catch (error) {
    console.error('[/api/income] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'שגיאה בשליפת מקורות הכנסה' },
      { status: 500 }
    );
  }
}

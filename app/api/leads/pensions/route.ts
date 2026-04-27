import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPensionsLeadEmail, type PensionRow } from '@/lib/email/advisor-emails';
import { analyzePensionPlan, analyzePortfolio } from '@/lib/finance/pension-insights';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', user.id)
      .maybeSingle();

    const { data: plans } = await supabase
      .from('pension_insurance')
      .select('fund_name, fund_type, provider, current_balance, monthly_deposit, management_fee_percentage, deposit_fee_percentage, annual_return, active')
      .eq('user_id', user.id);

    if (!plans || plans.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו תוכניות פנסיוניות' }, { status: 400 });
    }

    const planRows = plans as PensionRow[];
    const perPlan = planRows.flatMap((p) => analyzePensionPlan(p));
    const portfolio = analyzePortfolio(planRows);
    const insights = [...portfolio, ...perPlan];

    const flagged = insights.filter((i) => i.severity === 'critical' || i.severity === 'warning');
    if (flagged.length === 0) {
      return NextResponse.json(
        { error: 'אין סימני אזהרה בתיק הפנסיוני שלך כרגע — לא נדרש ייעוץ דחוף' },
        { status: 400 },
      );
    }

    const result = await sendPensionsLeadEmail(
      {
        name: (profile as any)?.name || user.email?.split('@')[0] || '',
        email: (profile as any)?.email || user.email || '',
        phone: (profile as any)?.phone || '',
      },
      planRows,
      insights,
    );

    if (!result.sent) {
      return NextResponse.json({ error: 'שליחת המייל נכשלה', reason: result.reason }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: planRows.length, flagged: flagged.length });
  } catch (error: any) {
    console.error('Error in /api/leads/pensions:', error);
    return NextResponse.json({ error: error.message || 'שגיאה' }, { status: 500 });
  }
}

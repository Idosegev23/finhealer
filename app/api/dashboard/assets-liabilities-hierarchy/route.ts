import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const level = searchParams.get('level') || '1';
    const mainCategory = searchParams.get('main_category'); // 'assets' or 'liabilities'
    const subCategory = searchParams.get('sub_category');

    // רמה 1: נכסים מול חובות
    if (level === '1') {
      // חישוב סך הנכסים
      const { data: savings } = await supabase
        .from('savings_accounts')
        .select('current_balance')
        .eq('user_id', user.id)
        .eq('active', true);

      const { data: pensions } = await supabase
        .from('pension_insurance')
        .select('current_balance')
        .eq('user_id', user.id)
        .eq('active', true);

      const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const { data: profile } = await supabase
        .from('user_financial_profile')
        .select('investments')
        .eq('user_id', user.id)
        .single();

      const totalSavings = (savings || []).reduce((sum: number, acc: any) => 
        sum + (Number(acc.current_balance) || 0), 0);
      const totalPensions = (pensions || []).reduce((sum: number, pen: any) => 
        sum + (Number(pen.current_balance) || 0), 0);
      const totalBank = (bankAccounts || []).reduce((sum: number, acc: any) => 
        sum + (Number(acc.current_balance) || 0), 0);
      const totalInvestments = Number((profile as any)?.investments) || 0;

      const totalAssets = totalSavings + totalPensions + totalBank + totalInvestments;

      // חישוב סך החובות
      const { data: loans } = await supabase
        .from('loans')
        .select('current_balance')
        .eq('user_id', user.id)
        .eq('active', true);

      const totalLiabilities = (loans || []).reduce((sum: number, loan: any) => 
        sum + (Number(loan.current_balance) || 0), 0);

      const result = [
        {
          name: 'נכסים 💰',
          value: Math.round(totalAssets),
          metadata: { main_category: 'assets' },
          color: '#7ED957' // ירוק
        },
        {
          name: 'חובות 💳',
          value: Math.round(totalLiabilities),
          metadata: { main_category: 'liabilities' },
          color: '#E74C3C' // אדום
        }
      ];

      return NextResponse.json(result);
    }

    // רמה 2: פילוח נכסים או חובות
    if (level === '2' && mainCategory) {
      if (mainCategory === 'assets') {
        const { data: savings } = await supabase
          .from('savings_accounts')
          .select('current_balance')
          .eq('user_id', user.id)
          .eq('active', true);

        const { data: pensions } = await supabase
          .from('pension_insurance')
          .select('current_balance')
          .eq('user_id', user.id)
          .eq('active', true);

        const { data: bankAccounts } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('user_id', user.id)
          .eq('is_current', true);

        const { data: profile } = await supabase
          .from('user_financial_profile')
          .select('investments')
          .eq('user_id', user.id)
          .single();

        const totalSavings = (savings || []).reduce((sum: number, acc: any) => 
          sum + (Number(acc.current_balance) || 0), 0);
        const totalPensions = (pensions || []).reduce((sum: number, pen: any) => 
          sum + (Number(pen.current_balance) || 0), 0);
        const totalBank = (bankAccounts || []).reduce((sum: number, acc: any) => 
          sum + (Number(acc.current_balance) || 0), 0);
        const totalInvestments = Number((profile as any)?.investments) || 0;

        const result = [
          {
            name: 'חיסכון',
            value: Math.round(totalSavings),
            metadata: { main_category: 'assets', sub_category: 'savings' }
          },
          {
            name: 'פנסיה וביטוח',
            value: Math.round(totalPensions),
            metadata: { main_category: 'assets', sub_category: 'pensions' }
          },
          {
            name: 'חשבונות בנק',
            value: Math.round(totalBank),
            metadata: { main_category: 'assets', sub_category: 'bank' }
          },
          {
            name: 'השקעות',
            value: Math.round(totalInvestments),
            metadata: { main_category: 'assets', sub_category: 'investments' }
          }
        ].filter(item => item.value > 0);

        return NextResponse.json(result);
      }

      if (mainCategory === 'liabilities') {
        const { data: loans } = await supabase
          .from('loans')
          .select('loan_type, current_balance')
          .eq('user_id', user.id)
          .eq('active', true);

        // קיבוץ לפי loan_type
        const grouped = (loans || []).reduce((acc: any, loan: any) => {
          const type = loan.loan_type || 'other';
          if (!acc[type]) {
            acc[type] = 0;
          }
          acc[type] += Number(loan.current_balance) || 0;
          return acc;
        }, {});

        const result = Object.entries(grouped).map(([type, value]) => ({
          name: translateLoanType(type),
          value: Math.round(value as number),
          metadata: { main_category: 'liabilities', sub_category: type }
        }));

        return NextResponse.json(result);
      }
    }

    // רמה 3: פירוט פריטים ספציפיים
    if (level === '3' && mainCategory && subCategory) {
      if (mainCategory === 'assets') {
        if (subCategory === 'savings') {
          const { data: savings } = await supabase
            .from('savings_accounts')
            .select('bank_name, account_type, current_balance')
            .eq('user_id', user.id)
            .eq('active', true);

          const result = (savings || []).map((acc: any, index: number) => ({
            name: `${acc.bank_name || 'חיסכון'} - ${acc.account_type || 'חשבון'} ${index + 1}`,
            value: Math.round(Number(acc.current_balance) || 0)
          }));

          return NextResponse.json(result);
        }

        if (subCategory === 'pensions') {
          const { data: pensions } = await supabase
            .from('pension_insurance')
            .select('provider_name, policy_type, current_balance')
            .eq('user_id', user.id)
            .eq('active', true);

          const result = (pensions || []).map((pen: any) => ({
            name: `${pen.provider_name || 'פנסיה'} - ${pen.policy_type || 'פוליסה'}`,
            value: Math.round(Number(pen.current_balance) || 0)
          }));

          return NextResponse.json(result);
        }

        if (subCategory === 'bank') {
          const { data: bankAccounts } = await supabase
            .from('bank_accounts')
            .select('bank_name, account_type, current_balance')
            .eq('user_id', user.id)
            .eq('is_current', true);

          const result = (bankAccounts || []).map((acc: any) => ({
            name: `${acc.bank_name || 'בנק'} - ${acc.account_type || 'חשבון עו"ש'}`,
            value: Math.round(Number(acc.current_balance) || 0)
          }));

          return NextResponse.json(result);
        }
      }

      if (mainCategory === 'liabilities') {
        const { data: loans } = await supabase
          .from('loans')
          .select('lender_name, loan_type, current_balance')
          .eq('user_id', user.id)
          .eq('active', true)
          .eq('loan_type', subCategory);

        const result = (loans || []).map((loan: any) => ({
          name: `${loan.lender_name} - ${translateLoanType(loan.loan_type)}`,
          value: Math.round(Number(loan.current_balance) || 0)
        }));

        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching assets-liabilities hierarchy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function translateLoanType(type: string): string {
  const translations: Record<string, string> = {
    'mortgage': 'משכנתא',
    'personal': 'הלוואה אישית',
    'credit_card': 'כרטיס אשראי',
    'car': 'הלוואת רכב',
    'student': 'הלוואת סטודנטים',
    'business': 'הלוואה עסקית',
    'overdraft': 'משיכת יתר',
    'other': 'אחר'
  };
  return translations[type] || type;
}


import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to calculate date range based on period (same as expenses)
function getDateRange(period: string): { startDate: string; endDate: string; periodLabel: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate: Date;
  let endDate: Date = new Date(today);
  let periodLabel: string;

  switch (period) {
    case 'current_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
      periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      break;
    
    case 'last_3_months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startMonth = startDate.getMonth();
      const endMonth = endDate.getMonth();
      const monthNamesShort = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
      if (startDate.getFullYear() === endDate.getFullYear()) {
        periodLabel = `${monthNamesShort[startMonth]}-${monthNamesShort[endMonth]} ${endDate.getFullYear()}`;
      } else {
        periodLabel = `${monthNamesShort[startMonth]} ${startDate.getFullYear()}-${monthNamesShort[endMonth]} ${endDate.getFullYear()}`;
      }
      break;
    
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodLabel = `שנה אחרונה (${now.getFullYear() - 1}-${now.getFullYear()})`;
      break;
    
    case 'all_time':
      startDate = new Date(2000, 0, 1);
      endDate = new Date(today);
      periodLabel = 'כל הזמן';
      break;
    
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startMonthDefault = startDate.getMonth();
      const endMonthDefault = endDate.getMonth();
      const monthNamesShortDefault = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
      if (startDate.getFullYear() === endDate.getFullYear()) {
        periodLabel = `${monthNamesShortDefault[startMonthDefault]}-${monthNamesShortDefault[endMonthDefault]} ${endDate.getFullYear()}`;
      } else {
        periodLabel = `${monthNamesShortDefault[startMonthDefault]} ${startDate.getFullYear()}-${monthNamesShortDefault[endMonthDefault]} ${endDate.getFullYear()}`;
      }
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    periodLabel
  };
}

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
    const sourceType = searchParams.get('source_type');
    const period = searchParams.get('period') || 'last_3_months'; // ברירת מחדל: 3 חודשים אחרונים

    // חישוב טווח תאריכים לפי תקופה
    const { startDate, endDate, periodLabel } = getDateRange(period);
    
    console.log(`📊 Income hierarchy API called:`, {
      userId: user.id,
      level,
      period,
      startDate,
      endDate,
      periodLabel,
      sourceType
    });

    // רמה 1: פילוח לפי סוג מקור הכנסה
    if (level === '1') {
      // קבלת מקורות הכנסה קבועים
      const { data: incomeSources, error: sourcesError } = await supabase
        .from('income_sources')
        .select('employment_type, net_amount, source_name')
        .eq('user_id', user.id)
        .eq('active', true);

      // קבלת תנועות הכנסה מהתקופה הנבחרת
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount, category, vendor')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('status', 'confirmed')
        .gte('date', startDate)
        .lte('date', endDate)
        .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true');

      if (sourcesError) {
        console.error('❌ Error fetching income sources:', sourcesError);
      }
      if (transactionsError) {
        console.error('❌ Error fetching income transactions:', transactionsError);
      }

      // קיבוץ לפי source_type - מתחיל עם מקורות קבועים
      const grouped: Record<string, { total: number; sources: any[] }> = {};
      
      // הוספת מקורות הכנסה קבועים
      (incomeSources || []).forEach((source: any) => {
        const type = source.employment_type || 'other';
        if (!grouped[type]) {
          grouped[type] = { total: 0, sources: [] };
        }
        // הכפלת הכנסה חודשית לפי מספר חודשים בתקופה
        const monthsInPeriod = period === 'current_month' ? 1 : period === 'last_3_months' ? 3 : period === 'last_year' ? 12 : 1;
        grouped[type].total += (Number(source.net_amount) || 0) * monthsInPeriod;
        grouped[type].sources.push(source);
      });

      // הוספת תנועות הכנסה בפועל
      (transactions || []).forEach((tx: any) => {
        const type = tx.category || 'other'; // transactions don't have employment_type
        if (!grouped[type]) {
          grouped[type] = { total: 0, sources: [] };
        }
        grouped[type].total += Number(tx.amount) || 0;
        grouped[type].sources.push(tx);
      });

      const result = Object.entries(grouped).map(([type, data]: [string, any]) => ({
        name: translateSourceType(type),
        value: Math.round(data.total),
        metadata: { type: type }
      }));

      console.log(`✅ Found ${incomeSources?.length || 0} income sources and ${transactions?.length || 0} income transactions`);

      return NextResponse.json({
        data: result,
        period: {
          startDate,
          endDate,
          periodLabel,
          period
        }
      });
    }

    // רמה 2: פירוט מקורות ספציפיים בתוך הסוג
    if (level === '2' && sourceType) {
      // מקורות הכנסה קבועים
      const { data: incomeSources, error: sourcesError } = await supabase
        .from('income_sources')
        .select('source_name, net_amount, employer_name, notes')
        .eq('user_id', user.id)
        .eq('active', true)
        .eq('employment_type', sourceType);

      // תנועות הכנסה מהתקופה
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount, vendor, notes, date, category')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .eq('status', 'confirmed')
        .gte('date', startDate)
        .lte('date', endDate)
        .or('has_details.is.null,has_details.eq.false');

      if (sourcesError) {
        console.error('❌ Error fetching income sources:', sourcesError);
      }
      if (transactionsError) {
        console.error('❌ Error fetching income transactions:', transactionsError);
      }

      const result: any[] = [];

      // הוספת מקורות הכנסה קבועים
      (incomeSources || []).forEach((source: any) => {
        const name = source.source_name || source.employer_name || 'מקור הכנסה';
        const monthsInPeriod = period === 'current_month' ? 1 : period === 'last_3_months' ? 3 : period === 'last_year' ? 12 : 1;
        result.push({
          name,
          value: Math.round((Number(source.net_amount) || 0) * monthsInPeriod),
          description: source.notes
        });
      });

      // הוספת תנועות הכנסה בפועל
      (transactions || []).forEach((tx: any) => {
        const date = new Date(tx.date).toLocaleDateString('he-IL');
        const name = tx.vendor || `הכנסה (${date})`;
        result.push({
          name,
          value: Math.round(Number(tx.amount) || 0),
          description: tx.notes || null
        });
      });

      console.log(`✅ Found ${incomeSources?.length || 0} income sources and ${transactions?.length || 0} transactions for ${sourceType}`);

      return NextResponse.json({
        data: result,
        period: {
          startDate,
          endDate,
          periodLabel,
          period
        }
      });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching income hierarchy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function translateSourceType(type: string): string {
  const translations: Record<string, string> = {
    'salary': 'משכורת',
    'self_employed': 'עצמאי',
    'pension': 'פנסיה',
    'rental': 'השכרה',
    'investment': 'השקעות',
    'social_security': 'ביטוח לאומי',
    'alimony': 'מזונות',
    'other': 'אחר'
  };
  return translations[type] || type;
}







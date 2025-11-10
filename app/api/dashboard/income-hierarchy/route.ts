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
    const sourceType = searchParams.get('source_type');

    const currentMonth = new Date().toISOString().slice(0, 7);

    // רמה 1: פילוח לפי סוג מקור הכנסה
    if (level === '1') {
      const { data: incomeSources } = await supabase
        .from('income_sources')
        .select('source_type, net_amount, name')
        .eq('user_id', user.id)
        .eq('active', true);

      // קיבוץ לפי source_type
      const grouped = (incomeSources || []).reduce((acc: any, source: any) => {
        const type = source.source_type || 'other';
        if (!acc[type]) {
          acc[type] = { total: 0, sources: [] };
        }
        acc[type].total += Number(source.net_amount) || 0;
        acc[type].sources.push(source);
        return acc;
      }, {});

      const result = Object.entries(grouped).map(([type, data]: [string, any]) => ({
        name: translateSourceType(type),
        value: Math.round(data.total),
        metadata: { source_type: type }
      }));

      return NextResponse.json(result);
    }

    // רמה 2: פירוט מקורות ספציפיים בתוך הסוג
    if (level === '2' && sourceType) {
      const { data: incomeSources } = await supabase
        .from('income_sources')
        .select('name, net_amount, employer_name, description')
        .eq('user_id', user.id)
        .eq('active', true)
        .eq('source_type', sourceType);

      const result = (incomeSources || []).map((source: any) => {
        const name = source.name || source.employer_name || 'מקור הכנסה';
        return {
          name,
          value: Math.round(Number(source.net_amount) || 0),
          description: source.description
        };
      });

      return NextResponse.json(result);
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





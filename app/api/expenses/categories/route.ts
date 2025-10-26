// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/expenses/categories
 * מחזיר רשימת קטגוריות הוצאות מסוננת לפי employment_status
 * 
 * Query params:
 * - search: חיפוש טקסט חופשי
 * - employment_status: employee | self_employed | both (override)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // אימות משתמש
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // קבלת פרמטרים
    const searchParams = request.nextUrl.searchParams;
    const searchQuery = searchParams.get('search');
    const employmentOverride = searchParams.get('employment_status');

    // שליפת employment_status של המשתמש
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('employment_status')
      .eq('id', user.id)
      .single();

    const employmentStatus = employmentOverride || userData?.employment_status || 'both';

    // שליפת קטגוריות מוגדרות מראש
    let query = (supabase as any)
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('category_group', { ascending: true })
      .order('display_order', { ascending: true });

    // סינון לפי employment_status
    if (employmentStatus === 'employee' || employmentStatus === 'self_employed') {
      query = query.or(`applicable_to.eq.${employmentStatus},applicable_to.eq.both`);
    }

    // חיפוש טקסט
    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery.trim()}%`);
    }

    const { data: predefined, error: predefinedError } = await query;

    if (predefinedError) {
      console.error('Error fetching predefined categories:', predefinedError);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    // שליפת קטגוריות מותאמות אישית
    let customQuery = (supabase as any)
      .from('user_custom_expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (searchQuery && searchQuery.trim()) {
      customQuery = customQuery.ilike('name', `%${searchQuery.trim()}%`);
    }

    const { data: custom, error: customError } = await customQuery;

    if (customError) {
      console.error('Error fetching custom categories:', customError);
      // לא נכשיל את כל הבקשה, רק נחזיר רשימה ריקה
    }

    // קיבוץ לפי category_group
    const grouped: Record<string, any[]> = {};
    
    (predefined || []).forEach((item: any) => {
      const group = item.category_group || 'אחר';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push({
        ...item,
        is_custom: false
      });
    });

    // הוספת מותאמות אישית לקבוצה נפרדת
    if (custom && custom.length > 0) {
      grouped['מותאמות אישית'] = custom.map((item: any) => ({
        ...item,
        is_custom: true
      }));
    }

    return NextResponse.json({
      predefined: (predefined || []).map((item: any) => ({ ...item, is_custom: false })),
      custom: (custom || []).map((item: any) => ({ ...item, is_custom: true })),
      grouped,
      total: (predefined?.length || 0) + (custom?.length || 0)
    });

  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


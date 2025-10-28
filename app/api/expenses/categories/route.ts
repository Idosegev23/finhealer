import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API לשליפת קטגוריות הוצאות
 * תומך בחיפוש, סינון לפי סוג, ומעמד
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // פרמטרים
    const search = searchParams.get('search') || '';
    const expenseType = searchParams.get('type'); // fixed, variable, special
    const applicableTo = searchParams.get('applicable'); // employee, self_employed, both
    const employmentStatus = searchParams.get('employment'); // employee או self_employed

    const supabase = await createClient();

    // בניית query בסיסי
    let query = supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true);

    // חיפוש לפי שם
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // סינון לפי סוג הוצאה
    if (expenseType) {
      query = query.eq('expense_type', expenseType);
    }

    // סינון לפי מעמד (חשוב!)
    // אם המשתמש עצמאי - מציג רק עצמאי ושניהם
    // אם המשתמש שכיר - מציג רק שכיר ושניהם
    if (applicableTo) {
      if (applicableTo === 'both') {
        // מציג הכל
        query = query.in('applicable_to', ['employee', 'self_employed', 'both']);
      } else {
        // מציג רק רלוונטי למעמד + both
        query = query.in('applicable_to', [applicableTo, 'both']);
      }
    } else if (employmentStatus) {
      // fallback למצב שלא נשלח applicableTo
      query = query.in('applicable_to', [employmentStatus, 'both']);
    }

    // מיון לפי סדר תצוגה ושם
    query = query.order('display_order', { ascending: true });

    const { data: categories, error } = await query;

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // קיבוץ לפי סוג
    const grouped = {
      fixed: categories?.filter(c => c.expense_type === 'fixed') || [],
      variable: categories?.filter(c => c.expense_type === 'variable') || [],
      special: categories?.filter(c => c.expense_type === 'special') || [],
    };

    return NextResponse.json({
      categories: categories || [],
      grouped,
      total: categories?.length || 0,
    });

  } catch (error: any) {
    console.error('Categories API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * API ליצירת קטגוריה מותאמת אישית (אופציונלי)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // בדיקת אימות
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, expense_type, applicable_to, category_group } = body;

    // ולידציה
    if (!name || !expense_type || !applicable_to) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // יצירת קטגוריה חדשה
    const { data: category, error } = await supabase
      .from('expense_categories')
      .insert({
        name,
        expense_type,
        applicable_to,
        category_group: category_group || 'custom',
        display_order: 9999, // בסוף הרשימה
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ 
        error: 'Failed to create category' 
      }, { status: 500 });
    }

    return NextResponse.json({ category });

  } catch (error: any) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

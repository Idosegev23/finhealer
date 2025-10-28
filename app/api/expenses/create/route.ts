import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API ליצירת הוצאה ידנית
 * משתמש מזין הוצאה בעצמו - מאושרת אוטומטית
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
    const {
      amount,
      vendor,
      date,
      expense_category,
      expense_category_id,
      expense_type,
      payment_method,
      notes,
      source = 'manual',
      status = 'confirmed', // הוצאה ידנית מאושרת מיד
    } = body;

    // ולידציה
    if (!amount || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, date' },
        { status: 400 }
      );
    }

    // יצירת ההוצאה
    const { data: transaction, error } = await (supabase as any)
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'expense',
        amount: parseFloat(amount),
        vendor,
        date: date || new Date().toISOString().split('T')[0],
        tx_date: date || new Date().toISOString().split('T')[0],
        expense_category, // השם המדויק מהרשימה
        expense_category_id: expense_category_id || null,
        category: mapExpenseCategoryToOldCategory(expense_category), // תאימות לאחור
        expense_frequency: expense_type === 'fixed' ? 'fixed' : expense_type === 'special' ? 'special' : 'one_time',
        payment_method: payment_method || null,
        notes: notes || null,
        source,
        status,
        auto_categorized: false, // הוזן ידנית
        confidence_score: 1.0, // ביטחון מלא - הוזן ידנית
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return NextResponse.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
      message: 'Transaction created successfully',
    });

  } catch (error: any) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * מיפוי מקטגוריה מפורטת לקטגוריה כללית (תאימות לאחור)
 */
function mapExpenseCategoryToOldCategory(expenseCategory: string): string {
  const mappings: Record<string, string> = {
    // מזון
    'מזון ומשקאות': 'food',
    'קניות סופר': 'food',
    'מסעדות': 'food',
    
    // דיור
    'ארנונה למגורים': 'housing',
    'ארנונה לעסק': 'housing',
    'שכירות למגורים': 'housing',
    'שכירות משרד / קליניקה': 'housing',
    'ועד בית': 'housing',
    
    // תחבורה
    'דלק': 'transport',
    'חניה': 'transport',
    'תחבורה ציבורית': 'transport',
    'כביש 6 / כבישי אגרה': 'transport',
    
    // תקשורת
    'אינטרנט ביתי': 'utilities',
    'טלפונים ניידים': 'utilities',
    'טלפונים עסקיים': 'utilities',
    'חשמל לבית': 'utilities',
    'חשמל לעסק': 'utilities',
    'מים': 'utilities',
    'גז': 'utilities',
    
    // בריאות
    'קופת חולים': 'health',
    'תרופות': 'health',
    'טיפולי שיניים': 'health',
    'טיפול רגשי / פסיכולוג': 'health',
    
    // חינוך
    'חינוך גנים ובתי ספר': 'education',
    'חוגים לילדים': 'education',
    'קורסים ולמידה אישית': 'education',
    
    // בילויים
    'בילויים ובידור': 'entertainment',
    'מנויים דיגיטליים (נטפליקס, ספוטיפיי)': 'entertainment',
    
    // קניות
    'ביגוד': 'shopping',
    'ציוד לבית': 'shopping',
    'קוסמטיקה וטיפוח': 'shopping',
  };

  // אם יש מיפוי ישיר
  if (mappings[expenseCategory]) {
    return mappings[expenseCategory];
  }

  // אחרת, ניסיון לזהות לפי מילות מפתח
  const lowerCategory = expenseCategory.toLowerCase();
  if (lowerCategory.includes('ביטוח')) return 'insurance';
  if (lowerCategory.includes('משכנתא') || lowerCategory.includes('הלוואה')) return 'loans';
  if (lowerCategory.includes('רכב') || lowerCategory.includes('טסט')) return 'transport';
  
  // ברירת מחדל
  return 'other';
}


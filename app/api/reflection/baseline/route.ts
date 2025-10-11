import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
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

    // קבלת נתונים מהבקשה
    const { baselines } = await request.json();

    if (!baselines || !Array.isArray(baselines) || baselines.length === 0) {
      return NextResponse.json(
        { error: 'Invalid baselines data' },
        { status: 400 }
      );
    }

    // בדיקת phase - רק reflection יכול לשמור baselines
    const { data: userData } = await supabase
      .from('users')
      .select('phase')
      .eq('id', user.id)
      .single();

    if (userData?.phase !== 'reflection') {
      return NextResponse.json(
        { error: 'User not in reflection phase' },
        { status: 403 }
      );
    }

    // מחיקת baselines קודמים (אם יש)
    await supabase
      .from('user_baselines')
      .delete()
      .eq('user_id', user.id);

    // הכנת נתונים לשמירה
    const baselinesData = baselines.map((baseline: any) => ({
      user_id: user.id,
      category: baseline.category,
      avg_amount: baseline.avg_amount,
      months_back: baseline.months_back
    }));

    // שמירת baselines
    const { error: insertError } = await supabase
      .from('user_baselines')
      .insert(baselinesData);

    if (insertError) {
      console.error('Error inserting baselines:', insertError);
      return NextResponse.json(
        { error: 'Failed to save baselines' },
        { status: 500 }
      );
    }

    // עדכון phase ל-behavior
    const { error: updateError } = await supabase
      .from('users')
      .update({ phase: 'behavior' })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating phase:', updateError);
      return NextResponse.json(
        { error: 'Failed to update phase' },
        { status: 500 }
      );
    }

    // יצירת התראת מעבר שלבים
    await supabase
      .from('alerts')
      .insert({
        user_id: user.id,
        type: 'welcome',
        message: `מעולה! 🎉 עברת לשלב 2: התנהלות והרגלים. מעכשיו המערכת תעקוב אחרי ההוצאות שלך ותזהה דפוסים. תתחיל לרשום הוצאות ותקבל תובנות מותאמות!`,
        status: 'sent',
        params: {
          from_phase: 'reflection',
          to_phase: 'behavior',
          baselines_count: baselines.length
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Baselines saved successfully',
      phase: 'behavior',
      baselines_count: baselines.length
    });

  } catch (error) {
    console.error('Reflection baseline error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



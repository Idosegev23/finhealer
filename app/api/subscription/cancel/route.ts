import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // בדיקת משתמש
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'לא מחובר' },
        { status: 401 }
      );
    }

    // עדכון סטטוס המנוי ל-cancelled
    const { error: updateError } = await (supabase as any)
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (updateError) {
      console.error('Error cancelling subscription:', updateError);
      return NextResponse.json(
        { error: 'שגיאה בביטול המנוי' },
        { status: 500 }
      );
    }

    // עדכון סטטוס המנוי במשתמש
    const { error: userUpdateError } = await (supabase as any)
      .from('users')
      .update({ subscription_status: 'cancelled' })
      .eq('id', user.id);

    if (userUpdateError) {
      console.error('Error updating user subscription status:', userUpdateError);
    }

    return NextResponse.json({
      success: true,
      message: 'המנוי בוטל בהצלחה. תוכל להמשיך להשתמש בשירות עד סוף התקופה ששולמה.',
    });

  } catch (error: any) {
    console.error('Error in cancel subscription:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בביטול המנוי' },
      { status: 500 }
    );
  }
}


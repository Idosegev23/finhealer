import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Coupon definitions
const COUPONS: Record<string, { type: 'free' | 'discount'; discount?: number; label: string; trialDays?: number }> = {
  GADIFREE: { type: 'free', label: 'גישה מלאה בחינם', trialDays: 365 },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, apply } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'קוד קופון חסר' }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();
    const coupon = COUPONS[normalized];

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'קופון לא תקין' });
    }

    // Just validate (don't apply)
    if (!apply) {
      return NextResponse.json({
        valid: true,
        coupon: {
          code: normalized,
          type: coupon.type,
          discount: coupon.discount,
          label: coupon.label,
        },
      });
    }

    // Apply coupon — activate subscription
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const trialDays = coupon.trialDays || 365;
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    // Update user subscription
    await supabaseAdmin
      .from('users')
      .update({
        subscription_status: 'active',
        trial_expires_at: expiresAt,
      })
      .eq('id', user.id);

    // Update subscription record
    await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan: 'premium',
        status: 'active',
        provider: 'coupon',
        started_at: new Date().toISOString(),
        amount: 0,
        currency: 'ILS',
        billing_cycle: 'yearly',
        metadata: {
          coupon_code: normalized,
          coupon_label: coupon.label,
          payment_method: 'coupon',
        },
      }, { onConflict: 'user_id' });

    console.log(`🎫 Coupon ${normalized} applied for user ${user.id}`);

    return NextResponse.json({
      valid: true,
      applied: true,
      coupon: {
        code: normalized,
        type: coupon.type,
        label: coupon.label,
      },
    });
  } catch (error: any) {
    console.error('Coupon validation error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

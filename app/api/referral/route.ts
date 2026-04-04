import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';

/**
 * GET /api/referral — get user's referral code + stats
 * POST /api/referral — apply a referral code
 */

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get or create referral code
    const { data: userData } = await supabase
      .from('users')
      .select('referral_code, referred_by')
      .eq('id', user.id)
      .single();

    let referralCode = (userData as any)?.referral_code;

    if (!referralCode) {
      referralCode = `PHI-${randomBytes(3).toString('hex').toUpperCase()}`;
      await supabase
        .from('users')
        .update({ referral_code: referralCode })
        .eq('id', user.id);
    }

    // Count referrals
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', referralCode);

    return NextResponse.json({
      referralCode,
      referralCount: count || 0,
      referredBy: (userData as any)?.referred_by || null,
      shareUrl: `https://finhealer.vercel.app/signup?ref=${referralCode}`,
    });
  } catch (error) {
    console.error('Referral GET error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = checkApiRateLimit(request, 5, 60_000);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'חסר קוד הפניה' }, { status: 400 });

    const normalizedCode = code.trim().toUpperCase();

    // Check if user already used a referral
    const { data: userData } = await supabase
      .from('users')
      .select('referred_by')
      .eq('id', user.id)
      .single();

    if ((userData as any)?.referred_by) {
      return NextResponse.json({ error: 'כבר השתמשת בקוד הפניה' }, { status: 409 });
    }

    // Verify referral code exists and isn't own code
    const { data: referrer } = await supabase
      .from('users')
      .select('id, referral_code')
      .eq('referral_code', normalizedCode)
      .single();

    if (!referrer) {
      return NextResponse.json({ error: 'קוד הפניה לא נמצא' }, { status: 404 });
    }

    if (referrer.id === user.id) {
      return NextResponse.json({ error: 'לא ניתן להשתמש בקוד שלך' }, { status: 400 });
    }

    // Apply referral
    await supabase
      .from('users')
      .update({ referred_by: normalizedCode })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: 'קוד הפניה הופעל בהצלחה! שניכם תקבלו הטבה',
    });
  } catch (error) {
    console.error('Referral POST error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית' }, { status: 500 });
  }
}

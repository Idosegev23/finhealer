import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron: Re-engagement (daily 11:00)
 *
 * 3 target audiences:
 * 1. Dormant — active/trial, no interaction 3+ days
 * 2. Trial expiring — trial expires in 1-2 days
 * 3. Recently cancelled — cancelled < 14 days ago
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quietCheck = isQuietTime();
    if (quietCheck.isQuiet) {
      console.log(`[Cron] Skipped — ${quietCheck.description}`);
      return NextResponse.json({ skipped: true, reason: quietCheck.description });
    }

    console.log('[Cron] Starting re-engagement...');
    const supabase = createServiceClient();
    const greenAPI = getGreenAPIClient();
    const now = new Date();
    const results: Array<{ user_id: string; type: string; success: boolean }> = [];

    // 1. Dormant users: active/trial, no WA interaction 3+ days, no reengagement 3+ days
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dormantUsers } = await supabase
      .from('users')
      .select('id, name, phone')
      .in('subscription_status', ['active', 'trial'])
      .eq('wa_opt_in', true)
      .not('phone', 'is', null)
      .lt('last_wa_interaction', threeDaysAgo)
      .or(`last_reengagement_at.is.null,last_reengagement_at.lt.${threeDaysAgo}`);

    for (const user of dormantUsers || []) {
      try {
        const firstName = (user.name || '').split(' ')[0] || 'היי';
        await greenAPI.sendMessage({
          phoneNumber: user.phone,
          message: `היי ${firstName}! 👋\n\nלא דיברנו כמה ימים.\nרוצה לראות סיכום? כתוב *"סיכום"* 📊`,
        });

        await supabase.from('users').update({ last_reengagement_at: now.toISOString() }).eq('id', user.id);
        await supabase.from('alerts').insert({ user_id: user.id, type: 'reengagement_dormant', message: 'dormant 3+ days', status: 'sent' });
        results.push({ user_id: user.id, type: 'dormant', success: true });
      } catch (e) {
        console.error(`Dormant reengagement failed for ${user.id}:`, e);
        results.push({ user_id: user.id, type: 'dormant', success: false });
      }
    }

    // 2. Trial expiring: trial expires in 1-2 days, no reengagement today
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiringUsers } = await supabase
      .from('users')
      .select('id, name, phone, trial_expires_at')
      .eq('subscription_status', 'trial')
      .eq('wa_opt_in', true)
      .not('phone', 'is', null)
      .gte('trial_expires_at', oneDayFromNow)
      .lte('trial_expires_at', twoDaysFromNow)
      .or(`last_reengagement_at.is.null,last_reengagement_at.lt.${oneDayAgo}`);

    for (const user of expiringUsers || []) {
      try {
        const firstName = (user.name || '').split(' ')[0] || 'היי';
        await greenAPI.sendMessage({
          phoneNumber: user.phone,
          message: `⏰ ${firstName}, תקופת הנסיון שלך מסתיימת מחר!\n\nכל הנתונים והתובנות שלך ממתינים לך.\nכתוב *"שדרג"* להמשיך ליהנות מ-Phi 💫`,
        });

        await supabase.from('users').update({ last_reengagement_at: now.toISOString() }).eq('id', user.id);
        await supabase.from('alerts').insert({ user_id: user.id, type: 'reengagement_trial_expiring', message: 'trial expiring soon', status: 'sent' });
        results.push({ user_id: user.id, type: 'trial_expiring', success: true });
      } catch (e) {
        console.error(`Trial expiring reengagement failed for ${user.id}:`, e);
        results.push({ user_id: user.id, type: 'trial_expiring', success: false });
      }
    }

    // 3. Recently cancelled: cancelled < 14 days, no reengagement 7+ days
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: cancelledUsers } = await supabase
      .from('users')
      .select('id, name, phone, updated_at')
      .eq('subscription_status', 'cancelled')
      .eq('wa_opt_in', true)
      .not('phone', 'is', null)
      .gte('updated_at', fourteenDaysAgo)
      .or(`last_reengagement_at.is.null,last_reengagement_at.lt.${sevenDaysAgo}`);

    for (const user of cancelledUsers || []) {
      try {
        const firstName = (user.name || '').split(' ')[0] || 'היי';
        await greenAPI.sendMessage({
          phoneNumber: user.phone,
          message: `היי ${firstName} 💰\n\nהנתונים שלך שמורים אצלנו.\nכתוב *"שדרג"* לחזור ל-Phi בכל רגע.`,
        });

        await supabase.from('users').update({ last_reengagement_at: now.toISOString() }).eq('id', user.id);
        await supabase.from('alerts').insert({ user_id: user.id, type: 'reengagement_cancelled', message: 'recently cancelled', status: 'sent' });
        results.push({ user_id: user.id, type: 'cancelled', success: true });
      } catch (e) {
        console.error(`Cancelled reengagement failed for ${user.id}:`, e);
        results.push({ user_id: user.id, type: 'cancelled', success: false });
      }
    }

    console.log(`[Cron] Re-engagement complete: ${results.length} messages sent`);

    return NextResponse.json({
      success: true,
      sent: results.length,
      breakdown: {
        dormant: results.filter(r => r.type === 'dormant').length,
        trial_expiring: results.filter(r => r.type === 'trial_expiring').length,
        cancelled: results.filter(r => r.type === 'cancelled').length,
      },
      results,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('Re-engagement cron error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

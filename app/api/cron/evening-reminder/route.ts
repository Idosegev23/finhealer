import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Cron: Evening expense reminder
 * Runs daily at 20:00: 0 20 * * *
 * Sends a gentle reminder to users who haven't logged any expense today
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quietCheck = isQuietTime();
    if (quietCheck.isQuiet) {
      return NextResponse.json({ skipped: true, reason: quietCheck.description });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const greenAPI = getGreenAPIClient();
    const today = new Date().toISOString().split('T')[0];

    // Get users who opted in to WhatsApp and are in monitoring phase
    const { data: users } = await supabase
      .from('users')
      .select('id, name, phone')
      .eq('wa_opt_in', true)
      .eq('phase', 'monitoring')
      .not('phone', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, reminded: 0 });
    }

    let reminded = 0;

    for (const user of users) {
      try {
        // Check if user logged any manual expense today (source = 'manual' or 'whatsapp')
        const { count } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .eq('tx_date', today)
          .in('source', ['manual', 'whatsapp']);

        if (count && count > 0) continue; // Already logged today, skip

        // Check we haven't sent a reminder today already
        const { data: recentReminder } = await supabase
          .from('alerts')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'expense_reminder')
          .gte('created_at', `${today}T00:00:00`)
          .limit(1);

        if (recentReminder && recentReminder.length > 0) continue;

        // Send reminder
        const name = user.name ? user.name.split(' ')[0] : '';
        const greeting = name ? `${name}, ` : '';

        await greenAPI.sendMessage({
          phoneNumber: user.phone,
          message: `💡 ${greeting}היו לך הוצאות היום?\n\nתרשום בקצרה, למשל:\n*"סופר 200"*\n*"דלק 150"*\n*"קפה 18"*\n\nככה התמונה הכספית שלך תהיה מדויקת 😊`,
        });

        await supabase.from('alerts').insert({
          user_id: user.id,
          type: 'expense_reminder',
          message: 'evening expense reminder sent',
          status: 'sent',
        });

        reminded++;
      } catch (err) {
        console.warn(`[EveningReminder] Error for user ${user.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, reminded, total: users.length });
  } catch (error: any) {
    console.error('[EveningReminder] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

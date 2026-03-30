/**
 * GET /api/cron/phi-brain-check
 *
 * THE ONE CRON THAT RULES THEM ALL.
 *
 * Replaces: morning-brief, daily-summary, weekly-summary, monthly-review,
 * re-engagement, process-alerts, cash-flow-alerts, check-recurring.
 *
 * For each active user, runs PhiBrain scheduled_check.
 * PhiBrain decides: talk or shut up. What to say. How to say it.
 *
 * Runs twice daily (morning + evening, per user's active hours).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { scheduledBrainCheck } from '@/lib/ai/phi-brain';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Fetch all active users with phones
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, phone, phase, classification_context')
      .not('phone', 'is', null)
      .in('phase', ['monitoring', 'behavior', 'goals', 'budget']);

    if (error || !users) {
      log.error('phi_brain_cron_fetch_failed', { error: error?.message });
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    log.info('phi_brain_cron_start', { userCount: users.length });

    let sent = 0;
    let silent = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Check cooldown and silence rules at cron level too
        const profile = user.classification_context?.phi_profile;
        const cooldownUntil = profile?.cooldown_until;
        if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
          silent++;
          continue;
        }

        // Check if we already sent a proactive message today
        const today = new Date().toISOString().split('T')[0];
        const { count: todayAlerts } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00`)
          .like('type', 'phi_brain_%');

        if (todayAlerts && todayAlerts > 0) {
          silent++;
          continue; // Already messaged today
        }

        // Run PhiBrain scheduled check
        await scheduledBrainCheck(user.id);

        // Check if it actually sent something
        const { count: newAlerts } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 5000).toISOString())
          .like('type', 'phi_brain_%');

        if (newAlerts && newAlerts > 0) {
          sent++;
        } else {
          silent++;
        }
      } catch (err: any) {
        log.error('phi_brain_cron_user_error', { userId: user.id, error: err.message });
        errors++;
      }
    }

    log.info('phi_brain_cron_complete', { total: users.length, sent, silent, errors });

    return NextResponse.json({
      success: true,
      total: users.length,
      sent,
      silent,
      errors,
    });
  } catch (error: any) {
    log.error('phi_brain_cron_fatal', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

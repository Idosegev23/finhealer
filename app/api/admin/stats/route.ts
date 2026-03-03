import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!adminEmails.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Run all queries in parallel
    const [
      totalUsersRes,
      activeUsersRes,
      trialUsersRes,
      newThisWeekRes,
      docsRes,
      messagesRes,
      activeTodayRes,
    ] = await Promise.all([
      // Total users
      supabase.from('users').select('id', { count: 'exact', head: true }),
      // Active subscriptions
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      // Trial users
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('subscription_status', 'trial'),
      // New this week
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      // Documents processed
      supabase.from('uploaded_statements').select('id', { count: 'exact', head: true }),
      // Messages today
      supabase.from('wa_messages').select('id', { count: 'exact', head: true }).gte('created_at', today),
      // Active today (WhatsApp interaction)
      supabase.from('users').select('id', { count: 'exact', head: true }).gte('last_wa_interaction', today),
    ]);

    return NextResponse.json({
      totalUsers: totalUsersRes.count || 0,
      activeUsers: activeUsersRes.count || 0,
      trialUsers: trialUsersRes.count || 0,
      newThisWeek: newThisWeekRes.count || 0,
      docsProcessed: docsRes.count || 0,
      messagesToday: messagesRes.count || 0,
      activeToday: activeTodayRes.count || 0,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

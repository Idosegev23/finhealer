import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const supabase = auth.supabase;

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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const phase = searchParams.get('phase') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 25;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('id, name, full_name, email, phone, subscription_status, phase, created_at, last_wa_interaction, trial_expires_at, wa_opt_in', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('subscription_status', status);
    }
    if (phase) {
      query = query.eq('phase', phase);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Admin users query error:', error);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    return NextResponse.json({
      users: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

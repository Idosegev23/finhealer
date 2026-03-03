import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.includes(user.email?.toLowerCase() || '')) return null;

  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Get user + stats in parallel
    const [userRes, txCountRes, docsRes, goalsRes, messagesRes] = await Promise.all([
      supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single(),
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id),
      supabase
        .from('uploaded_statements')
        .select('id, file_name, bank_name, doc_type, status, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('goals')
        .select('id, name, target_amount, current_amount, status')
        .eq('user_id', id),
      supabase
        .from('wa_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id),
    ]);

    if (userRes.error || !userRes.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: userRes.data,
      stats: {
        transactionCount: txCountRes.count || 0,
        documents: docsRes.data || [],
        goals: goalsRes.data || [],
        messageCount: messagesRes.count || 0,
      },
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Only allow specific fields to be updated
    const allowedFields = ['subscription_status', 'trial_expires_at', 'phase', 'is_admin'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Admin user update error:', error);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('Admin user patch error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

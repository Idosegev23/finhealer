/**
 * Advisor notes — Gadi writes private notes on a user, visible only in admin.
 *
 * GET  /api/admin/users/[id]/notes   → list (newest first)
 * POST /api/admin/users/[id]/notes   → create { note_text: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from('advisor_notes')
    .select('id, note_text, advisor_id, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ notes: data || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const noteText = (body?.note_text || '').toString().trim();
  if (!noteText) {
    return NextResponse.json({ error: 'note_text is required' }, { status: 400 });
  }
  if (noteText.length > 5000) {
    return NextResponse.json({ error: 'note_text too long (max 5000 chars)' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('advisor_notes')
    .insert({
      user_id: id,
      advisor_id: auth.user.id,
      note_text: noteText,
    })
    .select('id, note_text, advisor_id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ note: data });
}

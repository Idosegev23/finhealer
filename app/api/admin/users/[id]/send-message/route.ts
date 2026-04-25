/**
 * Admin → user direct WhatsApp message.
 *
 * POST /api/admin/users/[id]/send-message  body: { message: string }
 *
 * Sends via GreenAPI (auto-logs to wa_messages by the client).
 * Marks the message in payload.source = 'admin_direct' so it doesn't get
 * counted as proactive and doesn't trigger silence/cooldown rules for the brain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = (body?.message || '').toString().trim();
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: 'message too long (max 4000 chars)' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: targetUser } = await supabase
    .from('users')
    .select('phone, name, wa_opt_in')
    .eq('id', userId)
    .single();

  if (!targetUser?.phone) {
    return NextResponse.json({ error: 'User has no phone number' }, { status: 400 });
  }
  if (targetUser.wa_opt_in === false) {
    return NextResponse.json({ error: 'User opted out of WhatsApp' }, { status: 400 });
  }

  try {
    const greenAPI = getGreenAPIClient();
    await greenAPI.sendMessage({
      phoneNumber: targetUser.phone,
      message,
    });
  } catch (err: any) {
    return NextResponse.json({ error: `GreenAPI: ${err.message || err}` }, { status: 502 });
  }

  // Persist with admin metadata so the brain treats this as advisor speaking,
  // not bot speaking. The GreenAPI client also auto-logs the basic outgoing row;
  // we add a second row tagged as admin so audit/UI can distinguish.
  await supabase.from('wa_messages').insert({
    user_id: userId,
    direction: 'outgoing',
    msg_type: 'text',
    payload: {
      body: message,
      source: 'admin_direct',
      advisor_id: auth.user.id,
      advisor_email: auth.user.email,
    },
    status: 'sent',
  });

  // Audit row in advisor_notes too — the message itself becomes a note, since
  // admin-initiated messages are part of the coaching record.
  await supabase.from('advisor_notes').insert({
    user_id: userId,
    advisor_id: auth.user.id,
    note_text: `📤 הודעה ישירה: ${message}`,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, sent_to: targetUser.phone });
}

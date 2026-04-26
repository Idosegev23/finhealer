/**
 * Web AI Chat — same φ brain, same conversation as WhatsApp.
 *
 * Both web and WhatsApp messages persist to `wa_messages` (single source of truth).
 * The brain already loads context from this table, so the conversation flows
 * seamlessly across channels: continue on web what was started on WhatsApp.
 *
 * POST /api/ai/chat   body: { message: string }   → { reply, action }
 * GET  /api/ai/chat                               → { messages: [{id, role, content, created_at}] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient, createServiceClient } from '@/lib/supabase/server';
import { phiBrain } from '@/lib/ai/phi-brain';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';

// Match the extractor in lib/ai/phi-brain.ts so we read the same shape we write.
function extractBody(payload: any): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.body === 'string') return payload.body;
  const md = payload.messageData;
  if (md) {
    if (md.textMessageData?.textMessage) return md.textMessageData.textMessage;
    if (md.extendedTextMessageData?.text) return md.extendedTextMessageData.text;
  }
  return '';
}

export async function POST(req: NextRequest) {
  const limited = checkApiRateLimit(req, 20, 60_000);
  if (limited) return limited;

  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = (body?.message || '').toString().trim();
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: 'message too long' }, { status: 400 });

  const supabase = createServiceClient();

  // Persist incoming web message into wa_messages — same table as WhatsApp.
  // The brain loads context from this table, so writing here makes the just-typed
  // message visible to the brain on this very call.
  await supabase.from('wa_messages').insert({
    user_id: user.id,
    direction: 'incoming',
    msg_type: 'text',
    payload: { body: message, source: 'web' },
    status: 'delivered',
  });

  let action;
  try {
    action = await phiBrain(user.id, { type: 'whatsapp_message', message }, { skipChannelSend: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI error' }, { status: 500 });
  }

  const reply = action.sendMessage || '🤔';
  const handlerAction = (action as any).updateState ? `updateState:${(action as any).updateState}` : 'reply';

  // Persist outgoing reply so it appears in unified history (web + WhatsApp).
  await supabase.from('wa_messages').insert({
    user_id: user.id,
    direction: 'outgoing',
    msg_type: 'text',
    payload: { body: reply, source: 'web' },
    status: 'sent',
  });

  return NextResponse.json({ reply, action: handlerAction });
}

/**
 * GET — unified WhatsApp + web conversation, oldest first, last 50.
 */
export async function GET() {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('wa_messages')
    .select('id, direction, payload, created_at')
    .eq('user_id', user.id)
    .eq('msg_type', 'text')
    .order('created_at', { ascending: false })
    .limit(50);

  const messages = (data || [])
    .reverse()
    .map((m: any) => ({
      id: m.id,
      role: m.direction === 'incoming' ? 'user' : 'assistant',
      content: extractBody(m.payload),
      created_at: m.created_at,
    }))
    .filter((m: any) => m.content);

  return NextResponse.json({ messages });
}

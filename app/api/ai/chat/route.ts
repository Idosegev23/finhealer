/**
 * Web AI Chat — same φ brain as WhatsApp, but responses come back as JSON
 * instead of being sent through GreenAPI.
 *
 * POST /api/ai/chat   body: { message: string }
 * Returns: { reply: string, action: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient, createServiceClient } from '@/lib/supabase/server';
import { phiBrain } from '@/lib/ai/phi-brain';
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter';

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
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'message too long' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Persist the user's message in chat_messages so the brain sees it as history next time
  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'user',
    content: message,
  });

  // Run the brain with web channel — message comes back via the action, NOT sent to WhatsApp
  let action;
  try {
    action = await phiBrain(user.id, { type: 'whatsapp_message', message }, { skipChannelSend: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI error' }, { status: 500 });
  }

  const reply = action.sendMessage || '🤔';
  const handlerAction = (action as any).updateState ? `updateState:${(action as any).updateState}` : 'reply';

  // Persist the bot's response too
  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: reply,
    model: 'gemini-3-flash-preview',
  });

  return NextResponse.json({ reply, action: handlerAction });
}

/**
 * GET /api/ai/chat — load conversation history (last 50 messages, oldest first)
 */
export async function GET() {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ messages: (data || []).reverse() });
}

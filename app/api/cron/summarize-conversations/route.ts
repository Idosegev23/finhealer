/**
 * Cron: Summarize closed conversations.
 *
 * Runs once a day. For each conversation that:
 *   (a) has had no messages in the last 4 hours, AND
 *   (b) is not yet present in users.classification_context.phi_profile.recent_conversations,
 * we call Gemini to produce a structured summary and store it in the user's profile.
 *
 * The next time the user starts a conversation, the brain reads recent_conversations[]
 * to recall topics, mood, and open threads — giving real continuity across sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { findClosedUnsummarizedConversations } from '@/lib/conversation/threading';
import { summarizeAndStore, getRecentSummaries } from '@/lib/ai/conversation-summarizer';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const closed = await findClosedUnsummarizedConversations({ gapMinutes: 240, limit: 100 });
  log.info('summarize_conversations_start', { candidateCount: closed.length });

  let summarized = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of closed) {
    try {
      // Skip if already summarized for this user
      const existing = await getRecentSummaries(c.userId);
      if (existing.some(s => s.conversation_id === c.conversationId)) {
        skipped++;
        continue;
      }

      const result = await summarizeAndStore(c.userId, c.conversationId);
      if (result) summarized++;
      else skipped++;
    } catch (err: any) {
      log.error('summarize_conversation_error', { userId: c.userId, conversationId: c.conversationId, error: err.message });
      failed++;
    }
  }

  log.info('summarize_conversations_done', { candidateCount: closed.length, summarized, skipped, failed });

  return NextResponse.json({
    success: true,
    candidateCount: closed.length,
    summarized,
    skipped,
    failed,
  });
}

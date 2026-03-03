// @ts-nocheck
import { NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import type { WebhookContext } from './types';
import { maskUserId } from './utils';

/**
 * Handle text messages: receipt edit flow check, then φRouter delegation.
 */
export async function handleText(ctx: WebhookContext): Promise<NextResponse> {
  const { userData, phoneNumber, payload, supabase } = ctx;
  const messageType = payload.messageData?.typeMessage;

  // Extract text from all text-like message types
  const text = messageType === 'extendedTextMessage'
    ? (payload.messageData?.extendedTextMessageData?.text || payload.messageData?.textMessageData?.textMessage || '')
    : messageType === 'quotedMessage'
    ? (payload.messageData?.extendedTextMessageData?.text || payload.messageData?.textMessageData?.textMessage || payload.messageData?.quotedMessage?.caption || '')
    : (payload.messageData?.textMessageData?.textMessage || '');

  console.log('📝 Text message received, type:', messageType, 'length:', text.length);

  const greenAPI = getGreenAPIClient();

  // Check if user is editing a transaction (receipt edit flow)
  {
    const { data: editCtxUser } = await supabase
      .from('users')
      .select('classification_context')
      .eq('id', userData.id)
      .single();

    const editingTxId = editCtxUser?.classification_context?.editing_tx_id;
    if (editingTxId && text.trim()) {
      const editMsg = text.trim();

      // Check for delete command
      if (editMsg === 'מחק' || editMsg === 'delete') {
        const { error: delErr } = await supabase.from('transactions').delete().eq('id', editingTxId).eq('user_id', userData.id);
        if (delErr) {
          console.error('Failed to delete transaction:', delErr);
          await greenAPI.sendMessage({ phoneNumber, message: '❌ לא הצלחתי למחוק. נסה שוב.' });
        } else {
          await greenAPI.sendMessage({ phoneNumber, message: '🗑️ ההוצאה נמחקה.' });
        }
      } else {
        // Parse edit: look for amount, category, description
        const updates: any = {};
        const amountMatch = editMsg.match(/(?:סכום[:\s]*)?(\d+(?:\.\d+)?)/);
        const categoryMatch = editMsg.match(/(?:קטגוריה[:\s]*)([^\n,]+)/);
        const descMatch = editMsg.match(/(?:תיאור[:\s]*)([^\n,]+)/);

        if (amountMatch) updates.amount = parseFloat(amountMatch[1]);
        if (categoryMatch) updates.expense_category = categoryMatch[1].trim();
        if (descMatch) updates.notes = descMatch[1].trim();

        if (Object.keys(updates).length === 0) {
          // Treat the whole text as the category
          updates.expense_category = editMsg;
        }

        const { error: updErr } = await supabase.from('transactions').update(updates).eq('id', editingTxId).eq('user_id', userData.id);
        if (updErr) {
          console.error('Failed to update transaction:', updErr);
          await greenAPI.sendMessage({ phoneNumber, message: '❌ לא הצלחתי לעדכן. נסה שוב.' });
        } else {
          const label = updates.expense_category && Object.keys(updates).length === 1
            ? `✅ הקטגוריה עודכנה ל-"${updates.expense_category}"`
            : '✅ ההוצאה עודכנה!';
          await greenAPI.sendMessage({ phoneNumber, message: label });
        }
      }

      // Clean up editing context
      const existingCtx = editCtxUser?.classification_context || {};
      const { editing_tx_id: _, ...restCtx } = existingCtx as any;
      await supabase.from('users').update({
        classification_context: Object.keys(restCtx).length > 0 ? restCtx : null
      }).eq('id', userData.id);

      return NextResponse.json({ status: 'edit_completed' });
    }
  }

  // Route through φRouter
  console.log('🎯 Using Rigid Router (deterministic logic)');

  try {
    const { routeMessage } = await import('@/lib/conversation/phi-router');
    console.log(`[Webhook] ROUTING_TEXT: userId=${maskUserId(userData.id)}, text="${text.substring(0, 100)}", length=${text.length}`);
    const result = await routeMessage(userData.id, phoneNumber, text);

    console.log(`[Webhook] ROUTER_RESULT: success=${result.success}, newState=${result.newState || 'unchanged'}, responded=${result.responded ?? 'N/A'}`);

    // Fallback if router didn't match any state
    if (!result.success) {
      console.log(`[Webhook] RESPONSE: router_fallback (no match)`);
      await greenAPI.sendMessage({
        phoneNumber,
        message: `לא הבנתי 🤔\n\nכתוב *"עזרה"* לראות מה אפשר לעשות.`,
      });
    }

    console.log(`[Webhook] RESPONSE: rigid_router_response success=${result.success}, newState=${result.newState || null}`);
    return NextResponse.json({
      status: 'rigid_router_response',
      success: result.success,
      newState: result.newState || null,
    });
  } catch (routerError) {
    console.error('[Rigid Router] Error:', routerError);
    await greenAPI.sendMessage({
      phoneNumber,
      message: 'סליחה, משהו השתבש 😅 נסה שוב בבקשה',
    });
    return NextResponse.json({ status: 'error', error: String(routerError) });
  }
}

/**
 * φ Webhook - AI-First WhatsApp Handler
 * 
 * Endpoint חדש שמשתמש ב-AI Orchestrator באופן מלא
 * ניתן לבדוק בנפרד לפני החלפת ה-webhook הראשי
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';
import { thinkAndRespond, executeActions, loadPhiContext } from '@/lib/ai/phi-brain';

// ============================================================================
// Webhook Handler
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[φ Webhook] Received request');

  try {
    const payload = await request.json();
    
    // אימות webhook
    if (payload.typeWebhook === 'stateInstanceChanged' || 
        payload.typeWebhook === 'statusMessage') {
      return NextResponse.json({ status: 'ignored' });
    }

    // רק הודעות נכנסות
    if (payload.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ status: 'not_a_message' });
    }

    const messageData = payload.messageData;
    const senderData = payload.senderData;
    
    if (!senderData?.chatId) {
      return NextResponse.json({ error: 'No sender' }, { status: 400 });
    }

    // חילוץ מספר טלפון
    const phoneNumber = senderData.chatId.replace('@c.us', '');
    console.log('[φ Webhook] Phone:', phoneNumber);

    const supabase = createServiceClient();
    const greenAPI = getGreenAPIClient();

    // מציאת/יצירת משתמש
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, phone, full_name, current_phase')
      .eq('phone', phoneNumber)
      .single();

    if (userError || !userData) {
      // משתמש חדש - יצירה
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          phone: phoneNumber,
          current_phase: 'onboarding',
        })
        .select()
        .single();

      if (!newUser) {
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }

      // הודעת פתיחה למשתמש חדש
      const context = await loadPhiContext(newUser.id);
      const response = await thinkAndRespond('משתמש חדש מצטרף', context);
      
      await greenAPI.sendMessage({
        phoneNumber,
        message: response.message || getDefaultWelcome(),
      });

      return NextResponse.json({ status: 'new_user', message: 'Welcome sent' });
    }

    // טיפול לפי סוג הודעה
    const messageType = messageData?.typeMessage || 'unknown';

    if (messageType === 'textMessage') {
      const text = messageData.textMessageData?.textMessage || '';
      console.log('[φ Webhook] Text:', text);

      // שמירת הודעה נכנסת
      await saveMessage(supabase, userData.id, 'incoming', text);

      // 🧠 AI חושב ומחליט
      const context = await loadPhiContext(userData.id);
      const response = await thinkAndRespond(text, context);

      // ביצוע פעולות
      if (response.actions.length > 0) {
        await executeActions(response.actions, context);
        console.log('[φ Webhook] Executed actions:', response.actions.map(a => a.type));
      }

      // שליחת תשובה
      if (response.message) {
        await greenAPI.sendMessage({
          phoneNumber,
          message: response.message,
        });

        // שמירת הודעה יוצאת
        await saveMessage(supabase, userData.id, 'outgoing', response.message);
      }

      return NextResponse.json({
        status: 'success',
        actions: response.actions.map(a => a.type),
        waitingForResponse: response.shouldWaitForResponse,
      });
    }

    // טיפול במסמכים (PDF/תמונה)
    if (messageType === 'documentMessage' || messageType === 'imageMessage') {
      const context = await loadPhiContext(userData.id);
      
      // הודעה שקיבלנו מסמך
      const docType = messageType === 'documentMessage' ? 'מסמך' : 'תמונה';
      const response = await thinkAndRespond(
        `המשתמש שלח ${docType}. עדכן אותו שקיבלת ושאתה מתחיל לנתח.`,
        context
      );

      await greenAPI.sendMessage({
        phoneNumber,
        message: response.message || `קיבלתי את ה${docType}! 📄 מתחיל לנתח...`,
      });

      // כאן יתווסף הטיפול במסמך בפועל
      // TODO: Process document with existing logic

      return NextResponse.json({ status: 'document_received' });
    }

    return NextResponse.json({ status: 'unhandled_message_type' });

  } catch (error) {
    console.error('[φ Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function saveMessage(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  direction: 'incoming' | 'outgoing',
  content: string
): Promise<void> {
  try {
    await supabase.from('wa_messages').insert({
      user_id: userId,
      direction,
      content,
      message_type: 'text',
      status: 'delivered',
    });
  } catch (error) {
    console.error('[φ Webhook] Error saving message:', error);
  }
}

function getDefaultWelcome(): string {
  return `היי! 👋

אני *φ (פאי)* - המאמן הפיננסי שלך.

כמו שהיחס הזהב יוצר הרמוניה במתמטיקה, ביחד נמצא את *ההרמוניה בכסף* שלך.

מה השם שלך?`;
}

// GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'φ Webhook is alive!' });
}


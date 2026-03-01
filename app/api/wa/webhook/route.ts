// @ts-nocheck
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { EXPENSE_CATEGORIES_SYSTEM_PROMPT } from '@/lib/ai/expense-categories-prompt';

// 🆕 הודעות מכינות לפני יצירת גרף
const CHART_PREPARING_MESSAGES = [
  '🎨 שניה, מכין לך משהו יפה...',
  '📊 רגע, מציירים את הנתונים שלך...',
  '✨ מכין תמונה מיוחדת בשבילך...',
  '🖼️ עובד על הויזואליזציה...',
  '🎯 שניה, מארגן את המספרים בתמונה...',
];

// PII masking helpers for production logs
function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 3) + '***' + phone.slice(-2);
}
function maskUserId(id: string): string {
  if (!id || id.length < 8) return '***';
  return id.slice(0, 4) + '...' + id.slice(-4);
}

// Helper: convert DD/MM/YYYY or other date formats → YYYY-MM-DD safely
function safeParseDateToISO(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  // DD/MM/YYYY format (from Gemini OCR)
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Try native parsing as last resort
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// 🛡️ Rate limiting per user_id
// ============================================================================
const userRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRateLimit.get(userId);

  // Clean expired entries periodically (every ~60s via lazy check)
  if (userRateLimit.size > 500) {
    for (const [key, val] of userRateLimit) {
      if (val.resetAt < now) userRateLimit.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    userRateLimit.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false; // not limited
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true; // rate limited
  }
  return false;
}

// ============================================================================
// 🆕 טיפים והודעות בזמן עיבוד מסמך
// ============================================================================

const PROCESSING_TIPS = [
  "💡 ידעת? לפי מחקרים, אנשים שעוקבים אחרי ההוצאות שלהם חוסכים בממוצע 15% יותר!",
  "💡 טיפ: הגדרת תקציב לכל קטגוריה עוזרת להימנע מהוצאות אימפולסיביות.",
  "💡 הידעת? רוב ההוצאות הקטנות (קפה, חטיפים) מצטברות ל-15% מהתקציב החודשי.",
  "💡 טיפ: בדיקת דוחות פעם בשבוע עוזרת לזהות בעיות לפני שהן גדלות.",
  "💡 הידעת? השקעה של 10% מההכנסה מגיל צעיר יכולה להכפיל את החיסכון לפנסיה.",
  "💡 טיפ: לפני קנייה גדולה, המתן 48 שעות - זה מונע רכישות אימפולסיביות.",
  "💡 הידעת? מנוי שלא משתמשים בו עולה בממוצע 200₪ בחודש לישראלי.",
  "💡 טיפ: כלל 50/30/20 - 50% לצרכים, 30% לרצונות, 20% לחיסכון.",
];

const PROCESSING_STAGES = [
  "🔍 סורק את המסמך...",
  "📊 מזהה תנועות...",
  "🏷️ מסווג קטגוריות...",
  "🧮 מחשב סיכומים...",
  "✨ מסיים ניתוח...",
];

/**
 * שליחת טיפ אקראי בזמן עיבוד
 */
async function sendProcessingTip(greenAPI: any, phoneNumber: string, tipIndex: number): Promise<void> {
  const tip = PROCESSING_TIPS[tipIndex % PROCESSING_TIPS.length];
  await greenAPI.sendMessage({ phoneNumber, message: tip });
}

/**
 * שליחת עדכון התקדמות
 */
async function sendProgressUpdate(greenAPI: any, phoneNumber: string, stage: number): Promise<void> {
  const stageMessage = PROCESSING_STAGES[Math.min(stage, PROCESSING_STAGES.length - 1)];
  await greenAPI.sendMessage({ phoneNumber, message: stageMessage });
}

/**
 * הפעלת עדכוני התקדמות ברקע
 * מחזיר פונקציית ביטול
 */
function startProgressUpdates(
  greenAPI: any, 
  phoneNumber: string
): { stop: () => void } {
  let stage = 0;
  let tipIndex = Math.floor(Math.random() * PROCESSING_TIPS.length);
  let stopped = false;
  
  // שלח טיפ ראשון אחרי 15 שניות
  const tipTimeout = setTimeout(async () => {
    if (!stopped) {
      await sendProcessingTip(greenAPI, phoneNumber, tipIndex);
      tipIndex++;
    }
  }, 15000);
  
  // שלח עדכון התקדמות אחרי 30 שניות
  const progressTimeout = setTimeout(async () => {
    if (!stopped) {
      stage++;
      await sendProgressUpdate(greenAPI, phoneNumber, stage);
    }
  }, 30000);
  
  // שלח טיפ נוסף אחרי 50 שניות
  const tipTimeout2 = setTimeout(async () => {
    if (!stopped) {
      await sendProcessingTip(greenAPI, phoneNumber, tipIndex);
      tipIndex++;
    }
  }, 50000);
  
  // שלח עדכון נוסף אחרי 70 שניות
  const progressTimeout2 = setTimeout(async () => {
    if (!stopped) {
      stage++;
      await sendProgressUpdate(greenAPI, phoneNumber, stage);
    }
  }, 70000);
  
  // שלח עדכון אחרי 90 שניות
  const progressTimeout3 = setTimeout(async () => {
    if (!stopped) {
      await greenAPI.sendMessage({ 
        phoneNumber, 
        message: "⏳ עוד קצת... המסמך מורכב אבל אני כמעט סיימתי!" 
      });
    }
  }, 90000);
  
  return {
    stop: () => {
      stopped = true;
      clearTimeout(tipTimeout);
      clearTimeout(progressTimeout);
      clearTimeout(tipTimeout2);
      clearTimeout(progressTimeout2);
      clearTimeout(progressTimeout3);
    }
  };
}

/**
 * GreenAPI Webhook Handler עם AI
 * מקבל הודעות WhatsApp נכנסות (טקסט ותמונות)
 * משתמש ב-OpenAI GPT-4o לשיחה חכמה וזיהוי הוצאות
 * 
 * Docs: https://green-api.com/en/docs/api/receiving/
 */

interface GreenAPIWebhookPayload {
  typeWebhook: string;
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  idMessage: string;
  senderData: {
    chatId: string;
    chatName?: string;
    sender: string;
    senderName?: string;
  };
  messageData?: {
    typeMessage: 'textMessage' | 'imageMessage' | 'documentMessage' | 'buttonsResponseMessage';
    textMessageData?: {
      textMessage: string;
    };
    buttonsResponseMessage?: {
      buttonId: string;
      buttonText: string;
    };
    downloadUrl?: string;
    caption?: string;
    fileName?: string;
    jpegThumbnail?: string;
  };
}

// 🛡️ Cache למניעת עיבוד כפול (in-memory, יתאפס בכל deploy)
const processedMessages = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Read raw body FIRST for signature verification, then parse
    const rawBody = await request.text();
    const payload: GreenAPIWebhookPayload = JSON.parse(rawBody);

    // אימות webhook signature
    // Must happen BEFORE any processing, using the raw wire-format body
    const webhookSecret = process.env.GREEN_API_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature') || '';
      const { createHmac } = await import('crypto');
      const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (signature !== expected && signature !== `sha256=${expected}`) {
        console.warn('⚠️ Webhook signature mismatch - rejecting request');
        return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ GREEN_API_WEBHOOK_SECRET not set - webhook signature verification disabled');
    }

    console.log(`[Webhook] ═══════════════════════════════════════`);
    console.log(`[Webhook] INCOMING: type=${payload.typeWebhook}, msgId=${payload.idMessage}`);
    console.log(`[Webhook] FROM: chatId=${payload.senderData?.chatId}, name=${payload.senderData?.senderName || 'unknown'}`);
    console.log(`[Webhook] MSG_TYPE: ${payload.messageData?.typeMessage || 'none'}`);
    console.log(`[Webhook] CONTENT: ${JSON.stringify(payload.messageData || {}).substring(0, 300)}`);

    // 🛡️ בדיקה ראשונה - התעלם מכל מה שלא הודעה נכנסת
    if (payload.typeWebhook !== 'incomingMessageReceived') {
      console.log('🛡️ Ignoring non-incoming message:', payload.typeWebhook);
      return NextResponse.json({ status: 'ignored', reason: payload.typeWebhook });
    }

    // 🛡️ בדיקת כפילויות לפי idMessage - בדאטאבייס!
    const messageId = payload.idMessage;

    // בדיקה בדאטאבייס - זה שורד בין invocations
    if (messageId) {
      const { data: existingMsg } = await supabase
        .from('wa_messages')
        .select('id')
        .eq('provider_msg_id', messageId)
        .limit(1)
        .single();

      if (existingMsg) {
        console.log('🛡️ Duplicate message ignored (DB check):', messageId);
        return NextResponse.json({ status: 'ignored', reason: 'duplicate' });
      }
    }

    // גם בדיקה in-memory לאותו invocation
    if (messageId && processedMessages.has(messageId)) {
      console.log('🛡️ Duplicate message ignored (memory):', messageId);
      return NextResponse.json({ status: 'ignored', reason: 'duplicate' });
    }
    if (messageId) {
      processedMessages.add(messageId);
      if (processedMessages.size > 1000) {
        const first = processedMessages.values().next().value;
        if (first) processedMessages.delete(first);
      }
    }

    // 🛡️ בדיקה נוספת - אם זה הודעה מהבוט עצמו
    if (payload.messageData?.fromMe === true) {
      console.log('🛡️ Ignoring message from self (fromMe=true)');
      return NextResponse.json({ status: 'ignored', reason: 'message from self' });
    }

    // (הבדיקות הישנות הוסרו כי הבדיקה הראשונה כבר מכסה אותן)

    // רק הודעות נכנסות - כבר בדקנו למעלה
    if (payload.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ status: 'ignored', reason: 'not incoming message' });
    }
    
    // 🛡️ בדיקה נוספת - אם זה הודעה מהבוט עצמו
    if (payload.messageData?.fromMe === true) {
      console.log('🛡️ Ignoring message from self (fromMe=true)');
      return NextResponse.json({ status: 'ignored', reason: 'message from self' });
    }

    // חילוץ מספר טלפון
    const rawPhoneNumber = payload.senderData.chatId.replace('@c.us', '');
    
    // נרמול מספר טלפון - להסיר +, רווחים, מקפים
    const normalizePhone = (phone: string) => {
      return phone.replace(/[\s\-\+]/g, '');
    };
    
    const phoneNumber = normalizePhone(rawPhoneNumber);
    
    console.log('📞 Phone normalized:', maskPhone(phoneNumber));
    
    // נסה למצוא משתמש בכמה פורמטים
    const phoneVariants = [
      phoneNumber,                                    // 972547667775
      phoneNumber.replace(/^972/, '0'),              // 0547667775
      phoneNumber.replace(/^0/, '972'),              // 972547667775 (מ-0547667775)
    ];
    
    // phone variants generated for lookup
    
    // מציאת משתמש לפי מספר טלפון (נסה כל הפורמטים)
    const { data: users } = await supabase
      .from('users')
      .select('id, name, wa_opt_in, phone')
      .in('phone', phoneVariants);
    
    const user = users?.[0];

    let userData: any;

    if (!user) {
      // 🆕 Auto-create new user from WhatsApp
      console.log('🆕 New user from WhatsApp:', maskPhone(phoneNumber));

      // Extract name from WhatsApp profile BEFORE insert (name is NOT NULL in DB)
      const senderName = payload.senderData?.senderName || '';
      const cleanName = senderName && senderName !== phoneNumber && !/^\d+$/.test(senderName)
        ? senderName.trim()
        : '';

      const initialName = cleanName || 'משתמש חדש';
      const initialState = cleanName ? 'waiting_for_document' : 'waiting_for_name';
      console.log(`[Webhook] CREATE_USER: name="${initialName}", state=${initialState}, hasProfileName=${!!cleanName}`);

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          phone: phoneNumber,
          name: initialName,
          full_name: cleanName || null,
          wa_opt_in: true,
          onboarding_state: initialState,
          phase: 'data_collection',
        })
        .select('id, name, wa_opt_in, phone')
        .single();

      if (createError || !newUser) {
        console.error('❌ Failed to create new user:', createError);
        return NextResponse.json({
          status: 'error',
          message: 'Failed to create user'
        }, { status: 500 });
      }

      console.log('✅ New user created:', maskUserId(newUser.id));
      userData = newUser;

      // 🆕 Send welcome message and return early - don't process the first message as name
      const greenAPIWelcome = getGreenAPIClient();

      if (cleanName) {

        await greenAPIWelcome.sendMessage({
          phoneNumber,
          message: `היי ${cleanName}! 👋\n\nאני *φ Phi* - העוזר הפיננסי שלך.\n\n📄 שלח לי דוח בנק או אשראי (PDF/Excel/תמונה) ואני אנתח את התנועות שלך.`,
        });
      } else {
        await greenAPIWelcome.sendMessage({
          phoneNumber,
          message: `היי! 👋\n\nאני *φ Phi* - העוזר הפיננסי שלך.\n\nאיך קוראים לך? 😊`,
        });
      }

      // If the first message is a document/image, don't return early - let it be processed
      if (messageType === 'documentMessage' || messageType === 'imageMessage') {
        console.log('[Webhook] FIRST_MSG_DOC: processing document from new user');
      } else {
        return NextResponse.json({ status: 'new_user_greeted', userId: newUser.id });
      }
    } else {
      console.log('✅ User found:', maskUserId((user as any).id));
      userData = user as any;
      console.log(`[Webhook] USER: id=${maskUserId(userData.id)}, name=${userData.name || 'none'}, wa_opt_in=${userData.wa_opt_in}`);
    }

    // 🆕 אם המשתמש לא אישר עדיין WhatsApp - מאשר אוטומטית ומתחיל אונבורדינג
    if (!userData.wa_opt_in) {
      console.log('🚀 Auto-enabling WhatsApp for:', maskUserId(userData.id));
      
      // עדכון wa_opt_in ל-true
      const { error: updateError } = await supabase
        .from('users')
        .update({ wa_opt_in: true })
        .eq('id', userData.id);
      
      if (updateError) {
        console.error('❌ Error enabling WhatsApp:', updateError);
        return NextResponse.json({ 
          status: 'error', 
          message: 'Failed to enable WhatsApp' 
        }, { status: 500 });
      }
      
      // עדכון ה-userData המקומי
      userData.wa_opt_in = true;
      console.log('✅ WhatsApp auto-enabled for user');
    }

    // 🛡️ Rate limiting check
    if (checkRateLimit(userData.id)) {
      console.warn(`⚠️ Rate limited user ${maskUserId(userData.id)} (>${RATE_LIMIT_MAX} msgs in ${RATE_LIMIT_WINDOW_MS / 1000}s)`);
      const greenAPIRL = getGreenAPIClient();
      await greenAPIRL.sendMessage({
        phoneNumber: phoneNumber,
        message: `⏳ שניה, אני עדיין מעבד... נסה שוב בעוד כמה שניות.`,
      });
      return NextResponse.json({ status: 'rate_limited' });
    }

    const messageType = payload.messageData?.typeMessage;
    // messageId כבר הוגדר למעלה

    console.log('📨 MESSAGE TYPE:', messageType, 'keys:', Object.keys(payload.messageData || {}));

    // שמירת ההודעה בטבלה
    const waMessageData = {
      user_id: userData.id,
      direction: 'incoming',
      msg_type: messageType === 'imageMessage' ? 'image' : 'text',
      payload: payload,
      provider_msg_id: messageId,
      status: 'delivered',
    };

    const { data: savedMessage, error: msgError } = await (supabase as any)
      .from('wa_messages')
      .insert(waMessageData)
      .select()
      .single();

    if (msgError) {
      console.error('❌ Error saving message:', msgError);
      return NextResponse.json({ 
        status: 'error', 
        message: msgError.message 
      }, { status: 500 });
    }

    // 🆕 טיפול בלחיצה על כפתור - מעביר ל-Rigid Router
    if (messageType === 'interactiveButtonsResponse' || messageType === 'buttonsResponseMessage') {
      // Support both interactive buttons and old-format buttons
      const interactiveData = payload.messageData?.interactiveButtonsResponse;
      const oldButtonData = payload.messageData?.buttonsResponseMessage;

      const buttonId = interactiveData?.selectedButtonId || oldButtonData?.selectedButtonId || oldButtonData?.buttonId || '';
      const buttonText = interactiveData?.selectedButtonText || oldButtonData?.selectedButtonText || oldButtonData?.buttonText || '';

      console.log('🔘 Button pressed - selectedButtonId:', buttonId, 'selectedButtonText:', buttonText);

      // עדיפות ל-buttonId, אחרת buttonText (שהוא בדיוק כמו הטריגר)
      const messageToRoute = buttonId || buttonText;

      console.log('🎯 Routing:', messageToRoute);

      // 🆕 Handle receipt confirm/edit buttons directly
      if (messageToRoute.startsWith('confirm_') || messageToRoute.startsWith('edit_')) {
        const greenAPI = getGreenAPIClient();
        const txId = messageToRoute.replace(/^(confirm_|edit_)/, '');

        if (messageToRoute.startsWith('confirm_')) {
          // Confirm the transaction
          await supabase
            .from('transactions')
            .update({ status: 'confirmed' })
            .eq('id', txId)
            .eq('user_id', userData.id);

          await greenAPI.sendMessage({
            phoneNumber,
            message: `✅ ההוצאה אושרה ונשמרה! 👍`,
          });
        } else {
          // Edit - ask user to type correct details
          await greenAPI.sendMessage({
            phoneNumber,
            message: `✏️ מה לתקן?\n\nכתוב בפורמט:\n*סכום:* 50\n*קטגוריה:* מכולת\n*תיאור:* קניות בסופר\n\nאו כתוב *"מחק"* למחיקת ההוצאה.`,
          });

          // Save edit context
          const { data: ctxUser } = await supabase
            .from('users')
            .select('classification_context')
            .eq('id', userData.id)
            .single();

          const existingCtx = ctxUser?.classification_context || {};
          await supabase
            .from('users')
            .update({ classification_context: { ...existingCtx, editing_tx_id: txId } })
            .eq('id', userData.id);
        }

        const btnAction = messageToRoute.startsWith('confirm_') ? 'confirmed' : 'editing';
        console.log(`[Webhook] RESPONSE: receipt_button_handled action=${btnAction}`);
        return NextResponse.json({ status: 'receipt_button_handled', action: btnAction });
      }

      const { routeMessage } = await import('@/lib/conversation/phi-router');
      const result = await routeMessage(userData.id, phoneNumber, messageToRoute);

      console.log('[φ Router] Button result: success=' + result.success);

      return NextResponse.json({
        status: 'button_response',
        success: result.success,
      });
    }
    // טיפול לפי סוג הודעה - עם Orchestrator! 🤖
    else if (messageType === 'textMessage' || messageType === 'extendedTextMessage' || messageType === 'quotedMessage') {
      // Extract text from all text-like message types
      const text = messageType === 'extendedTextMessage'
        ? (payload.messageData?.extendedTextMessageData?.text || payload.messageData?.textMessageData?.textMessage || '')
        : messageType === 'quotedMessage'
        ? (payload.messageData?.extendedTextMessageData?.text || payload.messageData?.textMessageData?.textMessage || payload.messageData?.quotedMessage?.caption || '')
        : (payload.messageData?.textMessageData?.textMessage || '');
      console.log('📝 Text message received, type:', messageType, 'length:', text.length);

      const greenAPI = getGreenAPIClient();

      // 🆕 Handle receipt edit flow - check if user is editing a transaction
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
            await supabase.from('transactions').delete().eq('id', editingTxId).eq('user_id', userData.id);
            await greenAPI.sendMessage({ phoneNumber, message: '🗑️ ההוצאה נמחקה.' });
          } else {
            // Parse edit: look for amount, category, description
            const updates: any = {};
            const amountMatch = editMsg.match(/(?:סכום[:\s]*)?(\d+(?:\.\d+)?)/);
            const categoryMatch = editMsg.match(/(?:קטגוריה[:\s]*)([^\n,]+)/);
            const descMatch = editMsg.match(/(?:תיאור[:\s]*)([^\n,]+)/);

            if (amountMatch) updates.amount = parseFloat(amountMatch[1]);
            if (categoryMatch) updates.expense_category = categoryMatch[1].trim();
            if (descMatch) updates.notes = descMatch[1].trim();

            if (Object.keys(updates).length > 0) {
              await supabase.from('transactions').update(updates).eq('id', editingTxId).eq('user_id', userData.id);
              await greenAPI.sendMessage({ phoneNumber, message: '✅ ההוצאה עודכנה!' });
            } else {
              // Treat the whole text as the category
              updates.expense_category = editMsg;
              await supabase.from('transactions').update(updates).eq('id', editingTxId).eq('user_id', userData.id);
              await greenAPI.sendMessage({ phoneNumber, message: `✅ הקטגוריה עודכנה ל-"${editMsg}"` });
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

      // 🆕 RIGID ROUTER - לוגיקה קשיחה בלי AI להחלטות
      {
        console.log('🎯 Using Rigid Router (deterministic logic)');

        try {
          // הודעה כבר נשמרה ב-wa_messages בשלב הגנרי (שורה 355)
          // 🎯 קריאה ל-φ Router - לוגיקה נקייה וקשיחה
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
          // שליחת הודעת שגיאה למשתמש
      await greenAPI.sendMessage({
        phoneNumber,
            message: 'סליחה, משהו השתבש 😅 נסה שוב בבקשה',
          });
          return NextResponse.json({ status: 'error', error: String(routerError) });
        }
      }
    } else if (messageType === 'imageMessage') {
      // 🔍 Debug: הצג את כל ה-payload
      console.log('🖼️ Image message received, mime:', payload.messageData?.fileMessageData?.mimeType || 'unknown');

      // 🔧 GreenAPI שולח את הנתונים ב-fileMessageData!
      const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl || payload.messageData?.downloadUrl;
      const caption = payload.messageData?.fileMessageData?.caption || payload.messageData?.caption || '';

      console.log('📥 Download URL:', downloadUrl);
      console.log('📝 Caption:', caption);
      console.log(`[Webhook] IMAGE_RECEIVED: downloadUrl=${downloadUrl ? 'yes' : 'no'}, caption="${(caption || '').substring(0, 50)}"`);

      // 🆕 If user is in waiting_for_name and sends an image, auto-set name and advance
      {
        const { data: imgNameCheck } = await supabase
          .from('users')
          .select('onboarding_state, name')
          .eq('id', userData.id)
          .single();

        if (imgNameCheck?.onboarding_state === 'waiting_for_name' && !imgNameCheck?.name) {
          const imgSenderName = payload.senderData?.senderName || '';
          const imgCleanName = imgSenderName && imgSenderName !== phoneNumber && !/^\d+$/.test(imgSenderName)
            ? imgSenderName.trim()
            : 'משתמש';

          await supabase
            .from('users')
            .update({ name: imgCleanName, full_name: imgCleanName, onboarding_state: 'waiting_for_document' })
            .eq('id', userData.id);

          console.log(`📝 Auto-set name to "${imgCleanName}" from image sender`);
        }
      }

      // 🆕 אם אין downloadUrl, נשלח הודעת שגיאה
      if (!downloadUrl) {
        const greenAPI = getGreenAPIClient();
        await greenAPI.sendMessage({
          phoneNumber,
          message: '😕 לא הצלחתי לקבל את התמונה.\n\nאפשר לנסות שוב?',
        });
        return NextResponse.json({ status: 'no_download_url' });
      }

      const greenAPI = getGreenAPIClient();
      
      await greenAPI.sendMessage({
        phoneNumber,
        message: 'קיבלתי את התמונה! 📸\n\nאני מנתח אותה עם AI...',
      });

        try {
          // הורדת התמונה מ-GreenAPI
          const imageResponse = await fetch(downloadUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

          // ניתוח OCR + AI (GPT-5.2 Vision) עם קטגוריות מדויקות
          console.log('🤖 Starting OCR analysis with GPT-5.2 Vision...');
          
          const systemPrompt = `${EXPENSE_CATEGORIES_SYSTEM_PROMPT}

**פורמט החזרה מיוחד לקבלות:**
{
  "document_type": "receipt | bank_statement | credit_statement",
  "vendor_name": "שם בית העסק הראשי (אם רלוונטי)",
  "receipt_date": "YYYY-MM-DD (תאריך הקבלה)",
  "receipt_total": <סכום כולל של הקבלה>,
  "receipt_number": <מספר הקבלה - אם קיים>,
  "transactions": [
    {
      "amount": <number>,
      "vendor": "שם בית העסק או תיאור הפריט",
      "date": "YYYY-MM-DD (תאריך מהקבלה - חשוב מאוד!)",
      "expense_category": "השם המדויק מרשימת ההוצאות",
      "expense_type": "fixed | variable | special",
      "description": "תיאור נוסף",
      "confidence": <0.0-1.0>
    }
  ]
}

🎯 **חשוב במיוחד לקבלות:**
1. **הבדל קריטי בין מספר קבלה/קופה לעלות:**
   - מספר קבלה (Receipt Number) - זה מספר סידורי של הקבלה (למשל: 36401, 00123, #456)
   - מספר קופה (Cash Register Number) - זה מספר הקופה (למשל: 000083, 001, 5)
   - עלות/סכום (Amount/Total) - זה הסכום ששולם בפועל (למשל: 79.00 ₪, 150.50 ש״ח)
   - **תמיד** השתמש בסכום שמופיע ליד המילים: "סה״כ כולל מע״מ", "סה״כ", "לתשלום", "Total", "Sum", "Amount", "₪", "ש״ח"
   - **לעולם אל תשתמש במספר קבלה או מספר קופה כעלות!**
   - **מספר קופה (000083) ≠ סכום כסף (79)**
   - **מספר קבלה (36401) ≠ סכום כסף (79)**

2. **מיקום הסכום הכולל:**
   - הסכום הכולל נמצא תמיד בתחתית הקבלה, ליד המילים "סה״כ כולל מע״מ" או "Total"
   - זה לא מספר הקופה (שנמצא ליד "מספר קופה" או "Cash Register")
   - זה לא מספר הקבלה (שנמצא ליד "מספר קבלה" או "Receipt Number")

3. **פורמט תאריכים ישראלי (חשוב מאוד!):**
   - תאריכים ישראליים הם בפורמט: **יום.חודש.שנה** (DD.MM.YY או DD.MM.YYYY)
   - **לא** כמו בארה"ב (MM.DD.YY)!
   - דוגמאות: "10.11.20" = 10 בנובמבר 2020, "25.12.24" = 25 בדצמבר 2024
   - אם רשום "10.11.20" - זה יום 10, חודש 11 (נובמבר), שנה 2020
   - החזר בפורמט ISO: "YYYY-MM-DD" (למשל: "2020-11-10")

4. חלץ את **התאריך האמיתי מהקבלה** - לא תאריך היום!

5. אם יש כמה פריטים בקבלה - חלץ את כולם

6. אם זו קבלה פשוטה (1-2 פריטים) - השתמש בשם בית העסק כ-vendor

7. סווג לקטגוריה המדויקת ביותר מהרשימה

8. **בדיקה כפולה:** לפני שתחזיר את ה-amount, ודא שזה באמת סכום כסף (עם נקודה עשרונית או מספר שלם) ולא מספר קבלה, מספר קופה או מזהה אחר.`;

          const userPrompt = 'נתח את הקבלה/תדפיס הזה וחלץ את כל המידע. **שים לב מיוחד לתאריך!**\n\n**חשוב מאוד - זיהוי הסכום הנכון:**\n- זהה את הסכום ששולם בפועל - זה נמצא ליד "סה״כ כולל מע״מ" או "סה״כ" בתחתית הקבלה\n- אל תשתמש במספר הקבלה כעלות! (מספר קבלה = 36401)\n- אל תשתמש במספר הקופה כעלות! (מספר קופה = 000083)\n- דוגמה: אם רשום "מספר קופה: 000083" ו"סה״כ כולל מע״מ: 79" - הסכום הוא 79, לא 83!\n- מספר קופה/קבלה ≠ סכום כסף\n\n**חשוב מאוד - פורמט תאריכים ישראלי:**\n- תאריכים ישראליים הם בפורמט: יום.חודש.שנה (DD.MM.YY)\n- **לא** כמו בארה"ב! אם רשום "10.11.20" זה יום 10, חודש 11 (נובמבר), שנה 2020\n- החזר בפורמט ISO: "YYYY-MM-DD" (למשל: "2020-11-10")\n\nהחזר תשובה בפורמט JSON.';

          // 🆕 Gemini Flash Vision for receipt OCR
          const { chatWithGeminiProVision } = await import('@/lib/ai/gemini-client');
          const aiText = await chatWithGeminiProVision(
            base64Image,
            mimeType,
            systemPrompt + '\n\n' + userPrompt
          );
          console.log('🎯 OCR Result:', aiText);

          let ocrData: any;
          try {
            ocrData = JSON.parse(aiText);
          } catch {
            // אם AI לא החזיר JSON תקין
            ocrData = { document_type: 'receipt', transactions: [] };
          }

          const transactions = ocrData.transactions || [];
          
          if (transactions.length === 0) {
            await greenAPI.sendMessage({
              phoneNumber,
              message: 'לא הצלחתי לזהות פרטים מהקבלה 😕\n\nתוכל לכתוב את הסכום ידנית? למשל: "50 ₪ קפה"',
            });
            return NextResponse.json({ status: 'no_data' });
          }

          // שימוש בתאריך מהקבלה (לא מהיום!)
          const receiptDate = safeParseDateToISO(ocrData.receipt_date || transactions[0]?.date);
          const receiptTotal = ocrData.receipt_total || transactions[0]?.amount || null;
          const receiptVendor = ocrData.vendor_name || transactions[0]?.vendor || null;
          const receiptNumber = ocrData.receipt_number || null; // ⭐ מספר הקבלה

          // שמירת קבלה + יצירת הוצאות
          const { data: receipt } = await (supabase as any)
            .from('receipts')
            .insert({
              user_id: userData.id,
              storage_path: downloadUrl,
              ocr_text: aiText,
              amount: receiptTotal,
              vendor: receiptVendor,
              tx_date: receiptDate,
              receipt_number: receiptNumber, // ⭐ מספר הקבלה
              confidence: transactions[0]?.confidence || 0.5,
              status: 'completed',
              metadata: {
                document_type: ocrData.document_type,
                source: 'whatsapp',
                model: 'gpt-5.2',
                total_items: transactions.length,
              },
            })
            .select()
            .single();

          console.log('✅ Receipt saved:', receipt?.id);

          // יצירת הוצאות - כולן pending לאישור
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';
          
          if (transactions.length <= 2) {
            // קבלה רגילה עם 1-2 פריטים
            const insertedIds: string[] = [];
            
            for (const tx of transactions) {
              // שימוש בתאריך מהקבלה (לא מהיום!)
              const txDate = safeParseDateToISO(tx.date) || receiptDate;
              
              const { data: insertedTx, error: insertError } = await (supabase as any)
                .from('transactions')
                .insert({
                  user_id: userData.id,
                  type: 'expense',
                  amount: tx.amount,
                  vendor: tx.vendor,
                  date: txDate,
                  tx_date: txDate,
                  category: tx.category || 'other', // תאימות לאחור
                  expense_category: tx.expense_category || null, // 🆕 הקטגוריה המדויקת!
                  expense_type: tx.expense_type || 'variable', // 🆕 fixed/variable/special
                  detailed_category: tx.detailed_category,
                  expense_frequency: tx.expense_frequency || 'one_time',
                  payment_method: null,
                  source: 'ocr',
                  status: 'pending', // ממתין לאישור
                  notes: tx.description || '',
                  original_description: tx.description || '',
                  auto_categorized: true,
                  confidence_score: tx.confidence || 0.5,
                  receipt_id: receipt?.id || null, // ⭐ קישור לקבלה
                  receipt_number: receiptNumber, // ⭐ מספר הקבלה
                })
                .select('id')
                .single();
              
              if (insertError) {
                console.error('❌ Error inserting transaction:', insertError);
                console.error('Transaction data:', { user_id: maskUserId(userData.id), amount: tx.amount, status: 'pending', source: 'ocr' });
              } else if (insertedTx?.id) {
                console.log('✅ Transaction inserted successfully:', insertedTx.id, { amount: tx.amount, status: 'pending', source: 'ocr' });
                insertedIds.push(insertedTx.id);
              }
            }

            const tx = transactions[0];
            const displayCategory = tx.expense_category || tx.category || 'אחר';
            const displayDate = tx.date || receiptDate;
            const transactionId = insertedIds[0];
            
            // 🆕 שליחת הודעה עם כפתורי אישור/עריכה
            if (transactionId) {
              await greenAPI.sendButtons({
                phoneNumber,
                message: `✅ קבלה נקלטה במערכת!\n\n💰 ${tx.amount} ₪\n🏪 ${tx.vendor}\n📂 ${displayCategory}\n📅 ${displayDate}\n\nזה נכון?`,
                buttons: [
                  { buttonId: `confirm_${transactionId}`, buttonText: '✅ אישור' },
                  { buttonId: `edit_${transactionId}`, buttonText: '✏️ עריכה' },
                ],
              });
            } else {
              // fallback אם לא הצלחנו לקבל ID
              await greenAPI.sendMessage({
                phoneNumber,
                message: `✅ קבלה נקלטה במערכת!\n\n💰 ${tx.amount} ₪\n🏪 ${tx.vendor}\n📂 ${displayCategory}\n📅 ${displayDate}\n\n👉 אשר את ההוצאה כאן:\n${siteUrl}/dashboard/expenses/pending`,
              });
            }
          } else {
            // תדפיס אשראי/בנק עם הרבה תנועות
            for (const tx of transactions) {
              // שימוש בתאריך מהקבלה (לא מהיום!)
              const txDate = safeParseDateToISO(tx.date) || receiptDate;
              
              await (supabase as any)
                .from('transactions')
                .insert({
                  user_id: userData.id,
                  type: 'expense',
                  amount: tx.amount,
                  vendor: tx.vendor,
                  date: txDate,
                  tx_date: txDate,
                  category: tx.category || 'other', // תאימות לאחור
                  expense_category: tx.expense_category || null, // 🆕 הקטגוריה המדויקת!
                  expense_type: tx.expense_type || 'variable', // 🆕 fixed/variable/special
                  detailed_category: tx.detailed_category,
                  expense_frequency: tx.expense_frequency || 'one_time',
                  payment_method: ocrData.document_type === 'credit_statement' ? 'credit_card' : 'bank_transfer',
                  source: 'ocr',
                  status: 'pending', // ממתין לאישור
                  notes: tx.description || '',
                  original_description: tx.description || '',
                  auto_categorized: true,
                  confidence_score: tx.confidence || 0.5,
                });
            }
            
            await greenAPI.sendMessage({
              phoneNumber,
              message: `🎉 זיהיתי ${transactions.length} תנועות!\n\n👉 אשר את ההוצאות כאן:\n${siteUrl}/dashboard/expenses/pending`,
            });

            // Trigger state machine - update user state for classification
            try {
              const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
              await onDocumentProcessed(userData.id, phoneNumber);
              console.log('✅ φ Router notified of image-based transactions');
            } catch (routerErr) {
              console.error('⚠️ φ Router notification failed:', routerErr);
            }
          }

        } catch (ocrError: any) {
          console.error('❌ OCR Error:', ocrError);
          await greenAPI.sendMessage({
            phoneNumber,
            message: 'משהו השתבש בניתוח הקבלה 😕\n\nנסה שוב או כתוב את הפרטים ידנית.',
          });
        }
    } else if (messageType === 'documentMessage') {
      // 🆕 טיפול במסמכים (PDF, Excel, וכו')
      console.log('📄 Document message received, mime:', payload.messageData?.fileMessageData?.mimeType || 'unknown');

      // 🔧 GreenAPI שולח את הנתונים ב-fileMessageData!
      const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl || payload.messageData?.downloadUrl;
      const fileName = payload.messageData?.fileMessageData?.fileName || payload.messageData?.fileName || 'document';
      const caption = payload.messageData?.fileMessageData?.caption || payload.messageData?.caption || '';

      console.log('📥 Document URL:', downloadUrl);
      console.log('📝 File name:', fileName);

      // 🆕 If user is in waiting_for_name and sends a document, auto-set name and advance
      {
        const { data: nameCheckUser } = await supabase
          .from('users')
          .select('onboarding_state, name')
          .eq('id', userData.id)
          .single();

        if (nameCheckUser?.onboarding_state === 'waiting_for_name' && !nameCheckUser?.name) {
          const docSenderName = payload.senderData?.senderName || '';
          const docCleanName = docSenderName && docSenderName !== phoneNumber && !/^\d+$/.test(docSenderName)
            ? docSenderName.trim()
            : 'משתמש';

          await supabase
            .from('users')
            .update({ name: docCleanName, full_name: docCleanName, onboarding_state: 'waiting_for_document' })
            .eq('id', userData.id);

          console.log(`📝 Auto-set name to "${docCleanName}" from document sender`);
        }
      }

      if (!downloadUrl) {
        const greenAPI = getGreenAPIClient();
        await greenAPI.sendMessage({
          phoneNumber,
          message: '😕 לא הצלחתי לקבל את המסמך.\n\nאפשר לנסות שוב?',
        });
        return NextResponse.json({ status: 'no_download_url' });
      }

      const greenAPI = getGreenAPIClient();

      // בדיקה אם זה PDF או Excel
      const lowerName = fileName.toLowerCase();
      const isPDF = lowerName.endsWith('.pdf');
      const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');

      if (isPDF) {
        // 🆕 זיהוי חכם של סוג המסמך לפי ה-state
        const { data: userState } = await supabase
          .from('users')
          .select('onboarding_state, classification_context')
          .eq('id', userData.id)
          .single();
        
        const currentState = userState?.onboarding_state;
        const explicitDocType = userState?.classification_context?.waitingForDocument;
        
        // 🆕 טיפול מיוחד במסמכי הלוואות לאיחוד
        if (currentState === 'waiting_for_loan_docs') {
          console.log('📄 Loan document received for consolidation');
          
          const { receiveLoanDocument } = await import('@/lib/loans/consolidation-handler');
          const response = await receiveLoanDocument(userData.id, phoneNumber, downloadUrl, fileName);
          
          const greenAPI = getGreenAPIClient();
          await greenAPI.sendMessage({
            phoneNumber,
            message: response,
          });
          
          // בדוק אם קיבלנו את כל המסמכים
          const { data: updatedRequest } = await supabase
            .from('loan_consolidation_requests')
            .select('id, status, documents_received, documents_needed')
            .eq('user_id', userData.id)
            .eq('status', 'documents_received')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (updatedRequest) {
            // קיבלנו את כל המסמכים - שלח לגדי!
            const { sendLeadToAdvisor } = await import('@/lib/loans/lead-generator');
            await sendLeadToAdvisor(updatedRequest.id);

            // עדכן למשתמש שהבקשה נשלחה
            await greenAPI.sendMessage({
              phoneNumber,
              message: `✅ *הבקשה נשלחה לגדי!*\n\n` +
                `הוא יבדוק את המצב שלך ויחזור אליך בהקדם.\n\n` +
                `בינתיים, בוא נמשיך לנתח את ההתנהגות הפיננסית שלך 📊`,
            });

            // עובר לשלב הבא - נקה רק את loanConsolidation מה-context
            const { data: ctxUser } = await supabase
              .from('users')
              .select('classification_context')
              .eq('id', userData.id)
              .single();

            const existingCtx = ctxUser?.classification_context || {};
            const { loanConsolidation: _, ...restCtx } = existingCtx as any;

            await supabase
              .from('users')
              .update({
                onboarding_state: 'behavior',
                phase: 'behavior',
                classification_context: Object.keys(restCtx).length > 0 ? restCtx : null
              })
              .eq('id', userData.id);
          }
          
          return NextResponse.json({ status: 'loan_document_received' });
        }
        
        // 🎯 זיהוי סוג מסמך לפי:
        // 1. סוג מסמך שהוגדר במפורש ב-context (waitingForDocument)
        // 2. ה-state הנוכחי של המשתמש
        // 3. ניסיון זיהוי מהשם של הקובץ
        let documentType = 'bank'; // ברירת מחדל
        let documentTypeHebrew = 'דוח בנק';
        
        const lowerFileName = fileName.toLowerCase();
        
        // מיפוי סוגים לשמות בעברית
        const typeLabels: Record<string, string> = {
          'bank': 'דוח בנק',
          'credit': 'דוח אשראי',
          'payslip': 'תלוש משכורת',
          'loan': 'דוח הלוואות',
          'mortgage': 'דוח משכנתא',
          'pension': 'דוח פנסיה',
          'pension_clearing': 'דוח מסלקה פנסיונית (כל הפנסיות!)',
          'insurance': 'דוח ביטוח',
          'har_bituach': 'דוח הר הביטוח (כל הביטוחים!)',
          'savings': 'דוח חסכונות',
          'investment': 'דוח השקעות',
        };
        
        if (explicitDocType && explicitDocType !== 'pending_type_selection') {
          // סוג מסמך הוגדר במפורש
          documentType = explicitDocType;
          documentTypeHebrew = typeLabels[explicitDocType] || explicitDocType;
        } else if (currentState === 'onboarding_income' || currentState === 'data_collection') {
          // ב-onboarding - הבוט ביקש דוח בנק
          documentType = 'bank';
          documentTypeHebrew = typeLabels['bank'];
        } 
        // === דוחות כוללים (עדיפות גבוהה!) ===
        else if (lowerFileName.includes('מסלקה') || lowerFileName.includes('clearing') || 
                 lowerFileName.includes('פנסיוני') || lowerFileName.includes('pension_report')) {
          documentType = 'pension_clearing';
          documentTypeHebrew = typeLabels['pension_clearing'];
        } 
        else if (lowerFileName.includes('הר הביטוח') || lowerFileName.includes('har') || 
                 lowerFileName.includes('all_insurance') || lowerFileName.includes('כל הביטוחים')) {
          documentType = 'har_bituach';
          documentTypeHebrew = typeLabels['har_bituach'];
        }
        // === דוחות רגילים ===
        else if (lowerFileName.includes('אשראי') || lowerFileName.includes('credit') || 
                 lowerFileName.includes('ויזה') || lowerFileName.includes('ויזא') ||
                 lowerFileName.includes('כאל') || lowerFileName.includes('מקס') || 
                 lowerFileName.includes('visa') || lowerFileName.includes('mastercard') ||
                 lowerFileName.includes('ישראכרט') || lowerFileName.includes('דיינרס')) {
          documentType = 'credit';
          documentTypeHebrew = typeLabels['credit'];
        } 
        else if (lowerFileName.includes('בנק') || lowerFileName.includes('bank') || 
                 lowerFileName.includes('עוש') || lowerFileName.includes('תנועות') ||
                 lowerFileName.includes('חשבון')) {
          documentType = 'bank';
          documentTypeHebrew = typeLabels['bank'];
        } 
        else if (lowerFileName.includes('תלוש') || lowerFileName.includes('משכורת') || 
                 lowerFileName.includes('שכר') || lowerFileName.includes('payslip') ||
                 lowerFileName.includes('salary')) {
          documentType = 'payslip';
          documentTypeHebrew = typeLabels['payslip'];
        } 
        else if (lowerFileName.includes('הלוואה') || lowerFileName.includes('loan') ||
                 lowerFileName.includes('הלוואות')) {
          documentType = 'loan';
          documentTypeHebrew = typeLabels['loan'];
        } 
        else if (lowerFileName.includes('משכנתא') || lowerFileName.includes('mortgage') ||
                 lowerFileName.includes('דיור')) {
          documentType = 'mortgage';
          documentTypeHebrew = typeLabels['mortgage'];
        } 
        else if (lowerFileName.includes('פנסיה') || lowerFileName.includes('pension') ||
                 lowerFileName.includes('גמל') || lowerFileName.includes('השתלמות')) {
          documentType = 'pension';
          documentTypeHebrew = typeLabels['pension'];
        } 
        else if (lowerFileName.includes('ביטוח') || lowerFileName.includes('insurance') ||
                 lowerFileName.includes('פוליסה') || lowerFileName.includes('פרמיה')) {
          documentType = 'insurance';
          documentTypeHebrew = typeLabels['insurance'];
        }
        else if (lowerFileName.includes('חסכון') || lowerFileName.includes('savings') ||
                 lowerFileName.includes('פיקדון') || lowerFileName.includes('deposit')) {
          documentType = 'savings';
          documentTypeHebrew = typeLabels['savings'];
        }
        else if (lowerFileName.includes('השקעות') || lowerFileName.includes('investment') ||
                 lowerFileName.includes('תיק') || lowerFileName.includes('portfolio') ||
                 lowerFileName.includes('מניות') || lowerFileName.includes('ני"ע')) {
          documentType = 'investment';
          documentTypeHebrew = typeLabels['investment'];
        }
        
        console.log(`📋 Document type detected: ${documentType} (state: ${currentState}, fileName: ${fileName})`);
        
        await greenAPI.sendMessage({
          phoneNumber,
          message: `📄 קיבלתי ${documentTypeHebrew}!\n\nמתחיל לנתח... זה יקח כדקה-שתיים.`,
        });
        
        // 🆕 הפעל עדכוני התקדמות ברקע
        const progressUpdater = startProgressUpdates(greenAPI, phoneNumber);
        
        try {
          // הורדת ה-PDF
          const pdfResponse = await fetch(downloadUrl);
          const pdfBuffer = await pdfResponse.arrayBuffer();
          const buffer = Buffer.from(pdfBuffer);
          
          console.log(`🤖 Starting PDF analysis (type: ${documentType}) with Gemini Flash...`);
          console.log(`[Webhook] PDF_ANALYSIS_START: docType=${documentType}, fileSize=${buffer.length} bytes, fileName=${fileName}`);
          const pdfStartTime = Date.now();

          // 🆕 טען קטגוריות ובחר את הפרומפט המתאים לסוג המסמך
          const { getPromptForDocumentType } = await import('@/lib/ai/document-prompts');
          let expenseCategories: Array<{name: string; expense_type: string; category_group: string}> = [];

          if (documentType === 'credit' || documentType === 'bank') {
            const { data: categories } = await supabase
              .from('expense_categories')
              .select('name, expense_type, category_group')
              .eq('is_active', true);
            expenseCategories = categories || [];
            console.log(`📋 Loaded ${expenseCategories.length} expense categories`);
          }

          const prompt = getPromptForDocumentType(
            documentType === 'credit' ? 'credit_statement' :
            documentType === 'bank' ? 'bank_statement' :
            documentType,
            null,
            expenseCategories
          );

          console.log(`📝 Using prompt for document type: ${documentType} (${prompt.length} chars)`);

          // 🆕 Gemini Flash - direct PDF analysis via inline data
          let content = '';
          try {
            console.log('🔄 Analyzing PDF with Gemini Flash...');
            const base64Pdf = buffer.toString('base64');
            const { chatWithGeminiProVision } = await import('@/lib/ai/gemini-client');

            // ⏱️ Timeout wrapper to prevent Vercel function timeout (240s leaves room for DB ops)
            const aiPromise = chatWithGeminiProVision(base64Pdf, 'application/pdf', prompt);
            const timeoutPromise = new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('PDF_AI_TIMEOUT')), 240000)
            );
            content = await Promise.race([aiPromise, timeoutPromise]);

            console.log('✅ Gemini Pro PDF analysis succeeded');
            console.log(`[Webhook] PDF_ANALYSIS_DONE: time=${Date.now() - pdfStartTime}ms, resultLength=${content.length} chars`);
          } catch (geminiError: any) {
            if (geminiError.message === 'PDF_AI_TIMEOUT') {
              console.error('⏱️ PDF AI call timed out after 240 seconds');
              progressUpdater.stop();
              await greenAPI.sendMessage({
                phoneNumber,
                message: `⏱️ המסמך גדול מדי ולוקח יותר מדי זמן לנתח.\n\nנסה לשלוח מסמך קצר יותר (עד 3 חודשים), או צלם את העמודים הרלוונטיים.`,
              });
              return NextResponse.json({ status: 'success', message: 'pdf timeout handled' });
            }
            console.log(`❌ Gemini Pro failed: ${geminiError.message}`);
            throw geminiError;
          }

          // Clean up context
          try {
            await updateContext(userData.id, {
              waitingForDocument: undefined,
              taskProgress: undefined,
            } as any);
          } catch (e) {
            // Ignore cleanup errors
          }

          console.log('🎯 PDF OCR Result:', content);

          let ocrData: any;
          try {
            // Try to extract JSON from the response (may include markdown)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            let jsonStr = jsonMatch ? jsonMatch[0] : content;

            // 🔧 FIX: Clean up common AI JSON errors before parsing
            // Fix "29571. - null" patterns → null
            jsonStr = jsonStr.replace(/:\s*[\d.]+\s*-\s*null/g, ': null');
            // Fix trailing commas
            jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
            // Fix "null" as string → null
            jsonStr = jsonStr.replace(/"null"/g, 'null');

            ocrData = JSON.parse(jsonStr);
          } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            console.log('📝 Raw content (first 500 chars):', content.substring(0, 500));
            console.log('📝 Raw content (last 300 chars):', content.substring(Math.max(0, content.length - 300)));

            // 🔧 Try to recover truncated JSON by closing open brackets
            try {
              let jsonStr = content.match(/\{[\s\S]*/)?.[0] || content;
              // Remove trailing incomplete object/value
              jsonStr = jsonStr.replace(/,\s*\{[^}]*$/s, '');
              // Count open/close brackets and close them
              const openBraces = (jsonStr.match(/\{/g) || []).length;
              const closeBraces = (jsonStr.match(/\}/g) || []).length;
              const openBrackets = (jsonStr.match(/\[/g) || []).length;
              const closeBrackets = (jsonStr.match(/\]/g) || []).length;
              jsonStr += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
              jsonStr += '}'.repeat(Math.max(0, openBraces - closeBraces));
              // Clean up
              jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
              ocrData = JSON.parse(jsonStr);
              console.log(`✅ JSON recovery succeeded: ${ocrData.transactions?.length || 0} transactions salvaged`);
            } catch (recoveryError) {
              console.error('❌ JSON recovery also failed:', recoveryError);
              ocrData = { document_type: 'credit_statement', transactions: [] };
            }
          }

          // 🆕 Handle different response formats:
          // - Credit: transactions = array
          // - Bank: transactions = { income: [], expenses: [], loan_payments: [], savings_transfers: [] }
          let allTransactions: any[] = [];
          
          // 🔧 Helper function to determine transaction type
          const determineTransactionType = (tx: any): 'income' | 'expense' => {
            // 1. If type is explicitly set, use it
            if (tx.type === 'income') return 'income';
            if (tx.type === 'expense') return 'expense';
            
            // 2. If income_category is set, it's income
            if (tx.income_category) return 'income';
            
            // 3. If expense_category is set, it's expense
            if (tx.expense_category || tx.expense_type) return 'expense';
            
            // 4. Check balance_before and balance_after
            if (tx.balance_before !== undefined && tx.balance_after !== undefined) {
              const balanceBefore = typeof tx.balance_before === 'string' 
                ? parseFloat(tx.balance_before.replace(/[^\d.-]/g, '')) 
                : tx.balance_before;
              const balanceAfter = typeof tx.balance_after === 'string' 
                ? parseFloat(tx.balance_after.replace(/[^\d.-]/g, '')) 
                : tx.balance_after;
              if (!isNaN(balanceBefore) && !isNaN(balanceAfter)) {
                return balanceAfter > balanceBefore ? 'income' : 'expense';
              }
            }
            
            // 5. Check for negative amount indicators
            const amountStr = String(tx.amount || tx.original_amount || '');
            if (amountStr.includes('-') || amountStr.endsWith('-')) return 'expense';
            
            // 6. Check description for expense keywords
            const desc = (tx.description || tx.vendor || '').toLowerCase();
            const expenseKeywords = ['חיוב', 'תשלום', 'ויזה', 'ויזא', 'מסטרקארד', 'משיכה', 'הו"ק', 'ארנונה', 'חשמל', 'מים', 'גז'];
            if (expenseKeywords.some(kw => desc.includes(kw))) return 'expense';
            
            // 7. Check description for income keywords
            const incomeKeywords = ['משכורת', 'שכר', 'העברה ל', 'זיכוי', 'החזר', 'קצבה', 'גמלה'];
            if (incomeKeywords.some(kw => desc.includes(kw))) return 'income';
            
            // 8. Default to expense (most bank transactions are expenses)
            console.log(`⚠️ Could not determine type for: "${desc}" (${tx.amount}) - defaulting to expense`);
            return 'expense';
          };
          
          if (Array.isArray(ocrData.transactions)) {
            // Credit statement format - transactions is array
            // 🔧 FIX: Ensure each transaction has a type
            allTransactions = ocrData.transactions.map((tx: any) => ({
              ...tx,
              type: determineTransactionType(tx)
            }));
          } else if (ocrData.transactions && typeof ocrData.transactions === 'object') {
            // Bank statement format - transactions is object with categories
            const { income = [], expenses = [], loan_payments = [], savings_transfers = [] } = ocrData.transactions;
            
            // Add type to each transaction and merge
            allTransactions = [
              ...income.map((tx: any) => ({ ...tx, type: 'income' })),
              ...expenses.map((tx: any) => ({ ...tx, type: 'expense' })),
              ...loan_payments.map((tx: any) => ({ ...tx, type: 'expense', expense_category: tx.expense_category || 'החזר הלוואה' })),
              ...savings_transfers.map((tx: any) => ({ ...tx, type: 'expense', expense_category: tx.expense_category || 'חיסכון' })),
            ];
          }
          
          // Count actual types for logging
          const incomeCountFromData = allTransactions.filter(tx => tx.type === 'income').length;
          const expenseCountFromData = allTransactions.filter(tx => tx.type === 'expense').length;
          console.log(`📊 Parsed ${allTransactions.length} transactions (income: ${incomeCountFromData}, expenses: ${expenseCountFromData})`);
          
          if (allTransactions.length === 0) {
            await greenAPI.sendMessage({
              phoneNumber,
              message: 'לא הצלחתי לזהות תנועות ב-PDF 😕\n\nנסה לצלם את המסך או כתוב את הפרטים ידנית.',
            });
            return NextResponse.json({ status: 'no_data' });
          }

          // 🆕 בדיקת כפילויות - האם יש כבר תנועות דומות במערכת?
          const { checkForDuplicateTransactions } = await import('@/lib/documents/period-tracker');
          const duplicateCheck = await checkForDuplicateTransactions(userData.id, allTransactions);
          
          if (duplicateCheck.isDuplicate) {
            console.log(`⚠️ Duplicate document detected! Overlap: ${duplicateCheck.overlapPercent}%`);
            await greenAPI.sendMessage({
              phoneNumber,
              message: `⚠️ שים לב - נראה שהמסמך הזה כבר הועלה!\n\nזיהיתי ${duplicateCheck.overlapPercent}% חפיפה עם תנועות קיימות.\n\n${duplicateCheck.overlappingPeriod ? `תקופה חופפת: ${duplicateCheck.overlappingPeriod}` : ''}\n\nרוצה להעלות מסמך אחר?`,
            });
            return NextResponse.json({ status: 'duplicate_detected' });
          }
          
          // 🆕 אזהרה על חפיפה חלקית - נשמור כדי להציג בהודעה
          let partialOverlapWarning = '';
          if (duplicateCheck.hasPartialOverlap) {
            console.log(`⚠️ Partial overlap detected: ${duplicateCheck.overlapPercent}%`);
            partialOverlapWarning = `\n\n⚠️ *שים לב:* ${duplicateCheck.overlapPercent}% מהתנועות כבר קיימות במערכת.\nייתכן שחלק מהמסמך כבר הועלה קודם.`;
          }

          // 🆕 שמירת התנועות ב-pending לסיווג אינטראקטיבי
          const pendingBatchId = `batch_${Date.now()}_${userData.id.substring(0, 8)}`;
          const insertedIds: string[] = [];
          const insertErrors: any[] = [];
          
          console.log(`💾 Saving ${allTransactions.length} transactions with batch_id: ${pendingBatchId}`);
          
          const duplicateSuspects: Array<{ vendor: string; amount: number; date: string }> = [];

          for (const tx of allTransactions) {
            const txDate = safeParseDateToISO(tx.date);
            const txType = tx.type || 'expense';
            // 🔧 FIX: category חובה - נשתמש בקטגוריה מה-AI או ברירת מחדל
            const category = tx.expense_category || tx.income_category || tx.category ||
              (txType === 'income' ? 'הכנסה אחרת' : 'הוצאה אחרת');

            // 🔍 Duplicate detection: check if similar transaction already exists
            if (tx.vendor && tx.amount) {
              const tolerance = Math.abs(tx.amount) * 0.02; // ±2%
              const dateObj = new Date(txDate);
              const dayBefore = new Date(dateObj.getTime() - 86400000).toISOString().split('T')[0];
              const dayAfter = new Date(dateObj.getTime() + 86400000).toISOString().split('T')[0];

              const { data: existingTx } = await (supabase as any)
                .from('transactions')
                .select('id, vendor, amount, tx_date')
                .eq('user_id', userData.id)
                .gte('tx_date', dayBefore)
                .lte('tx_date', dayAfter)
                .gte('amount', tx.amount - tolerance)
                .lte('amount', tx.amount + tolerance)
                .neq('status', 'duplicate_suspect')
                .limit(1);

              if (existingTx && existingTx.length > 0) {
                duplicateSuspects.push({ vendor: tx.vendor, amount: tx.amount, date: txDate });
                // Still insert but mark as duplicate suspect
                const { data: inserted, error: insertError } = await (supabase as any)
                  .from('transactions')
                  .insert({
                    user_id: userData.id,
                    type: txType,
                    amount: tx.amount,
                    vendor: tx.vendor,
                    date: txDate,
                    tx_date: txDate,
                    category: category,
                    expense_category: tx.expense_category || tx.income_category || null,
                    expense_type: tx.expense_type || (txType === 'income' ? null : 'variable'),
                    payment_method: tx.payment_method || (documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
                    source: 'ocr',
                    status: 'duplicate_suspect',
                    notes: `חשד לכפל: קיימת תנועה דומה (${existingTx[0].id})`,
                    original_description: tx.description || '',
                    auto_categorized: !!tx.expense_category,
                    confidence_score: tx.confidence || 0.5,
                    batch_id: pendingBatchId,
                  })
                  .select('id')
                  .single();
                if (!insertError && inserted?.id) insertedIds.push(inserted.id);
                continue;
              }
            }

            const { data: inserted, error: insertError } = await (supabase as any)
              .from('transactions')
              .insert({
                user_id: userData.id,
                type: txType,
                amount: tx.amount,
                vendor: tx.vendor,
                date: txDate,
                tx_date: txDate,
                category: category,
                expense_category: tx.expense_category || tx.income_category || null,
                expense_type: tx.expense_type || (txType === 'income' ? null : 'variable'),
                payment_method: tx.payment_method || (documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
                source: 'ocr',
                status: 'pending',
                notes: tx.notes || tx.description || '',
                original_description: tx.description || '',
                auto_categorized: !!tx.expense_category,
                confidence_score: tx.confidence || 0.5,
                batch_id: pendingBatchId,
              })
              .select('id')
              .single();
            
            if (insertError) {
              insertErrors.push({ vendor: tx.vendor, error: insertError.message });
            } else if (inserted?.id) {
              insertedIds.push(inserted.id);
            }
          }
          
          console.log(`✅ Saved ${insertedIds.length}/${allTransactions.length} transactions`);
          console.log(`[Webhook] TX_INSERT_COMPLETE: saved=${insertedIds.length}/${allTransactions.length}, errors=${insertErrors.length}, batchId=${pendingBatchId}`);
          if (insertErrors.length > 0) {
            console.log(`[Webhook] TX_INSERT_ERRORS:`, JSON.stringify(insertErrors.slice(0, 5)));
          }

          // 🔍 Notify user about duplicate suspects
          if (duplicateSuspects.length > 0) {
            const dupList = duplicateSuspects.slice(0, 3).map(d =>
              `• ${d.vendor} - ₪${Math.abs(d.amount).toLocaleString('he-IL')} (${d.date})`
            ).join('\n');
            await greenAPI.sendMessage({
              phoneNumber: phoneNumber,
              message: `⚠️ *חשד לכפל תשלום (${duplicateSuspects.length}):*\n\n${dupList}\n\nכתוב *"כפל תשלום"* לראות ולטפל`,
            });
          }

          if (insertErrors.length > 0) {
            console.error(`❌ ${insertErrors.length} transaction insert errors:`);
            // Log first 5 errors with details
            insertErrors.slice(0, 5).forEach((err, idx) => {
              console.error(`   Error ${idx + 1}: ${err.vendor} - ${err.error}`);
            });
            
            // If ALL transactions failed - this is critical!
            if (insertedIds.length === 0 && insertErrors.length > 0) {
              console.error('🚨 CRITICAL: ALL transactions failed to insert!');
              console.error('   Possible causes:');
              console.error('   1. RLS policy blocking (check SUPABASE_SERVICE_ROLE_KEY)');
              console.error('   2. Constraint violation (check source/status/category values)');
              console.error('   3. Foreign key issue (check user_id exists)');
              console.error(`   Sample error: ${insertErrors[0].error}`);
            }
          }
          
          // חישוב סיכומים
          const incomeTransactions = allTransactions.filter((tx: any) => tx.type === 'income');
          const expenseTransactions = allTransactions.filter((tx: any) => tx.type === 'expense');
          const totalIncome = incomeTransactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
          const totalExpenses = expenseTransactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
          
          // 🆕 בדיקת תקופה - צריך לפחות 3 חודשים!
          const { 
            extractPeriodFromOCR, 
            getUserPeriodCoverage, 
            getCoverageMessage,
            updateDocumentPeriod 
          } = await import('@/lib/documents/period-tracker');
          
          // חילוץ תקופה מה-OCR
          const { start: periodStart, end: periodEnd } = extractPeriodFromOCR(ocrData);
          
          console.log(`📅 Document period: ${periodStart?.toISOString().split('T')[0] || 'unknown'} - ${periodEnd?.toISOString().split('T')[0] || 'unknown'}`);
          
          // שמירת תקופה למסמך uploaded_statements
          let savedDocumentId: string | null = null;
          
          if (periodStart && periodEnd) {
            console.log(`📄 Saving document with period: ${periodStart.toISOString().split('T')[0]} - ${periodEnd.toISOString().split('T')[0]}`);
            
            // יצירת רשומת מסמך
            const { data: docRecord, error: docError } = await (supabase as any)
              .from('uploaded_statements')
              .insert({
                user_id: userData.id,
                file_name: fileName,
                file_url: downloadUrl, // 🔧 FIX: חובה - URL המסמך המקורי
                file_type: documentType === 'credit' ? 'credit_statement' : 'bank_statement',
                document_type: documentType,
                status: 'completed',
                processed: true, // 🔧 FIX: סימון שהעיבוד הושלם
                period_start: periodStart.toISOString().split('T')[0],
                period_end: periodEnd.toISOString().split('T')[0],
                transactions_extracted: allTransactions.length,
                transactions_created: insertedIds.length, // 🔧 FIX: מספר התנועות שנוצרו בפועל
              })
              .select('id')
              .single();
            
            if (docError) {
              console.error('❌ Error saving document:', docError);
            } else if (docRecord?.id) {
              savedDocumentId = docRecord.id;
              console.log(`✅ Document saved with id: ${savedDocumentId}`);
              
              // עדכון תנועות עם document_id
              await (supabase as any)
                .from('transactions')
                .update({ document_id: docRecord.id })
                .eq('batch_id', pendingBatchId);
              
              // 🔧 FIX: עדכון ה-state ל-classification אחרי קבלת מסמך
              await (supabase as any)
                .from('users')
                .update({ 
                  onboarding_state: 'classification',
                  phase: 'data_collection'
                })
                .eq('id', userData.id);
              console.log(`✅ User state updated to classification`);
              
              // 🆕 סימון missing_document כ-uploaded
              if (documentType === 'credit' || documentType === 'bank') {
                const { markDocumentAsUploaded } = await import('@/lib/conversation/classification-flow');
                
                // חלץ כרטיס אשראי אם זה דוח אשראי
                let cardLast4: string | null = null;
                if (documentType === 'credit') {
                  for (const tx of allTransactions) {
                    const text = `${tx.vendor || ''} ${tx.description || ''}`;
                    const cardMatch = text.match(/\d{4}$/);
                    const starMatch = text.match(/\*{4}(\d{4})/);
                    if (cardMatch) {
                      cardLast4 = cardMatch[0];
                      break;
                    } else if (starMatch) {
                      cardLast4 = starMatch[1];
                      break;
                    }
                  }
                }
                
                await markDocumentAsUploaded(
                  userData.id,
                  documentType,
                  cardLast4,
                  docRecord.id
                );
              }
              
              // 🆕 קישור דוח אשראי לתנועות שדולגו
              if (documentType === 'credit') {
                // חלץ 4 ספרות אחרונות של הכרטיס מהתנועות החדשות
                const cardLast4Set = new Set<string>();
                for (const tx of allTransactions) {
                  // חפש מספרי כרטיס בvendor או בdescription
                  const text = `${tx.vendor || ''} ${tx.description || ''}`;
                  const cardMatch = text.match(/\d{4}$/);
                  if (cardMatch) {
                    cardLast4Set.add(cardMatch[0]);
                  }
                  // גם חפש פורמט ****1234
                  const starMatch = text.match(/\*{4}(\d{4})/);
                  if (starMatch) {
                    cardLast4Set.add(starMatch[1]);
                  }
                }
                
                if (cardLast4Set.size > 0) {
                  const cardNumbers = Array.from(cardLast4Set);
                  console.log(`💳 Found credit card numbers: ${cardNumbers.join(', ')}`);
                  
                  // מצא תנועות שדולגו כי חיכו לפירוט אשראי
                  for (const cardLast4 of cardNumbers) {
                    const { data: skippedTx, error: skipErr } = await (supabase as any)
                      .from('transactions')
                      .select('id, vendor, amount')
                      .eq('user_id', userData.id)
                      .eq('status', 'needs_credit_detail')
                      .or(`vendor.ilike.%${cardLast4}%,vendor.ilike.%ויזה ${cardLast4}%,vendor.ilike.%visa ${cardLast4}%`);
                    
                    if (!skipErr && skippedTx && skippedTx.length > 0) {
                      console.log(`🔗 Found ${skippedTx.length} skipped transactions for card ${cardLast4}`);
                      
                      // עדכן אותן ל-status: linked_to_credit (לא צריך לסווג שוב - הפירוט כבר יש)
                      await (supabase as any)
                        .from('transactions')
                        .update({ 
                          status: 'confirmed',
                          notes: `קושר לדוח אשראי ${cardLast4}`,
                        })
                        .eq('user_id', userData.id)
                        .eq('status', 'needs_credit_detail')
                        .or(`vendor.ilike.%${cardLast4}%,vendor.ilike.%ויזה ${cardLast4}%,vendor.ilike.%visa ${cardLast4}%`);
                      
                      console.log(`✅ Linked ${skippedTx.length} transactions to credit statement`);
                    }
                  }
                }
              }
            }
            // 🔗 Reconciliation: match credit detail to bank summaries
            if (savedDocumentId && documentType === 'credit') {
              try {
                const { matchCreditTransactions } = await import('@/lib/reconciliation/credit-matcher');
                await matchCreditTransactions(supabase, userData.id, savedDocumentId, 'credit_statement');
                console.log('✅ Credit reconciliation completed');
              } catch (reconErr) {
                console.error('⚠️ Credit reconciliation error:', reconErr);
              }
            }
          } else {
            console.warn('⚠️ No period detected - document will not be saved');
          }

          // בדיקת כיסוי תקופות - האם יש 3 חודשים?
          // 🆕 נחכה רגע לוודא שה-DB עודכן
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const periodCoverage = await getUserPeriodCoverage(userData.id);
          
          // 🆕 אם המסמך החדש לא נשמר אבל יש לנו תקופה - נחשב ידנית
          let actualCoverage = periodCoverage;
          if (periodStart && periodEnd && periodCoverage.totalMonths === 0) {
            console.log('⚠️ Document not in coverage yet - calculating manually');
            const { calculateCoverage } = await import('@/lib/documents/period-tracker');
            actualCoverage = calculateCoverage([{
              start: periodStart,
              end: periodEnd,
              source: 'bank' as const,
              documentType,
              uploadedAt: new Date(),
            }]);
          }
          
          console.log(`📊 Period coverage: ${actualCoverage.totalMonths} months, covered: ${actualCoverage.coveredMonths.join(', ')}, missing: ${actualCoverage.missingMonths.join(', ')}`);
          
          // 🆕 שימוש ב-φ Router להודעת סיכום
          const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
          await onDocumentProcessed(userData.id, phoneNumber);
          console.log('✅ φ Router sent document summary message');
          
          // 🆕 שמירת מסמכים חסרים ב-DB לבקשה עתידית
          if (ocrData.missing_documents && ocrData.missing_documents.length > 0) {
            for (const missingDoc of ocrData.missing_documents) {
              await (supabase as any)
                .from('missing_documents')
                .upsert({
                  user_id: userData.id,
                  document_type: missingDoc.type,
                  card_last_4: missingDoc.card_last_4 || null,
                  charge_date: missingDoc.charge_date || missingDoc.payment_date || missingDoc.salary_date || null,
                  period_start: missingDoc.period_start || null,
                  period_end: missingDoc.period_end || null,
                  expected_amount: missingDoc.charge_amount || missingDoc.salary_amount || missingDoc.payment_amount || null,
                  description: missingDoc.description || null,
                  status: 'pending',
                  priority: missingDoc.type === 'credit' ? 10 : (missingDoc.type === 'payslip' ? 5 : 1),
                }, {
                  onConflict: 'user_id,document_type,card_last_4',
                  ignoreDuplicates: true,
                });
            }
            
            console.log(`📋 Saved ${ocrData.missing_documents.length} missing documents requests`);
          }
          
          console.log(`✅ Document processed: ${allTransactions.length} transactions, coverage: ${actualCoverage.totalMonths} months`)
          
          // 🆕 עצור עדכוני התקדמות - הניתוח הסתיים!
          progressUpdater.stop();
          
        } catch (pdfError: any) {
          // 🆕 עצור עדכוני התקדמות גם במקרה של שגיאה
          progressUpdater.stop();
          
          console.error('❌ PDF Error:', pdfError);
          await greenAPI.sendMessage({
            phoneNumber,
            message: 'משהו השתבש בניתוח. נסה לשלוח שוב או צלם את המסך.',
          });
        }
      } else if (isExcel) {
        // 🆕 טיפול בקבצי Excel (XLSX, XLS, CSV)
        console.log(`📊 Processing Excel file: ${fileName}`);
        
        // זיהוי סוג המסמך מהשם
        const { data: userState } = await supabase
          .from('users')
          .select('onboarding_state, classification_context')
          .eq('id', userData.id)
          .single();
        
        const currentState = userState?.onboarding_state;
        const explicitDocType = userState?.classification_context?.waitingForDocument;
        
        let documentType = 'bank';
        let documentTypeHebrew = 'דוח בנק';
        
        const typeLabels: Record<string, string> = {
          'bank': 'דוח בנק',
          'credit': 'דוח אשראי',
          'payslip': 'תלוש משכורת',
          'loan': 'דוח הלוואות',
        };
        
        // זיהוי מהשם או מה-context
        if (explicitDocType && explicitDocType !== 'pending_type_selection') {
          documentType = explicitDocType;
          documentTypeHebrew = typeLabels[explicitDocType] || explicitDocType;
        } else if (lowerName.includes('אשראי') || lowerName.includes('credit') || 
                   lowerName.includes('ויזה') || lowerName.includes('visa')) {
          documentType = 'credit';
          documentTypeHebrew = typeLabels['credit'];
        } else if (lowerName.includes('בנק') || lowerName.includes('bank') || 
                   lowerName.includes('עוש') || lowerName.includes('תנועות')) {
          documentType = 'bank';
          documentTypeHebrew = typeLabels['bank'];
        }
        
        console.log(`📋 Excel document type: ${documentType}`);
        
        await greenAPI.sendMessage({
          phoneNumber,
          message: `📊 קיבלתי ${documentTypeHebrew} (Excel)!\n\nמתחיל לנתח... זה יקח כדקה.`,
        });
        
        const progressUpdater = startProgressUpdates(greenAPI, phoneNumber);
        
        try {
          // הורדת הקובץ
          const excelResponse = await fetch(downloadUrl);
          const excelBuffer = await excelResponse.arrayBuffer();
          const buffer = Buffer.from(excelBuffer);
          
          console.log(`📥 Excel downloaded: ${buffer.length} bytes`);
          
          // קריאת ה-Excel
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          
          // המרה לטקסט - עם הגבלת שורות!
          let excelText = '';
          let totalRows = 0;
          const MAX_ROWS_PER_SHEET = 100; // 🚀 הגבלה למניעת timeout
          let wasLimited = false;
          
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
            totalRows += jsonData.length;
            
            // 🚀 אם יש יותר מ-100 שורות, נגביל
            const rowsToProcess = jsonData.slice(0, MAX_ROWS_PER_SHEET);
            if (jsonData.length > MAX_ROWS_PER_SHEET) {
              wasLimited = true;
              console.log(`⚠️ Sheet "${sheetName}": limiting ${jsonData.length} rows → ${MAX_ROWS_PER_SHEET}`);
            }
            
            // המר את השורות המוגבלות ל-CSV
            const limitedSheet = XLSX.utils.aoa_to_sheet(rowsToProcess);
            const csvData = XLSX.utils.sheet_to_csv(limitedSheet);
            
            excelText += `Sheet: ${sheetName}\n`;
            excelText += csvData + '\n\n';
            
            console.log(`📄 Sheet "${sheetName}": ${jsonData.length} rows (processed: ${rowsToProcess.length})`);
          }
          
          console.log(`✅ Excel parsed: ${workbook.SheetNames.length} sheets, ${totalRows} total rows, ${excelText.length} chars`);
          
          // 🆕 הודעה למשתמש אם הקובץ גדול מדי
          if (wasLimited) {
            await greenAPI.sendMessage({
              phoneNumber,
              message: `⚠️ הקובץ גדול (${totalRows} שורות).\nמעבד את 100 השורות הראשונות של כל גיליון.\n\n💡 לניתוח מלא, שלח מסמכים לפי חודש.`,
            });
          }
          
          // הגבלת אורך לטוקנים (גיבוי נוסף)
          if (excelText.length > 30000) {
            excelText = excelText.substring(0, 30000) + '\n...(truncated)';
            console.log('⚠️ Excel text truncated to 30000 chars');
          }
          
          // שליחה ל-AI לניתוח
          const { getPromptForDocumentType } = await import('@/lib/ai/document-prompts');
          
          let expenseCategories: Array<{name: string; expense_type: string; category_group: string}> = [];
          if (documentType === 'credit' || documentType === 'bank') {
            const { data: categories } = await supabase
              .from('expense_categories')
              .select('name, expense_type, category_group')
              .eq('is_active', true);
            expenseCategories = categories || [];
          }
          
          const prompt = getPromptForDocumentType(
            documentType === 'credit' ? 'credit_statement' : 'bank_statement',
            excelText,
            expenseCategories
          );
          
          console.log(`🤖 Sending Excel data to Gemini Flash (${excelText.length} chars)...`);

          // 🆕 Gemini Flash for text-based document analysis
          const { chatWithGeminiProDeep } = await import('@/lib/ai/gemini-client');

          // ⏱️ With timeout to prevent Vercel 300s limit
          const aiPromise = chatWithGeminiProDeep(prompt, '').then(text => ({ output_text: text }));

          // ⏱️ Timeout of 120 seconds for AI (leaves room for DB operations)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI_TIMEOUT')), 120000)
          );

          let aiResponse: any;
          try {
            aiResponse = await Promise.race([aiPromise, timeoutPromise]);
          } catch (timeoutError: any) {
            if (timeoutError.message === 'AI_TIMEOUT') {
              console.error('⏱️ AI call timed out after 120 seconds');
              progressUpdater.stop();
              await greenAPI.sendMessage({
                phoneNumber,
                message: `⏱️ הקובץ גדול מדי ולוקח יותר מדי זמן לעבד.\n\n` +
                  `💡 נסה לשלוח קבצים קטנים יותר (עד 100 שורות).\n` +
                  `📅 עדיף: מסמך אחד לכל חודש.`,
              });
              return NextResponse.json({ status: 'success', message: 'timeout handled' });
            }
            throw timeoutError;
          }
          
          const content = aiResponse.output_text || '{}';
          console.log('🎯 Excel OCR Result:', content.substring(0, 500));
          
          let ocrData: any;
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            let jsonStr = jsonMatch ? jsonMatch[0] : content;
            
            // 🔧 FIX: Clean up common AI JSON errors
            // Fix trailing commas before closing brackets
            jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
            // Fix "null" as string → null
            jsonStr = jsonStr.replace(/:\s*"null"/g, ': null');
            // Fix invalid patterns like "123. - null"
            jsonStr = jsonStr.replace(/:\s*[\d.]+\s*-\s*null/g, ': null');
            
            ocrData = JSON.parse(jsonStr);
          } catch (parseError: any) {
            console.error('❌ Excel JSON parse error:', parseError.message);
            console.log('📝 Raw content length:', content.length);
            console.log('📝 First 500 chars:', content.substring(0, 500));
            console.log('📝 Last 500 chars:', content.substring(Math.max(0, content.length - 500)));
            ocrData = { document_type: 'bank_statement', transactions: [] };
          }
          
          // טיפול בפורמטים שונים (כמו ב-PDF)
          // 🔧 Helper function to determine transaction type (same as PDF)
          const determineTransactionTypeExcel = (tx: any): 'income' | 'expense' => {
            if (tx.type === 'income') return 'income';
            if (tx.type === 'expense') return 'expense';
            if (tx.income_category) return 'income';
            if (tx.expense_category || tx.expense_type) return 'expense';
            
            if (tx.balance_before !== undefined && tx.balance_after !== undefined) {
              const balanceBefore = typeof tx.balance_before === 'string' 
                ? parseFloat(tx.balance_before.replace(/[^\d.-]/g, '')) 
                : tx.balance_before;
              const balanceAfter = typeof tx.balance_after === 'string' 
                ? parseFloat(tx.balance_after.replace(/[^\d.-]/g, '')) 
                : tx.balance_after;
              if (!isNaN(balanceBefore) && !isNaN(balanceAfter)) {
                return balanceAfter > balanceBefore ? 'income' : 'expense';
              }
            }
            
            const amountStr = String(tx.amount || tx.original_amount || '');
            if (amountStr.includes('-') || amountStr.endsWith('-')) return 'expense';
            
            const desc = (tx.description || tx.vendor || '').toLowerCase();
            const expenseKeywords = ['חיוב', 'תשלום', 'ויזה', 'ויזא', 'מסטרקארד', 'משיכה', 'הו"ק', 'ארנונה', 'חשמל', 'מים', 'גז'];
            if (expenseKeywords.some(kw => desc.includes(kw))) return 'expense';
            
            const incomeKeywords = ['משכורת', 'שכר', 'העברה ל', 'זיכוי', 'החזר', 'קצבה', 'גמלה'];
            if (incomeKeywords.some(kw => desc.includes(kw))) return 'income';
            
            return 'expense';
          };
          
          let allTransactions: any[] = [];
          
          if (Array.isArray(ocrData.transactions)) {
            allTransactions = ocrData.transactions.map((tx: any) => ({
              ...tx,
              type: determineTransactionTypeExcel(tx)
            }));
          } else if (ocrData.transactions && typeof ocrData.transactions === 'object') {
            const { income = [], expenses = [], loan_payments = [], savings_transfers = [] } = ocrData.transactions;
            allTransactions = [
              ...income.map((tx: any) => ({ ...tx, type: 'income' })),
              ...expenses.map((tx: any) => ({ ...tx, type: 'expense' })),
              ...loan_payments.map((tx: any) => ({ ...tx, type: 'expense', expense_category: tx.expense_category || 'החזר הלוואה' })),
              ...savings_transfers.map((tx: any) => ({ ...tx, type: 'expense', expense_category: tx.expense_category || 'חיסכון' })),
            ];
          }
          
          console.log(`📊 Extracted ${allTransactions.length} transactions from Excel`);
          
          // עצור עדכוני התקדמות - הניתוח הסתיים!
          progressUpdater.stop();
          
          // ספירת הכנסות והוצאות - לוגיקה מתוקנת
          const incomeCount = allTransactions.filter(tx => tx.type === 'income').length;
          const expenseCount = allTransactions.filter(tx => tx.type === 'expense').length;
          
          // שליחת הודעה למשתמש - הניתוח הסתיים!
          await greenAPI.sendMessage({
            phoneNumber,
            message: `✅ מצוין! זיהיתי ${allTransactions.length} תנועות:\n\n` +
              `💚 ${incomeCount} הכנסות\n` +
              `💸 ${expenseCount} הוצאות\n\n` +
              `מסדר את הנתונים... זה יקח כמה שניות 📊`,
          });
          
          // יצירת batch ID ייחודי
          const pendingBatchId = `excel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Helper to convert DD/MM/YYYY to YYYY-MM-DD with validation
          const parseDate = (dateStr: string | undefined): string => {
            if (!dateStr) return new Date().toISOString().split('T')[0];
            
            let year: number, month: number, day: number;
            
            // Try DD/MM/YYYY format
            const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyy) {
              day = parseInt(ddmmyyyy[1], 10);
              month = parseInt(ddmmyyyy[2], 10);
              year = parseInt(ddmmyyyy[3], 10);
            } 
            // Try YYYY-MM-DD format
            else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              const parts = dateStr.split('-');
              year = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10);
              day = parseInt(parts[2], 10);
            }
            // Try to parse with Date
            else {
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
              return new Date().toISOString().split('T')[0];
            }
            
            // Validate and fix invalid dates (like Feb 29 in non-leap year)
            const maxDays = new Date(year, month, 0).getDate(); // Get last day of month
            if (day > maxDays) day = maxDays;
            
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          };
          
          // הכנת התנועות ל-Batch Insert
          console.log(`📦 Preparing ${allTransactions.length} transactions for batch insert...`);
          
          const transactionsToInsert = allTransactions
            .filter((tx: any) => Math.abs(tx.amount || 0) > 0)
            .map((tx: any) => {
              const isIncome = tx.type === 'income' || (tx.type !== 'expense' && tx.amount > 0);
              return {
                user_id: userData.id,
                type: isIncome ? 'income' : 'expense',
                amount: Math.abs(tx.amount || 0),
                vendor: tx.vendor || tx.payee || tx.description || 'לא ידוע',
                original_description: tx.description || tx.vendor || '',
                notes: tx.notes || '',
                tx_date: parseDate(tx.date),
                category: isIncome ? null : (tx.expense_category || tx.category || null),
                income_category: isIncome ? (tx.income_category || tx.category || null) : null,
                expense_type: tx.expense_type || (isIncome ? null : 'variable'),
                payment_method: tx.payment_method || (documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
                source: 'excel',
                status: 'pending',
                batch_id: pendingBatchId,
                auto_categorized: !!tx.expense_category,
                confidence_score: tx.confidence || 0.5,
              };
            });
          
          // Batch Insert - הרבה יותר מהיר מאחד אחד!
          const { data: insertedTx, error: insertError } = await supabase
            .from('transactions')
            .insert(transactionsToInsert)
            .select('id');
          
          if (insertError) {
            console.error('❌ Batch insert error:', insertError);
            throw new Error(`Failed to save transactions: ${insertError.message}`);
          }
          
          const savedCount = insertedTx?.length || 0;
          console.log(`✅ Batch inserted ${savedCount} transactions`);
          
          // חישוב תקופה לשמירת המסמך - תמיד מהתנועות עצמן (יותר מדויק מ-AI)
          let periodStart: string | null = null;
          let periodEnd: string | null = null;
          
          // חשב מהתנועות עצמן - הכי מדויק!
          if (transactionsToInsert.length > 0) {
            const dates = transactionsToInsert
              .map((tx: any) => new Date(tx.tx_date))
              .filter((d: Date) => !isNaN(d.getTime()));
            
            if (dates.length > 0) {
              periodStart = new Date(Math.min(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
              periodEnd = new Date(Math.max(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
            }
          }
          
          console.log(`📅 Period calculated from transactions: ${periodStart} - ${periodEnd}`);
          
          // שמירת רשומת המסמך
          const { data: docRecord, error: docError } = await supabase
            .from('uploaded_statements')
            .insert({
              user_id: userData.id,
              file_url: downloadUrl,
              file_name: fileName,
              file_type: documentType === 'credit' ? 'credit_statement' : 'bank_statement',
              document_type: documentType,
              status: 'completed',
              processed: true,
              period_start: periodStart,
              period_end: periodEnd,
              transactions_extracted: allTransactions.length,
              transactions_created: savedCount,
            })
            .select('id')
            .single();
          
          if (docError) {
            console.error('⚠️ Document record error (non-fatal):', docError);
          } else if (docRecord?.id) {
            // עדכון התנועות עם document_id
            await supabase
              .from('transactions')
              .update({ document_id: docRecord.id })
              .eq('batch_id', pendingBatchId);
            console.log(`✅ Document saved: ${docRecord.id}`);
            
            // 🆕 סימון missing_document כ-uploaded
            if (documentType === 'credit' || documentType === 'bank') {
              const { markDocumentAsUploaded } = await import('@/lib/conversation/classification-flow');
              
              // חלץ כרטיס אשראי אם זה דוח אשראי
              let cardLast4: string | null = null;
              if (documentType === 'credit') {
                for (const tx of transactionsToInsert) {
                  const text = `${tx.vendor || ''} ${tx.description || ''}`;
                  const cardMatch = text.match(/\d{4}$/);
                  const starMatch = text.match(/\*{4}(\d{4})/);
                  if (cardMatch) {
                    cardLast4 = cardMatch[0];
                    break;
                  } else if (starMatch) {
                    cardLast4 = starMatch[1];
                    break;
                  }
                }
              }
              
              await markDocumentAsUploaded(
                userData.id,
                documentType,
                cardLast4,
                docRecord.id
              );
            }
          }
          
          // עדכון סטטוס משתמש
          await supabase
            .from('users')
            .update({ onboarding_state: 'classification', phase: 'data_collection' })
            .eq('id', userData.id);
          
          // קריאה לתהליך הסיווג
          const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
          await onDocumentProcessed(userData.id, phoneNumber);
          
          console.log(`✅ Excel processing complete: ${savedCount}/${allTransactions.length} transactions saved`);
          
        } catch (excelError: any) {
          progressUpdater.stop();
          console.error('❌ Excel Error:', excelError);
          await greenAPI.sendMessage({
            phoneNumber,
            message: 'משהו השתבש בניתוח ה-Excel 😕\n\nאפשר לנסות לשמור כ-PDF או לשלוח צילום מסך.',
          });
        }
      } else {
        await greenAPI.sendMessage({
          phoneNumber,
          message: '📎 קיבלתי את הקובץ!\n\nאני תומך ב-PDF, Excel (XLSX/XLS/CSV) ותמונות.\n\nאפשר לשלוח בפורמט אחר?',
        });
      }
    } else if (messageType === 'audioMessage' || messageType === 'voiceMessage') {
      // Voice/audio messages - not supported yet
      const greenAPI = getGreenAPIClient();
      await greenAPI.sendMessage({
        phoneNumber,
        message: `🎤 קיבלתי הודעה קולית!\n\nלצערי אני עדיין לא תומך בהודעות קוליות.\n\n💡 כתוב לי טקסט או שלח תמונה/PDF.`,
      });
    } else if (messageType === 'videoMessage') {
      const greenAPI = getGreenAPIClient();
      await greenAPI.sendMessage({
        phoneNumber,
        message: `🎬 קיבלתי וידאו!\n\nאני לא יכול לעבד וידאו.\n\n💡 שלח תמונה של הקבלה/דוח במקום.`,
      });
    } else if (messageType === 'listResponseMessage') {
      // Handle list selection responses - route selectedRowId to phi-router
      const selectedRowId = payload.messageData?.listResponseMessage?.selectedRowId || '';
      console.log('[Webhook] LIST_RESPONSE: rowId=' + selectedRowId);

      if (selectedRowId) {
        const { routeMessage } = await import('@/lib/conversation/phi-router');
        const routerResult = await routeMessage(userData.id, phoneNumber, selectedRowId);

        return NextResponse.json({
          status: 'list_response',
          success: routerResult.success,
        });
      }
    } else if (messageType === 'stickerMessage' || messageType === 'contactMessage' ||
               messageType === 'locationMessage' || messageType === 'pollMessage') {
      // Catch-all for unsupported but known message types
      const greenAPI = getGreenAPIClient();
      await greenAPI.sendMessage({
        phoneNumber,
        message: `👋 קיבלתי!\n\nאני עובד עם טקסט, תמונות ומסמכים (PDF/Excel).\n\n💡 כתוב *"עזרה"* לראות מה אפשר לעשות.`,
      });
    } else if (messageType && messageType !== 'extendedTextMessage' && messageType !== 'quotedMessage') {
      // Unknown message type - still respond so user isn't left hanging
      console.log(`⚠️ Unknown message type: ${messageType}`);
      const greenAPI = getGreenAPIClient();
      await greenAPI.sendMessage({
        phoneNumber,
        message: `👋 קיבלתי!\n\nכתוב לי טקסט, שלח תמונה או מסמך ואני אטפל בזה.\n\nכתוב *"עזרה"* לעוד אפשרויות.`,
      });
    }

    return NextResponse.json({
      status: 'success',
      messageId: savedMessage.id
    });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}

// Allow GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'GreenAPI Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}

// Dead code removed: handleAIChat, fetchUserContext, handleConfirmTransaction,
// handleEditTransaction, handleCategorySelection, handleSplitTransaction,
// handlePaymentMethod (~530 lines). Migrated to φ Router.
//
// END OF FILE
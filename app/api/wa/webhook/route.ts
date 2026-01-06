// @ts-nocheck
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

// 🆕 הודעות מכינות לפני יצירת גרף
const CHART_PREPARING_MESSAGES = [
  '🎨 שניה, מכין לך משהו יפה...',
  '📊 רגע, מציירים את הנתונים שלך...',
  '✨ מכין תמונה מיוחדת בשבילך...',
  '🖼️ עובד על הויזואליזציה...',
  '🎯 שניה, מארגן את המספרים בתמונה...',
];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🆕 Helper functions לפורמט תאריכים לעברית
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function formatHebrewMonth(date: Date): string {
  return `${HEBREW_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatMonthFromYYYYMM(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const monthIndex = parseInt(month) - 1;
  return `${HEBREW_MONTHS[monthIndex]} ${year}`;
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
    const payload: GreenAPIWebhookPayload = await request.json();

    console.log('📱 GreenAPI Webhook received:', payload.typeWebhook);

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

    // אימות webhook (אופציונלי - תלוי ב-GreenAPI setup)
    const webhookSecret = process.env.GREEN_API_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature');
      // TODO: implement signature verification if needed
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
    
    console.log('📞 Raw phone:', rawPhoneNumber, '→ Normalized:', phoneNumber);
    
    // נסה למצוא משתמש בכמה פורמטים
    const phoneVariants = [
      phoneNumber,                                    // 972547667775
      phoneNumber.replace(/^972/, '0'),              // 0547667775
      phoneNumber.replace(/^0/, '972'),              // 972547667775 (מ-0547667775)
    ];
    
    console.log('🔍 Trying phone variants:', phoneVariants);
    
    // מציאת משתמש לפי מספר טלפון (נסה כל הפורמטים)
    const { data: users } = await supabase
      .from('users')
      .select('id, name, wa_opt_in, phone')
      .in('phone', phoneVariants);
    
    const user = users?.[0];

    if (!user) {
      console.log('❌ User not found for any phone variant:', phoneVariants);
      return NextResponse.json({ 
        status: 'error', 
        message: 'User not found' 
      }, { status: 404 });
    }
    
    console.log('✅ User found:', user);

    const userData = user as any;

    // 🆕 אם המשתמש לא אישר עדיין WhatsApp - מאשר אוטומטית ומתחיל אונבורדינג
    if (!userData.wa_opt_in) {
      console.log('🚀 Auto-enabling WhatsApp for user:', phoneNumber);
      
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

    const messageType = payload.messageData?.typeMessage;
    // messageId כבר הוגדר למעלה

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
    if (messageType === 'buttonsResponseMessage') {
      const buttonId = payload.messageData?.buttonsResponseMessage?.buttonId || '';
      const buttonText = payload.messageData?.buttonsResponseMessage?.buttonText || '';
      
      console.log('🔘 Button pressed:', buttonId, buttonText);

      // 🎯 מעביר ל-φ Router כטקסט רגיל
      const { routeMessage } = await import('@/lib/conversation/phi-router');
      const result = await routeMessage(userData.id, phoneNumber, buttonId);
      
      console.log(`[φ Router] Button result: success=${result.success}`);
      
      return NextResponse.json({
        status: 'button_response',
        success: result.success,
      });
    }
    // טיפול לפי סוג הודעה - עם Orchestrator! 🤖
    else if (messageType === 'textMessage') {
      const text = payload.messageData?.textMessageData?.textMessage || '';
      console.log('📝 Text message:', text);

      const greenAPI = getGreenAPIClient();
      
      // 🆕 RIGID ROUTER - לוגיקה קשיחה בלי AI להחלטות
      {
        console.log('🎯 Using Rigid Router (deterministic logic)');
        
        try {
          // שמירת הודעה נכנסת
          const { error: insertError } = await supabase.from('wa_messages').insert({
            user_id: userData.id,
            direction: 'incoming',
            msg_type: 'text',
            payload: { text, messageId, timestamp: new Date().toISOString() },
            status: 'delivered',
            provider_msg_id: messageId,
          });
          
          if (insertError) {
            console.error('❌ Failed to save incoming message:', insertError);
          } else {
            console.log('✅ Incoming message saved to wa_messages');
          }
          
          // 🎯 קריאה ל-φ Router - לוגיקה נקייה וקשיחה
          const { routeMessage } = await import('@/lib/conversation/phi-router');
          const result = await routeMessage(userData.id, phoneNumber, text);
          
          console.log(`[φ Router] Result: success=${result.success}, newState=${result.newState || 'unchanged'}`);
          
          // הודעות נשלחות ישירות מה-router, אין צורך לשלוח כאן
          
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
      console.log('🖼️ Image message received. Full messageData:', JSON.stringify(payload.messageData, null, 2));
      
      // 🔧 GreenAPI שולח את הנתונים ב-fileMessageData!
      const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl || payload.messageData?.downloadUrl;
      const caption = payload.messageData?.fileMessageData?.caption || payload.messageData?.caption || '';
      
      console.log('📥 Download URL:', downloadUrl);
      console.log('📝 Caption:', caption);

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

          // 🆕 GPT-5.2 with Responses API - effort: 'none' for fast response!
          const visionResponse = await openai.responses.create({
            model: 'gpt-5.2-2025-12-11',
            input: [
              {
                role: 'user',
                content: [
                  { type: 'input_text', text: systemPrompt + '\n\n' + userPrompt },
                  { type: 'input_image', image_url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
                ]
              }
            ],
            reasoning: { effort: 'none' }, // ⚡ Fast mode - no deep thinking
            text: { verbosity: 'low' }, // ⚡ Concise output
          });

          const aiText = visionResponse.output_text || '{}';
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
          const receiptDate = ocrData.receipt_date || transactions[0]?.date || new Date().toISOString().split('T')[0];
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
              const txDate = tx.date || receiptDate;
              
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
                console.error('Transaction data:', { user_id: userData.id, amount: tx.amount, status: 'pending', source: 'ocr' });
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
              const txDate = tx.date || receiptDate;
              
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
      console.log('📄 Document message received. Full messageData:', JSON.stringify(payload.messageData, null, 2));
      
      // 🔧 GreenAPI שולח את הנתונים ב-fileMessageData!
      const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl || payload.messageData?.downloadUrl;
      const fileName = payload.messageData?.fileMessageData?.fileName || payload.messageData?.fileName || 'document';
      const caption = payload.messageData?.fileMessageData?.caption || payload.messageData?.caption || '';
      
      console.log('📥 Document URL:', downloadUrl);
      console.log('📝 File name:', fileName);
      
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
          
          console.log(`🤖 Starting PDF analysis (type: ${documentType}) with OpenAI Files API...`);
          
          // העלאה ל-Files API
          const fs = require('fs').promises;
          const tempFilePath = `/tmp/${Date.now()}-${fileName}`;
          await fs.writeFile(tempFilePath, buffer);
          
          let fileUpload: any;
          try {
            fileUpload = await openai.files.create({
              file: require('fs').createReadStream(tempFilePath),
              purpose: 'assistants'
            });
            console.log(`✅ PDF uploaded to OpenAI Files API: ${fileUpload.id}`);
          } finally {
            await fs.unlink(tempFilePath).catch(() => {});
          }
          
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
            null, // text - null כי אנחנו שולחים את הקובץ ישירות
            expenseCategories
          );
          
          console.log(`📝 Using prompt for document type: ${documentType} (${prompt.length} chars)`);

          // 🆕 נסה GPT-5.1 קודם, אח"כ GPT-4o
          let content = '';
          try {
            console.log('🔄 Trying GPT-5.1 with Responses API (direct PDF file)...');
            const gpt52Response = await openai.responses.create({
              model: 'gpt-5.2-2025-12-11',
              input: [
              {
                role: 'user',
                content: [
                    { type: 'input_file', file_id: fileUpload.id },
                    { type: 'input_text', text: prompt }
                  ]
                }
              ],
              reasoning: { effort: 'low' },
              text: { verbosity: 'low' },
              max_output_tokens: 32000
            });
            content = gpt52Response.output_text || '{}';
            console.log('✅ GPT-5.2 succeeded');
          } catch (gpt52Error: any) {
            console.log(`❌ GPT-5.2 failed: ${gpt52Error.message}`);
            throw gpt52Error; // No fallback - GPT-5.2 is the primary model
          }
          
          // Clean up uploaded file from OpenAI + context
          try {
            await openai.files.del(fileUpload.id);
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
            ocrData = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          } catch {
            ocrData = { document_type: 'credit_statement', transactions: [] };
          }

          // 🆕 Handle different response formats:
          // - Credit: transactions = array
          // - Bank: transactions = { income: [], expenses: [], loan_payments: [], savings_transfers: [] }
          let allTransactions: any[] = [];
          
          if (Array.isArray(ocrData.transactions)) {
            // Credit statement format - transactions is array
            allTransactions = ocrData.transactions;
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
          
          console.log(`📊 Parsed ${allTransactions.length} transactions (income: ${ocrData.transactions?.income?.length || 0}, expenses: ${ocrData.transactions?.expenses?.length || 0})`);
          
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
          
          for (const tx of allTransactions) {
            const txDate = tx.date || new Date().toISOString().split('T')[0];
            const txType = tx.type || 'expense';
            // 🔧 FIX: category חובה - נשתמש בקטגוריה מה-AI או ברירת מחדל
            const category = tx.expense_category || tx.income_category || tx.category || 
              (txType === 'income' ? 'הכנסה אחרת' : 'הוצאה אחרת');
            
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
                status: 'proposed', // 🔧 FIX: שונה מ-pending ל-proposed (תואם לסיווג)
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
          if (insertErrors.length > 0) {
            console.error(`❌ ${insertErrors.length} transaction insert errors:`, insertErrors.slice(0, 3));
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
                  current_phase: 'classification'
                })
                .eq('id', userData.id);
              console.log(`✅ User state updated to classification`);
              
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
          
          // המרה לטקסט
          let excelText = '';
          let totalRows = 0;
          
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csvData = XLSX.utils.sheet_to_csv(sheet);
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            excelText += `Sheet: ${sheetName}\n`;
            excelText += csvData + '\n\n';
            totalRows += jsonData.length;
            
            console.log(`📄 Sheet "${sheetName}": ${jsonData.length} rows`);
          }
          
          console.log(`✅ Excel parsed: ${workbook.SheetNames.length} sheets, ${totalRows} rows, ${excelText.length} chars`);
          
          // הגבלת אורך לטוקנים
          if (excelText.length > 50000) {
            excelText = excelText.substring(0, 50000) + '\n...(truncated)';
            console.log('⚠️ Excel text truncated to 50000 chars');
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
          
          console.log(`🤖 Sending Excel data to GPT-5.2 (${excelText.length} chars)...`);
          
          // 🆕 GPT-5.2 with Responses API - effort: 'none' for fast response!
          const aiResponse = await openai.responses.create({
            model: 'gpt-5.2-2025-12-11',
            input: prompt,
            reasoning: { effort: 'none' }, // ⚡ Fast mode - no deep thinking
            text: { verbosity: 'low' }, // ⚡ Concise output
          });
          
          const content = aiResponse.output_text || '{}';
          console.log('🎯 Excel OCR Result:', content.substring(0, 500));
          
          let ocrData: any;
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            ocrData = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          } catch {
            ocrData = { document_type: 'bank_statement', transactions: [] };
          }
          
          // טיפול בפורמטים שונים (כמו ב-PDF)
          let allTransactions: any[] = [];
          
          if (Array.isArray(ocrData.transactions)) {
            allTransactions = ocrData.transactions;
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
          const incomeCount = allTransactions.filter(tx => {
            // הכנסה = type הוא income, או סכום חיובי ללא type מפורש
            if (tx.type === 'income') return true;
            if (tx.type === 'expense') return false;
            return tx.amount > 0;
          }).length;
          const expenseCount = allTransactions.filter(tx => {
            // הוצאה = type הוא expense, או סכום שלילי ללא type מפורש
            if (tx.type === 'expense') return true;
            if (tx.type === 'income') return false;
            return tx.amount < 0;
          }).length;
          
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
          
          // חישוב תקופה לשמירת המסמך
          let periodStart: string | null = null;
          let periodEnd: string | null = null;
          
          if (ocrData?.period?.start_date && ocrData?.period?.end_date) {
            periodStart = parseDate(ocrData.period.start_date);
            periodEnd = parseDate(ocrData.period.end_date);
          } else if (ocrData?.report_info?.period_start && ocrData?.report_info?.period_end) {
            periodStart = parseDate(ocrData.report_info.period_start);
            periodEnd = parseDate(ocrData.report_info.period_end);
          } else if (allTransactions.length > 0) {
            const dates = allTransactions
              .map((tx: any) => new Date(parseDate(tx.date)))
              .filter((d: Date) => !isNaN(d.getTime()));
            
            if (dates.length > 0) {
              periodStart = new Date(Math.min(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
              periodEnd = new Date(Math.max(...dates.map((d: Date) => d.getTime()))).toISOString().split('T')[0];
            }
          }
          
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
          }
          
          // עדכון סטטוס משתמש
          await supabase
            .from('users')
            .update({ onboarding_state: 'classification', current_phase: 'classification' })
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

/**
 * Handle AI Chat
 * שליחת הודעה ל-AI וקבלת תשובה חכמה
 * הפונקציה מחזירה גם זיהוי הוצאה (אם רלוונטי)
 */
async function handleAIChat(
  supabase: any,
  userId: string,
  message: string,
  phoneNumber: string
): Promise<{ response: string; detected_expense?: any; tokens_used: number }> {
  try {
    // 1. שליפת context של המשתמש
    const context = await fetchUserContext(supabase, userId);

    // 2. שליפת 5 הודעות אחרונות (היסטוריה)
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // היסטוריה בסדר הפוך (ישן → חדש)
    const history = (recentMessages || []).reverse();

    // 3. בניית messages ל-OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      // System prompt
      { role: 'system', content: SYSTEM_PROMPT },
      // Context
      { role: 'system', content: `הנה המידע על המשתמש:\n\n${buildContextMessage(context)}` },
      // היסטוריה
      ...history.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      // ההודעה החדשה
      { role: 'user', content: message },
    ];

    // 4. קריאה ל-OpenAI (GPT-5-nano for fast chat)
    // Build combined input for Responses API
    const systemContext = `${SYSTEM_PROMPT}\n\nהנה המידע על המשתמש:\n\n${buildContextMessage(context)}`;
    const historyText = history.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n');
    const fullInput = `${systemContext}\n\n${historyText}\n\nuser: ${message}`;
    
    const chatResponse = await openai.responses.create({
      model: 'gpt-5-nano-2025-08-07',
      input: fullInput,
      reasoning: { effort: 'none' }, // Fast chat - no reasoning
    });

    const aiResponse = chatResponse.output_text || 'סליחה, לא הבנתי. תנסה שוב? 🤔';
    const tokensUsed = chatResponse.usage?.total_tokens || 0;

    // 5. זיהוי הוצאה (אם יש)
    const detectedExpense = parseExpenseFromAI(aiResponse);

    // 6. שמירת הודעת המשתמש
    await supabase.from('chat_messages').insert({
      user_id: userId,
      role: 'user',
      content: message,
      context_used: context,
    });

    // 7. שמירת תשובת ה-AI
    await supabase.from('chat_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: aiResponse,
      tokens_used: tokensUsed,
      model: 'gpt-5-nano',
      detected_expense: detectedExpense,
      expense_created: false,
    });

    return {
      response: aiResponse,
      detected_expense: detectedExpense,
      tokens_used: tokensUsed,
    };
  } catch (error) {
    console.error('❌ AI Chat error:', error);
    
    // Fallback response
    return {
      response: 'סליחה, משהו השתבש. תנסה שוב? 🤔',
      tokens_used: 0,
    };
  }
}

/**
 * שליפת context של המשתמש
 * (זהה לפונקציה ב-/api/wa/chat)
 */
async function fetchUserContext(supabase: any, userId: string): Promise<UserContext> {
  const context: UserContext = {};

  // 1. פרופיל פיננסי + Phase
  const { data: user } = await supabase
    .from('users')
    .select('name, phase')
    .eq('id', userId)
    .single();

  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profile) {
    context.profile = {
      name: user?.name,
      age: profile.age,
      monthlyIncome: profile.total_monthly_income,
      totalFixedExpenses: profile.total_fixed_expenses,
      availableBudget: (profile.total_monthly_income || 0) - (profile.total_fixed_expenses || 0),
      totalDebt: profile.total_debt,
      currentSavings: profile.current_savings,
    };
  }

  // 2. Phase נוכחי
  if (user?.phase) {
    context.phase = {
      current: user.phase,
      progress: 50, // TODO: חשב באמת מהדאטה
    };
  }

  // 3. תקציב חודשי (אם קיים)
  const currentMonth = new Date().toISOString().substring(0, 7);
  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single();

  if (budget) {
    const remaining = budget.total_budget - budget.total_spent;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const daysRemaining = daysInMonth - currentDay;

    context.budget = {
      totalBudget: budget.total_budget,
      totalSpent: budget.total_spent,
      remaining,
      daysRemaining,
      status: budget.status,
    };
  }

  // 4. יעדים פעילים
  const { data: goals } = await supabase
    .from('goals')
    .select('name, target_amount, current_amount')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(5);

  if (goals && goals.length > 0) {
    context.goals = goals.map((goal: any) => ({
      name: goal.name,
      targetAmount: goal.target_amount,
      currentAmount: goal.current_amount || 0,
      progress: Math.round(((goal.current_amount || 0) / goal.target_amount) * 100),
    }));
  }

  // 5. תנועות אחרונות
  const { data: transactions } = await supabase
    .from('transactions')
    .select('tx_date, vendor, amount, category')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .order('tx_date', { ascending: false })
    .limit(5);

  if (transactions && transactions.length > 0) {
    context.recentTransactions = transactions.map((tx: any) => ({
      date: new Date(tx.tx_date).toLocaleDateString('he-IL'),
      description: tx.vendor || tx.category,
      amount: tx.amount,
      category: tx.category,
    }));
  }

  // 6. התראות אחרונות (3 ימים)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: alerts } = await supabase
    .from('alerts')
    .select('type, message, created_at')
    .eq('user_id', userId)
    .gte('created_at', threeDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(3);

  if (alerts && alerts.length > 0) {
    context.alerts = alerts.map((alert: any) => ({
      type: alert.type,
      message: alert.message,
      createdAt: new Date(alert.created_at).toLocaleDateString('he-IL'),
    }));
  }

  // 7. הלוואות פעילות
  const { data: loans } = await supabase
    .from('loans')
    .select('loan_type, lender_name, current_balance, monthly_payment, interest_rate, remaining_payments')
    .eq('user_id', userId)
    .eq('active', true)
    .order('current_balance', { ascending: false })
    .limit(10);

  if (loans && loans.length > 0) {
    context.loans = loans.map((loan: any) => ({
      type: loan.loan_type === 'mortgage' ? 'משכנתא' : 
            loan.loan_type === 'personal' ? 'הלוואה אישית' : 
            loan.loan_type === 'car' ? 'הלוואת רכב' : 'הלוואה',
      lender: loan.lender_name,
      amount: loan.current_balance || 0,
      monthlyPayment: loan.monthly_payment || 0,
      interestRate: loan.interest_rate,
      remainingPayments: loan.remaining_payments,
    }));
  }

  // 8. ביטוחים פעילים
  const { data: insurance } = await supabase
    .from('insurance')
    .select('insurance_type, provider, monthly_premium, active')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(10);

  if (insurance && insurance.length > 0) {
    context.insurance = insurance.map((ins: any) => ({
      type: ins.insurance_type,
      provider: ins.provider,
      monthlyPremium: ins.monthly_premium,
      active: ins.active,
    }));
  }

  // 9. מנוי
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, billing_cycle')
    .eq('user_id', userId)
    .single();

  if (subscription) {
    context.subscriptions = {
      plan: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billing_cycle,
    };
  }

  return context;
}

/**
 * Handle Confirm Transaction
 * אישור transaction - שינוי סטטוס מ-proposed ל-confirmed
 */
async function handleConfirmTransaction(
  supabase: any,
  userId: string,
  transactionId: string,
  phoneNumber: string
) {
  const greenAPI = getGreenAPIClient();

  try {
    // עדכן transaction
    const { data: transaction, error } = await supabase
      .from('transactions')
      .update({ status: 'confirmed' })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error confirming transaction:', error);
      await greenAPI.sendMessage({
        phoneNumber,
        message: 'אופס! משהו השתבש באישור ההוצאה 😕',
      });
      return;
    }

    console.log('✅ Transaction confirmed:', transactionId);

    // שלח הודעת אישור + שאל על קטגוריה (אם אין)
    if (!transaction.category_id) {
      // קבל קטגוריות
      const { data: categories } = await supabase
        .from('budget_categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('active', true)
        .order('priority', { ascending: false })
        .limit(3);

      if (categories && categories.length > 0) {
        const buttons = categories.map((cat: any) => ({
          buttonId: `category_${transactionId}_${cat.id}`,
          buttonText: cat.name,
        }));

        await greenAPI.sendButtons({
          phoneNumber,
          message: `נרשם! 💚\n\nבאיזו קטגוריה?`,
          buttons,
        });
      } else {
        await greenAPI.sendMessage({
          phoneNumber,
          message: `נרשם! 💚\n\n${transaction.amount} ₪${transaction.vendor ? ` ב${transaction.vendor}` : ''}`,
        });
      }
    } else {
      await greenAPI.sendMessage({
        phoneNumber,
        message: `נרשם! 💚\n\n${transaction.amount} ₪${transaction.vendor ? ` ב${transaction.vendor}` : ''}`,
      });
    }
  } catch (error) {
    console.error('❌ Confirm error:', error);
  }
}

/**
 * Handle Edit Transaction
 * בקשת עריכה - שליחת הוראות למשתמש
 */
async function handleEditTransaction(
  supabase: any,
  userId: string,
  transactionId: string,
  phoneNumber: string
) {
  const greenAPI = getGreenAPIClient();

  try {
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (!transaction) {
      await greenAPI.sendMessage({
        phoneNumber,
        message: 'לא מצאתי את ההוצאה 🤔',
      });
      return;
    }

    await greenAPI.sendMessage({
      phoneNumber,
      message: `בסדר! כתוב את הסכום והמקום הנכונים 👇\n\nלדוגמה: "45 ₪ קפה"`,
    });

    // מחק את ה-proposed transaction
    await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', userId);
  } catch (error) {
    console.error('❌ Edit error:', error);
  }
}

/**
 * Handle Category Selection
 * בחירת קטגוריה ל-transaction
 */
async function handleCategorySelection(
  supabase: any,
  userId: string,
  transactionId: string,
  categoryId: string,
  phoneNumber: string
) {
  const greenAPI = getGreenAPIClient();

  try {
    const { data: transaction, error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select('*, budget_categories(name)')
      .single();

    if (error) {
      console.error('❌ Error setting category:', error);
      return;
    }

    const categoryName = transaction.budget_categories?.name || 'לא ידוע';

    await greenAPI.sendMessage({
      phoneNumber,
      message: `מעולה! נרשם תחת "${categoryName}" 📊`,
    });
  } catch (error) {
    console.error('❌ Category selection error:', error);
  }
}

/**
 * Handle Split Transaction
 * פיצול transaction למספר קטגוריות
 */
async function handleSplitTransaction(
  supabase: any,
  userId: string,
  transactionId: string,
  phoneNumber: string
) {
  const greenAPI = getGreenAPIClient();

  await greenAPI.sendMessage({
    phoneNumber,
    message: 'פיצול הוצאה 🔀\n\nכתוב כך:\n50 ₪ קפה, 30 ₪ חנייה',
  });

  // TODO: implement split logic in text message handler
}

/**
 * Handle Payment Method Selection
 * עדכון אמצעי תשלום להוצאות מהקבלה
 */
async function handlePaymentMethod(
  supabase: any,
  userId: string,
  receiptId: string,
  paymentType: string,
  phoneNumber: string
) {
  const greenAPI = getGreenAPIClient();

  try {
    // מצא את כל ההוצאות שקשורות לקבלה הזו (proposed status)
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'ocr')
      .eq('status', 'proposed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (fetchError || !transactions || transactions.length === 0) {
      await greenAPI.sendMessage({
        phoneNumber,
        message: 'לא מצאתי הוצאות לעדכן 🤔',
      });
      return;
    }

    // עדכן את כל ההוצאות האחרונות עם אמצעי התשלום
    const paymentMethodMap: Record<string, string> = {
      credit: 'credit',
      cash: 'cash',
      debit: 'debit',
    };

    const paymentMethod = paymentMethodMap[paymentType] || 'cash';

    for (const tx of transactions) {
      await supabase
        .from('transactions')
        .update({
          payment_method: paymentMethod,
          status: 'confirmed', // אישור אוטומטי
        })
        .eq('id', tx.id);
    }

    // הודעת אישור
    const paymentText = paymentType === 'credit' ? 'אשראי 💳' : 
                       paymentType === 'cash' ? 'מזומן 💵' : 
                       'חיוב 🏦';

    await greenAPI.sendMessage({
      phoneNumber,
      message: `מעולה! ✅\n\nההוצאות נשמרו כ-${paymentText}\n\nתוכל לראות אותן ב-Dashboard 📊`,
    });

    console.log('✅ Payment method updated:', { userId, receiptId, paymentMethod, count: transactions.length });

  } catch (error) {
    console.error('❌ Payment method error:', error);
    await greenAPI.sendMessage({
      phoneNumber,
      message: 'אופס! משהו השתבש 😕',
    });
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


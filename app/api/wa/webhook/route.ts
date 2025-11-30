// @ts-nocheck
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildContextMessage, parseExpenseFromAI, type UserContext } from '@/lib/ai/system-prompt';
import { EXPENSE_CATEGORIES_SYSTEM_PROMPT } from '@/lib/ai/expense-categories-prompt';
import { processMessage } from '@/lib/conversation/orchestrator';
import { updateContext, loadContext } from '@/lib/conversation/context-manager';

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

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const payload: GreenAPIWebhookPayload = await request.json();

    console.log('📱 GreenAPI Webhook received:', payload.typeWebhook);

    // אימות webhook (אופציונלי - תלוי ב-GreenAPI setup)
    const webhookSecret = process.env.GREEN_API_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature');
      // TODO: implement signature verification if needed
    }

    // התעלם מהודעות יוצאות ומסוגים לא רלוונטיים
    if (payload.typeWebhook === 'outgoingMessageStatus') {
      return NextResponse.json({ status: 'ignored', reason: 'outgoing message' });
    }

    // רק הודעות נכנסות
    if (payload.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ status: 'ignored', reason: 'not incoming message' });
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

    if (!userData.wa_opt_in) {
      console.log('⚠️ User has not opted in to WhatsApp:', phoneNumber);
      return NextResponse.json({ 
        status: 'error', 
        message: 'User not opted in' 
      }, { status: 403 });
    }

    const messageType = payload.messageData?.typeMessage;
    const messageId = payload.idMessage;

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

    // טיפול בלחיצה על כפתור
    if (messageType === 'buttonsResponseMessage') {
      const buttonId = payload.messageData?.buttonsResponseMessage?.buttonId || '';
      const buttonText = payload.messageData?.buttonsResponseMessage?.buttonText || '';
      
      console.log('🔘 Button pressed:', buttonId, buttonText);

      // טיפול לפי סוג הכפתור
      if (buttonId.startsWith('confirm_')) {
        const transactionId = buttonId.replace('confirm_', '');
        await handleConfirmTransaction(supabase, userData.id, transactionId, phoneNumber);
      } else if (buttonId.startsWith('edit_')) {
        const transactionId = buttonId.replace('edit_', '');
        await handleEditTransaction(supabase, userData.id, transactionId, phoneNumber);
      } else if (buttonId.startsWith('category_')) {
        const [_, transactionId, categoryId] = buttonId.split('_');
        await handleCategorySelection(supabase, userData.id, transactionId, categoryId, phoneNumber);
      } else if (buttonId.startsWith('split_')) {
        const transactionId = buttonId.replace('split_', '');
        await handleSplitTransaction(supabase, userData.id, transactionId, phoneNumber);
      }
    }
    // טיפול לפי סוג הודעה - עם Orchestrator! 🤖
    else if (messageType === 'textMessage') {
      const text = payload.messageData?.textMessageData?.textMessage || '';
      console.log('📝 Text message:', text);

      const greenAPI = getGreenAPIClient();
      
      // 🆕 בדיקה אם זה אישור/ביטול תנועות ממתינות
      const lowerText = text.toLowerCase().trim();
      const isApproval = lowerText === 'אשר' || lowerText === 'אשר הכל' || lowerText === 'כן' || lowerText === 'אישור';
      const isCancellation = lowerText === 'בטל' || lowerText === 'לא' || lowerText === 'ביטול';
      const isCorrectionRequest = lowerText.startsWith('תקן ') || lowerText.startsWith('שנה ');
      
      // טען את ה-context לבדוק אם יש תנועות ממתינות
      const currentContext = await loadContext(userData.id);
      
      // 🆕 בדיקה אם יש classification session פעיל
      const hasClassificationSession = currentContext?.ongoingTask?.taskType === 'classification_questions';
      
      if (hasClassificationSession) {
        console.log('📋 Processing classification response...');
        
        const { 
          loadClassificationSession, 
          handleUserResponse,
          clearClassificationSession 
        } = await import('@/lib/conversation/flows/document-classification-session');
        
        const session = await loadClassificationSession(userData.id);
        
        if (session) {
          const result = await handleUserResponse(session, text, supabase);
          
      await greenAPI.sendMessage({
        phoneNumber,
            message: result.message,
          });
          
          if (result.done) {
            // סיימנו - ניקוי session
            await clearClassificationSession(userData.id);
            console.log('✅ Classification session completed');
          }
          
          return NextResponse.json({ 
            status: 'classification_response', 
            done: result.done 
          });
        }
      }
      
      // 🆕 Legacy: תמיכה לאחור עבור אישור/ביטול ישן
      const hasPendingApproval = currentContext?.ongoingTask?.taskType === 'transaction_approval';
      
      if (hasPendingApproval && (isApproval || isCancellation || isCorrectionRequest)) {
        const taskProgress = currentContext?.ongoingTask?.data as any;
        
        if (isApproval && taskProgress?.transactionIds) {
          // ✅ אישור כל התנועות
          await greenAPI.sendMessage({
            phoneNumber,
            message: '⏳ מאשר את התנועות...',
          });
          
          const { data: updatedCount } = await (supabase as any)
            .from('transactions')
            .update({ status: 'approved' })
            .eq('user_id', userData.id)
            .eq('batch_id', taskProgress.batchId)
            .select('id');
          
          // ניקוי ה-context
          await updateContext(userData.id, {
            ongoingTask: undefined,
            taskProgress: undefined,
          } as any);
          
          await greenAPI.sendMessage({
            phoneNumber,
            message: `✅ מעולה! אישרתי ${updatedCount?.length || taskProgress.transactionCount} תנועות.\n\n💰 סה"כ: ${taskProgress.totalAmount?.toLocaleString('he-IL')} ₪\n\nהתנועות נשמרו בהיסטוריה שלך.\n\nמה עכשיו? 🚀\n• שלח לי עוד דוח\n• שאל אותי שאלה\n• כתוב "סיכום" לראות את המצב`,
          });
          
          return NextResponse.json({ status: 'transactions_approved' });
        }
        
        if (isCancellation && taskProgress?.batchId) {
          // ❌ ביטול כל התנועות
          await (supabase as any)
            .from('transactions')
            .delete()
            .eq('user_id', userData.id)
            .eq('batch_id', taskProgress.batchId);
          
          // ניקוי ה-context
          await updateContext(userData.id, {
            ongoingTask: undefined,
            taskProgress: undefined,
          } as any);
          
          await greenAPI.sendMessage({
            phoneNumber,
            message: '🗑️ בוטל! מחקתי את כל התנועות מהדוח.\n\nאפשר לשלוח דוח אחר או לנסות שוב 📄',
          });
          
          return NextResponse.json({ status: 'transactions_cancelled' });
        }
        
        if (isCorrectionRequest) {
          // ✏️ תיקון תנועה ספציפית (TODO: implement full flow)
          await greenAPI.sendMessage({
            phoneNumber,
            message: '✏️ תיקון תנועות - בקרוב!\n\nלעת עתה, כתוב "אשר" לאשר הכל או "בטל" להתחיל מחדש.',
          });
          
          return NextResponse.json({ status: 'correction_requested' });
        }
      }

      // 🆕 שליחה ל-Orchestrator לטיפול חכם (6 שלבים!)
      const orchestratorResult = await processMessage(
        userData.id,
        text,
        'text',
        {
          userId: userData.id,
          userName: userData.name || '',
          phoneNumber: phoneNumber,
        }
      );

      // המרה לפורמט ישן לתאימות
      const aiResult = {
        response: orchestratorResult.message,
        detected_expense: orchestratorResult.action?.type === 'create_transaction' 
          ? { 
              expense_detected: true,
              ...orchestratorResult.action.data,
              needs_confirmation: true 
            } 
          : null,
        tokens_used: 0,
      };

      // Log the result
      console.log('🤖 Orchestrator result:', { 
        intent: orchestratorResult.metadata?.intent,
        hasAction: !!orchestratorResult.action,
        stateChanged: orchestratorResult.metadata?.stateChanged 
      });
      
      // אם AI זיהה הוצאה → צור transaction
      let expenseCreated = false;
      if (aiResult.detected_expense && aiResult.detected_expense.expense_detected) {
        const expense = aiResult.detected_expense;
        
        // נסה לזהה קטגוריה אוטומטית
        let category = expense.category || null;
        let expenseType = null;
        let categoryGroup = null;
        let autoCategorized = !!expense.category;

        if (!autoCategorized && expense.description) {
        try {
          const categorizeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/expenses/categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: expense.description,
                vendor: expense.vendor,
                amount: expense.amount
            })
          });

          if (categorizeResponse.ok) {
            const categorizeData = await categorizeResponse.json();
            if (categorizeData.matched && categorizeData.confidence > 0.5) {
              category = categorizeData.suggested_category;
              expenseType = categorizeData.expense_type;
              categoryGroup = categorizeData.category_group;
              autoCategorized = true;
            }
          }
        } catch (catError) {
          console.error('❌ Categorization error (non-critical):', catError);
          }
        }

        // אם צריך אישור → צור pending transaction
        if (expense.needs_confirmation) {
        const { data: transaction, error: txError } = await (supabase as any)
          .from('transactions')
          .insert({
            user_id: userData.id,
            type: 'expense',
              amount: expense.amount,
            category: category || 'other',
            expense_type: expenseType,
            expense_category: category, // 🆕 קטגוריה מדויקת
            category_group: categoryGroup,
            auto_categorized: autoCategorized,
              vendor: expense.vendor,
              notes: expense.description || text,
              source: 'whatsapp',
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            tx_date: new Date().toISOString().split('T')[0],
          })
          .select()
          .single();

          if (!txError && transaction) {
            console.log('✅ Pending transaction created:', transaction.id);
            expenseCreated = true; // 🆕 סימון שיצרנו הוצאה
            
            // עדכן chat_message שהוצאה נוצרה
            await supabase
              .from('chat_messages')
              .update({ expense_created: true })
              .eq('user_id', userData.id)
              .eq('role', 'assistant')
              .order('created_at', { ascending: false })
              .limit(1);
            
            // 🆕 שלח הודעה עם כפתורי אישור/עריכה (כמו בתמונה!)
            const displayCategory = category || 'אחר';
            const displayVendor = expense.vendor || 'לא צוין';
            
            await greenAPI.sendButtons({
              phoneNumber,
              message: `✅ הוצאה ממתינה לאישור\n\n💰 ${expense.amount} ₪\n🏪 ${displayVendor}\n📂 ${displayCategory}\n\nזה נכון?`,
              buttons: [
                { buttonId: `confirm_${transaction.id}`, buttonText: '✅ אישור' },
                { buttonId: `edit_${transaction.id}`, buttonText: '✏️ עריכה' },
              ],
            });
          }
        }
      }
      
      // 🆕 שלח את תשובת ה-AI רק אם לא יצרנו הוצאה עם כפתורים
      if (aiResult.response && !expenseCreated) {
        await sendWhatsAppMessage(phoneNumber, aiResult.response);
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

          // ניתוח OCR + AI (GPT-4o Vision) עם קטגוריות מדויקות
          console.log('🤖 Starting OCR analysis with GPT-4o Vision...');
          
          const visionResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `${EXPENSE_CATEGORIES_SYSTEM_PROMPT}

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

8. **בדיקה כפולה:** לפני שתחזיר את ה-amount, ודא שזה באמת סכום כסף (עם נקודה עשרונית או מספר שלם) ולא מספר קבלה, מספר קופה או מזהה אחר.`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'נתח את הקבלה/תדפיס הזה וחלץ את כל המידע. **שים לב מיוחד לתאריך!**\n\n**חשוב מאוד - זיהוי הסכום הנכון:**\n- זהה את הסכום ששולם בפועל - זה נמצא ליד "סה״כ כולל מע״מ" או "סה״כ" בתחתית הקבלה\n- אל תשתמש במספר הקבלה כעלות! (מספר קבלה = 36401)\n- אל תשתמש במספר הקופה כעלות! (מספר קופה = 000083)\n- דוגמה: אם רשום "מספר קופה: 000083" ו"סה״כ כולל מע״מ: 79" - הסכום הוא 79, לא 83!\n- מספר קופה/קבלה ≠ סכום כסף\n\n**חשוב מאוד - פורמט תאריכים ישראלי:**\n- תאריכים ישראליים הם בפורמט: יום.חודש.שנה (DD.MM.YY)\n- **לא** כמו בארה"ב! אם רשום "10.11.20" זה יום 10, חודש 11 (נובמבר), שנה 2020\n- החזר בפורמט ISO: "YYYY-MM-DD" (למשל: "2020-11-10")\n\nהחזר תשובה בפורמט JSON.'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${mimeType};base64,${base64Image}` }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 4000,
            response_format: { type: 'json_object' }, // 🔥 Force valid JSON
          });

          const aiText = visionResponse.choices[0].message.content || '{}';
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
                model: 'gpt-4o',
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
      
      // בדיקה אם זה PDF
      const isPDF = fileName.toLowerCase().endsWith('.pdf');
      
      if (isPDF) {
        // 🆕 זיהוי חכם של סוג המסמך לפי ה-state וה-context
        const currentContext = await loadContext(userData.id);
        const currentState = currentContext?.currentState;
        const explicitDocType = currentContext?.waitingForDocument;
        
        // 🎯 זיהוי סוג מסמך לפי:
        // 1. סוג מסמך שהוגדר במפורש ב-context (waitingForDocument)
        // 2. ה-state הנוכחי של המשתמש
        // 3. ניסיון זיהוי מהשם של הקובץ
        let documentType = 'bank'; // ברירת מחדל
        let documentTypeHebrew = 'דוח בנק';
        
        const lowerFileName = fileName.toLowerCase();
        
        if (explicitDocType && explicitDocType !== 'pending_type_selection') {
          // סוג מסמך הוגדר במפורש
          documentType = explicitDocType;
        } else if (currentState === 'onboarding_income' || currentState === 'data_collection') {
          // ב-onboarding - הבוט ביקש דוח בנק
          documentType = 'bank';
          documentTypeHebrew = 'דוח בנק';
        } else if (lowerFileName.includes('אשראי') || lowerFileName.includes('credit') || lowerFileName.includes('ויזה') || lowerFileName.includes('כאל') || lowerFileName.includes('מקס') || lowerFileName.includes('visa') || lowerFileName.includes('mastercard')) {
          documentType = 'credit';
          documentTypeHebrew = 'דוח אשראי';
        } else if (lowerFileName.includes('בנק') || lowerFileName.includes('bank') || lowerFileName.includes('עוש') || lowerFileName.includes('תנועות')) {
          documentType = 'bank';
          documentTypeHebrew = 'דוח בנק';
        } else if (lowerFileName.includes('תלוש') || lowerFileName.includes('משכורת') || lowerFileName.includes('שכר') || lowerFileName.includes('payslip')) {
          documentType = 'payslip';
          documentTypeHebrew = 'תלוש משכורת';
        } else if (lowerFileName.includes('הלוואה') || lowerFileName.includes('loan')) {
          documentType = 'loan';
          documentTypeHebrew = 'דוח הלוואות';
        } else if (lowerFileName.includes('משכנתא') || lowerFileName.includes('mortgage')) {
          documentType = 'mortgage';
          documentTypeHebrew = 'דוח משכנתא';
        } else if (lowerFileName.includes('פנסיה') || lowerFileName.includes('מסלקה') || lowerFileName.includes('pension')) {
          documentType = 'pension';
          documentTypeHebrew = 'דוח פנסיה';
        } else if (lowerFileName.includes('ביטוח') || lowerFileName.includes('insurance')) {
          documentType = 'insurance';
          documentTypeHebrew = 'דוח ביטוחים';
        }
        
        console.log(`📋 Document type detected: ${documentType} (state: ${currentState}, fileName: ${fileName})`);
        
        await greenAPI.sendMessage({
          phoneNumber,
          message: `📄 קיבלתי ${documentTypeHebrew}!\n\n📊 מנתח את המסמך עם AI... זה יכול לקחת כמה שניות ⏳`,
        });
        
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
            const gpt51Response = await openai.responses.create({
              model: 'gpt-5.1',
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
            content = gpt51Response.output_text || '{}';
            console.log('✅ GPT-5.1 succeeded');
          } catch (gpt51Error: any) {
            console.log(`❌ GPT-5.1 failed: ${gpt51Error.message}, trying GPT-4o...`);
            
            // Fallback to GPT-4o
            const visionResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{
                role: 'user',
                content: [
                  { type: 'file', file: { file_id: fileUpload.id } },
                  { type: 'text', text: prompt }
                ]
              }],
            temperature: 0.1,
              max_tokens: 16384,
              response_format: { type: 'json_object' }
            });
            content = visionResponse.choices[0]?.message?.content || '{}';
            console.log('✅ GPT-4o succeeded');
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

          // 🆕 שמירת התנועות ב-pending לסיווג אינטראקטיבי
          const pendingBatchId = `batch_${Date.now()}_${userData.id.substring(0, 8)}`;
          const insertedIds: string[] = [];
          
          for (const tx of allTransactions) {
            const txDate = tx.date || new Date().toISOString().split('T')[0];
            const txType = tx.type || 'expense';
            
            const { data: inserted } = await (supabase as any)
              .from('transactions')
              .insert({
                user_id: userData.id,
                type: txType,
                amount: tx.amount,
                vendor: tx.vendor,
                date: txDate,
                tx_date: txDate,
                category: tx.category || 'other',
                expense_category: tx.expense_category || tx.income_category || null,
                expense_type: tx.expense_type || (txType === 'income' ? null : 'variable'),
                payment_method: tx.payment_method || (documentType === 'credit' ? 'credit_card' : 'bank_transfer'),
                source: 'ocr',
                status: 'pending',
                notes: tx.notes || tx.description || '',
                original_description: tx.description || '',
                auto_categorized: !!tx.expense_category,  // true רק אם יש כבר קטגוריה
                confidence_score: tx.confidence || 0.5,
                batch_id: pendingBatchId,
              })
              .select('id')
              .single();
            
            if (inserted?.id) {
              insertedIds.push(inserted.id);
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
          
          // שמירת תקופה למסמך uploaded_statements אם יש כזה
          if (periodStart && periodEnd) {
            // יצירת רשומת מסמך אם לא קיימת
            const { data: docRecord } = await (supabase as any)
              .from('uploaded_statements')
              .insert({
                user_id: userData.id,
                file_name: fileName,
                file_type: documentType === 'credit' ? 'credit_statement' : 'bank_statement',
                document_type: documentType,
                status: 'completed',
                period_start: periodStart.toISOString().split('T')[0],
                period_end: periodEnd.toISOString().split('T')[0],
                transactions_extracted: allTransactions.length,
              })
              .select('id')
              .single();
            
            if (docRecord?.id) {
              // עדכון תנועות עם document_id
              await (supabase as any)
                .from('transactions')
                .update({ document_id: docRecord.id })
                .eq('batch_id', pendingBatchId);
            }
          }
          
          // בדיקת כיסוי תקופות - האם יש 3 חודשים?
          const periodCoverage = await getUserPeriodCoverage(userData.id);
          
          console.log(`📊 Period coverage: ${periodCoverage.totalMonths} months, missing: ${periodCoverage.missingMonths.join(', ')}`);
          
          // 🆕 Import classification session manager
          const { 
            createClassificationSession, 
            saveClassificationSession, 
            getInitialMessage,
            getNextQuestionBatch 
          } = await import('@/lib/conversation/flows/document-classification-session');
          
          // יצירת רשימת תנועות לסיווג
          const transactionsToClassify = allTransactions.map((tx: any, idx: number) => ({
            id: insertedIds[idx] || `temp_${idx}`,
            date: tx.date || new Date().toISOString().split('T')[0],
            vendor: tx.vendor || 'לא ידוע',
            amount: tx.amount || 0,
            type: (tx.type || 'expense') as 'income' | 'expense',
            currentCategory: tx.expense_category || tx.income_category || null,
            suggestedCategory: tx.expense_category || null,
          }));
          
          // יצירת classification session
          const session = await createClassificationSession(
            userData.id,
            pendingBatchId,
            transactionsToClassify,
            totalIncome,
            totalExpenses,
            ocrData.missing_documents || []  // מסמכים חסרים (כרטיסי אשראי וכו')
          );
          
          // שמירת ה-session
          await saveClassificationSession(userData.id, session);
          
          // 🆕 בניית הודעה משולבת - כוללת סיכום + מסמכים חסרים
          let combinedMessage = '';
          
          // קודם מראים מה נמצא בדוח הזה
          combinedMessage += `📊 *דוח ${documentType === 'credit' ? 'אשראי' : 'בנק'} עובד בהצלחה!*\n\n`;
          combinedMessage += `📅 תקופה: ${periodStart ? formatHebrewMonth(periodStart) : '?'} - ${periodEnd ? formatHebrewMonth(periodEnd) : '?'}\n`;
          combinedMessage += `📝 תנועות: ${allTransactions.length}\n`;
          combinedMessage += `💚 הכנסות: ${totalIncome.toLocaleString('he-IL')} ₪\n`;
          combinedMessage += `💸 הוצאות: ${totalExpenses.toLocaleString('he-IL')} ₪\n\n`;
          
          // 🆕 הצגת מסמכים חסרים שזוהו מהדוח
          const missingDocs = ocrData.missing_documents || [];
          if (missingDocs.length > 0) {
            combinedMessage += `📋 *זיהיתי מסמכים שיעזרו להשלים את התמונה:*\n\n`;
            
            // קיבוץ לפי סוג
            const byType: Record<string, any[]> = {};
            for (const doc of missingDocs) {
              const type = doc.type || 'other';
              if (!byType[type]) byType[type] = [];
              byType[type].push(doc);
            }
            
            const typeLabels: Record<string, { icon: string; name: string; why: string }> = {
              credit: { icon: '💳', name: 'דוח אשראי', why: 'לראות פירוט הוצאות' },
              payslip: { icon: '💼', name: 'תלוש משכורת', why: 'לראות פנסיה, קה"ש, ניכויים' },
              mortgage: { icon: '🏠', name: 'דוח משכנתא', why: 'לראות יתרה, קרן וריבית' },
              loan: { icon: '🏦', name: 'דוח הלוואות', why: 'לראות פירוט כל ההלוואות' },
              insurance: { icon: '🛡️', name: 'פוליסת ביטוח', why: 'לראות כיסויים ותנאים' },
              pension: { icon: '👴', name: 'דוח פנסיה', why: 'לראות יתרה ודמי ניהול' },
              savings: { icon: '💰', name: 'דוח חיסכון', why: 'לראות יתרות ותשואות' },
            };
            
            for (const [type, docs] of Object.entries(byType)) {
              const label = typeLabels[type] || { icon: '📄', name: type, why: '' };
              if (docs.length === 1) {
                const doc = docs[0];
                combinedMessage += `${label.icon} *${label.name}*`;
                if (doc.card_last_4) combinedMessage += ` (****${doc.card_last_4})`;
                if (doc.employer) combinedMessage += ` - ${doc.employer}`;
                if (doc.provider) combinedMessage += ` - ${doc.provider}`;
                combinedMessage += `\n   ${label.why}\n`;
              } else {
                combinedMessage += `${label.icon} *${docs.length} ${label.name}*\n   ${label.why}\n`;
              }
            }
            
            combinedMessage += `\n💡 *למה זה חשוב?*\n`;
            combinedMessage += `כשאני רואה משכורת בבנק, התלוש מראה לי כמה הולך לפנסיה.\n`;
            combinedMessage += `כשאני רואה חיוב אשראי, הדוח מראה לי על מה בדיוק הוצאת.\n`;
            combinedMessage += `ככה אני בונה לך תמונה מלאה! 📊\n\n`;
          }
          
          // בדיקה אם יש מספיק חודשים
          if (!periodCoverage.hasMinimumCoverage) {
            combinedMessage += `⚠️ *עוד משהו:* צריך לפחות 3 חודשים של נתונים.\n`;
            combinedMessage += `יש לי: ${periodCoverage.totalMonths} ${periodCoverage.totalMonths === 1 ? 'חודש' : 'חודשים'}\n`;
            
            if (periodCoverage.missingMonths.length > 0) {
              combinedMessage += `חסר: ${periodCoverage.missingMonths.map(formatMonthFromYYYYMM).join(', ')}\n\n`;
            }
          } else {
            combinedMessage += `✅ יש לי ${periodCoverage.totalMonths} חודשים - מעולה!\n\n`;
          }
          
          // הצעה להמשיך
          if (missingDocs.length > 0) {
            combinedMessage += `🎯 *מה עכשיו?*\n`;
            combinedMessage += `שלח לי עוד מסמכים (בכל סדר שנוח לך) או כתוב "נמשיך" אם אין לך כרגע.\n`;
          } else if (periodCoverage.hasMinimumCoverage) {
            // עכשיו ניתן להמשיך לסיווג
            const initialMessage = getInitialMessage(session);
            combinedMessage += initialMessage;
          }
          
          await greenAPI.sendMessage({
            phoneNumber,
            message: combinedMessage,
          });
          
          // אם יש מספיק נתונים ויש תנועות לסיווג, נשלח את השאלה הראשונה
          if (periodCoverage.hasMinimumCoverage && 
              (session.incomeToClassify.length > 0 || session.expensesToClassify.length > 0)) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const firstBatch = getNextQuestionBatch(session);
            if (!firstBatch.done) {
              await greenAPI.sendMessage({
                phoneNumber,
                message: firstBatch.message,
              });
              await saveClassificationSession(userData.id, session);
            }
          }
          
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
          
          console.log(`✅ Document processed: ${allTransactions.length} transactions, coverage: ${periodCoverage.totalMonths} months`)
          
        } catch (pdfError: any) {
          console.error('❌ PDF Error:', pdfError);
          await greenAPI.sendMessage({
            phoneNumber,
            message: 'משהו השתבש בניתוח ה-PDF 😕\n\nנסה לצלם את המסך או כתוב את הפרטים ידנית.',
          });
        }
      } else {
        await greenAPI.sendMessage({
          phoneNumber,
          message: '📎 קבלתי את הקובץ!\n\nכרגע אני תומך רק בתמונות ו-PDF.\n\nאפשר לצלם את המסמך במקום?',
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

    // 4. קריאה ל-OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'סליחה, לא הבנתי. תנסה שוב? 🤔';
    const tokensUsed = completion.usage?.total_tokens || 0;

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
      model: 'gpt-4o',
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
 * Send WhatsApp message via GreenAPI (legacy - use client instead)
 * @deprecated Use getGreenAPIClient().sendMessage() instead
 */
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  const greenAPI = getGreenAPIClient();
  return await greenAPI.sendMessage({ phoneNumber, message });
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


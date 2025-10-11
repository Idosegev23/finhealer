import { createClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GreenAPI Webhook Handler
 * מקבל הודעות WhatsApp נכנסות (טקסט ותמונות)
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
    const supabase = await createClient();
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
    const phoneNumber = payload.senderData.chatId.replace('@c.us', '');
    
    // מציאת משתמש לפי מספר טלפון
    const { data: user } = await supabase
      .from('users')
      .select('id, name, wa_opt_in')
      .eq('phone', phoneNumber)
      .single();

    if (!user) {
      console.log('❌ User not found for phone:', phoneNumber);
      return NextResponse.json({ 
        status: 'error', 
        message: 'User not found' 
      }, { status: 404 });
    }

    if (!user.wa_opt_in) {
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
      user_id: user.id,
      direction: 'in',
      msg_type: messageType === 'imageMessage' ? 'image' : 'text',
      payload: payload,
      provider_msg_id: messageId,
      status: 'delivered',
    };

    const { data: savedMessage, error: msgError } = await supabase
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
        await handleConfirmTransaction(supabase, user.id, transactionId, phoneNumber);
      } else if (buttonId.startsWith('edit_')) {
        const transactionId = buttonId.replace('edit_', '');
        await handleEditTransaction(supabase, user.id, transactionId, phoneNumber);
      } else if (buttonId.startsWith('category_')) {
        const [_, transactionId, categoryId] = buttonId.split('_');
        await handleCategorySelection(supabase, user.id, transactionId, categoryId, phoneNumber);
      } else if (buttonId.startsWith('split_')) {
        const transactionId = buttonId.replace('split_', '');
        await handleSplitTransaction(supabase, user.id, transactionId, phoneNumber);
      }
    }
    // טיפול לפי סוג הודעה
    else if (messageType === 'textMessage') {
      const text = payload.messageData?.textMessageData?.textMessage || '';
      console.log('📝 Text message:', text);

      // נסה לזהות הוצאה
      const parsedTransaction = await parseExpenseFromText(text);
      
      if (parsedTransaction) {
        // צור transaction מוצעת
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'expense',
            amount: parsedTransaction.amount,
            vendor: parsedTransaction.vendor,
            description: text,
            source: 'wa_text',
            status: 'proposed',
            tx_date: new Date().toISOString().split('T')[0],
          })
          .select()
          .single();

        if (txError) {
          console.error('❌ Error creating transaction:', txError);
        } else {
          console.log('✅ Transaction created:', transaction.id);
          
          // שלח הודעת אישור
          await sendWhatsAppMessage(
            phoneNumber,
            `נרשמה הוצאה של ${parsedTransaction.amount} ₪${parsedTransaction.vendor ? ` ב${parsedTransaction.vendor}` : ''} ✅\n\nזה נכון? [כן] [לא]`
          );
        }
      } else {
        // לא הצלחנו לזהות - שאל
        await sendWhatsAppMessage(
          phoneNumber,
          'לא הבנתי 🤔\n\nכתוב למשל: "50 ₪ קפה" או "רכישה 120 שקל"'
        );
      }
    } else if (messageType === 'imageMessage') {
      const downloadUrl = payload.messageData?.downloadUrl;
      const caption = payload.messageData?.caption || '';
      
      console.log('🖼️ Image message:', downloadUrl);

      if (downloadUrl) {
        const greenAPI = getGreenAPIClient();
        
        await greenAPI.sendMessage({
          phoneNumber,
          message: 'קיבלתי את התמונה! 📸\n\nאני מעבד אותה עכשיו...',
        });

        try {
          // שמור receipt בסטטוס pending - יעובד מאוחר יותר
          const { data: receipt, error: receiptError } = await supabase
            .from('receipts')
            .insert({
              user_id: user.id,
              storage_path: downloadUrl,
              ocr_text: null,
              total_amount: null,
              vendor: null,
              tx_date: null,
              confidence: null,
              status: 'pending',
            })
            .select()
            .single();

          if (receiptError) {
            console.error('❌ Error creating receipt:', receiptError);
            await greenAPI.sendMessage({
              phoneNumber,
              message: 'אופס! משהו השתבש בשמירת הקבלה 😕\n\nנסה שוב או כתוב את הסכום ידנית.',
            });
            return NextResponse.json({ status: 'error', error: receiptError.message }, { status: 500 });
          }

          // הודע שהקבלה נשמרה
          await greenAPI.sendMessage({
            phoneNumber,
            message: '✅ הקבלה נשמרה!\n\nכרגע תוכל לראות אותה ב-Dashboard. בקרוב נוסיף זיהוי אוטומטי 🚀\n\nבינתיים, כתוב את הסכום ידנית, למשל: "50 ₪ קפה"',
          });

          console.log('✅ Receipt saved:', receipt.id);
        } catch (saveError: any) {
          console.error('❌ Save Error:', saveError);
          await greenAPI.sendMessage({
            phoneNumber,
            message: 'לא הצלחתי לשמור את הקבלה 📄\n\nכתוב את הסכום ידנית, למשל: "50 ₪ קפה"',
          });
        }
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
 * Parse expense from text message
 * זיהוי סכומים והוצאות מטקסט חופשי
 */
async function parseExpenseFromText(text: string): Promise<{ amount: number; vendor?: string } | null> {
  // Regex patterns לזיהוי סכומים
  const patterns = [
    /(\d+(?:\.\d{1,2})?)\s*₪/,           // "50 ₪"
    /(\d+(?:\.\d{1,2})?)\s*שקל/,         // "50 שקל"
    /₪\s*(\d+(?:\.\d{1,2})?)/,           // "₪ 50"
    /שקל\s*(\d+(?:\.\d{1,2})?)/,         // "שקל 50"
    /רכישה\s+(\d+(?:\.\d{1,2})?)/,      // "רכישה 50"
    /קניתי\s+(\d+(?:\.\d{1,2})?)/,      // "קניתי 50"
    /שילמתי\s+(\d+(?:\.\d{1,2})?)/,     // "שילמתי 50"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      
      // נסה לזהות ספק/מקום
      let vendor: string | undefined;
      
      // מילות מפתח נפוצות
      const vendorPatterns = [
        /(?:ב|מ|ל)(\w+)/,                  // "בקפה", "מסופר", "לטסט"
        /(\w+)\s+(?:₪|שקל)/,               // "קפה 50 ₪"
      ];

      for (const vPattern of vendorPatterns) {
        const vMatch = text.match(vPattern);
        if (vMatch && vMatch[1] !== match[1]) {
          vendor = vMatch[1];
          break;
        }
      }

      return { amount, vendor };
    }
  }

  return null;
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

// Allow GET for testing
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'GreenAPI Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}


// @ts-nocheck
import { createServiceClient } from '@/lib/supabase/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildContextMessage, parseExpenseFromAI, type UserContext } from '@/lib/ai/system-prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    // טיפול לפי סוג הודעה - עם AI! 🤖
    else if (messageType === 'textMessage') {
      const text = payload.messageData?.textMessageData?.textMessage || '';
      console.log('📝 Text message:', text);

      // שליחת ההודעה ל-AI לטיפול חכם
      const aiResult = await handleAIChat(supabase, userData.id, text, phoneNumber);
      
      // אם AI זיהה הוצאה → צור transaction
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
            
            // עדכן chat_message שהוצאה נוצרה
            await supabase
              .from('chat_messages')
              .update({ expense_created: true })
              .eq('user_id', userData.id)
              .eq('role', 'assistant')
              .order('created_at', { ascending: false })
              .limit(1);
            
            // שלח הודעה עם קישור לדף אישור
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';
            await sendWhatsAppMessage(phoneNumber, 
              `✅ ההוצאה נקלטה במערכת!\n\n💰 ${expense.amount} ₪${expense.vendor ? ` | ${expense.vendor}` : ''}\n\n👉 אשר את ההוצאה כאן:\n${siteUrl}/dashboard/expenses/pending`
            );
          }
        }
      }
      
      // שלח את תשובת ה-AI ב-WhatsApp
      if (aiResult.response) {
        await sendWhatsAppMessage(phoneNumber, aiResult.response);
      }
    } else if (messageType === 'imageMessage') {
      const downloadUrl = payload.messageData?.downloadUrl;
      const caption = payload.messageData?.caption || '';
      
      console.log('🖼️ Image message:', downloadUrl);

      if (downloadUrl) {
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

          // ניתוח OCR + AI (GPT-5 New API)
          console.log('🤖 Starting OCR analysis with OpenAI Vision (GPT-5)...');
          
          const visionResponse = await openai.responses.create({
            model: 'gpt-5',
            input: [
              {
                role: 'system',
                content: `אתה מומחה לניתוח קבלות ותדפיסי בנק/אשראי בעברית.
חלץ את המידע הבא בפורמט JSON:
{
  "document_type": "receipt | bank_statement | credit_statement",
  "transactions": [
    {
      "amount": <number>,
      "vendor": "שם בית העסק",
      "date": "YYYY-MM-DD",
      "category": "food | transport | shopping | health | entertainment | education | housing | utilities | other",
      "detailed_category": "תת-קטגוריה",
      "expense_frequency": "fixed | temporary | special | one_time",
      "description": "תיאור",
      "confidence": <0.0-1.0>
    }
  ]
}`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: 'נתח את הקבלה/תדפיס הזה וחלץ את כל המידע.'
                  },
                  {
                    type: 'input_image',
                    image_url: `data:${mimeType};base64,${base64Image}`
                  }
                ]
              }
            ],
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

          // שמירת קבלה + יצירת הוצאות
          const { data: receipt } = await (supabase as any)
            .from('receipts')
            .insert({
              user_id: userData.id,
              storage_path: downloadUrl,
              ocr_text: aiText,
              amount: transactions[0]?.amount || null,
              vendor: transactions[0]?.vendor || null,
              tx_date: transactions[0]?.date || new Date().toISOString().split('T')[0],
              confidence: transactions[0]?.confidence || 0.5,
              status: 'completed',
              metadata: {
                document_type: ocrData.document_type,
                source: 'whatsapp',
                model: 'gpt-4o',
              },
            })
            .select()
            .single();

          console.log('✅ Receipt saved:', receipt?.id);

          // יצירת הוצאות - כולן pending לאישור
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';
          
          if (transactions.length <= 2) {
            // קבלה רגילה עם 1-2 פריטים
            for (const tx of transactions) {
              await (supabase as any)
                .from('transactions')
                .insert({
                  user_id: userData.id,
                  type: 'expense',
                  amount: tx.amount,
                  vendor: tx.vendor,
                  date: tx.date || new Date().toISOString().split('T')[0],
                  tx_date: tx.date || new Date().toISOString().split('T')[0],
                  category: tx.category || 'other',
                  detailed_category: tx.detailed_category,
                  expense_frequency: tx.expense_frequency || 'one_time',
                  payment_method: null,
                  source: 'ocr',
                  status: 'pending', // ממתין לאישור
                  notes: tx.description || '',
                  original_description: tx.description || '',
                  auto_categorized: true,
                  confidence_score: tx.confidence || 0.5,
                });
            }

            const tx = transactions[0];
            await greenAPI.sendMessage({
              phoneNumber,
              message: `✅ קבלה נקלטה במערכת!\n\n💰 ${tx.amount} ₪\n🏪 ${tx.vendor}\n📂 ${tx.category}\n\n👉 אשר את ההוצאה כאן:\n${siteUrl}/dashboard/expenses/pending`,
            });
          } else {
            // תדפיס אשראי/בנק עם הרבה תנועות
            for (const tx of transactions) {
              await (supabase as any)
                .from('transactions')
                .insert({
                  user_id: userData.id,
                  type: 'expense',
                  amount: tx.amount,
                  vendor: tx.vendor,
                  date: tx.date || new Date().toISOString().split('T')[0],
                  tx_date: tx.date || new Date().toISOString().split('T')[0],
                  category: tx.category || 'other',
                  detailed_category: tx.detailed_category,
                  expense_frequency: tx.expense_frequency || 'one_time',
                  payment_method: ocrData.document_type === 'credit_statement' ? 'credit' : null,
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


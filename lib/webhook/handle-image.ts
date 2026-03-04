// @ts-nocheck
import { NextResponse } from 'next/server';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { EXPENSE_CATEGORIES_SYSTEM_PROMPT } from '@/lib/ai/expense-categories-prompt';
import type { WebhookContext } from './types';
import { safeParseDateToISO, maskUserId, safeFetch } from './utils';

/**
 * Handle image messages: download, OCR via Gemini Vision, create receipt + transactions.
 */
export async function handleImage(ctx: WebhookContext): Promise<NextResponse> {
  const { userData, phoneNumber, payload, supabase } = ctx;

  console.log('🖼️ Image message received, mime:', payload.messageData?.fileMessageData?.mimeType || 'unknown');

  const downloadUrl = payload.messageData?.fileMessageData?.downloadUrl || payload.messageData?.downloadUrl;
  const caption = payload.messageData?.fileMessageData?.caption || payload.messageData?.caption || '';

  console.log('📥 Download URL:', downloadUrl);
  console.log('📝 Caption:', caption);
  console.log(`[Webhook] IMAGE_RECEIVED: downloadUrl=${downloadUrl ? 'yes' : 'no'}, caption="${(caption || '').substring(0, 50)}"`);

  // Auto-set name if waiting_for_name
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
    // Download & encode image (with timeout + status check)
    const imageResponse = await safeFetch(downloadUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    console.log('🤖 Starting OCR analysis with Gemini Flash Vision...');

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

    // Gemini Flash Vision for receipt OCR
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

    // Use receipt date (not today!)
    const receiptDate = safeParseDateToISO(ocrData.receipt_date || transactions[0]?.date);
    const receiptTotal = ocrData.receipt_total || transactions[0]?.amount || null;
    const receiptVendor = ocrData.vendor_name || transactions[0]?.vendor || null;
    const receiptNumber = ocrData.receipt_number || null;

    // Save receipt record
    const { data: receipt } = await (supabase as any)
      .from('receipts')
      .insert({
        user_id: userData.id,
        storage_path: downloadUrl,
        ocr_text: aiText,
        amount: receiptTotal,
        vendor: receiptVendor,
        tx_date: receiptDate,
        receipt_number: receiptNumber,
        confidence: transactions[0]?.confidence || 0.5,
        status: 'completed',
        metadata: {
          document_type: ocrData.document_type,
          source: 'whatsapp',
          model: 'gemini-flash',
          total_items: transactions.length,
        },
      })
      .select()
      .single();

    console.log('✅ Receipt saved:', receipt?.id);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://finhealer.vercel.app';

    if (transactions.length <= 2) {
      // Simple receipt with 1-2 items — show confirm/edit buttons
      const insertedIds: string[] = [];

      for (const tx of transactions) {
        const txDate = safeParseDateToISO(tx.date) || receiptDate;

        const { data: insertedTx, error: insertError } = await (supabase as any)
          .from('transactions')
          .insert({
            user_id: userData.id,
            type: 'expense',
            amount: tx.amount,
            vendor: tx.vendor,
            tx_date: txDate,
            category: tx.category || 'other',
            expense_category: tx.expense_category || null,
            expense_type: tx.expense_type || 'variable',
            detailed_category: tx.detailed_category,
            expense_frequency: tx.expense_frequency || 'one_time',
            payment_method: null,
            source: 'ocr',
            status: 'pending',
            notes: tx.description || '',
            original_description: tx.description || '',
            auto_categorized: true,
            confidence_score: tx.confidence || 0.5,
            receipt_id: receipt?.id || null,
            receipt_number: receiptNumber,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('❌ Error inserting transaction:', insertError);
        } else if (insertedTx?.id) {
          console.log('✅ Transaction inserted:', insertedTx.id);
          insertedIds.push(insertedTx.id);
        }
      }

      const tx = transactions[0];
      const displayCategory = tx.expense_category || tx.category || 'אחר';
      const displayDate = tx.date || receiptDate;
      const transactionId = insertedIds[0];

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
        await greenAPI.sendMessage({
          phoneNumber,
          message: `✅ קבלה נקלטה במערכת!\n\n💰 ${tx.amount} ₪\n🏪 ${tx.vendor}\n📂 ${displayCategory}\n📅 ${displayDate}\n\n👉 אשר את ההוצאה כאן:\n${siteUrl}/dashboard/expenses/pending`,
        });
      }

      // Trigger state machine for simple receipts too
      try {
        const { onDocumentProcessed } = await import('@/lib/conversation/phi-router');
        await onDocumentProcessed(userData.id, phoneNumber);
      } catch (routerErr) {
        console.error('Router notification failed for simple receipt:', routerErr);
      }
    } else {
      // Bank/credit statement image with many transactions
      for (const tx of transactions) {
        const txDate = safeParseDateToISO(tx.date) || receiptDate;

        await (supabase as any)
          .from('transactions')
          .insert({
            user_id: userData.id,
            type: 'expense',
            amount: tx.amount,
            vendor: tx.vendor,
            tx_date: txDate,
            category: tx.category || 'other',
            expense_category: tx.expense_category || null,
            expense_type: tx.expense_type || 'variable',
            detailed_category: tx.detailed_category,
            expense_frequency: tx.expense_frequency || 'one_time',
            payment_method: ocrData.document_type === 'credit_statement' ? 'credit_card' : 'bank_transfer',
            source: 'ocr',
            status: 'pending',
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

      // Trigger state machine
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

  return NextResponse.json({ status: 'success' });
}

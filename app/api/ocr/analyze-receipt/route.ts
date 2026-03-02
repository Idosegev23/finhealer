// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const source = formData.get('source') as string || 'manual' // manual / whatsapp

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'הקובץ גדול מדי. מקסימום 10MB.' },
        { status: 413 }
      )
    }

    console.log('📸 Analyzing receipt:', {
      userId: user.id,
      fileName: imageFile.name,
      fileSize: imageFile.size,
      source,
    })

    // המרת תמונה ל-base64
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    // 🆕 שליחה ל-GPT-5.2 Vision
    const systemPrompt = `אתה מומחה לניתוח קבלות ותדפיסי בנק ואשראי בעברית.
תפקידך לחלץ מידע מדויק ממסמכים פיננסיים.

עבור כל מסמך, זהה:
1. **סוג המסמך**: receipt (קבלה), bank_statement (דוח בנק), credit_statement (דוח אשראי), salary_slip (תלוש שכר)
2. **פרטי העסקה**:
   - סכום (amount) - **חשוב מאוד:** זה הסכום ששולם בפועל, לא מספר הקבלה!
   - ספק/בית עסק (vendor)
   - תאריך (date)
   - קטגוריה (category) - בחר מהרשימה: food, transport, shopping, health, entertainment, education, housing, utilities, other
   - קטגוריה מפורטת (detailed_category)
   - סוג הוצאה (expense_frequency): fixed (קבועה), temporary (זמנית), special (מיוחדת), one_time (חד פעמית)
   - אמצעי תשלום (payment_method): cash, credit, debit, digital_wallet, bank_transfer, check, other

3. **רמת ביטחון** (confidence): 0.0-1.0

**הבדל קריטי בין מספר קבלה/קופה לעלות:**
- מספר קבלה (Receipt Number) - זה מספר סידורי של הקבלה (למשל: 36401, 00123, #456)
- מספר קופה (Cash Register Number) - זה מספר הקופה (למשל: 000083, 001, 5)
- עלות/סכום (Amount/Total) - זה הסכום ששולם בפועל (למשל: 79.00 ₪, 150.50 ש״ח)
- **תמיד** השתמש בסכום שמופיע ליד המילים: "סה״כ כולל מע״מ", "סה״כ", "לתשלום", "Total", "Sum", "Amount", "₪", "ש״ח"
- **לעולם אל תשתמש במספר הקבלה או מספר הקופה כעלות!**
- **מספר קופה (000083) ≠ סכום כסף (79)**
- **מספר קבלה (36401) ≠ סכום כסף (79)**
- הסכום הכולל נמצא תמיד בתחתית הקבלה, ליד "סה״כ כולל מע״מ" - לא ליד "מספר קופה" או "מספר קבלה"

**פורמט תאריכים ישראלי (חשוב מאוד!):**
- תאריכים ישראליים הם בפורמט: **יום.חודש.שנה** (DD.MM.YY או DD.MM.YYYY)
- **לא** כמו בארה"ב (MM.DD.YY)!
- דוגמאות: "10.11.20" = 10 בנובמבר 2020, "25.12.24" = 25 בדצמבר 2024
- אם רשום "10.11.20" - זה יום 10, חודש 11 (נובמבר), שנה 2020
- החזר בפורמט ISO: "YYYY-MM-DD" (למשל: "2020-11-10")

**עבור תדפיסי בנק/אשראי**: חלץ את כל התנועות בטבלה.

החזר JSON בפורמט:
{
  "document_type": "receipt | bank_statement | credit_statement | salary_slip",
  "receipt_number": <מספר הקבלה - אם קיים>,
  "transactions": [
    {
      "amount": 123.45,
      "vendor": "שם בית העסק",
      "date": "2024-10-27",
      "category": "food",
      "detailed_category": "restaurants",
      "expense_frequency": "one_time",
      "payment_method": "credit",
      "description": "תיאור מפורט",
      "confidence": 0.95
    }
  ],
  "raw_text": "הטקסט המלא שזוהה"
}`;

    const userPrompt = 'נתח את המסמך הפיננסי הזה וחלץ את כל המידע הרלוונטי.\n\n**חשוב מאוד - זיהוי הסכום הנכון:**\n- זהה את הסכום ששולם בפועל - זה נמצא ליד "סה״כ כולל מע״מ" או "סה״כ" בתחתית הקבלה\n- אל תשתמש במספר הקבלה כעלות! (מספר קבלה = 36401)\n- אל תשתמש במספר הקופה כעלות! (מספר קופה = 000083)\n- דוגמה: אם רשום "מספר קופה: 000083" ו"סה״כ כולל מע״מ: 79" - הסכום הוא 79, לא 83!\n- מספר קופה/קבלה ≠ סכום כסף\n\n**חשוב מאוד - פורמט תאריכים ישראלי:**\n- תאריכים ישראליים הם בפורמט: יום.חודש.שנה (DD.MM.YY)\n- **לא** כמו בארה"ב! אם רשום "10.11.20" זה יום 10, חודש 11 (נובמבר), שנה 2020\n- החזר בפורמט ISO: "YYYY-MM-DD" (למשל: "2020-11-10")';

    const response = await getOpenAI().responses.create({
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
      reasoning: { effort: 'medium' },
    });

    const aiResponse = response.output_text

    if (!aiResponse) {
      throw new Error('No response from OpenAI')
    }

    // פרסור התשובה
    const parsedData = JSON.parse(aiResponse)

    console.log('✅ OCR Analysis complete:', {
      documentType: parsedData.document_type,
      transactionsCount: parsedData.transactions?.length || 0,
    })

    // שמירת הקבלה ב-receipts table
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        storage_path: `receipts/${user.id}/${Date.now()}_${imageFile.name}`,
        ocr_text: parsedData.raw_text || '',
        amount: parsedData.transactions?.[0]?.amount || null,
        vendor: parsedData.transactions?.[0]?.vendor || null,
        confidence: parsedData.transactions?.[0]?.confidence || 0.5,
        status: 'completed',
        metadata: {
          document_type: parsedData.document_type,
          source,
          model: 'gpt-5.2',
          tokens_used: response.usage?.total_tokens || 0,
        },
        tx_date: parsedData.transactions?.[0]?.date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (receiptError) {
      console.error('❌ Error saving receipt:', receiptError)
    }

    return NextResponse.json({
      success: true,
      receipt_id: receipt?.id,
      document_type: parsedData.document_type,
      transactions: parsedData.transactions,
      raw_text: parsedData.raw_text,
      message: `זוהו ${parsedData.transactions?.length || 0} תנועות מהמסמך`,
    })

  } catch (error: any) {
    console.error('❌ OCR Analysis error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze receipt', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}


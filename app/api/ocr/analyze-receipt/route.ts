// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

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

    // שליחה ל-OpenAI Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `אתה מומחה לניתוח קבלות ותדפיסי בנק ואשראי בעברית.
תפקידך לחלץ מידע מדויק ממסמכים פיננסיים.

עבור כל מסמך, זהה:
1. **סוג המסמך**: receipt (קבלה), bank_statement (דוח בנק), credit_statement (דוח אשראי), salary_slip (תלוש שכר)
2. **פרטי העסקה**:
   - סכום (amount)
   - ספק/בית עסק (vendor)
   - תאריך (date)
   - קטגוריה (category) - בחר מהרשימה: food, transport, shopping, health, entertainment, education, housing, utilities, other
   - קטגוריה מפורטת (detailed_category)
   - סוג הוצאה (expense_frequency): fixed (קבועה), temporary (זמנית), special (מיוחדת), one_time (חד פעמית)
   - אמצעי תשלום (payment_method): cash, credit, debit, digital_wallet, bank_transfer, check, other

3. **רמת ביטחון** (confidence): 0.0-1.0

**עבור תדפיסי בנק/אשראי**: חלץ את כל התנועות בטבלה.

החזר JSON בפורמט:
{
  "document_type": "receipt | bank_statement | credit_statement | salary_slip",
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
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'נתח את המסמך הפיננסי הזה וחלץ את כל המידע הרלוונטי.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1, // נמוך לדיוק גבוה
    })

    const aiResponse = response.choices[0]?.message?.content

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
          model: 'gpt-4o',
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


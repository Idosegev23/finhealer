// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkApiRateLimit } from '@/lib/utils/api-rate-limiter'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

/**
 * AI Category Router
 * ניתוב חכם של הוצאות לקטגוריות נכונות
 * לומד מהעדפות המשתמש ומשפר את עצמו עם הזמן
 */

export async function POST(request: NextRequest) {
  const limited = checkApiRateLimit(request, 10, 60_000)
  if (limited) return limited

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
    }

    const body = await request.json()
    const { description, vendor, amount } = body

    if (!description && !vendor) {
      return NextResponse.json({ error: 'Description or vendor required' }, { status: 400 })
    }

    console.log('🤖 AI Categorization request:', { userId: user.id, description, vendor, amount })

    // 1. בדוק אם יש כלל מותאם אישית למשתמש
    const { data: userRule } = await supabase
      .from('user_category_rules')
      .select('*')
      .eq('user_id', user.id)
      .ilike('vendor_pattern', `%${vendor || description}%`)
      .order('confidence', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (userRule) {
      // עדכן שימושים
      await supabase
        .from('user_category_rules')
        .update({
          times_used: (userRule.times_used || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', userRule.id)

      console.log('✅ Found user rule:', userRule)

      return NextResponse.json({
        success: true,
        matched: true,
        source: 'user_rule',
        suggested_category: userRule.category,
        detailed_category: userRule.detailed_category,
        expense_frequency: userRule.expense_frequency,
        confidence: userRule.confidence || 0.9,
      })
    }

    // 2. שאל את GPT-4o לסיווג
    const aiResponse = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `אתה מומחה לסיווג הוצאות בישראל.
תפקידך לסווג הוצאות לקטגוריות נכונות על פי התיאור והספק.

קטגוריות אפשריות:
- food: מזון (מסעדות, קפה, סופרמרקט)
- transport: תחבורה (דלק, חניה, תחבורה ציבורית, מונית)
- shopping: קניות (ביגוד, אלקטרוניקה, רהיטים)
- health: בריאות (תרופות, רופא, ביטוח בריאות)
- entertainment: בילויים (קולנוע, תיאטרון, פארקים)
- education: חינוך (שכר לימוד, ספרים, קורסים)
- housing: דיור (שכר דירה, משכנתא, תיקונים)
- utilities: שירותים (חשמל, מים, גז, אינטרנט, סלולר)
- other: אחר

סוגי הוצאה (expense_frequency):
- fixed: הוצאה קבועה חודשית (דירה, ביטוח, סלולר)
- temporary: הוצאה זמנית (כמה חודשים)
- special: הוצאה מיוחדת (אירועים, חגים)
- one_time: הוצאה חד פעמית

החזר JSON:
{
  "category": "food",
  "detailed_category": "restaurants",
  "expense_frequency": "one_time",
  "confidence": 0.95,
  "reasoning": "הסבר קצר"
}`
        },
        {
          role: 'user',
          content: `סווג את ההוצאה הזו:\nספק: ${vendor || 'לא צוין'}\nתיאור: ${description}\nסכום: ₪${amount || 0}`
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const aiText = aiResponse.choices[0].message.content || '{}'
    console.log('🎯 AI Categorization:', aiText)

    let aiResult: any
    try {
      aiResult = JSON.parse(aiText)
    } catch {
      aiResult = { category: 'other', confidence: 0.5 }
    }

    // 3. שמור כלל חדש אם הביטחון גבוה
    if (aiResult.confidence >= 0.8 && (vendor || description)) {
      const vendorPattern = vendor || description.substring(0, 50)
      
      // בדוק אם כבר קיים
      const { data: existingRule } = await supabase
        .from('user_category_rules')
        .select('id')
        .eq('user_id', user.id)
        .eq('vendor_pattern', vendorPattern)
        .maybeSingle()

      if (!existingRule) {
        await supabase
          .from('user_category_rules')
          .insert({
            user_id: user.id,
            vendor_pattern: vendorPattern,
            category: aiResult.category,
            detailed_category: aiResult.detailed_category,
            expense_frequency: aiResult.expense_frequency,
            confidence: aiResult.confidence,
            times_used: 1,
            last_used_at: new Date().toISOString(),
          })

        console.log('💾 Saved new rule:', vendorPattern)
      }
    }

    return NextResponse.json({
      success: true,
      matched: true,
      source: 'ai',
      suggested_category: aiResult.category,
      detailed_category: aiResult.detailed_category,
      expense_frequency: aiResult.expense_frequency,
      confidence: aiResult.confidence || 0.7,
      reasoning: aiResult.reasoning,
    })

  } catch (error: any) {
    console.error('❌ Categorization error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to categorize', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

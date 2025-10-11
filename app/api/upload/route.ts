import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importType = formData.get('importType') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📄 File: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)`);

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 400 });
    }

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isExcel = fileType.includes('spreadsheet') || fileType.includes('excel') || 
                    fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');

    if (!isImage && !isPDF && !isExcel) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Excel/CSV
    if (isExcel) {
      console.log('📊 Processing Excel/CSV...');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvText = XLSX.utils.sheet_to_csv(sheet);
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const extractedText = `Excel Data (${jsonData.length} rows):\n${csvText.substring(0, 5000)}`;
      console.log(`✅ Excel parsed: ${jsonData.length} rows`);
      
      return await analyzeText(extractedText, importType, 'excel');
    }

    // PDF
    if (isPDF) {
      console.log('📄 Processing PDF...');
      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      try {
        // Dynamic import to avoid build issues
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(pdfBuffer);
        const extractedText = data.text;
        console.log(`✅ PDF parsed: ${data.numpages} pages, ${extractedText.length} chars`);
        
        if (!extractedText || extractedText.length < 50) {
          return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
        }
        
        return await analyzeText(extractedText, importType, 'pdf');
      } catch (error: any) {
        console.error('❌ PDF error:', error);
        return NextResponse.json({ error: 'Failed to read PDF' }, { status: 400 });
      }
    }

    // Images - GPT-4o Vision
    console.log('🖼️ Processing image...');
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${fileType};base64,${base64}`;

    return await analyzeImage(dataUrl, importType);

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ניתוח טקסט (PDF/Excel)
async function analyzeText(text: string, importType: string, source: string) {
  const systemPrompt = `אתה מומחה לניתוח דוחות בנק ואשראי ישראליים.
תפקידך לזהות ולחלץ הוצאות קבועות חודשיות מתוך נתוני עסקאות.
החזר ONLY JSON תקני ללא טקסט נוסף.`;

  const fields = importType === 'expenses'
    ? `{
  "rent_mortgage": {"value": 0, "confidence": 0.9, "source": ["פירוט"]},
  "building_maintenance": {},
  "property_tax": {},
  "life_insurance": {},
  "health_insurance": {},
  "car_insurance": {},
  "home_insurance": {},
  "cellular": {},
  "internet": {},
  "tv_cable": {},
  "leasing": {},
  "fuel": {},
  "parking": {},
  "public_transport": {},
  "daycare": {},
  "afterschool": {},
  "tuition": {},
  "extracurricular": {},
  "babysitter": {},
  "gym": {},
  "therapy": {},
  "medication": {},
  "pension_funds": {},
  "streaming": {},
  "digital_services": {},
  "electricity": {},
  "water": {},
  "gas": {}
}`
    : `{"current_account_balance": {"value": 0, "confidence": 0.9, "source": "text"}, "credit_card_debt": {}, "bank_loans": {}, "current_savings": {}, "investments": {}}`;

  const expensesInstructions = `
חלץ את ההוצאות הקבועות החודשיות הבאות (כל שדה שמצאת):

🏠 **דיור:**
- rent_mortgage: שכר דירה או החזר משכנתא חודשי
- building_maintenance: דמי ניהול, ועד בית
- property_tax: ארנונה (אם משלם חודשי)

🛡️ **ביטוחים (פרק לסוגים):**
- life_insurance: ביטוח חיים, ביטוח משכנתא, ביטוח מנהלים
- health_insurance: ביטוח בריאות משלים
- car_insurance: ביטוח רכב (חובה + מקיף)
- home_insurance: ביטוח דירה/תכולה

📞 **תקשורת:**
- cellular: טלפון נייד - פלאפון, סלקום, פרטנר, גולן טלקום, הוט מובייל, רמי לוי תקשורת, 019 מובייל, יאפון
- internet: אינטרנט ביתי - בזק בינלאומי, Bezeq, הוט (HOT), סלקום, פרטנר, 019, Unlimited, IBC, סיבים אופטיים (Fiber)
- tv_cable: טלוויזיה בכבלים/לוויין - yes, הוט (HOT), סלקום TV

🚗 **רכב ותחבורה:**
- leasing: ליסינג רכב
- fuel: דלק (אם יש חיוב קבוע חודשי)
- parking: מנוי חניה
- public_transport: רב-קו, חופשי חודשי

👶 **ילדים וחינוך:**
- daycare: מעון יום, גן ילדים
- afterschool: צהרון
- tuition: שכר לימוד (בית ספר פרטי, אוניברסיטה)
- extracurricular: חוגים - ספורט, מוזיקה, אומנות
- babysitter: שמרטפית, בייביסיטר קבוע

🏋️ **בריאות ורווחה:**
- gym: חדר כושר, סטודיו יוגה/פילאטיס
- therapy: טיפולים - פיזיותרפיה, פסיכולוג
- medication: תרופות קבועות

💰 **חיסכון ופנסיה:**
- pension_funds: פנסיה, קופות גמל (מעבר לניכויים אוטומטיים)

📺 **מנויים ובידור:**
- streaming: Netflix, Disney+, Spotify, Apple Music
- digital_services: iCloud, Google One, Microsoft 365, אפליקציות

⚡ **תשלומי חובה:**
- electricity: חשבון חשמל
- water: חשבון מים
- gas: גז בישול

**הנחיות:**
1. אם חיוב מופיע יותר מפעם אחת = הוצאה קבועה
2. סכם חיובים מאותו ספק
3. source = מערך של תיאורים מהדוח
4. רק שדות שמצאת!
5. confidence: 0.9 = בטוח, 0.7 = סביר, 0.5 = אולי

דוגמה:
{
  "life_insurance": {
    "value": 450,
    "confidence": 0.9,
    "source": ["הפניקס חיים: ₪ 200", "כלל ביטוח: ₪ 250"]
  },
  "cellular": {
    "value": 89.90,
    "confidence": 0.9,
    "source": ["פלאפון: ₪ 89.90"]
  }
}`;

  const debtsInstructions = `
חלץ חובות ונכסים:

1. **current_account_balance** - יתרת חשבון עו"ש נוכחית
2. **credit_card_debt** - חוב על כרטיסי אשראי + מינוס בחשבון
3. **bank_loans** - הלוואות מהבנק (יתרת חוב)
4. **current_savings** - חיסכון וקופות
5. **investments** - מניות, קרנות נאמנות

חפש: "יתרה", "יתרת חוב", "מסגרת אשראי", "הלוואה", "יתרת הלוואה"`;

  const userPrompt = `${importType === 'expenses' ? expensesInstructions : debtsInstructions}

**הנתונים לניתוח:**
${text.substring(0, 8000)}

החזר JSON בלבד בפורמט: ${fields}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const detected = JSON.parse(content);
    
    console.log(`✅ GPT-4o (${source}):`, detected);

    return NextResponse.json({
      success: true,
      detected,
      confidence: calcConfidence(detected),
      model: 'gpt-4o',
      source
    });
  } catch (error: any) {
    console.error('❌ AI error:', error);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 400 });
  }
}

// ניתוח תמונה
async function analyzeImage(dataUrl: string, importType: string) {
  const fields = importType === 'expenses'
    ? `{
  "rent_mortgage": {}, "building_maintenance": {}, "property_tax": {},
  "life_insurance": {}, "health_insurance": {}, "car_insurance": {}, "home_insurance": {},
  "cellular": {}, "internet": {}, "tv_cable": {},
  "leasing": {}, "fuel": {}, "parking": {}, "public_transport": {},
  "daycare": {}, "afterschool": {}, "tuition": {}, "extracurricular": {}, "babysitter": {},
  "gym": {}, "therapy": {}, "medication": {},
  "pension_funds": {},
  "streaming": {}, "digital_services": {},
  "electricity": {}, "water": {}, "gas": {}
}`
    : `{"current_account_balance": {"value": 0, "confidence": 0.9, "source": "text"}, "credit_card_debt": {}, "bank_loans": {}, "current_savings": {}, "investments": {}}`;

  const expensesPrompt = `נתח את התמונה וחלץ הוצאות קבועות חודשיות מפורטות:

🏠 דיור: rent_mortgage (שכירות/משכנתא), building_maintenance (דמי ניהול), property_tax (ארנונה)
🛡️ ביטוחים: life_insurance, health_insurance, car_insurance, home_insurance (פרק לסוגים!)
📞 תקשורת: cellular (פלאפון/סלקום/פרטנר/גולן/הוט מובייל/רמי לוי/019), internet (בזק/הוט/סלקום/פרטנר/019/Unlimited), tv_cable (yes/הוט/סלקום TV)
🚗 רכב: leasing, fuel, parking, public_transport
👶 ילדים: daycare (גן/מעון), afterschool (צהרון), tuition, extracurricular (חוגים), babysitter
🏋️ בריאות: gym, therapy, medication
💰 חיסכון: pension_funds
📺 מנויים: streaming (Netflix/Spotify), digital_services (iCloud/Microsoft)
⚡ חובה: electricity, water, gas

חפש חיובים חוזרים, סכם לפי קטגוריה. החזר JSON: ${fields}`;

  const debtsPrompt = `נתח את התמונה וחלץ חובות ונכסים:
- יתרת חשבון עו"ש
- חוב על כרטיסי אשראי
- הלוואות
- חיסכון והשקעות

החזר JSON: ${fields}`;

  const userPrompt = importType === 'expenses' ? expensesPrompt : debtsPrompt;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const detected = JSON.parse(content);
    
    console.log('✅ GPT-4o Vision:', detected);

    return NextResponse.json({
      success: true,
      detected,
      confidence: calcConfidence(detected),
      model: 'gpt-4o-vision',
      source: 'image'
    });
  } catch (error: any) {
    console.error('❌ Vision error:', error);
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    if (error.code === 'insufficient_quota') {
      return NextResponse.json({ error: 'OpenAI quota exceeded' }, { status: 429 });
    }
    
    return NextResponse.json({ error: 'Vision analysis failed' }, { status: 400 });
  }
}

function calcConfidence(detected: any): number {
  const confidences = Object.values(detected)
    .map((item: any) => item?.confidence || 0)
    .filter(c => c > 0);
  
  if (confidences.length === 0) return 0;
  return Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100;
}

#!/usr/bin/env node

/**
 * סקריפט בדיקה מקומית לעיבוד מסמכים
 * משתמש באותו פרומפט ולוגיקה כמו ה-API
 */

import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// בדיקת args
if (process.argv.length < 3) {
  console.log('שימוש: node scripts/test-document-locally.mjs <path-to-pdf-file> [bank|credit]');
  console.log('דוגמה: node scripts/test-document-locally.mjs /Users/idosegev/Downloads/bank.pdf bank');
  process.exit(1);
}

const filePath = process.argv[2];
const fileType = process.argv[3] || 'bank'; // bank או credit

console.log('🔍 בודק מסמך מקומית...');
console.log('📄 קובץ:', filePath);
console.log('🏦 סוג:', fileType === 'bank' ? 'דוח בנק' : 'דוח אשראי');
console.log('---');

// קטגוריות לדוגמה (כמו שמגיעות מהDB)
const SAMPLE_CATEGORIES = [
  // קבועות
  { name: 'שכר דירה', expense_type: 'fixed', category_group: 'housing' },
  { name: 'ארנונה', expense_type: 'fixed', category_group: 'housing' },
  { name: 'חשמל', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'מים', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'גז', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'אינטרנט וטלפון', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'ביטוח בריאות', expense_type: 'fixed', category_group: 'insurance' },
  { name: 'ביטוח רכב', expense_type: 'fixed', category_group: 'insurance' },
  { name: 'ביטוח דירה', expense_type: 'fixed', category_group: 'insurance' },
  { name: 'מנוי חדר כושר', expense_type: 'fixed', category_group: 'health' },
  { name: 'מנויי סטרימינג', expense_type: 'fixed', category_group: 'entertainment' },
  
  // משתנות
  { name: 'סופרמרקט', expense_type: 'variable', category_group: 'food' },
  { name: 'מסעדות ובתי קפה', expense_type: 'variable', category_group: 'food' },
  { name: 'תחבורה ציבורית', expense_type: 'variable', category_group: 'transport' },
  { name: 'דלק', expense_type: 'variable', category_group: 'transport' },
  { name: 'חניה', expense_type: 'variable', category_group: 'transport' },
  { name: 'בילויים', expense_type: 'variable', category_group: 'entertainment' },
  { name: 'קניות ביגוד', expense_type: 'variable', category_group: 'shopping' },
  { name: 'מתנות', expense_type: 'variable', category_group: 'shopping' },
  { name: 'טיפוח ויופי', expense_type: 'variable', category_group: 'personal' },
  { name: 'ספורט ובריאות', expense_type: 'variable', category_group: 'health' },
  
  // מיוחדות
  { name: 'חופשות ונסיעות', expense_type: 'special', category_group: 'travel' },
  { name: 'רפואה', expense_type: 'special', category_group: 'health' },
  { name: 'חינוך והשכלה', expense_type: 'special', category_group: 'education' },
  { name: 'שיפוצים', expense_type: 'special', category_group: 'housing' },
  { name: 'מכשירי חשמל', expense_type: 'special', category_group: 'shopping' },
  { name: 'אירועים משפחתיים', expense_type: 'special', category_group: 'family' },
  { name: 'תרומות', expense_type: 'special', category_group: 'charity' },
  { name: 'תיקוני רכב', expense_type: 'special', category_group: 'transport' },
  { name: 'משפטי ואדמיניסטרטיבי', expense_type: 'special', category_group: 'legal' },
  { name: 'אחר', expense_type: 'special', category_group: 'other' },
];

// פונקציה לבניית הפרומפט לדוח בנק
function getBankStatementPrompt(categories) {
  const fixed = categories.filter(c => c.expense_type === 'fixed');
  const variable = categories.filter(c => c.expense_type === 'variable');
  const special = categories.filter(c => c.expense_type === 'special');
  
  const categoriesGuide = `

**קטגוריות הוצאות אפשריות (מהמסד נתונים):**

**קבועות (fixed):**
${fixed.map(c => `  • ${c.name}`).join('\n')}

**משתנות (variable):**
${variable.map(c => `  • ${c.name}`).join('\n')}

**מיוחדות (special):**
${special.map(c => `  • ${c.name}`).join('\n')}

**חשוב:** השתמש בשמות המדויקים מהרשימה למעלה בלבד!
אל תמציא קטגוריות חדשות - רק מהרשימה הזאת.
`;

  return `אתה מומחה בניתוח דוחות בנק ישראליים.

## **חשוב מאוד - כללי זיהוי:**

### **1. הכנסות vs הוצאות - חוק זהב:**
**🔑 השתמש ביתרה לפני/אחרי כמדד עיקרי:**
- אם balance_after גדול מ-balance_before → **INCOME** (הכסף גדל = הכנסה!)
- אם balance_after קטן מ-balance_before → **EXPENSE (הכסף קטן = הוצאה!)

**דוגמאות:**
- יתרה לפני: 5,000 ₪ | יתרה אחרי: 15,000 ₪ → **INCOME** של 10,000 ₪ (משכורת/זכות)
- יתרה לפני: 5,000 ₪ | יתרה אחרי: 4,500 ₪ → **EXPENSE** של 500 ₪ (קניה/חיוב)

**כללים נוספים (רק אם אין יתרות):**
- **זכות/הפקדה/העברה נכנסת = INCOME** (type: "income")
- **חובה/משיכה/העברה יוצאת/תשלום = EXPENSE** (type: "expense")
- תשלום בכרטיס אשראי = EXPENSE
- שכירות שאני מקבל = INCOME
- משכורת/פרילנס = INCOME

### **2. הסכום תמיד חיובי:**
- גם הוצאות וגם הכנסות → סכום חיובי (ללא מינוס)
- דוגמה: -500 ₪ → שמור 500
- דוגמה: +3,000 ₪ → שמור 3000

${categoriesGuide}

---

## **פורמט הפלט (JSON בלבד):**

\`\`\`json
{
  "report_info": {
    "bank_name": "string",
    "report_date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD"
  },
  "account_info": {
    "account_number": "string",
    "current_balance": 0,
    "available_balance": 0,
    "overdraft_limit": 0
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "vendor": "string",
      "amount": 0,
      "type": "income" | "expense",
      "category": "string (מהרשימה למעלה)",
      "expense_type": "fixed" | "variable" | "special",
      "payment_method": "העברה בנקאית" | "המחאה" | "הוראת קבע" | "משיכת מזומן" | "אחר",
      "balance_before": 0,
      "balance_after": 0,
      "notes": "string"
    }
  ]
}
\`\`\`

**חזור רק בפורמט JSON טהור - ללא טקסט נוסף!**`;
}

// פונקציה לבניית הפרומפט לדוח אשראי
function getCreditStatementPrompt(categories) {
  const fixed = categories.filter(c => c.expense_type === 'fixed');
  const variable = categories.filter(c => c.expense_type === 'variable');
  const special = categories.filter(c => c.expense_type === 'special');
  
  const categoriesGuide = `

**קטגוריות הוצאות אפשריות (מהמסד נתונים):**

**קבועות (fixed):**
${fixed.map(c => `  • ${c.name}`).join('\n')}

**משתנות (variable):**
${variable.map(c => `  • ${c.name}`).join('\n')}

**מיוחדות (special):**
${special.map(c => `  • ${c.name}`).join('\n')}

**חשוב:** השתמש בשמות המדויקים מהרשימה למעלה בלבד!
`;

  return `אתה מומחה בניתוח דוחות אשראי ישראליים (כאל/מקס/ישראכרט).

${categoriesGuide}

**חזור רק ב-JSON טהור!**`;
}

async function extractTextFromPDF(pdfPath) {
  console.log('📝 מחלץ טקסט מ-PDF...');
  
  // ניסיון 1: שימוש ב-unpdf
  try {
    const { getTextExtractor } = await import('unpdf');
    const buffer = await fs.readFile(pdfPath);
    const extract = await getTextExtractor();
    const { text } = await extract(buffer);
    
    if (text && text.length > 50) {
      console.log(`✅ הצלחתי לחלץ ${text.length} תווים עם unpdf`);
      return text;
    }
  } catch (error) {
    console.log('⚠️  unpdf נכשל, מנסה pdf-parse...');
  }

  // ניסיון 2: שימוש ב-pdf-parse
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = await fs.readFile(pdfPath);
    const data = await pdfParse(buffer);
    
    if (data.text && data.text.length > 50) {
      console.log(`✅ הצלחתי לחלץ ${data.text.length} תווים עם pdf-parse`);
      return data.text;
    }
  } catch (error) {
    console.log('⚠️  pdf-parse נכשל');
  }

  throw new Error('לא הצלחתי לחלץ טקסט מהקובץ');
}

async function analyzeWithOpenAI(text, documentType) {
  console.log('🤖 שולח ל-OpenAI לניתוח...');
  console.log(`📊 אורך טקסט: ${text.length} תווים`);
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000, // 2 minutes
  });

  const prompt = documentType === 'bank' 
    ? getBankStatementPrompt(SAMPLE_CATEGORIES)
    : getCreditStatementPrompt(SAMPLE_CATEGORIES);

  console.log('---');
  console.log('📤 פרומפט שנשלח:');
  console.log(prompt.substring(0, 500) + '...\n');

  const startTime = Date.now();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: `נתח את הדוח הבא:\n\n${text}`,
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ קיבלתי תשובה מ-OpenAI תוך ${duration} שניות`);
  console.log(`💰 Tokens: ${completion.usage?.total_tokens || 'N/A'}`);
  console.log('---');

  return JSON.parse(completion.choices[0].message.content || '{}');
}

async function main() {
  try {
    // 1. בדיקת קובץ קיים
    await fs.access(filePath);
    console.log('✅ קובץ נמצא');

    // 2. חילוץ טקסט
    const extractedText = await extractTextFromPDF(filePath);
    console.log('---');
    console.log('📝 טקסט שחולץ (200 תווים ראשונים):');
    console.log(extractedText.substring(0, 200));
    console.log('...');
    console.log('---');

    // 3. ניתוח עם OpenAI
    const result = await analyzeWithOpenAI(extractedText, fileType);

    // 4. הצגת תוצאות
    console.log('📊 תוצאות הניתוח:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80));
    console.log('');

    // 5. סיכום
    if (result.transactions) {
      const income = result.transactions.filter((t) => t.type === 'income');
      const expenses = result.transactions.filter((t) => t.type === 'expense');
      
      console.log('📈 סיכום:');
      console.log(`   • סה״כ תנועות: ${result.transactions.length}`);
      console.log(`   • הכנסות: ${income.length}`);
      console.log(`   • הוצאות: ${expenses.length}`);
      
      if (income.length > 0) {
        console.log('');
        console.log('💰 הכנסות:');
        income.forEach((t) => {
          console.log(`   - ${t.date} | ${t.vendor} | ${t.amount} ₪`);
        });
      }
      
      if (expenses.length > 0) {
        console.log('');
        console.log('💸 הוצאות:');
        expenses.slice(0, 10).forEach((t) => {
          console.log(`   - ${t.date} | ${t.vendor} | ${t.amount} ₪ | ${t.category}`);
        });
        if (expenses.length > 10) {
          console.log(`   ... ועוד ${expenses.length - 10} הוצאות`);
        }
      }
    }

    console.log('');
    console.log('✅ בדיקה הושלמה בהצלחה!');
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    process.exit(1);
  }
}

main();


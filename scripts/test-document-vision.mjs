#!/usr/bin/env node

/**
 * סקריפט בדיקה מקומית עם GPT-4o Vision
 * לקבצי PDF שהם תמונות (לא טקסט)
 */

import OpenAI from 'openai';
import fs from 'fs/promises';

if (process.argv.length < 3) {
  console.log('שימוש: node scripts/test-document-vision.mjs <path-to-pdf-or-image> [bank|credit]');
  console.log('דוגמה: node scripts/test-document-vision.mjs /Users/idosegev/Downloads/bank.pdf bank');
  process.exit(1);
}

const filePath = process.argv[2];
const fileType = process.argv[3] || 'bank';

console.log('🔍 בודק מסמך עם GPT-4o Vision...');
console.log('📄 קובץ:', filePath);
console.log('🏦 סוג:', fileType === 'bank' ? 'דוח בנק' : 'דוח אשראי');
console.log('---');

// קטגוריות מהDB
const SAMPLE_CATEGORIES = [
  { name: 'שכר דירה', expense_type: 'fixed', category_group: 'housing' },
  { name: 'ארנונה', expense_type: 'fixed', category_group: 'housing' },
  { name: 'חשמל', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'מים', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'גז', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'אינטרנט וטלפון', expense_type: 'fixed', category_group: 'utilities' },
  { name: 'ביטוח בריאות', expense_type: 'fixed', category_group: 'insurance' },
  { name: 'ביטוח רכב', expense_type: 'fixed', category_group: 'insurance' },
  { name: 'סופרמרקט', expense_type: 'variable', category_group: 'food' },
  { name: 'מסעדות ובתי קפה', expense_type: 'variable', category_group: 'food' },
  { name: 'תחבורה ציבורית', expense_type: 'variable', category_group: 'transport' },
  { name: 'דלק', expense_type: 'variable', category_group: 'transport' },
  { name: 'בילויים', expense_type: 'variable', category_group: 'entertainment' },
  { name: 'קניות ביגוד', expense_type: 'variable', category_group: 'shopping' },
  { name: 'חופשות ונסיעות', expense_type: 'special', category_group: 'travel' },
  { name: 'רפואה', expense_type: 'special', category_group: 'health' },
  { name: 'שיפוצים', expense_type: 'special', category_group: 'housing' },
  { name: 'אחר', expense_type: 'special', category_group: 'other' },
];

function getBankPrompt(categories) {
  const fixed = categories.filter(c => c.expense_type === 'fixed');
  const variable = categories.filter(c => c.expense_type === 'variable');
  const special = categories.filter(c => c.expense_type === 'special');
  
  return `אתה מומחה בניתוח דוחות בנק ישראליים.

## **חוקי זיהוי חשובים:**

### **1. הכנסות vs הוצאות - חוק זהב:**
**השתמש ביתרה לפני/אחרי כמדד עיקרי:**
- אם balance_after > balance_before → **INCOME** (הכסף גדל!)
- אם balance_after < balance_before → **EXPENSE** (הכסף קטן!)

דוגמאות:
- יתרה לפני: 5,000 | יתרה אחרי: 15,000 → INCOME של 10,000
- יתרה לפני: 5,000 | יתרה אחרי: 4,500 → EXPENSE של 500

אם אין יתרות:
- זכות/הפקדה = INCOME
- חובה/משיכה/תשלום = EXPENSE

### **2. סכום תמיד חיובי (ללא מינוס)**

### **3. קטגוריות (רק מהרשימה!):**

**קבועות:**
${fixed.map(c => `  • ${c.name}`).join('\n')}

**משתנות:**
${variable.map(c => `  • ${c.name}`).join('\n')}

**מיוחדות:**
${special.map(c => `  • ${c.name}`).join('\n')}

---

## **פורמט פלט - JSON בלבד:**

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
      "category": "string",
      "expense_type": "fixed" | "variable" | "special",
      "payment_method": "string",
      "balance_before": 0,
      "balance_after": 0,
      "notes": "string"
    }
  ]
}
\`\`\`

**חזור JSON טהור בלבד!**`;
}

async function analyzeWithVision(fileBuffer, fileType) {
  console.log('🤖 שולח ל-GPT-4o Vision...');
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000,
  });

  const prompt = fileType === 'bank' 
    ? getBankPrompt(SAMPLE_CATEGORIES)
    : 'נתח דוח אשראי...';

  // המר לbase64
  const base64 = fileBuffer.toString('base64');
  const mimeType = filePath.endsWith('.png') ? 'image/png' 
                 : filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg'
                 : 'application/pdf';

  console.log(`📊 גודל קובץ: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`📝 MIME Type: ${mimeType}`);
  console.log('---');

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
        content: [
          {
            type: 'text',
            text: 'נתח את הדוח הזה:',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ קיבלתי תשובה תוך ${duration} שניות`);
  console.log(`💰 Tokens: ${completion.usage?.total_tokens || 'N/A'}`);
  console.log('---');

  return JSON.parse(completion.choices[0].message.content || '{}');
}

async function main() {
  try {
    // 1. קריאת קובץ
    await fs.access(filePath);
    console.log('✅ קובץ נמצא');

    const fileBuffer = await fs.readFile(filePath);
    console.log(`📦 קראתי ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    console.log('---');

    // 2. ניתוח עם Vision
    const result = await analyzeWithVision(fileBuffer, fileType);

    // 3. תוצאות
    console.log('📊 תוצאות:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80));
    console.log('');

    // 4. סיכום
    if (result.transactions) {
      const income = result.transactions.filter((t) => t.type === 'income');
      const expenses = result.transactions.filter((t) => t.type === 'expense');
      
      console.log('📈 סיכום:');
      console.log(`   • סה״כ תנועות: ${result.transactions.length}`);
      console.log(`   • הכנסות: ${income.length}`);
      console.log(`   • הוצאות: ${expenses.length}`);
      
      if (income.length > 0) {
        console.log('');
        console.log('💰 הכנסות שזוהו:');
        income.forEach((t) => {
          console.log(`   ${t.date} | ${t.vendor} | ${t.amount} ₪ | balance: ${t.balance_before}→${t.balance_after}`);
        });
      }
      
      if (expenses.length > 0) {
        console.log('');
        console.log('💸 הוצאות שזוהו (10 ראשונות):');
        expenses.slice(0, 10).forEach((t) => {
          console.log(`   ${t.date} | ${t.vendor} | ${t.amount} ₪ | ${t.category} | balance: ${t.balance_before}→${t.balance_after}`);
        });
        if (expenses.length > 10) {
          console.log(`   ... ועוד ${expenses.length - 10}`);
        }
      }

      // בדיקת בעיות
      console.log('');
      console.log('🔍 בדיקת איכות:');
      
      const wrongType = result.transactions.filter(t => {
        if (t.balance_before && t.balance_after) {
          const shouldBeIncome = t.balance_after > t.balance_before;
          const shouldBeExpense = t.balance_after < t.balance_before;
          return (shouldBeIncome && t.type !== 'income') || (shouldBeExpense && t.type !== 'expense');
        }
        return false;
      });

      if (wrongType.length > 0) {
        console.log(`   ⚠️  ${wrongType.length} תנועות עם סוג שגוי (לפי balance):`);
        wrongType.forEach(t => {
          const correct = t.balance_after > t.balance_before ? 'INCOME' : 'EXPENSE';
          console.log(`      ${t.vendor}: marked as "${t.type}" but should be "${correct}" (${t.balance_before}→${t.balance_after})`);
        });
      } else {
        console.log(`   ✅ כל התנועות מסווגות נכון!`);
      }
    }

    console.log('');
    console.log('✅ בדיקה הושלמה!');
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    if (error.response) {
      console.error('📄 Response:', await error.response.text());
    }
    process.exit(1);
  }
}

main();


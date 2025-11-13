#!/usr/bin/env node

/**
 * Test with REAL prompt from codebase
 */

const fs = require('fs');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 180000,
  maxRetries: 1,
});

// Import the real prompt function (converted to JS)
function getCreditStatementPrompt(text, categories) {
  // Build categories guide from database
  let categoriesGuide = '';
  if (categories && categories.length > 0) {
    const fixed = categories.filter(c => c.expense_type === 'fixed');
    const variable = categories.filter(c => c.expense_type === 'variable');
    const special = categories.filter(c => c.expense_type === 'special');
    
    categoriesGuide = `

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
  }

  // The ACTUAL prompt from the codebase (lines 52-278)
  return `אתה מומחה בניתוח פירוטי ויזה ישראליים (כאל/מקס/ישראכרט/לאומי קארד).

## **מטרה**: חילוץ **כל עסקה** מהדוח עם סיווג מדויק לקטגוריות.

🎯 **חשוב במיוחד:**
- חלץ **כל עסקה** - עברית ואנגלית
- זהה הוראות קבע (recurring) עם שדות is_recurring ו-recurring_type
- זהה תשלומים (X מ-Y)
- זהה עסקאות במט"ח (דולר/יורו) + עמלות + שער המרה
- סווג לקטגוריות **מדויקות** מהרשימה - אם לא בטוח, השאר null

🚨 **כללי פורמט JSON - חובה!** 🚨
1. החזר **רק JSON תקין** - לא markdown, לא הסברים, לא טקסט נוסף
2. התחל ישירות עם { וסיים עם }
3. **אין פסיקים אחרי האלמנט האחרון** ב-array או object

---

## **1. מידע כללי (report_info)**
- report_date (תאריך הפקת הדוח - YYYY-MM-DD)
- period_start, period_end (תקופת הדוח - YYYY-MM-DD)
- card_issuer (כאל / מקס / ישראכרט / לאומי קארד)

## **2. מידע על החשבון (account_info)**
- account_number (מספר חשבון)
- card_last_digits (4 ספרות אחרונות של הכרטיס)
- card_holder (שם בעל הכרטיס)
- credit_limit (מסגרת אשראי ₪)
- used_credit (ניצול בפועל ₪)
- total_debt (סך חוב ₪)

## **🔥 3. מידע חיוב (billing_info) - קריטי!**
- next_billing_date (מועד החיוב הבא בבנק - DD/MM/YYYY)
- next_billing_amount (הסכום שיחוייב בבנק - ללא עיגול!)
- card_last_digits (4 ספרות אחרונות - לזיהוי החיוב בבנק)

## **3. עסקאות (transactions)**

### **4 סוגי עסקאות:**
**א. רגיל** - עסקה חד-פעמית
**ב. תשלום X מ-Y** - עסקה מפוצלת
**ג. קרדיט X מ-Y** - קרדיט ארוך טווח
**ד. הוראת קבע** - חיוב חוזר

${categoriesGuide}

### **🔥 שדות לכל עסקה - הכרחי!**

**שדות חובה:**
- date: תאריך העסקה (YYYY-MM-DD)
- vendor: שם בית העסק (עברית או אנגלית - **כמו שכתוב בדוח**)
- amount: סכום בש"ח (מספר חיובי תמיד!)
- expense_category: קטגוריה מדויקת (או null אם לא בטוח)
- expense_type: fixed/variable/special (או null אם לא בטוח)
- type: "expense" או "income" בלבד
- payment_method: credit_card

**אם תשלום/קרדיט:**
- installment: "תשלום 1 מ-10"
- payment_number: 1
- total_payments: 10

**🌍 אם עסקה במט"ח:**
- original_amount: הסכום המקורי במט"ח
- original_currency: "USD" או "EUR"
- exchange_rate: שער החליפין
- forex_fee: עמלת המרה בשקלים

## **פורמט פלט - JSON בלבד:**

{
  "report_info": {
    "report_date": "2025-09-15",
    "period_start": "2025-08-11",
    "period_end": "2025-09-10",
    "card_issuer": "כאל"
  },
  "account_info": {
    "card_last_digits": "3943",
    "card_holder": "עידו שגב",
    "credit_limit": 49000.00
  },
  "billing_info": {
    "next_billing_date": "10/10/2025",
    "next_billing_amount": 2829.32,
    "card_last_digits": "3943"
  },
  "transactions": [...]
}

---

**הדוח:**
${text}

---

**חשוב**: 
- סכומים תמיד חיוביים
- תאריכים בפורמט YYYY-MM-DD
- חלץ **כל** עסקה - עברית ואנגלית
- זהה נכון: רגיל/תשלום/קרדיט/הוראת קבע`;
}

async function realPromptTest(pdfPath) {
  console.log(`🚀 Testing with REAL PRODUCTION PROMPT\n`);
  console.log(`📄 PDF: ${pdfPath}\n`);
  
  try {
    // 1. Extract text
    console.log('📝 Step 1: Extracting text...');
    const { getDocumentProxy, extractText } = require('unpdf');
    const buffer = fs.readFileSync(pdfPath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text: rawText } = await extractText(pdf, { mergePages: true });
    
    console.log(`✅ Extracted: ${rawText.length} chars, ${totalPages} pages\n`);
    
    // 2. Load categories (mock - in production this comes from DB)
    console.log('📋 Step 2: Loading expense categories...');
    const mockCategories = [
      { name: 'תוכנה ומנויים דיגיטליים', expense_type: 'fixed', category_group: 'מקצועי' },
      { name: 'קניות סופר', expense_type: 'variable', category_group: 'מזון' },
      { name: 'מסעדות', expense_type: 'variable', category_group: 'מזון' },
      { name: 'דלק', expense_type: 'variable', category_group: 'רכב' },
      { name: 'ביטוח חיים', expense_type: 'fixed', category_group: 'ביטוח' },
      { name: 'קופת חולים', expense_type: 'fixed', category_group: 'בריאות' },
      { name: 'אינטרנט', expense_type: 'fixed', category_group: 'תקשורת' },
      { name: 'טלפון נייד', expense_type: 'fixed', category_group: 'תקשורת' },
      { name: 'מיסים ומקדמות מס', expense_type: 'fixed', category_group: 'מיסים' },
      { name: 'גז', expense_type: 'fixed', category_group: 'שירותים ביתיים' },
      { name: 'רהיטים ומוצרי בית', expense_type: 'special', category_group: 'בית' },
    ];
    console.log(`✅ Loaded ${mockCategories.length} categories\n`);
    
    // 3. Build REAL prompt
    console.log('📋 Step 3: Building REAL production prompt...');
    const prompt = getCreditStatementPrompt(rawText, mockCategories);
    console.log(`✅ Prompt built: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)\n`);
    
    // Save prompt
    const promptPath = pdfPath.replace('.pdf', '-REAL-prompt.txt');
    fs.writeFileSync(promptPath, prompt);
    console.log(`💾 Prompt saved: ${promptPath}\n`);
    
    // 4. Call GPT-4o
    console.log('🤖 Step 4: Calling GPT-4o with REAL prompt...');
    console.log(`⏱️  Started at: ${new Date().toLocaleTimeString()}\n`);
    
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast, proven, reliable
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`✅ GPT-4o responded in ${duration}s`);
    console.log(`⏱️  Finished at: ${new Date().toLocaleTimeString()}\n`);
    
    // 5. Parse response with auto-repair (like production code)
    let content = response.choices[0]?.message?.content || '{}';
    
    // Auto-repair JSON (like production)
    console.log('🔧 Attempting JSON parse with auto-repair...');
    let result;
    try {
      result = JSON.parse(content);
      console.log('✅ JSON parsed successfully (no repair needed)\n');
    } catch (parseError) {
      console.log(`⚠️  Initial parse failed: ${parseError.message}`);
      console.log('🔧 Attempting auto-repair...');
      
      // Remove markdown code blocks if present
      content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      
      // Count brackets
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      const openBrackets = (content.match(/\[/g) || []).length;
      const closeBrackets = (content.match(/\]/g) || []).length;
      
      console.log(`   Brackets: { ${openBraces} → ${closeBraces} } | [ ${openBrackets} → ${closeBrackets} ]`);
      
      // Add missing closing brackets
      if (closeBrackets < openBrackets) {
        const missing = openBrackets - closeBrackets;
        content += ']'.repeat(missing);
        console.log(`   Added ${missing} closing ]`);
      }
      
      // Add missing closing braces
      if (closeBraces < openBraces) {
        const missing = openBraces - closeBraces;
        content += '}'.repeat(missing);
        console.log(`   Added ${missing} closing }`);
      }
      
      // Try parsing again
      try {
        result = JSON.parse(content);
        console.log('✅ JSON repaired and parsed successfully!\n');
      } catch (repairError) {
        console.error('❌ Auto-repair failed:', repairError.message);
        
        // Save failed JSON for debugging
        const failedPath = pdfPath.replace('.pdf', '-FAILED.json');
        fs.writeFileSync(failedPath, content);
        console.error(`💾 Failed JSON saved to: ${failedPath}`);
        throw repairError;
      }
    }
    
    console.log('📊 Response Stats:');
    console.log(`   Response length: ${content.length} chars`);
    console.log(`   Transactions found: ${result.transactions?.length || 0}`);
    console.log(`   Token usage: ${response.usage?.total_tokens || 'N/A'} total`);
    console.log(`     - Prompt: ${response.usage?.prompt_tokens || 'N/A'}`);
    console.log(`     - Completion: ${response.usage?.completion_tokens || 'N/A'}\n`);
    
    // 6. Save results
    const resultPath = pdfPath.replace('.pdf', '-REAL-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`💾 AI Result saved: ${resultPath}\n`);
    
    // 7. Display ALL transactions
    console.log(`📝 ALL TRANSACTIONS (${result.transactions?.length || 0}):`);
    console.log('═'.repeat(120));
    (result.transactions || []).forEach((tx, i) => {
      const category = tx.expense_category || 'לא מסווג';
      const installment = tx.installment ? ` [${tx.installment}]` : '';
      const recurring = tx.is_recurring ? ' 🔄' : '';
      console.log(`${String(i+1).padStart(3)}. ${tx.date} | ${tx.vendor.padEnd(35)} | ${String(tx.amount).padStart(8)} ₪ | ${category}${installment}${recurring}`);
    });
    console.log('═'.repeat(120));
    console.log();
    
    console.log('✅ ANALYSIS COMPLETE WITH REAL PROMPT!');
    console.log(`📄 Full results in: ${resultPath}`);
    console.log(`📄 Full prompt in: ${promptPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Main
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Usage: node test-real-prompt.js <path-to-pdf>');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY not set');
  process.exit(1);
}

realPromptTest(pdfPath);


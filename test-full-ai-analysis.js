#!/usr/bin/env node

/**
 * Full AI Analysis Test - runs the REAL GPT-4o analysis with prompts
 */

const fs = require('fs');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 180000, // 3 minutes
  maxRetries: 1,
});

async function fullAnalysis(pdfPath) {
  console.log(`🚀 Starting FULL AI Analysis\n`);
  console.log(`📄 PDF: ${pdfPath}\n`);
  
  try {
    // 1. Extract text
    console.log('📝 Step 1: Extracting text from PDF...');
    const { getDocumentProxy, extractText } = require('unpdf');
    const buffer = fs.readFileSync(pdfPath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text: rawText } = await extractText(pdf, { mergePages: true });
    
    console.log(`✅ Extracted: ${rawText.length} chars, ${totalPages} pages\n`);
    
    // 2. Build prompt (simplified credit_statement prompt)
    console.log('📋 Step 2: Building AI prompt...');
    
    const prompt = `אתה מומחה לניתוח דוחות כרטיס אשראי ישראליים. נתח את הדוח הבא וחלץ את כל המידע בפורמט JSON.

# טקסט הדוח:
${rawText}

# הוראות:
1. חלץ את כל העסקאות מהדוח
2. זהה את סוג כל עסקה (expense_category)
3. זהה אם זה הוצאה קבועה/משתנה/מיוחדת (expense_type)
4. זהה תשלומים/קרדיט אם יש

# קטגוריות אפשריות:
- מזון ומשקאות, קניות סופר, מסעדות, בידור, דלק, תקשורת, ביטוח, מיסים, מים, חשמל, גז

# פורמט תשובה (JSON בלבד):
{
  "report_info": {
    "report_date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD", 
    "period_end": "YYYY-MM-DD",
    "card_issuer": "שם חברת האשראי"
  },
  "account_info": {
    "account_number": "מספר חשבון",
    "card_last_digits": "4 ספרות אחרונות",
    "card_holder": "שם בעל הכרטיס"
  },
  "billing_info": {
    "next_billing_date": "DD/MM/YYYY",
    "next_billing_amount": מספר,
    "card_last_digits": "4 ספרות"
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "vendor": "שם בית העסק",
      "amount": מספר,
      "expense_category": "קטגוריה",
      "expense_type": "fixed/variable/special",
      "type": "expense",
      "payment_method": "credit_card"
    }
  ]
}

החזר **רק JSON** ללא טקסט נוסף.`;

    console.log(`✅ Prompt built: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)\n`);
    
    // Save prompt to file
    const promptPath = pdfPath.replace('.pdf', '-prompt.txt');
    fs.writeFileSync(promptPath, prompt);
    console.log(`💾 Prompt saved: ${promptPath}\n`);
    
    // 3. Call GPT-4o
    console.log('🤖 Step 3: Calling GPT-4o API...');
    console.log(`⏱️  Started at: ${new Date().toLocaleTimeString()}\n`);
    
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`✅ GPT-4o responded in ${duration}s`);
    console.log(`⏱️  Finished at: ${new Date().toLocaleTimeString()}\n`);
    
    // 4. Parse response
    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);
    
    console.log('📊 Response Stats:');
    console.log(`   Response length: ${content.length} chars`);
    console.log(`   Transactions found: ${result.transactions?.length || 0}`);
    console.log(`   Token usage: ${response.usage?.total_tokens || 'N/A'} total`);
    console.log(`     - Prompt: ${response.usage?.prompt_tokens || 'N/A'}`);
    console.log(`     - Completion: ${response.usage?.completion_tokens || 'N/A'}\n`);
    
    // 5. Save results
    const resultPath = pdfPath.replace('.pdf', '-ai-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`💾 AI Result saved: ${resultPath}\n`);
    
    // 6. Display sample transactions
    console.log('📝 Sample Transactions (first 5):');
    console.log('─'.repeat(100));
    (result.transactions || []).slice(0, 5).forEach((tx, i) => {
      console.log(`${i+1}. ${tx.date} | ${tx.vendor} | ${tx.amount} ₪ | ${tx.expense_category || 'לא מסווג'} (${tx.expense_type || '-'})`);
    });
    console.log('─'.repeat(100));
    console.log();
    
    console.log('✅ ANALYSIS COMPLETE!');
    console.log(`📄 Full results in: ${resultPath}`);
    
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
  console.error('Usage: node test-full-ai-analysis.js <path-to-pdf>');
  console.error('\nMake sure OPENAI_API_KEY is set in environment');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY not found in environment');
  console.error('Set it with: export OPENAI_API_KEY=your-key-here');
  process.exit(1);
}

fullAnalysis(pdfPath);


#!/usr/bin/env node
/**
 * Test PDF analysis timing with different reasoning levels
 * Usage: node test-pdf-timing.mjs [path-to-pdf]
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const parsed = dotenv.parse(envContent);
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
  console.log('✅ Loaded .env.local');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default PDF path
const pdfPath = process.argv[2] || '/Users/idosegev/Downloads/TriRoars/gadi_docs/מרים בנק לאומי.pdf';

// Expense categories for the prompt
const EXPENSE_CATEGORIES = `
קטגוריות הוצאה אפשריות:
- דיור: שכר דירה, משכנתא, ארנונה, ועד בית, חשמל, מים, גז
- מזון: סופרמרקט, מכולת, ירקות ופירות
- תחבורה: דלק, תחבורה ציבורית, ביטוח רכב, טיפולים לרכב
- בריאות: תרופות, רופאים, ביטוח בריאות
- חינוך: שכר לימוד, ספרים, חוגים
- בילויים: מסעדות, קולנוע, תיאטרון
- ביגוד: בגדים, נעליים
- ביטוחים: ביטוח חיים, ביטוח דירה
- עמלות בנק: עמלות, ריביות
- הלוואות: החזר הלוואות
- אחר: הוצאות שלא מתאימות לקטגוריות אחרות
`;

const BANK_PROMPT = `אתה מנתח דוחות בנק ישראליים. נתח את המסמך וחלץ את כל התנועות.

${EXPENSE_CATEGORIES}

החזר JSON בפורמט:
{
  "report_info": {
    "report_date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD", 
    "period_end": "YYYY-MM-DD",
    "bank_name": "שם הבנק"
  },
  "account_info": {
    "account_number": "מספר חשבון",
    "account_type": "personal/business",
    "current_balance": number
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "תיאור התנועה",
      "amount": number,
      "type": "expense/income",
      "category": "קטגוריה מהרשימה",
      "category_confidence": 0.0-1.0
    }
  ]
}

חשוב:
1. תאריכים ישראליים: DD/MM/YYYY → המר ל-YYYY-MM-DD
2. סכומים שליליים = הוצאות, חיוביים = הכנסות
3. סווג כל תנועה לקטגוריה המתאימה ביותר`;

async function testPdfAnalysis(reasoningEffort) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧠 Testing with reasoning effort: ${reasoningEffort.toUpperCase()}`);
  console.log('='.repeat(60));

  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ File not found: ${pdfPath}`);
    process.exit(1);
  }

  const fileSize = fs.statSync(pdfPath).size;
  console.log(`📄 PDF file: ${path.basename(pdfPath)} (${(fileSize / 1024).toFixed(1)} KB)`);

  const startTime = Date.now();
  let uploadTime, analysisTime;

  try {
    // Step 1: Upload PDF to OpenAI
    console.log('\n📤 Uploading PDF to OpenAI Files API...');
    const uploadStart = Date.now();
    
    const fileUpload = await openai.files.create({
      file: fs.createReadStream(pdfPath),
      purpose: 'assistants',
    });
    
    uploadTime = Date.now() - uploadStart;
    console.log(`✅ Upload completed in ${(uploadTime / 1000).toFixed(2)}s (file_id: ${fileUpload.id})`);

    // Step 2: Analyze with GPT-5.2
    console.log(`\n🤖 Analyzing with GPT-5.2 (reasoning: ${reasoningEffort})...`);
    const analysisStart = Date.now();

    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_file', file_id: fileUpload.id },
            { type: 'input_text', text: BANK_PROMPT }
          ]
        }
      ],
      reasoning: { effort: reasoningEffort },
      text: { verbosity: 'low' },
      max_output_tokens: 16000
    });

    analysisTime = Date.now() - analysisStart;
    const totalTime = Date.now() - startTime;

    // Parse response
    const content = response.output_text || '{}';
    let data;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      data = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      data = { error: 'Failed to parse JSON', raw: content.substring(0, 500) };
    }

    // Output results
    console.log(`\n✅ Analysis completed!`);
    console.log('─'.repeat(40));
    console.log(`⏱️  Upload time:    ${(uploadTime / 1000).toFixed(2)}s`);
    console.log(`⏱️  Analysis time:  ${(analysisTime / 1000).toFixed(2)}s`);
    console.log(`⏱️  TOTAL TIME:     ${(totalTime / 1000).toFixed(2)}s`);
    console.log('─'.repeat(40));

    if (data.report_info) {
      console.log(`\n📊 Report Info:`);
      console.log(`   Bank: ${data.report_info.bank_name || 'N/A'}`);
      console.log(`   Period: ${data.report_info.period_start} → ${data.report_info.period_end}`);
    }

    if (data.transactions) {
      console.log(`\n💳 Transactions found: ${data.transactions.length}`);
      
      // Show first 5 transactions
      const sample = data.transactions.slice(0, 5);
      sample.forEach((tx, i) => {
        const emoji = tx.type === 'expense' ? '🔴' : '🟢';
        console.log(`   ${emoji} ${tx.date} | ${tx.description?.substring(0, 30)} | ₪${Math.abs(tx.amount)} | ${tx.category}`);
      });
      
      if (data.transactions.length > 5) {
        console.log(`   ... and ${data.transactions.length - 5} more`);
      }
    }

    // Cleanup
    try {
      await openai.files.del(fileUpload.id);
      console.log(`\n🗑️  Cleaned up uploaded file`);
    } catch (e) {
      // Ignore
    }

    return { reasoningEffort, totalTime, analysisTime, transactionCount: data.transactions?.length || 0 };

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`\n❌ Error after ${(totalTime / 1000).toFixed(2)}s:`, error.message);
    return { reasoningEffort, totalTime, error: error.message };
  }
}

async function main() {
  console.log('🔬 PDF Analysis Timing Test');
  console.log(`📁 Testing file: ${pdfPath}`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Found' : '❌ Missing'}`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env.local');
    process.exit(1);
  }

  const results = [];

  // Test all reasoning levels
  for (const effort of ['none', 'low', 'medium', 'high']) {
    const result = await testPdfAnalysis(effort);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TIMING SUMMARY');
  console.log('='.repeat(60));
  console.log('\nReasoning Level | Analysis Time | Total Time | Transactions');
  console.log('-'.repeat(60));
  
  for (const r of results) {
    if (r.error) {
      console.log(`${r.reasoningEffort.padEnd(15)} | ERROR: ${r.error.substring(0, 40)}`);
    } else {
      console.log(`${r.reasoningEffort.padEnd(15)} | ${(r.analysisTime / 1000).toFixed(1)}s`.padEnd(30) + 
                  `| ${(r.totalTime / 1000).toFixed(1)}s`.padEnd(15) + 
                  `| ${r.transactionCount}`);
    }
  }

  console.log('\n💡 Recommendation:');
  const successful = results.filter(r => !r.error);
  if (successful.length > 0) {
    const fastest = successful.reduce((a, b) => a.totalTime < b.totalTime ? a : b);
    const mostAccurate = successful.reduce((a, b) => a.transactionCount > b.transactionCount ? a : b);
    
    console.log(`   ⚡ Fastest: ${fastest.reasoningEffort} (${(fastest.totalTime / 1000).toFixed(1)}s)`);
    console.log(`   🎯 Most transactions: ${mostAccurate.reasoningEffort} (${mostAccurate.transactionCount} txns)`);
    
    if (fastest.totalTime < 300000) {
      console.log(`\n✅ All modes complete within Vercel Pro 300s limit!`);
    } else {
      const underLimit = successful.filter(r => r.totalTime < 300000);
      if (underLimit.length > 0) {
        console.log(`\n⚠️  Only these modes work within 300s limit: ${underLimit.map(r => r.reasoningEffort).join(', ')}`);
      } else {
        console.log(`\n❌ All modes exceed 300s - consider PDF splitting or async processing`);
      }
    }
  }
}

main().catch(console.error);


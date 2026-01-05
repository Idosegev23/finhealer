#!/usr/bin/env node
/**
 * Full Production Flow Simulation
 * Simulates exactly what happens in the WhatsApp webhook
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

// Load environment variables
config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DOCS_DIR = '/Users/idosegev/Downloads/TriRoars/gadi_docs';

// ============================================================================
// Date Parser (exactly as in webhook)
// ============================================================================
function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // DD/MM/YYYY format (Israeli)
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try to parse with Date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// Excel Processing (exactly as in webhook)
// ============================================================================
async function processExcel(filePath) {
  const fileName = path.basename(filePath);
  console.log('\n' + '═'.repeat(70));
  console.log(`📊 EXCEL PROCESSING: ${fileName}`);
  console.log('═'.repeat(70));
  
  // Step 1: Read file
  console.log('\n📥 Step 1: Reading file...');
  const buffer = fs.readFileSync(filePath);
  console.log(`   ✅ File size: ${buffer.length} bytes`);
  
  // Step 2: Parse Excel
  console.log('\n📄 Step 2: Parsing Excel...');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  let excelText = '';
  let totalRows = 0;
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csvData = XLSX.utils.sheet_to_csv(sheet);
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    excelText += `Sheet: ${sheetName}\n`;
    excelText += csvData + '\n\n';
    totalRows += jsonData.length;
    
    console.log(`   📄 Sheet "${sheetName}": ${jsonData.length} rows`);
  }
  
  console.log(`   ✅ Total: ${workbook.SheetNames.length} sheets, ${totalRows} rows, ${excelText.length} chars`);
  
  // Truncate if too long
  if (excelText.length > 50000) {
    excelText = excelText.substring(0, 50000) + '\n...(truncated)';
  }
  
  // Step 3: Analyze with AI
  console.log('\n🤖 Step 3: Analyzing with GPT-5.2...');
  
  const systemPrompt = `אתה מנתח דוחות פיננסיים ישראליים (בנק וכרטיסי אשראי).
נתח את הנתונים וחלץ את כל התנועות.

**חשוב מאוד:**
1. תאריכים חייבים להיות בפורמט ISO: YYYY-MM-DD (לדוגמה: 2025-10-15)
2. אם התאריך במקור הוא DD/MM/YYYY, המר אותו ל-YYYY-MM-DD
3. לכל תנועת הוצאה חייבת להיות קטגוריה (category) - אם לא ברור, תן "אחר"
4. לתנועות הכנסה - השאר category כ-null

החזר JSON בפורמט:
{
  "report_info": {
    "report_date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "bank_name": "שם הבנק/חברת אשראי"
  },
  "account_info": {
    "account_number": "מספר חשבון",
    "account_type": "checking/business/credit"
  },
  "transactions": {
    "income": [
      {
        "date": "YYYY-MM-DD",
        "vendor": "שם",
        "amount": 123.45,
        "description": "תיאור",
        "category": null
      }
    ],
    "expenses": [
      {
        "date": "YYYY-MM-DD",
        "vendor": "שם בית העסק",
        "amount": 123.45,
        "description": "תיאור",
        "category": "קטגוריה"
      }
    ]
  }
}`;

  const userPrompt = `נתח את הדוח הפיננסי הזה:\n\n${excelText}`;
  
  const startTime = Date.now();
  
  try {
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: [
        { role: 'developer', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      reasoning: { effort: 'medium' },
      text: { verbosity: 'low' },
      max_output_tokens: 16384,
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ AI response received in ${elapsed}s`);
    
    const content = response.output_text || '{}';
    
    // Step 4: Parse JSON response
    console.log('\n📊 Step 4: Parsing AI response...');
    
    let ocrData;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      ocrData = JSON.parse(jsonStr);
      console.log('   ✅ JSON parsed successfully');
    } catch (e) {
      console.error('   ❌ JSON Parse Error:', e.message);
      console.log('   Raw response:', content.substring(0, 500));
      return;
    }
    
    // Show report info
    console.log('\n📋 Report Info:');
    console.log(`   📅 Period: ${ocrData.report_info?.period_start} to ${ocrData.report_info?.period_end}`);
    console.log(`   🏦 Bank: ${ocrData.report_info?.bank_name}`);
    if (ocrData.account_info?.account_number) {
      console.log(`   💳 Account: ${ocrData.account_info.account_number}`);
    }
    
    // Step 5: Process transactions
    console.log('\n💰 Step 5: Processing transactions...');
    
    const incomeTransactions = ocrData.transactions?.income || [];
    const expenseTransactions = ocrData.transactions?.expenses || [];
    
    console.log(`   📈 Income: ${incomeTransactions.length} transactions`);
    console.log(`   📉 Expenses: ${expenseTransactions.length} transactions`);
    
    // Prepare transactions for DB (exactly as in webhook)
    const transactionsToInsert = [];
    const errors = [];
    
    // Process income
    for (const tx of incomeTransactions) {
      const parsedDate = parseDate(tx.date);
      
      const record = {
        user_id: 'TEST_USER_ID',
        type: 'income',
        amount: Math.abs(parseFloat(tx.amount) || 0),
        original_description: tx.vendor || tx.description || 'Unknown',
        tx_date: parsedDate,
        source: 'excel',
        status: 'pending',
        notes: tx.description || null,
        currency: 'ILS',
        expense_type: 'variable',
        auto_categorized: false,
        confidence_score: 0.5,
        vendor_name: tx.vendor || null,
        payment_method: 'credit_card',
        category: null, // Income doesn't need category
      };
      
      transactionsToInsert.push({ record, original: tx, type: 'income' });
    }
    
    // Process expenses
    for (const tx of expenseTransactions) {
      const parsedDate = parseDate(tx.date);
      
      // Check for required category
      if (!tx.category) {
        errors.push({
          type: 'missing_category',
          tx: tx,
          message: `Missing category for expense: ${tx.vendor}`
        });
      }
      
      const record = {
        user_id: 'TEST_USER_ID',
        type: 'expense',
        amount: Math.abs(parseFloat(tx.amount) || 0),
        original_description: tx.vendor || tx.description || 'Unknown',
        tx_date: parsedDate,
        source: 'excel',
        status: 'pending',
        notes: tx.description || null,
        currency: 'ILS',
        expense_type: 'variable',
        auto_categorized: true,
        confidence_score: 0.5,
        vendor_name: tx.vendor || null,
        payment_method: 'credit_card',
        category: tx.category || 'אחר', // Fallback to "אחר" if missing
      };
      
      transactionsToInsert.push({ record, original: tx, type: 'expense' });
    }
    
    // Step 6: Show what would be inserted
    console.log('\n📝 Step 6: Transactions to insert:');
    console.log('─'.repeat(70));
    
    let validCount = 0;
    let errorCount = 0;
    
    for (const { record, original, type } of transactionsToInsert) {
      const icon = type === 'income' ? '💚' : '💸';
      const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(record.tx_date);
      const categoryOk = type === 'income' || record.category;
      
      const status = dateOk && categoryOk ? '✅' : '❌';
      
      console.log(`${status} ${icon} ${record.tx_date} | ${record.original_description.substring(0, 25).padEnd(25)} | ${record.amount.toFixed(2).padStart(8)} ₪ | ${record.category || '-'}`);
      
      if (!dateOk) {
        console.log(`      ⚠️  Invalid date: "${original.date}" → "${record.tx_date}"`);
        errorCount++;
      } else if (!categoryOk) {
        console.log(`      ⚠️  Missing category`);
        errorCount++;
      } else {
        validCount++;
      }
    }
    
    console.log('─'.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Valid: ${validCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total: ${transactionsToInsert.length}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️ Validation Errors:');
      for (const err of errors) {
        console.log(`   - ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ AI Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

// ============================================================================
// PDF Processing
// ============================================================================
async function processPDF(filePath) {
  const fileName = path.basename(filePath);
  console.log('\n' + '═'.repeat(70));
  console.log(`📄 PDF PROCESSING: ${fileName}`);
  console.log('═'.repeat(70));
  
  // Step 1: Read file
  console.log('\n📥 Step 1: Reading file...');
  const buffer = fs.readFileSync(filePath);
  console.log(`   ✅ File size: ${buffer.length} bytes`);
  
  // Step 2: Upload to OpenAI
  console.log('\n📤 Step 2: Uploading to OpenAI Files API...');
  
  try {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    const fileUpload = await openai.files.create({
      file,
      purpose: 'assistants',
    });
    console.log(`   ✅ File uploaded: ${fileUpload.id}`);
    
    // Step 3: Analyze with AI
    console.log('\n🤖 Step 3: Analyzing with GPT-5.2...');
    
    const prompt = `אתה מנתח דוחות בנק וכרטיסי אשראי ישראליים.
נתח את ה-PDF וחלץ את כל התנועות.

**חשוב מאוד:**
1. תאריכים חייבים להיות בפורמט ISO: YYYY-MM-DD
2. לכל הוצאה חייבת להיות קטגוריה
3. לתנועות הכנסה - category = null

החזר JSON בפורמט:
{
  "report_info": {
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "bank_name": "שם הבנק"
  },
  "transactions": {
    "income": [...],
    "expenses": [...]
  }
}`;

    const startTime = Date.now();
    
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_file', file_id: fileUpload.id },
            { type: 'input_text', text: prompt }
          ]
        }
      ],
      reasoning: { effort: 'medium' },
      max_output_tokens: 32000
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ AI response received in ${elapsed}s`);
    
    const content = response.output_text || '{}';
    console.log('\n📝 Raw AI Response (first 1500 chars):');
    console.log(content.substring(0, 1500));
    
    // Cleanup
    console.log('\n🗑️ Cleaning up...');
    await openai.files.delete(fileUpload.id);
    console.log('   ✅ File deleted from OpenAI');
    
    // Parse and show transactions
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const ocrData = JSON.parse(jsonStr);
      
      console.log('\n📋 Report Info:');
      console.log(`   📅 Period: ${ocrData.report_info?.period_start} to ${ocrData.report_info?.period_end}`);
      console.log(`   🏦 Bank: ${ocrData.report_info?.bank_name}`);
      
      const income = ocrData.transactions?.income || [];
      const expenses = ocrData.transactions?.expenses || [];
      
      console.log(`\n💰 Transactions: ${income.length} income, ${expenses.length} expenses`);
      
      console.log('\n📝 Sample transactions:');
      for (const tx of [...income.slice(0, 3), ...expenses.slice(0, 5)]) {
        const icon = tx.type === 'income' || income.includes(tx) ? '💚' : '💸';
        console.log(`   ${icon} ${parseDate(tx.date)} | ${tx.vendor?.substring(0, 25) || '-'} | ${tx.amount} ₪`);
      }
      
    } catch (e) {
      console.error('   ❌ JSON Parse Error:', e.message);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('🚀 FULL PRODUCTION FLOW SIMULATION');
  console.log(`📁 Documents: ${DOCS_DIR}`);
  console.log(`🔑 API Key: ${process.env.OPENAI_API_KEY ? '✅ Loaded' : '❌ Missing'}`);
  
  const files = fs.readdirSync(DOCS_DIR);
  
  const targetFile = process.argv[2];
  
  if (!targetFile) {
    console.log('\n📋 Available files:');
    files.forEach((f, i) => {
      const ext = path.extname(f).toLowerCase();
      const icon = ext === '.pdf' ? '📄' : '📊';
      console.log(`   ${i + 1}. ${icon} ${f}`);
    });
    console.log('\n📌 Usage: node test-full-flow.mjs "<filename>"');
    console.log('   Example: node test-full-flow.mjs "מרים חודש 10.xlsx"');
    return;
  }
  
  const fullPath = path.join(DOCS_DIR, targetFile);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }
  
  const ext = path.extname(targetFile).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
    await processExcel(fullPath);
  } else if (ext === '.pdf') {
    await processPDF(fullPath);
  } else {
    console.error(`❌ Unsupported file type: ${ext}`);
  }
}

main().catch(console.error);


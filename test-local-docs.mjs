#!/usr/bin/env node
/**
 * Local Document Testing Script
 * Tests Excel and PDF processing without touching the database
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

// Load environment variables from .env.local
config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log(`🔑 API Key loaded: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);

const DOCS_DIR = '/Users/idosegev/Downloads/TriRoars/gadi_docs';

// Helper to convert DD/MM/YYYY to YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Try DD/MM/YYYY format (Israeli)
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // Try to parse with Date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  
  return new Date().toISOString().split('T')[0];
}

// Analyze Excel file
async function analyzeExcel(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Processing Excel: ${fileName}`);
  console.log('='.repeat(60));
  
  const buffer = fs.readFileSync(filePath);
  
  // Parse Excel
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
    
    console.log(`📄 Sheet "${sheetName}": ${jsonData.length} rows`);
  }
  
  console.log(`✅ Excel parsed: ${workbook.SheetNames.length} sheets, ${totalRows} rows, ${excelText.length} chars`);
  
  // Truncate if too long
  if (excelText.length > 50000) {
    excelText = excelText.substring(0, 50000) + '\n...(truncated)';
  }
  
  // Build prompt
  const prompt = `אתה מנתח דוחות פיננסיים ישראליים.
נתח את הנתונים הבאים וחלץ את כל התנועות.

החזר JSON בפורמט:
{
  "report_info": {
    "report_date": "YYYY-MM-DD",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD",
    "bank_name": "שם הבנק/חברת אשראי"
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "vendor": "שם בית העסק",
      "amount": 123.45,
      "type": "expense" | "income",
      "expense_category": "קטגוריה",
      "description": "תיאור"
    }
  ]
}

**חשוב:** תאריכים בפורמט ISO: YYYY-MM-DD

הנתונים:
${excelText}`;

  console.log(`\n🤖 Sending to GPT-5.2 (${excelText.length} chars)...`);
  
  try {
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: prompt,
      reasoning: { effort: 'medium' },
    });
    
    const content = response.output_text || '{}';
    console.log('\n📝 Raw AI Response (first 2000 chars):');
    console.log(content.substring(0, 2000));
    
    // Parse JSON
    let ocrData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      ocrData = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      console.error('❌ JSON Parse Error:', e.message);
      return;
    }
    
    console.log('\n📊 Parsed Data:');
    console.log('Report Info:', JSON.stringify(ocrData.report_info, null, 2));
    
    // Process transactions
    let allTransactions = [];
    if (Array.isArray(ocrData.transactions)) {
      allTransactions = ocrData.transactions;
    } else if (ocrData.transactions && typeof ocrData.transactions === 'object') {
      const { income = [], expenses = [] } = ocrData.transactions;
      allTransactions = [
        ...income.map(tx => ({ ...tx, type: 'income' })),
        ...expenses.map(tx => ({ ...tx, type: 'expense' })),
      ];
    }
    
    console.log(`\n💰 Found ${allTransactions.length} transactions:`);
    
    for (const tx of allTransactions) {
      const parsedDate = parseDate(tx.date);
      const isIncome = tx.type === 'income' || tx.amount > 0;
      console.log(`  ${isIncome ? '💚' : '💸'} ${parsedDate} | ${tx.vendor} | ${Math.abs(tx.amount)} ₪ | ${tx.expense_category || '-'}`);
    }
    
    // Test date parsing
    console.log('\n🗓️ Date Parsing Test:');
    for (const tx of allTransactions.slice(0, 5)) {
      console.log(`  "${tx.date}" → "${parseDate(tx.date)}"`);
    }
    
  } catch (error) {
    console.error('❌ AI Error:', error.message);
  }
}

// Analyze PDF file
async function analyzePDF(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Processing PDF: ${fileName}`);
  console.log('='.repeat(60));
  
  try {
    const buffer = fs.readFileSync(filePath);
    
    // Upload to OpenAI
    console.log('📤 Uploading to OpenAI...');
    const file = new File([buffer], fileName, { type: 'application/pdf' });
    const fileUpload = await openai.files.create({
      file,
      purpose: 'assistants',
    });
    console.log(`✅ File uploaded: ${fileUpload.id}`);
    
    const prompt = `אתה מנתח דוחות בנק ואשראי ישראליים.
נתח את ה-PDF וחלץ את כל התנועות.

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

    console.log('🤖 Sending to GPT-5.2...');
    
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
    
    const content = response.output_text || '{}';
    console.log('\n📝 Raw AI Response (first 2000 chars):');
    console.log(content.substring(0, 2000));
    
    // Cleanup
    await openai.files.del(fileUpload.id);
    console.log('🗑️ File deleted from OpenAI');
    
  } catch (error) {
    console.error('❌ PDF Error:', error.message);
  }
}

// Main
async function main() {
  console.log('🚀 Local Document Testing');
  console.log(`📁 Docs directory: ${DOCS_DIR}`);
  
  const files = fs.readdirSync(DOCS_DIR);
  
  // Get file to test from command line or use first Excel
  const targetFile = process.argv[2];
  
  if (targetFile) {
    const fullPath = path.join(DOCS_DIR, targetFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`);
      process.exit(1);
    }
    
    if (targetFile.endsWith('.xlsx') || targetFile.endsWith('.xls')) {
      await analyzeExcel(fullPath);
    } else if (targetFile.endsWith('.pdf')) {
      await analyzePDF(fullPath);
    }
  } else {
    console.log('\nAvailable files:');
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('\nUsage: node test-local-docs.mjs <filename>');
    console.log('Example: node test-local-docs.mjs "מרים חודש 10.xlsx"');
    
    // Test first Excel file by default
    const firstExcel = files.find(f => f.endsWith('.xlsx'));
    if (firstExcel) {
      console.log(`\n🔄 Testing first Excel file: ${firstExcel}`);
      await analyzeExcel(path.join(DOCS_DIR, firstExcel));
    }
  }
}

main().catch(console.error);


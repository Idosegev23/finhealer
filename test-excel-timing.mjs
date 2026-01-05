import dotenv from 'dotenv';
import OpenAI from 'openai';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local explicitly
dotenv.config({ path: path.join(__dirname, '.env.local') });

console.log('🔑 API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes (' + process.env.OPENAI_API_KEY.substring(0,10) + '...)' : 'No');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testExcelTiming() {
  console.log('🧪 Testing Excel analysis timing...\n');
  
  // Find Excel file
  const docsDir = '/Users/idosegev/Downloads/TriRoars/gadi_docs';
  const files = fs.readdirSync(docsDir);
  const excelFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  
  if (!excelFile) {
    console.log('❌ No Excel file found in', docsDir);
    return;
  }
  
  const filePath = path.join(docsDir, excelFile);
  console.log(`📄 Using file: ${excelFile}`);
  
  // Parse Excel
  const startParse = Date.now();
  const workbook = XLSX.readFile(filePath);
  let excelText = '';
  let totalRows = 0;
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    totalRows += data.length;
    
    excelText += `\n=== ${sheetName} ===\n`;
    for (const row of data) {
      if (Array.isArray(row)) {
        excelText += row.join(' | ') + '\n';
      }
    }
  }
  
  const parseTime = Date.now() - startParse;
  console.log(`✅ Excel parsed in ${parseTime}ms`);
  console.log(`   Sheets: ${workbook.SheetNames.length}`);
  console.log(`   Total rows: ${totalRows}`);
  console.log(`   Text length: ${excelText.length} chars\n`);
  
  // Truncate if too long
  if (excelText.length > 50000) {
    excelText = excelText.substring(0, 50000) + '\n...(truncated)';
    console.log('⚠️ Text truncated to 50000 chars');
  }
  
  // Build prompt (same as webhook)
  const prompt = `אתה מנתח דוחות פיננסיים. נתח את הדוח הבא והחזר JSON עם המבנה:
{
  "report_info": { "report_date": "YYYY-MM-DD", "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD", "bank_name": "..." },
  "account_info": { "account_number": "...", "account_type": "checking/savings/business" },
  "transactions": {
    "income": [{ "date": "YYYY-MM-DD", "description": "...", "amount": 1000, "vendor": "...", "income_category": "..." }],
    "expenses": [{ "date": "YYYY-MM-DD", "description": "...", "amount": -500, "vendor": "...", "expense_category": "...", "expense_type": "fixed/variable" }]
  }
}

הדוח:
${excelText}`;

  console.log(`🤖 Sending to GPT-5.2 (${prompt.length} chars)...`);
  
  // Call GPT-5.2
  const startAI = Date.now();
  
  try {
    // Test with NO reasoning and LOW verbosity - faster for data extraction
    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: prompt,
      reasoning: { effort: 'none' },  // No reasoning needed for data extraction
      text: { verbosity: 'low' },     // Concise output
    });
    
    const aiTime = Date.now() - startAI;
    console.log(`\n✅ GPT-5.2 responded in ${aiTime}ms (${(aiTime/1000).toFixed(1)}s)`);
    
    const content = response.output_text || '{}';
    console.log(`📊 Response length: ${content.length} chars`);
    console.log(`🎯 First 500 chars: ${content.substring(0, 500)}`);
    
    // Parse and count transactions
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const data = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      
      let income = 0, expenses = 0;
      if (data.transactions?.income) income = data.transactions.income.length;
      if (data.transactions?.expenses) expenses = data.transactions.expenses.length;
      if (Array.isArray(data.transactions)) {
        income = data.transactions.filter(t => t.type === 'income' || t.amount > 0).length;
        expenses = data.transactions.filter(t => t.type === 'expense' || t.amount < 0).length;
      }
      
      console.log(`\n📈 Extracted: ${income} income, ${expenses} expenses`);
    } catch (e) {
      console.log('⚠️ Could not parse response as JSON');
    }
    
    console.log(`\n⏱️ Total time: ${Date.now() - startParse}ms`);
    
  } catch (error) {
    console.error('❌ GPT-5.2 error:', error.message);
    if (error.status) console.error('   Status:', error.status);
  }
}

testExcelTiming().catch(console.error);


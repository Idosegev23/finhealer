import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';
import { getDocumentProxy, extractText } from 'unpdf';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function splitPDFAndAnalyze(filePath) {
  try {
    console.log('🎯 Testing PDF splitting and analysis...');

    if (!fs.existsSync(filePath)) {
      console.error('❌ PDF file not found at:', filePath);
      return;
    }

    // First, extract text using unpdf
    const buffer = fs.readFileSync(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text: rawText } = await extractText(pdf, { mergePages: false }); // Don't merge pages

    console.log(`📄 PDF has ${totalPages} pages`);
    console.log(`📄 Raw text type: ${typeof rawText}`);
    console.log(`📄 Raw text length: ${rawText?.length || 'N/A'}`);

    // Handle different return types from extractText
    let textContent = '';
    if (typeof rawText === 'string') {
      textContent = rawText;
    } else if (Array.isArray(rawText)) {
      textContent = rawText.join('\n\n');
    } else {
      console.log('📄 Raw text structure:', rawText);
      textContent = JSON.stringify(rawText);
    }

    // Split text by pages (assuming pages are separated by double newlines)
    const pages = textContent.split('\n\n').filter(page => page.trim().length > 100);
    console.log(`📄 Found ${pages.length} substantial page sections`);

    // Analyze each page separately
    const allResults = [];

    for (let i = 0; i < Math.min(pages.length, 6); i++) { // Analyze up to 6 pages
      console.log(`\n🔄 Analyzing page ${i + 1}/${pages.length}...`);

      const pageText = pages[i];
      console.log(`📝 Page ${i + 1} text length: ${pageText.length} chars`);

      // Create temp file for this page
      const tempFileName = `/tmp/page-${i + 1}.txt`;
      fs.writeFileSync(tempFileName, pageText);

      // Upload page text as file
      const fileUpload = await openai.files.create({
        file: fs.createReadStream(tempFileName),
        purpose: 'assistants'
      });

      // Clean up temp file
      fs.unlinkSync(tempFileName);

      console.log(`✅ Page ${i + 1} uploaded, ID: ${fileUpload.id}`);

      // Analyze this page
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'file',
              file: { file_id: fileUpload.id }
            },
            {
              type: 'text',
              text: `חלץ את כל התנועות הבנקאיות מהעמוד הזה בפורמט JSON.

החזר רק JSON תקין עם המבנה הבא:
{
  "transactions": {
    "income": [
      {
        "date": "YYYY-MM-DD",
        "vendor": "שם הספק",
        "amount": 123.45
      }
    ],
    "expenses": [
      {
        "date": "YYYY-MM-DD",
        "vendor": "שם הספק",
        "amount": 123.45
      }
    ]
  }
}`
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      console.log(`📄 Page ${i + 1} response:`, content.substring(0, 200) + '...');

      try {
        const result = JSON.parse(content);
        if (result.transactions) {
          allResults.push({
            page: i + 1,
            transactions: result.transactions
          });
        }
      } catch (e) {
        console.log(`❌ Failed to parse page ${i + 1} JSON`);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Combine all results
    const combinedIncome = [];
    const combinedExpenses = [];

    allResults.forEach(result => {
      if (result.transactions.income) {
        combinedIncome.push(...result.transactions.income);
      }
      if (result.transactions.expenses) {
        combinedExpenses.push(...result.transactions.expenses);
      }
    });

    console.log('\n🎉 COMBINED RESULTS:');
    console.log(`💰 Total Income: ${combinedIncome.length}`);
    console.log(`💸 Total Expenses: ${combinedExpenses.length}`);

    console.log('\n📊 ALL INCOME:');
    combinedIncome.forEach((tx, i) => {
      console.log(`${i + 1}. ${tx.date} - ${tx.vendor} - ₪${tx.amount}`);
    });

    console.log('\n📊 ALL EXPENSES:');
    combinedExpenses.forEach((tx, i) => {
      console.log(`${i + 1}. ${tx.date} - ${tx.vendor} - ₪${tx.amount}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
const pdfPath = '/Users/idosegev/Downloads/דף פירוט דיגיטלי כאל 09-25.pdf';
splitPDFAndAnalyze(pdfPath);

import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testPDFUploadAndAnalyze() {
  try {
    console.log('🎯 Testing PDF upload to OpenAI Files API and then analysis...');

    const pdfPath = '/Users/idosegev/Downloads/דף פירוט דיגיטלי כאל 09-25.pdf';
    console.log(`📁 Reading PDF: ${pdfPath}`);

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found at:', pdfPath);
      return;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`📄 PDF size: ${pdfBuffer.length} bytes`);

    console.log('📤 Uploading PDF to OpenAI Files API...');

    // First upload the file
    const fileUpload = await openai.files.create({
      file: fs.createReadStream(pdfPath),
      purpose: 'assistants'
    });

    console.log('✅ File uploaded, ID:', fileUpload.id);

    console.log('🤖 Analyzing with GPT-4o using file ID...');

    const startTime = Date.now();

    // Now use the file ID in chat completions
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
            text: `חלץ את כל התנועות הבנקאיות מהדוח הזה בפורמט JSON.

            החזר רק JSON תקין עם המבנה הבא:
            {
              "report_info": {
                "bank_name": "שם הבנק",
                "account_number": "מספר חשבון",
                "period_start": "YYYY-MM-DD",
                "period_end": "YYYY-MM-DD"
              },
              "transactions": {
                "income": [
                  {
                    "date": "YYYY-MM-DD",
                    "vendor": "שם הספק",
                    "amount": 123.45,
                    "category": "קטגוריה"
                  }
                ],
                "expenses": [
                  {
                    "date": "YYYY-MM-DD",
                    "vendor": "שם הספק",
                    "amount": 123.45,
                    "category": "קטגוריה"
                  }
                ]
              }
            }`
          }
        ]
      }],
      temperature: 0.1,
      max_tokens: 16384,
      response_format: { type: 'json_object' }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ GPT-4o response received in ${duration}s`);

    const content = response.choices[0]?.message?.content;
    console.log('📄 Raw Response:');
    console.log(content);

    if (content) {
      try {
        const result = JSON.parse(content);
        console.log('🎉 Success! JSON parsed correctly');
        console.log('📊 Extracted transactions:');

        console.log('\n💰 INCOME:');
        if (result.transactions?.income?.length > 0) {
          result.transactions.income.forEach((tx, i) => {
            console.log(`${i + 1}. ${tx.date} - ${tx.vendor} - ₪${tx.amount} (${tx.category})`);
          });
        } else {
          console.log('No income transactions found');
        }

        console.log('\n💸 EXPENSES:');
        if (result.transactions?.expenses?.length > 0) {
          result.transactions.expenses.forEach((tx, i) => {
            console.log(`${i + 1}. ${tx.date} - ${tx.vendor} - ₪${tx.amount} (${tx.category})`);
          });
        } else {
          console.log('No expense transactions found');
        }

      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testPDFUploadAndAnalyze();

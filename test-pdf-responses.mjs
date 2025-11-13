import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testPDFResponsesAPI() {
  try {
    console.log('🎯 Testing OpenAI Responses API with PDF...');

    const pdfPath = '/Users/idosegev/Downloads/גדי ברקאי דוח עוש וכ.א.pdf';
    console.log(`📁 Reading PDF: ${pdfPath}`);

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found at:', pdfPath);
      return;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64PDF = pdfBuffer.toString('base64');

    console.log(`📄 PDF size: ${pdfBuffer.length} bytes, Base64: ${base64PDF.length} chars`);

    console.log('🤖 Sending to OpenAI Responses API...');

    const startTime = Date.now();

    // Try the Responses API (for newer models)
    const response = await openai.responses.create({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              data: base64PDF,
              mime_type: 'application/pdf'
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
        }
      ],
      max_output_tokens: 3000
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Response received in ${duration}s`);

    const content = response.output_text;
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
testPDFResponsesAPI();

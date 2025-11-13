import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 1 minute
  maxRetries: 1,
});

// Test if GPT-5-mini can read PDF directly
async function testPDFDirect() {
  try {
    console.log('🎯 Testing GPT-5-mini with PDF file directly...');

    // Read the specific PDF file provided by user
    const pdfPath = '/Users/idosegev/Downloads/גדי ברקאי דוח עוש וכ.א.pdf';
    console.log(`📁 Reading PDF: ${pdfPath}`);

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found at:', pdfPath);
      return;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64PDF = pdfBuffer.toString('base64');

    console.log(`📄 PDF size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`📄 Base64 size: ${base64PDF.length} chars`);

    // Try to send PDF directly to GPT-5-mini
    const prompt = `אתה מומחה בניתוח דוחות בנק ישראליים.

נתח את דוח הבנק הבא וחלץ את כל המידע הרלוונטי בפורמט JSON.

החזר רק JSON תקין, ללא טקסט נוסף.

פורמט JSON:
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
}`;

    console.log('🤖 Sending to GPT-5-mini...');

    const startTime = Date.now();

    // Try different approaches
    const approaches = [
      {
        name: 'Base64 PDF as text',
        messages: [{
          role: 'user',
          content: `Analyze this PDF document (base64 encoded):\n\n${base64PDF}\n\n${prompt}`
        }]
      },
      {
        name: 'PDF as data URL',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64PDF}`
              }
            }
          ]
        }]
      }
    ];

    for (const approach of approaches) {
      try {
        console.log(`\n🔄 Trying approach: ${approach.name}`);

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: approach.messages,
          temperature: 0.1,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ ${approach.name} completed in ${duration}s`);

        const content = response.choices[0]?.message?.content;
        console.log('📄 Response:', content?.substring(0, 500) + '...');

        if (content) {
          try {
            const result = JSON.parse(content);
            console.log('🎉 Success! JSON parsed correctly');
            console.log('📊 Extracted:', JSON.stringify(result, null, 2));
            return result;
          } catch (parseError) {
            console.log('❌ JSON parsing failed:', parseError.message);
          }
        }

      } catch (error) {
        console.error(`❌ ${approach.name} failed:`, error.message);
      }
    }

    console.log('\n❌ All approaches failed. GPT-5-mini cannot read PDF files directly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPDFDirect();

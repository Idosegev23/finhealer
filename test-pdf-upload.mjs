import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('🔍 Testing GPT-5.1 with Responses API...');

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

    console.log('🤖 Analyzing with GPT-5.1 using Responses API...');

    const startTime = Date.now();

    // Use GPT-5.1 with Responses API
    console.log('🔄 Using GPT-5.1...');

    const inputText = `Analyze this PDF document and extract all financial transactions in JSON format.

Return only valid JSON with this structure:
{
  "report_info": {
    "bank_name": "Bank name",
    "account_number": "Account number",
    "period_start": "YYYY-MM-DD",
    "period_end": "YYYY-MM-DD"
  },
  "transactions": {
    "income": [
      {
        "date": "YYYY-MM-DD",
        "vendor": "Vendor name",
        "amount": 123.45,
        "category": "Category"
      }
    ],
    "expenses": [
      {
        "date": "YYYY-MM-DD",
        "vendor": "Vendor name",
        "amount": 123.45,
        "category": "Category"
      }
    ]
  }
}`;

    console.log('📤 Sending to GPT-5.1 via Responses API...');

    const response = await openai.responses.create({
      model: 'gpt-5.1',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              file_id: fileUpload.id
            },
            {
              type: 'input_text',
              text: inputText
            }
          ]
        }
      ],
      reasoning: { effort: 'none' },
      text: { verbosity: 'low' },
      max_output_tokens: 32000
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ GPT-5.1 response received in ${duration}s`);

    const content = response.output_text;
    console.log('📄 Raw Response:');
    console.log(content);

    if (content) {
      // Try to extract JSON from the response
      let jsonContent = content;

      // Check if response is wrapped in markdown code blocks
      const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
        console.log('📦 Extracted JSON from markdown code block');
      }

      try {
        const result = JSON.parse(jsonContent);
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
        console.log('🔍 Full response content:');
        console.log(content);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testPDFUploadAndAnalyze();

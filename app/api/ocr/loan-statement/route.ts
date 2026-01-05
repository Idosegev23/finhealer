import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const statementImage = formData.get('statement') as File | null;

    if (!statementImage) {
      return NextResponse.json(
        { error: 'Loan statement image is required' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const buffer = await statementImage.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${statementImage.type};base64,${base64}`;

    // 🆕 GPT-5.2 with Responses API
    const systemPrompt = `You are an OCR system specialized in Israeli loan payoff statements (דוח סילוקין).
Extract all loan information accurately from Hebrew/English documents.
Return ONLY valid JSON with no additional text.

Extract the following fields:
- lenderName (string): Name of the lending institution (bank, company)
- loanType (string): Type of loan (mortgage/משכנתא, personal/אישית, car/רכב, student/לימודים, credit/אשראי, other/אחר)
- originalAmount (number): Original loan amount in ILS
- currentBalance (number): Current outstanding balance in ILS
- monthlyPayment (number): Monthly payment amount in ILS
- interestRate (number): Annual interest rate as percentage (e.g., 3.5)
- startDate (string): Loan start date in YYYY-MM-DD format if visible
- endDate (string): Expected payoff date in YYYY-MM-DD format if visible
- remainingPayments (number): Number of payments remaining if visible
- loanNumber (string): Loan account/reference number if visible

Return format:
{
  "lenderName": "string",
  "loanType": "string",
  "originalAmount": number,
  "currentBalance": number,
  "monthlyPayment": number,
  "interestRate": number,
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "remainingPayments": number or null,
  "loanNumber": "string or null"
}`;

    const userPrompt = 'Extract all loan information from this Israeli loan payoff statement (דוח סילוקין):';

    const response = await openai.responses.create({
      model: 'gpt-5.2-2025-12-11',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: systemPrompt + '\n\n' + userPrompt },
            { type: 'input_image', image_url: dataUrl, detail: 'high' },
          ]
        }
      ],
      reasoning: { effort: 'medium' },
    });

    const result = response.output_text;
    if (!result) {
      throw new Error('No response from OCR');
    }

    // Parse JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(result);
    } catch (e) {
      console.error('Failed to parse OCR response:', result);
      throw new Error('Invalid OCR response format');
    }

    // Validate required fields
    if (!parsedData.currentBalance || !parsedData.monthlyPayment) {
      throw new Error('Could not extract required loan information');
    }

    return NextResponse.json({
      success: true,
      data: parsedData
    });

  } catch (error: any) {
    console.error('Loan statement OCR error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process loan statement' },
      { status: 500 }
    );
  }
}


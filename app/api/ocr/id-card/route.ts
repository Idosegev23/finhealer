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
    const idCardImage = formData.get('idCard') as File | null;
    const appendixImage = formData.get('appendix') as File | null;

    if (!idCardImage) {
      return NextResponse.json(
        { error: 'ID card image is required' },
        { status: 400 }
      );
    }

    // Convert images to base64
    const idCardBuffer = await idCardImage.arrayBuffer();
    const idCardBase64 = Buffer.from(idCardBuffer).toString('base64');
    const idCardDataUrl = `data:${idCardImage.type};base64,${idCardBase64}`;

    let appendixBase64 = null;
    let appendixDataUrl = null;
    if (appendixImage) {
      const appendixBuffer = await appendixImage.arrayBuffer();
      appendixBase64 = Buffer.from(appendixBuffer).toString('base64');
      appendixDataUrl = `data:${appendixImage.type};base64,${appendixBase64}`;
    }

    // Use GPT-4 Vision to extract data from ID card
    const messages: any[] = [
      {
        role: 'system',
        content: `You are an OCR system specialized in Israeli ID cards (תעודת זהות). Extract all visible information accurately.
Return ONLY valid JSON with no additional text.

For the ID card, extract:
- fullName (string): Full name in Hebrew
- idNumber (string): 9-digit ID number
- birthDate (string): Format YYYY-MM-DD
- gender (string): "male" or "female"
- address (string): Full address in Hebrew
- issueDate (string): Format YYYY-MM-DD if visible

${appendixImage ? `For the appendix (ספח), extract an array of children:
- children (array): Each child should have:
  - name (string): Child's full name in Hebrew
  - idNumber (string): 9-digit ID number
  - birthDate (string): Format YYYY-MM-DD
  - gender (string): "male" or "female"` : ''}

Return format:
{
  "idCard": { /* extracted ID card data */ },
  ${appendixImage ? '"children": [ /* array of children */ ]' : '"children": []'}
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all information from this Israeli ID card:'
          },
          {
            type: 'image_url',
            image_url: {
              url: idCardDataUrl
            }
          }
        ]
      }
    ];

    // Add appendix image if exists
    if (appendixDataUrl) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all children information from this appendix (ספח):'
          },
          {
            type: 'image_url',
            image_url: {
              url: appendixDataUrl
            }
          }
        ]
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 1000,
      temperature: 0,
    });

    const result = response.choices[0].message.content;
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

    return NextResponse.json({
      success: true,
      data: parsedData
    });

  } catch (error: any) {
    console.error('ID Card OCR error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process ID card' },
      { status: 500 }
    );
  }
}


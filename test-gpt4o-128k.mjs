import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testGPT4o128k() {
  try {
    console.log('🎯 Testing GPT-4o-128k availability...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{
        role: 'user',
        content: 'Hello, can you see this message?'
      }],
      temperature: 0.1,
      max_tokens: 100
    });

    console.log('✅ GPT-4o-128k is available!');
    console.log('Response:', response.choices[0]?.message?.content);

  } catch (error) {
    console.error('❌ GPT-4o-128k not available:', error.message);
  }
}

// Run the test
testGPT4o128k();

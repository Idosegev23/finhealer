#!/usr/bin/env node

/**
 * Simple OpenAI connection test
 */

const OpenAI = require('openai');

async function testConnection() {
  console.log('🔍 Testing OpenAI connection...\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found!');
    process.exit(1);
  }
  
  console.log(`✅ API Key found: ${process.env.OPENAI_API_KEY.substring(0, 20)}...`);
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  console.log('\n🤖 Sending simple test request to GPT-4o-mini...');
  console.log(`⏱️  Started at: ${new Date().toLocaleTimeString()}\n`);
  
  const startTime = Date.now();
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Hello from gpt-4o-mini!"' }],
      max_tokens: 50,
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`✅ Response received in ${duration}s`);
    console.log(`⏱️  Finished at: ${new Date().toLocaleTimeString()}\n`);
    
    console.log('📝 Response:');
    console.log(response.choices[0]?.message?.content);
    console.log();
    
    console.log('📊 Token usage:');
    console.log(`   Prompt: ${response.usage?.prompt_tokens}`);
    console.log(`   Completion: ${response.usage?.completion_tokens}`);
    console.log(`   Total: ${response.usage?.total_tokens}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

testConnection();


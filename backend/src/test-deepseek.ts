import 'dotenv/config';
import OpenAI from 'openai';

async function testDeepseekAPI() {
  console.log('🧪 Testing Deepseek API connection...');
  console.log('API Key present:', !!process.env.DEEPSEEK_API_KEY);
  console.log('API Key prefix:', process.env.DEEPSEEK_API_KEY?.substring(0, 10) + '...');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY not found in environment variables');
    return;
  }

  const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
  });

  try {
    console.log('📡 Making test API call to deepseek-reasoner...');
    
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-reasoner',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: 'Test message. Please respond with JSON containing a "status" field set to "ok" and a "message" field.',
        },
      ],
      response_format: { type: 'json_object' },
    });

    console.log('✅ API call successful!');
    console.log('Response:', response.choices[0].message.content);
    
    // Test parsing the response
    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    console.log('Parsed response:', parsed);
    
  } catch (error) {
    console.error('❌ API call failed:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if ('response' in error) {
        console.error('API Response:', (error as any).response);
      }
      if ('status' in error) {
        console.error('Status:', (error as any).status);
      }
    }
  }
}

// Run the test
testDeepseekAPI();
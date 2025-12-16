import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.listModels();
    console.log('Available models:');
    for await (const model of models) {
      if (model.supportedGenerationMethods.includes('generateContent')) {
        console.log(`- ${model.name}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();

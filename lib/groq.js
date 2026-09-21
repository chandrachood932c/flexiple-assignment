import { cookies } from 'next/headers';
import { getApiConfig } from '@/lib/api-config-store';
import Groq from 'groq-sdk';

export async function getGroqInstance() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('recruiter_session')?.value;
  const config = sessionId ? getApiConfig(sessionId) : null;

  console.log(config, 'config');
  const apiKey = config?.apiKey ? config.apiKey.trim() : null;
  const model = config?.apiModel ? config.apiModel.trim() : '';

  if (!apiKey || !model) {
    throw new Error('Groq API Key is not configured. Please open API Settings and save your API key.');
  }

  return {
    groq: new Groq({ apiKey }),
    model,
    apiKey,
  };
}

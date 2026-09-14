import { notImplemented } from '../lib/response';

export function handleAI(pathname: string) {
  if (pathname === '/api/ai/analyze-photo') return notImplemented('ai.analyzePhoto', ['OPENAI_API_KEY']);
  if (pathname === '/api/ai/generate-content') return notImplemented('ai.generateContent', ['OPENAI_API_KEY']);
  if (pathname === '/api/ai/rewrite') return notImplemented('ai.rewriteContent', ['OPENAI_API_KEY']);
  return null;
}

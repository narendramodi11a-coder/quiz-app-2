import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';
const ai = new GoogleGenAI({});

export default async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    const { prompt, inlineData } = await request.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return Response.json({ error: 'Empty prompt provided.' }, { status: 400 });
    }

    const parts = [{ text: prompt.trim() }];

    if (inlineData !== null && inlineData !== undefined) {
      if (
        typeof inlineData !== 'object' ||
        typeof inlineData.mimeType !== 'string' ||
        typeof inlineData.data !== 'string' ||
        !inlineData.mimeType ||
        !inlineData.data
      ) {
        return Response.json({ error: 'Invalid inline data.' }, { status: 400 });
      }

      parts.push({
        inlineData: {
          mimeType: inlineData.mimeType,
          data: inlineData.data,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
    });

    const text = response.text?.trim();
    if (!text) {
      return Response.json({ error: 'Gemini returned an empty response.' }, { status: 502 });
    }

    return Response.json({ text });
  } catch (error) {
    const status = error?.status === 429 ? 429 : 502;
    console.error('Gemini request failed:', error);
    return Response.json(
      {
        error:
          status === 429
            ? 'Gemini rate limit reached. Please try again shortly.'
            : 'Gemini could not complete the request.',
      },
      { status },
    );
  }
};

export const config = {
  path: '/api/gemini',
};

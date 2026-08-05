import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const staticPath = path.join(process.cwd(), 'quiznova-x');
app.use(express.static(staticPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/config', (req, res) => {
  res.json({ isConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post('/api/gemini', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY environment variable is not configured.' });
    }

    const { prompt, inlineData, model } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Empty prompt provided.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const selectedModel = model || 'gemini-2.5-flash';

    const parts = [{ text: prompt }];

    if (inlineData && inlineData.mimeType && inlineData.data) {
      parts.push({
        inlineData: {
          mimeType: inlineData.mimeType,
          data: inlineData.data,
        }
      });
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ parts }],
    });

    const text = response.text || '';
    return res.json({ text });
  } catch (err) {
    console.error('Gemini API Error:', err);
    return res.status(500).json({ error: err.message || 'Error executing Gemini request.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`QuizNova X server running on http://0.0.0.0:${PORT}`);
});

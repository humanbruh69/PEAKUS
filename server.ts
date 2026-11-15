import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check endpoint for Cloud Run startup/liveness probes
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractFriendlyErrorMessage(err: any): string {
  if (!err) return 'An error occurred while contacting Study Bot.';
  let msg = err.message || String(err);
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error?.message) {
      msg = parsed.error.message;
    }
  } catch {
    // raw string
  }
  return msg;
}

async function callGeminiWithFallback(modelName: string, contents: any[], systemInstruction: string) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }

  const modelsToTry = Array.from(new Set([modelName, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']));
  let lastError: any = null;

  for (const candidate of modelsToTry) {
    try {
      return await ai.models.generateContent({
        model: candidate,
        contents,
        config: { systemInstruction },
      });
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err?.message?.includes('503') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.status === 503 ||
        err?.message?.includes('429') ||
        err?.status === 429;
      if (isRetryable) {
        console.warn(`Model ${candidate} unavailable, trying fallback candidate...`);
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function streamGeminiWithFallback(modelName: string, contents: any[], systemInstruction: string) {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }

  const modelsToTry = Array.from(new Set([modelName, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']));
  let lastError: any = null;

  for (const candidate of modelsToTry) {
    try {
      return await ai.models.generateContentStream({
        model: candidate,
        contents,
        config: { systemInstruction },
      });
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err?.message?.includes('503') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.status === 503 ||
        err?.message?.includes('429') ||
        err?.status === 429;
      if (isRetryable) {
        console.warn(`Model ${candidate} stream unavailable, trying fallback candidate...`);
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Non-streaming endpoint
app.post('/api/study-bot/chat', async (req: Request, res: Response) => {
  try {
    const { messages, mode, context } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not set. Please configure your API key in Settings > Secrets.',
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    let modelName = 'gemini-3.8-flash';
    if (mode === 'fast') {
      modelName = 'gemini-3.1-flash-lite';
    } else if (mode === 'deep') {
      modelName = 'gemini-4-argon';
    }

    const contents = messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    let sessionContext = '';
    if (context) {
      const parts: string[] = [];
      if (context.activeTask) parts.push(`User's active study task: "${context.activeTask}"`);
      if (context.timerPhase) parts.push(`Timer state: ${context.timerPhase} (${context.timerMinutes || 25} min)`);
      if (context.subject) parts.push(`Subject/Topic: ${context.subject}`);
      if (parts.length > 0) {
        sessionContext = `\nCurrent focus context:\n- ${parts.join('\n- ')}\n`;
      }
    }

    const systemInstruction = `You are Peakus Study Bot, an intelligent, distraction-free study companion and academic tutor embedded directly inside Peakus.
Your primary role is to answer student questions, explain difficult concepts clearly, guide step-by-step problem solving, clarify formulas and code, and provide memory mnemonics without requiring the student to juggle multiple browser tabs, search engines, or external apps.

Core Principles:
1. Distraction-Free & Concise: Students are in a focused study session. Deliver direct, well-organized answers. Avoid excessive filler or preamble.
2. Structured Formatting: Use Markdown with clear headings (###), bold key terms, numbered steps for problem-solving, and clean code/formula blocks.
3. Intuitive Clarity: Start with the intuitive "big picture" or core answer, then explain the mechanics step-by-step.
4. Encouraging & Academic: Be warm, constructive, and supportive. Emphasize understanding over rote memorization.
5. Socratic Follow-up: At the end of deep explanations, suggest 1-2 concise follow-up questions or practice checks to test comprehension.${sessionContext}`;

    const response = await callGeminiWithFallback(modelName, contents, systemInstruction);

    const replyText = response.text || 'I could not generate an answer at this moment.';
    return res.json({ text: replyText, model: modelName });
  } catch (error: any) {
    console.error('Study Bot error:', error);
    const errorMessage = extractFriendlyErrorMessage(error);
    return res.status(500).json({ error: errorMessage });
  }
});

// Real-time SSE streaming endpoint for instant interactive responses
app.post('/api/study-bot/stream', async (req: Request, res: Response) => {
  try {
    const { messages, mode, context } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      res.status(400).json({
        error: 'GEMINI_API_KEY is not set. Please configure your API key in Settings > Secrets.',
      });
      return;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    let modelName = 'gemini-3.8-flash';
    if (mode === 'fast') {
      modelName = 'gemini-3.1-flash-lite';
    } else if (mode === 'deep') {
      modelName = 'gemini-4-argon';
    }

    const contents = messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    let sessionContext = '';
    if (context) {
      const parts: string[] = [];
      if (context.activeTask) parts.push(`User's active study task: "${context.activeTask}"`);
      if (context.timerPhase) parts.push(`Timer state: ${context.timerPhase} (${context.timerMinutes || 25} min)`);
      if (context.subject) parts.push(`Subject/Topic: ${context.subject}`);
      if (parts.length > 0) {
        sessionContext = `\nCurrent focus context:\n- ${parts.join('\n- ')}\n`;
      }
    }

    const systemInstruction = `You are Peakus Study Bot, an intelligent, distraction-free study companion and academic tutor embedded directly inside Peakus.
Your primary role is to answer student questions, explain difficult concepts clearly, guide step-by-step problem solving, clarify formulas and code, and provide memory mnemonics without requiring the student to juggle multiple browser tabs, search engines, or external apps.

Core Principles:
1. Distraction-Free & Concise: Students are in a focused study session. Deliver direct, well-organized answers. Avoid excessive filler or preamble.
2. Structured Formatting: Use Markdown with clear headings (###), bold key terms, numbered steps for problem-solving, and clean code/formula blocks.
3. Intuitive Clarity: Start with the intuitive "big picture" or core answer, then explain the mechanics step-by-step.
4. Encouraging & Academic: Be warm, constructive, and supportive. Emphasize understanding over rote memorization.
5. Socratic Follow-up: At the end of deep explanations, suggest 1-2 concise follow-up questions or practice checks to test comprehension.${sessionContext}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const responseStream = await streamGeminiWithFallback(modelName, contents, systemInstruction);

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Study Bot stream error:', error);
    const errorMessage = extractFriendlyErrorMessage(error);
    if (!res.headersSent) {
      res.status(500).json({ error: errorMessage });
    } else {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
});

async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));

  // Cloud Run sets K_SERVICE/K_REVISION for both dev sandbox and prod; check NODE_ENV and npm script first
  const isExplicitProd = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
  const isExplicitDev =
    !isExplicitProd &&
    (process.env.NODE_ENV === 'development' ||
      process.env.npm_lifecycle_event === 'dev' ||
      process.argv.includes('--dev'));

  const isProd = isExplicitProd || (!isExplicitDev && hasDist);
  const port = Number(process.env.PORT) || 3000;

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (hasDist) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn(`[Peakus Server] Production mode active but dist folder not found at ${distPath}.`);
      app.get('*', (_req: Request, res: Response) => {
        res.status(503).send('Peakus is initializing. Please ensure "npm run build" has completed.');
      });
    }
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Peakus Server listening on http://0.0.0.0:${port} [mode: ${isProd ? 'production' : 'development'}]`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, closing server...`);
    server.close(() => {
      console.log('Server terminated cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();

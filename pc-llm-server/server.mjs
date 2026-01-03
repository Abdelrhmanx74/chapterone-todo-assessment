import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

import express from 'express';
import cors from 'cors';
import { getLlama } from 'node-llama-cpp';

const PORT = Number(process.env.PORT ?? 3333);
const HOST = process.env.HOST ?? '0.0.0.0';

const MODELS_DIR = path.join(process.cwd(), 'models');

/**
 * Requirements from user:
 * - 3 models
 * - include Qwen 1.5 (normal), Qwen 1.5 (4q), Phi 3 (or similar)
 * - each file < 1GB
 */
const MODELS = [
  {
    id: 'qwen15',
    label: 'Qwen 1.5 (Q2_K)',
    filename: 'qwen1_5-0_5b-chat-q2_k.gguf',
    url: 'https://huggingface.co/Qwen/Qwen1.5-0.5B-Chat-GGUF/resolve/main/qwen1_5-0_5b-chat-q2_k.gguf',
  },
  {
    id: 'qwen15-4q',
    label: 'Qwen 1.5 (Q4_0)',
    filename: 'qwen1_5-0_5b-chat-q4_0.gguf',
    url: 'https://huggingface.co/Qwen/Qwen1.5-0.5B-Chat-GGUF/resolve/main/qwen1_5-0_5b-chat-q4_0.gguf',
  },
  {
    id: 'phi3',
    label: 'Phi-3 mini (IQ1_S)',
    filename: 'Phi-3-mini-4k-instruct-IQ1_S.gguf',
    url: 'https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-IQ1_S.gguf',
  },
];

function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function fileSizeBytes(filePath) {
  try {
    const st = await fsp.stat(filePath);
    return st.size;
  } catch {
    return null;
  }
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + '.partial';

    const proto = url.startsWith('https:') ? https : http;

    const req = proto.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirects
        downloadToFile(res.headers.location, destPath).then(resolve, reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${url} (status ${res.statusCode})`));
        res.resume();
        return;
      }

      const total = Number(res.headers['content-length'] ?? 0);
      let written = 0;

      const file = fs.createWriteStream(tmpPath);
      res.on('data', (chunk) => {
        written += chunk.length;
        if (total > 0) {
          const pct = Math.round((written / total) * 100);
          if (pct % 5 === 0) {
            process.stdout.write(`\rDownloading ${path.basename(destPath)}... ${pct}%`);
          }
        }
      });

      res.pipe(file);

      file.on('finish', async () => {
        file.close(async () => {
          try {
            await fsp.rename(tmpPath, destPath);
            process.stdout.write('\n');
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      file.on('error', async (err) => {
        try {
          file.close();
        } catch {}
        try {
          await fsp.rm(tmpPath, { force: true });
        } catch {}
        reject(err);
      });
    });

    req.on('error', reject);
  });
}

async function ensureModelDownloaded(model) {
  await ensureDir(MODELS_DIR);
  const modelPath = path.join(MODELS_DIR, model.filename);

  const size = await fileSizeBytes(modelPath);
  // Treat files under 50MB as broken for these GGUFs
  if (size != null && size > 50 * 1024 * 1024) return modelPath;

  if (size != null) {
    try {
      await fsp.rm(modelPath, { force: true });
    } catch {}
  }

  console.log(`Downloading model: ${model.label}`);
  await downloadToFile(model.url, modelPath);

  return modelPath;
}

let llamaPromise = null;
let jsonGrammarPromise = null;

async function getLlamaOnce() {
  if (!llamaPromise) llamaPromise = getLlama();
  return llamaPromise;
}

async function getJsonGrammarOnce() {
  if (!jsonGrammarPromise) {
    jsonGrammarPromise = (async () => {
      const llama = await getLlamaOnce();
      return llama.getGrammarFor('json');
    })();
  }
  return jsonGrammarPromise;
}

const loadedModels = new Map();

async function getLoadedModel(modelId) {
  const cfg = MODELS.find((m) => m.id === modelId);
  if (!cfg) throw new Error(`Unknown modelId: ${modelId}`);

  if (loadedModels.has(cfg.id)) return loadedModels.get(cfg.id);

  const modelPath = await ensureModelDownloaded(cfg);
  const llama = await getLlamaOnce();

  console.log(`Loading model into memory: ${cfg.label}`);
  const model = await llama.loadModel({ modelPath });

  loadedModels.set(cfg.id, { cfg, model });
  return loadedModels.get(cfg.id);
}

function buildTodoSystemPrompt(todos) {
  const todoListJson = JSON.stringify(
    (Array.isArray(todos) ? todos : []).map((t) => ({
      id: t?.id,
      title: t?.title,
      completed: !!t?.completed,
    }))
  );

  return `You are a smart AI assistant for a To-Do list app.
Your goal is to help the user manage their tasks.
Current tasks: ${todoListJson}

Instructions:
1. Analyze the user's request.
2. Determine if they want to ADD, DELETE, or UPDATE a task, or just CHAT.
3. Output the result as a JSON object.

Output Format (JSON only):
- To ADD: { "action": "add", "title": "Task description" }
- To DELETE: { "action": "delete", "id": {task id} }
- To UPDATE: { "action": "update", "id": {task id}, "title": "New title", "completed": true/false, etc... }
- To CHAT: { "reply": "Your response here" }

Examples:
User: "Buy milk"
Output: { "action": "add", "title": "Buy milk" }

User: "Remove completed tasks"
Output: { "action": "delete", "id": {task id} }

User: "Hello"
Output: { "reply": "Hi there! How can I help with your tasks?" }

Respond ONLY with the JSON object. Do NOT return an empty object {}.`;
}

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  json(res, 200, { ok: true });
});

app.get('/models', async (_req, res) => {
  try {
    await ensureDir(MODELS_DIR);
    const models = await Promise.all(
      MODELS.map(async (m) => {
        const p = path.join(MODELS_DIR, m.filename);
        const sizeBytes = await fileSizeBytes(p);
        return {
          id: m.id,
          label: m.label,
          filename: m.filename,
          downloaded: sizeBytes != null && sizeBytes > 50 * 1024 * 1024,
          sizeBytes,
        };
      })
    );

    json(res, 200, { models });
  } catch (e) {
    json(res, 500, { error: e?.message ?? String(e) });
  }
});

app.post('/todo', async (req, res) => {
  try {
    const { modelId, userMsg, todos } = req.body ?? {};

    if (typeof modelId !== 'string') return json(res, 400, { error: 'modelId is required' });
    if (typeof userMsg !== 'string' || !userMsg.trim())
      return json(res, 400, { error: 'userMsg is required' });

    const { model } = await getLoadedModel(modelId);
    const context = await model.createContext({ contextSize: 2048 });

    const { LlamaChatSession } = await import('node-llama-cpp');

    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: buildTodoSystemPrompt(todos),
    });

    const grammar = await getJsonGrammarOnce();

    const response = await session.prompt(userMsg, {
      temperature: 0.1,
      topK: 40,
      topP: 0.95,
      maxTokens: 256,
      repeatPenalty: 1.1,
      grammar,
    });

    // Best-effort cleanup for per-request contexts
    try {
      session.dispose({ disposeSequence: true });
    } catch {}

    json(res, 200, { text: response?.trim?.() ?? String(response) });
  } catch (e) {
    json(res, 500, { error: e?.message ?? String(e) });
  }
});

async function warmupDownloads() {
  // Download sequentially to keep logs readable.
  for (const m of MODELS) {
    await ensureModelDownloaded(m);
  }
}

app.listen(PORT, HOST, async () => {
  console.log(`PC LLM server listening on http://${HOST}:${PORT}`);
  console.log(`Models dir: ${MODELS_DIR}`);

  try {
    await warmupDownloads();
    console.log('All model files are present.');
  } catch (e) {
    console.warn('Model download warmup failed:', e?.message ?? e);
    console.warn('The server can still start; it will retry on first request.');
  }
});

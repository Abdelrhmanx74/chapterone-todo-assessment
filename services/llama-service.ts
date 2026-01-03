import { initLlama, LlamaContext, TokenData } from 'llama.rn';
import FS from 'react-native-fs2';

declare global {
  // Persist across Fast Refresh / HMR
  // eslint-disable-next-line no-var
  var __llamaService: any;
  // eslint-disable-next-line no-var
  var __llamaDownloadPromise: Promise<void> | null | undefined;
  // eslint-disable-next-line no-var
  var __llamaInitPromise: Promise<void> | null | undefined;
  // eslint-disable-next-line no-var
  var __llamaCompletionQueue: Promise<void> | undefined;
}

// Qwen2-1.5B-Instruct - Much better reasoning and instruction following than Qwen 1.5
// Q2_K quantization is much smaller and more likely to load on mobile/emulators.
const DOWNLOAD_URL =
  'https://huggingface.co/Qwen/Qwen2-1.5B-Instruct-GGUF/resolve/main/qwen2-1_5b-instruct-q2_k.gguf';
const MODEL_FILENAME = 'qwen2-1.5b-instruct-q2_k.gguf';
const MODEL_PATH = `${FS.DocumentDirectoryPath}/${MODEL_FILENAME}`;

// Old model files to delete on upgrade
const OLD_MODEL_FILES = [
  'qwen-0.5b-chat.gguf',
  'qwen2-1.5b-instruct-q4_k_m.gguf',
  'qwen2-1.5b-instruct-q4_k_m.gguf',
  'qwen2-1.5b-instruct-q2_k.gguf',
];

// Set to true once to force re-download of corrupted model, then set back to false
const FORCE_REDOWNLOAD = false;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class LlamaService {
  private context: LlamaContext | null = null;
  public isInitialized = false;

  private async safeStat(path: string): Promise<{ size: number } | null> {
    try {
      if (typeof (FS as any).stat !== 'function') return null;
      const stat = await (FS as any).stat(path);
      const size = Number(stat?.size ?? 0);
      return Number.isFinite(size) ? { size } : null;
    } catch {
      return null;
    }
  }

  private async ensureModelFileIsValid(): Promise<void> {
    const exists = await FS.exists(MODEL_PATH);
    if (!exists) return;

    const stat = await this.safeStat(MODEL_PATH);
    // If we can't stat, we can't validate; assume ok.
    if (!stat) return;

    // Guard against truncated / partial downloads.
    // Even the smallest usable GGUFs are typically >100MB.
    if (stat.size < 100 * 1024 * 1024) {
      console.warn(`Model file looks too small (${stat.size} bytes). Deleting and re-downloading.`);
      try {
        await FS.unlink(MODEL_PATH);
      } catch {}
    }
  }

  async getLocalModelInfo(): Promise<{ path: string; exists: boolean; sizeBytes?: number }> {
    const exists = await FS.exists(MODEL_PATH);
    const stat = exists ? await this.safeStat(MODEL_PATH) : null;
    return {
      path: MODEL_PATH,
      exists,
      sizeBytes: stat?.size,
    };
  }

  async deleteLocalModel(): Promise<void> {
    try {
      await this.context?.release();
    } catch {}

    this.context = null;
    this.isInitialized = false;
    globalThis.__llamaInitPromise = null;
    globalThis.__llamaDownloadPromise = null;

    try {
      const exists = await FS.exists(MODEL_PATH);
      if (exists) {
        console.log('Deleting local model file...');
        await FS.unlink(MODEL_PATH);
      }
    } catch (err) {
      console.warn('Failed to delete local model file:', err);
    }
  }

  getModelPath(): string {
    return MODEL_PATH;
  }

  private async cleanupOldModels() {
    for (const oldFile of OLD_MODEL_FILES) {
      const oldPath = `${FS.DocumentDirectoryPath}/${oldFile}`;
      try {
        // Don't delete the current model file during upgrade cleanup.
        if (oldPath === MODEL_PATH) continue;
        const exists = await FS.exists(oldPath);
        if (exists) {
          console.log(`Deleting old model: ${oldFile}`);
          await FS.unlink(oldPath);
        }
      } catch (err) {
        console.warn(`Failed to delete old model ${oldFile}:`, err);
      }
    }
  }

  private async downloadModel(progressCallback?: (progress: number) => void) {
    // Cross-instance lock (Fast Refresh can create multiple instances)
    if (globalThis.__llamaDownloadPromise) return globalThis.__llamaDownloadPromise;

    globalThis.__llamaDownloadPromise = (async () => {
      try {
        // Clean up old model files first
        await this.cleanupOldModels();

        // If the existing model file is corrupted/truncated, delete it.
        await this.ensureModelFileIsValid();

        const exists = await FS.exists(MODEL_PATH);

        // Force re-download if flag is set (for corrupted downloads)
        if (exists && FORCE_REDOWNLOAD) {
          console.log('Force re-download enabled, deleting existing model...');
          await FS.unlink(MODEL_PATH);
        } else if (exists) {
          console.log('Model already exists.');
          return;
        }

        console.log('Downloading model...');
        const { promise } = FS.downloadFile({
          fromUrl: DOWNLOAD_URL,
          toFile: MODEL_PATH,
          progress: (status: { bytesWritten: number; contentLength: number }) => {
            const progress = status.bytesWritten / status.contentLength;
            if (progressCallback) progressCallback(progress);
            console.debug('Download progress:', progress);
          },
        });
        await promise;
        console.log('Model downloaded.');
      } catch (err) {
        console.error('Error downloading Model:', err);
        throw err;
      } finally {
        globalThis.__llamaDownloadPromise = null;
      }
    })();

    return globalThis.__llamaDownloadPromise;
  }

  async initialize(progressCallback?: (progress: number) => void) {
    if (this.isInitialized) return;

    // Cross-instance lock
    if (globalThis.__llamaInitPromise) return globalThis.__llamaInitPromise;

    globalThis.__llamaInitPromise = (async () => {
      try {
        await this.downloadModel(progressCallback);
        this.context = await initLlama({
          model: MODEL_PATH,
          use_mlock: true,
          n_ctx: 2048,
          n_gpu_layers: 0, // Set to 0 for Android emulator stability initially, increase for device
        });
        this.isInitialized = true;
        console.log('Llama initialized');
      } catch (error) {
        console.error('Error initializing Model:', error);
        throw error;
      } finally {
        globalThis.__llamaInitPromise = null;
      }
    })();

    return globalThis.__llamaInitPromise;
  }

  async completion(
    messages: ChatMessage[],
    onPartialCompletion: (token: string) => void
  ): Promise<string> {
    if (!this.context) throw new Error('Llama context not initialized');

    // Serialize completions (llama.rn host functions are not safe to run concurrently).
    if (!globalThis.__llamaCompletionQueue) {
      globalThis.__llamaCompletionQueue = Promise.resolve();
    }

    const run = async (): Promise<string> => {
      if (!this.context) throw new Error('Llama context not initialized');

      const res = await this.context.completion(
        {
          messages,
          n_predict: 128,
          temperature: 0.7,
          top_k: 40,
          top_p: 0.95,
        },
        (data: TokenData) => {
          onPartialCompletion(data.token);
        }
      );
      return res.text.trim();
    };

    // Queue this completion after the previous one.
    const resultPromise = globalThis.__llamaCompletionQueue.then(run, run);

    // Keep the queue alive regardless of success/failure.
    globalThis.__llamaCompletionQueue = resultPromise.then(
      () => undefined,
      () => undefined
    );

    try {
      return await resultPromise;
    } catch (err) {
      console.error('Error LLM completion:', err);
      // If we hit a native HostFunction exception, the context can be left in a bad state.
      // Mark as not-initialized so the UI can Retry or Delete & Re-download.
      try {
        await this.context?.release();
      } catch {}
      this.context = null;
      this.isInitialized = false;
      return '';
    }
  }

  async cleanup() {
    try {
      await this.context?.release();
      this.isInitialized = false;
    } catch {}
  }
}

const existingService = globalThis.__llamaService as any;
const llamaService =
  existingService &&
  typeof existingService.getModelPath === 'function' &&
  typeof existingService.deleteLocalModel === 'function'
    ? existingService
    : new LlamaService();

globalThis.__llamaService = llamaService;

export default llamaService;

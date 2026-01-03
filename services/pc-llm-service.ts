import Constants from 'expo-constants';

export type PcModelId = 'qwen15' | 'qwen15-4q' | 'phi3';

export const PC_MODELS: Array<{ id: PcModelId; label: string }> = [
  { id: 'qwen15', label: 'Qwen 1.5 (Q2_K)' },
  { id: 'qwen15-4q', label: 'Qwen 1.5 (Q4_0)' },
  { id: 'phi3', label: 'Phi-3 mini (IQ1_S)' },
];

function extractHostname(hostUri: string): string | null {
  // Typical values:
  // - "192.168.1.10:8081"
  // - "192.168.1.10:8081/" (sometimes)
  const cleaned = hostUri
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
  const host = cleaned.split('/')[0];
  const hostname = host.split(':')[0];
  return hostname || null;
}

export function getPcLlmServerBaseUrl(): string | null {
  // User override (recommended for dev builds)
  const envUrl = process.env.EXPO_PUBLIC_LLM_SERVER_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim().replace(/\/$/, '');

  // Best-effort: infer from Metro host, and use port 3333
  const manifest2HostUri = (Constants as any)?.manifest2?.extra?.expoClient?.hostUri as
    | string
    | undefined;
  const expoConfigHostUri = (Constants as any)?.expoConfig?.hostUri as string | undefined;

  const hostUri = manifest2HostUri ?? expoConfigHostUri;
  if (typeof hostUri !== 'string' || !hostUri.trim()) return null;

  const hostname = extractHostname(hostUri);
  if (!hostname) return null;

  return `http://${hostname}:3333`;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function isPcLlmServerReachable(baseUrl?: string): Promise<boolean> {
  const resolvedBase = baseUrl ?? getPcLlmServerBaseUrl();
  if (!resolvedBase) return false;

  try {
    const res = await fetchWithTimeout(`${resolvedBase}/health`, { method: 'GET' }, 1500);
    if (!res.ok) return false;
    const data = (await res.json()) as any;
    return data?.ok === true;
  } catch {
    return false;
  }
}

export async function pcTodoCompletion(args: {
  modelId: PcModelId;
  userMsg: string;
  todos: Array<{ id: number; title: string; completed: boolean }>;
  baseUrl?: string;
}): Promise<string> {
  const baseUrl = args.baseUrl ?? getPcLlmServerBaseUrl();
  if (!baseUrl) {
    throw new Error(
      'PC LLM server URL not set. Set EXPO_PUBLIC_LLM_SERVER_URL (e.g. http://192.168.1.10:3333)'
    );
  }

  const res = await fetch(`${baseUrl}/todo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: args.modelId,
      userMsg: args.userMsg,
      todos: args.todos,
    }),
  });

  const data = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(data?.error ?? 'PC LLM server error');
  }

  return typeof data?.text === 'string' ? data.text : '';
}

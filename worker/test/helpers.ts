import worker from '../src/index.js';
import type { Env } from '../src/data.js';

export const TEST_ENV: Env = { BASE_URL: 'https://ngano.dev', VERSION: '0.1.0' };

/** Drive the Worker exactly as the runtime does, with a real Request. */
export async function call(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `https://ngano.dev${path}`;
  return worker.fetch(new Request(url, init), TEST_ENV);
}

export async function getJson<T = unknown>(path: string, init?: RequestInit): Promise<{ res: Response; body: T }> {
  const res = await call(path, init);
  const body = (await res.json()) as T;
  return { res, body };
}

export interface ErrorBody {
  error: { code: string; message: string; status: number };
}

export interface DatasetListBody {
  data: Record<string, unknown>[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    total_hours: number;
    language_tags?: string[];
    language_unresolved?: string[];
  };
}

export interface RpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

/** Post one JSON-RPC message to /mcp and read the plain JSON reply. */
export async function rpc(method: string, params?: unknown, id: string | number | null = 1): Promise<RpcResponse> {
  const res = await call('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return (await res.json()) as RpcResponse;
}

export interface ToolCallResult {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export async function callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
  const reply = await rpc('tools/call', { name, arguments: args });
  if (!reply.result) throw new Error(`tools/call failed: ${JSON.stringify(reply.error)}`);
  return reply.result as unknown as ToolCallResult;
}

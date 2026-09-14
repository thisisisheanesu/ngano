/**
 * Small response helpers shared by the API, the MCP endpoint and the router.
 * Everything here is dependency free and safe to call from module scope.
 */

import type { ApiError } from './types.js';

/** Collection and item responses are cheap to recompute but very cacheable. */
export const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600';
/** Raw data downloads and the favicon change only when the catalogue is rebuilt. */
export const CACHE_CONTROL_LONG = 'public, max-age=3600, s-maxage=86400';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Content-Type, ETag, MCP-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

/** Add the permissive CORS headers to any response. Returns the same response object. */
export function cors(res: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) res.headers.set(key, value);
  return res;
}

/** Standard preflight answer. ngano is public, so every origin and method is allowed. */
export function preflight(): Response {
  return cors(new Response(null, { status: 204 }));
}

export interface JsonInit {
  status?: number;
  cache?: string;
  etag?: string;
  headers?: Record<string, string>;
}

/** JSON response with CORS, caching and optional ETag. */
export function json(body: unknown, init: JsonInit = {}): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': init.cache ?? CACHE_CONTROL,
  });
  if (init.etag) headers.set('ETag', init.etag);
  for (const [key, value] of Object.entries(init.headers ?? {})) headers.set(key, value);
  return cors(new Response(JSON.stringify(body), { status: init.status ?? 200, headers }));
}

/** A 304 carries no body but keeps the validators and the cache policy. */
export function notModified(tag: string, cache: string = CACHE_CONTROL): Response {
  return cors(new Response(null, { status: 304, headers: { ETag: tag, 'Cache-Control': cache } }));
}

/** HTML response for the site renderers. */
export function html(body: string, init: { status?: number; cache?: string } = {}): Response {
  return cors(
    new Response(body, {
      status: init.status ?? 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': init.cache ?? CACHE_CONTROL,
      },
    }),
  );
}

/** Plain text response, used by robots.txt. */
export function text(body: string, init: { status?: number; cache?: string; type?: string } = {}): Response {
  return cors(
    new Response(body, {
      status: init.status ?? 200,
      headers: {
        'Content-Type': init.type ?? 'text/plain; charset=utf-8',
        'Cache-Control': init.cache ?? CACHE_CONTROL_LONG,
      },
    }),
  );
}

/** The single error shape used by every API endpoint. */
export function error(code: string, message: string, status: number): Response {
  const body: ApiError = { error: { code, message, status } };
  return json(body, { status, cache: 'no-store' });
}

/**
 * Stable, cheap entity tag. FNV-1a over the serialised body, which is enough to
 * detect a changed catalogue without pulling in a crypto dependency or making
 * the caller await a digest.
 */
export function etag(payload: unknown): string {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `W/"${hash.toString(16).padStart(8, '0')}-${input.length.toString(36)}"`;
}

/** True when the client already holds this version. */
export function matchesEtag(req: Request, tag: string): boolean {
  const header = req.headers.get('If-None-Match');
  if (!header) return false;
  return header
    .split(',')
    .map((part) => part.trim())
    .some((part) => part === tag || part === '*' || part.replace(/^W\//, '') === tag.replace(/^W\//, ''));
}

import { describe, expect, it } from 'vitest';
import { call, callTool, rpc, type RpcResponse } from './helpers.js';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

describe('protocol methods', () => {
  it('initializes with protocol 2025-06-18 and advertises tools', async () => {
    const reply = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    expect(reply.jsonrpc).toBe('2.0');
    expect(reply.id).toBe(1);
    const result = reply.result as { protocolVersion: string; capabilities: { tools: unknown }; serverInfo: { name: string } };
    expect(result.protocolVersion).toBe('2025-06-18');
    expect(result.capabilities.tools).toBeDefined();
    expect(result.serverInfo.name).toBe('ngano');
  });

  it('accepts notifications/initialized with 202 and no body', async () => {
    const res = await call('/mcp', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  it('answers ping with an empty result', async () => {
    const reply = await rpc('ping', {}, 'ping-1');
    expect(reply.id).toBe('ping-1');
    expect(reply.result).toEqual({});
  });

  it('lists every tool with both schemas', async () => {
    const reply = await rpc('tools/list');
    const tools = (reply.result as { tools: ToolDefinition[] }).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'get_country',
        'get_dataset',
        'get_language',
        'get_loader_snippet',
        'get_stats',
        'list_countries',
        'list_languages',
        'search_datasets',
      ].sort(),
    );
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
    }
  });

  it('reports an unknown method', async () => {
    const reply = await rpc('does/not/exist');
    expect(reply.error?.code).toBe(-32601);
  });

  it('reports a malformed body as a parse error', async () => {
    const res = await call('/mcp', { method: 'POST', headers: JSON_HEADERS, body: 'not json' });
    const body = (await res.json()) as RpcResponse;
    expect(res.status).toBe(400);
    expect(body.error?.code).toBe(-32700);
  });

  it('rejects a message that is not JSON-RPC 2.0', async () => {
    const res = await call('/mcp', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ jsonrpc: '1.0', id: 1, method: 'ping' }),
    });
    const body = (await res.json()) as RpcResponse;
    expect(body.error?.code).toBe(-32600);
  });

  it('answers a batch with one reply per request', async () => {
    const res = await call('/mcp', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify([
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'ping' },
      ]),
    });
    const body = (await res.json()) as RpcResponse[];
    expect(body).toHaveLength(2);
    expect(body.map((r) => r.id)).toEqual([1, 2]);
  });
});

describe('transport', () => {
  it('replies as a single SSE message event when the caller accepts one', async () => {
    const res = await call('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'ping' }),
    });
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('event: message');
    const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
    expect(dataLine).toBeDefined();
    const payload = JSON.parse((dataLine as string).slice('data: '.length)) as RpcResponse;
    expect(payload.id).toBe(7);
    expect(payload.result).toEqual({});
  });

  it('opens an SSE stream on GET with the right headers', async () => {
    const res = await call('/mcp', { headers: { Accept: 'text/event-stream' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('MCP-Protocol-Version')).toBe('2025-06-18');
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const chunk = await reader.read();
    expect(new TextDecoder().decode(chunk.value)).toContain('ngano mcp 2025-06-18');
    await reader.cancel();
  });

  it('refuses a GET that does not accept an event stream', async () => {
    const res = await call('/mcp', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(406);
  });

  it('answers a preflight', async () => {
    const res = await call('/mcp', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('tools/call', () => {
  it('searches datasets and returns text plus structured content', async () => {
    const out = await callTool('search_datasets', { language: ['sna'], per_page: 5 });
    expect(out.isError).toBe(false);
    expect(out.content[0]?.type).toBe('text');
    expect(out.content[0]?.text).toContain('dataset');
    const structured = out.structuredContent as { data: { language_tags: string[] }[]; meta: { total: number } };
    expect(structured.meta.total).toBeGreaterThan(0);
    expect(structured.data.length).toBeLessThanOrEqual(5);
    for (const row of structured.data) expect(row.language_tags).toContain('sna');
  });

  it('never counts unverified hours in a search total', async () => {
    const out = await callTool('search_datasets', { per_page: 1 });
    const structured = out.structuredContent as { meta: { total_hours: number; total: number } };
    expect(structured.meta.total).toBe(612);
    expect(structured.meta.total_hours).toBeLessThan(200000);
    expect(out.content[0]?.text).toContain('unverified sizes excluded');
  });

  it('gets one dataset', async () => {
    const search = await callTool('search_datasets', { per_page: 1 });
    const id = (search.structuredContent as { data: { id: string }[] }).data[0]?.id as string;
    const out = await callTool('get_dataset', { id });
    const structured = out.structuredContent as { dataset: { id: string } };
    expect(structured.dataset.id).toBe(id);
  });

  it('reports an unknown dataset id as a tool error, not a protocol error', async () => {
    const out = await callTool('get_dataset', { id: 'nope' });
    expect(out.isError).toBe(true);
    expect(out.content[0]?.text).toContain('nope');
  });

  it('lists countries', async () => {
    const out = await callTool('list_countries', {});
    const structured = out.structuredContent as { countries: unknown[]; total: number };
    expect(structured.total).toBe(58);
    expect(structured.countries).toHaveLength(58);
  });

  it('accepts a code, a tag or an alias in search_datasets and widens only on request', async () => {
    interface Search { meta: { total: number; language_tags?: string[] } }
    const byCode = (await callTool('search_datasets', { language: ['sna'], per_page: 1 })).structuredContent as unknown as Search;
    const byName = (await callTool('search_datasets', { language: ['Shona'], per_page: 1 })).structuredContent as unknown as Search;
    expect(byName.meta.total).toBe(byCode.meta.total);
    expect(byName.meta.language_tags).toEqual(['sna']);

    const bare = (await callTool('search_datasets', { language: ['eng'], per_page: 1 })).structuredContent as unknown as Search;
    const wide = (await callTool('search_datasets', { language: ['eng'], include_varieties: true, per_page: 1 }))
      .structuredContent as unknown as Search;
    expect(bare.meta.language_tags).toEqual(['eng']);
    expect(wide.meta.total).toBeGreaterThan(bare.meta.total);
    expect(wide.meta.language_tags).toContain('eng-NG');
  });

  it('gets one country with its datasets and languages', async () => {
    const out = await callTool('get_country', { iso2: 'zw' });
    const structured = out.structuredContent as {
      country: { name: string; datasets: number };
      datasets: unknown[];
      languages: unknown[];
    };
    expect(structured.country.name).toBe('Zimbabwe');
    expect(structured.datasets).toHaveLength(structured.country.datasets);
    expect(structured.languages.length).toBeGreaterThan(0);
  });

  it('lists languages with a limit, keyed on tag', async () => {
    const out = await callTool('list_languages', { limit: 3 });
    const structured = out.structuredContent as { languages: { tag: string; slug: string }[]; total: number };
    expect(structured.languages).toHaveLength(3);
    for (const l of structured.languages) expect(l.slug).toBe(l.tag.toLowerCase());
    expect(structured.total).toBeGreaterThan(3);
  });

  it('gets one language by tag, by code case and by alias, always returning the tag', async () => {
    interface LangResult {
      language: { tag: string; name: string; iso639_3: string; region: string | null; aliases: string[] };
      requested: string;
      datasets: unknown[];
    }
    const byTag = (await callTool('get_language', { slug: 'sna' })).structuredContent as unknown as LangResult;
    const byUpper = (await callTool('get_language', { slug: 'SNA' })).structuredContent as unknown as LangResult;
    const byName = (await callTool('get_language', { slug: 'Shona' })).structuredContent as unknown as LangResult;
    for (const r of [byTag, byUpper, byName]) {
      expect(r.language.tag).toBe('sna');
      expect(r.language.name).toBe('Shona');
    }
    expect(byName.requested).toBe('Shona');

    // An old free-text name for a regional variety still works and answers with the tag.
    const variety = (await callTool('get_language', { slug: 'Nigerian English' }))
      .structuredContent as unknown as LangResult;
    expect(variety.language.tag).toBe('eng-NG');
    expect(variety.language.iso639_3).toBe('eng');
    expect(variety.language.region).toBe('NG');
    expect(variety.language.aliases).toContain('Nigerian English');

    const a = byTag;
    expect(a.datasets.length).toBeGreaterThan(0);
  });

  it('gets stats', async () => {
    const out = await callTool('get_stats', {});
    const structured = out.structuredContent as { datasets: number; unverified_excluded: number };
    expect(structured.datasets).toBe(612);
    expect(structured.unverified_excluded).toBeGreaterThan(0);
    expect(out.content[0]?.text).toContain('excluded from every hour figure');
  });

  it('rejects an unknown tool name', async () => {
    const reply = await rpc('tools/call', { name: 'no_such_tool', arguments: {} });
    expect(reply.error?.code).toBe(-32602);
  });
});

interface SnippetBlock {
  key: string;
  shell: boolean;
  code: string;
}

interface RenderedPack {
  language: string;
  install: string;
  install_audio: string | null;
  package: string;
  blocks: SnippetBlock[];
}

interface SnippetResult {
  filter: Record<string, unknown>;
  snippet_keys: string[];
  tokens: Record<string, string>;
  matched_datasets: number;
  matched_hours: number;
  sample_dataset_ids: string[];
  snippets: Record<string, RenderedPack>;
}

const TOKEN_PATTERN = /\{\{[A-Z0-9_]+\}\}/g;

function everyBlock(result: SnippetResult): SnippetBlock[] {
  return Object.values(result.snippets).flatMap((pack) => pack.blocks);
}

describe('get_loader_snippet', () => {
  it('returns all three SDKs by default, with install lines and real code', async () => {
    const out = await callTool('get_loader_snippet', { language: ['Shona'], commercial: ['Yes'] });
    const result = out.structuredContent as unknown as SnippetResult;
    expect(Object.keys(result.snippets).sort()).toEqual(['javascript', 'python', 'rust']);
    expect(result.snippets.python?.install).toBe('pip install ngano');
    expect(result.snippets.javascript?.install).toBe('npm install ngano');
    expect(result.snippets.rust?.install).toBe('cargo add ngano');
    expect(result.snippets.python?.blocks.length).toBeGreaterThan(0);
    for (const block of everyBlock(result)) expect(block.code.length).toBeGreaterThan(20);
  });

  it('leaves no placeholder token anywhere in any output', async () => {
    const cases: Record<string, unknown>[] = [
      {},
      { language: ['Shona'] },
      { country: ['ZW'] },
      { dataset_id: 'fleurs-r' },
      { task: ['TTS'], commercial: ['Yes'] },
      { q: 'broadcast', hf_only: true },
      { language: ['Swahili'], country: ['KE'], task: ['ASR'] },
      { language: ['Shona'], code_language: 'rust' },
    ];
    for (const args of cases) {
      const out = await callTool('get_loader_snippet', args);
      expect(out.isError, JSON.stringify(args)).toBe(false);
      const result = out.structuredContent as unknown as SnippetResult;
      for (const block of everyBlock(result)) {
        expect(block.code.match(TOKEN_PATTERN), `${JSON.stringify(args)} ${block.key}`).toBeNull();
      }
      expect(out.content[0]?.text.match(TOKEN_PATTERN), JSON.stringify(args)).toBeNull();
      for (const value of Object.values(result.tokens)) {
        expect(value.length, JSON.stringify(args)).toBeGreaterThan(0);
        expect(value).not.toMatch(TOKEN_PATTERN);
      }
    }
  });

  it('substitutes the caller filter into the code, as a tag rather than a name', async () => {
    const out = await callTool('get_loader_snippet', { language: ['sna'], country: ['ZW'], task: ['ASR'] });
    const result = out.structuredContent as unknown as SnippetResult;
    expect(result.tokens.LANGUAGE).toBe('sna');
    expect(result.tokens.COUNTRY_ISO2).toBe('ZW');
    expect(result.tokens.COUNTRY_NAME).toBe('Zimbabwe');
    expect(result.tokens.TASK).toBe('ASR');
    const python = result.snippets.python?.blocks.map((b) => b.code).join('\n') ?? '';
    expect(python).toContain('"sna"');
    expect(python).toContain('"ZW"');
  });

  it('resolves an old free-text language name to the tag before substituting it', async () => {
    for (const [given, tag] of [
      ['Shona', 'sna'],
      ['shona', 'sna'],
      ['SNA', 'sna'],
      ['Nigerian English', 'eng-NG'],
    ] as const) {
      const result = (await callTool('get_loader_snippet', { language: [given] }))
        .structuredContent as unknown as SnippetResult;
      expect(result.tokens.LANGUAGE, given).toBe(tag);
      const python = result.snippets.python?.blocks.map((b) => b.code).join('\n') ?? '';
      expect(python, given).toContain(`"${tag}"`);
    }
  });

  it('substitutes a tag even when no language was asked for', async () => {
    const result = (await callTool('get_loader_snippet', { task: ['TTS'] })).structuredContent as unknown as SnippetResult;
    expect(result.tokens.LANGUAGE).toMatch(/^[a-z]{3}(-[A-Z]{2})?$/);
  });

  it('picks dataset_page and single_dataset for a dataset id', async () => {
    const out = await callTool('get_loader_snippet', { dataset_id: 'fleurs-r' });
    const result = out.structuredContent as unknown as SnippetResult;
    expect(result.snippet_keys).toEqual(['dataset_page', 'single_dataset', 'catalogue_filter']);
    expect(result.matched_datasets).toBe(1);
    expect(result.tokens.DATASET_ID).toBe('fleurs-r');
    expect((result.tokens.HF_REPO ?? '').length).toBeGreaterThan(0);
    expect((result.tokens.CONFIG ?? '').length).toBeGreaterThan(0);
    const python = result.snippets.python?.blocks.map((b) => b.code).join('\n') ?? '';
    expect(python).toContain('"fleurs-r"');
  });

  it('picks language_page for a lone language and country_page for a lone country', async () => {
    const byLanguage = (await callTool('get_loader_snippet', { language: ['Shona'] }))
      .structuredContent as unknown as SnippetResult;
    expect(byLanguage.snippet_keys).toEqual(['language_page', 'catalogue_filter']);

    const byCountry = (await callTool('get_loader_snippet', { country: ['ZW'] }))
      .structuredContent as unknown as SnippetResult;
    expect(byCountry.snippet_keys).toEqual(['country_page', 'catalogue_filter']);
  });

  it('picks stream_filter for anything else, and always includes catalogue_filter', async () => {
    for (const args of [{}, { language: ['Shona'], commercial: ['Yes'] }, { language: ['Shona'], country: ['ZW'] }]) {
      const result = (await callTool('get_loader_snippet', args)).structuredContent as unknown as SnippetResult;
      expect(result.snippet_keys[0], JSON.stringify(args)).toBe('stream_filter');
      expect(result.snippet_keys).toContain('catalogue_filter');
    }
  });

  it('returns one SDK when code_language is given', async () => {
    const out = await callTool('get_loader_snippet', { language_name: 'Swahili', code_language: 'rust' });
    const result = out.structuredContent as unknown as SnippetResult;
    expect(Object.keys(result.snippets)).toEqual(['rust']);
    expect(result.snippets.rust?.blocks.map((b) => b.code).join('\n')).toContain('"swh"');
  });

  it('accepts languages as an alias for code_language', async () => {
    const result = (await callTool('get_loader_snippet', { languages: ['python', 'rust'] }))
      .structuredContent as unknown as SnippetResult;
    expect(Object.keys(result.snippets).sort()).toEqual(['python', 'rust']);
  });

  it('marks a shell session as shell rather than source', async () => {
    const result = (await callTool('get_loader_snippet', { dataset_id: 'fleurs-r' }))
      .structuredContent as unknown as SnippetResult;
    for (const pack of Object.values(result.snippets)) {
      for (const block of pack.blocks) {
        expect(typeof block.shell).toBe('boolean');
      }
    }
  });

  it('rejects an unknown SDK and says how to filter by spoken language', async () => {
    const out = await callTool('get_loader_snippet', { code_language: 'cobol' });
    expect(out.isError).toBe(true);
    expect(out.content[0]?.text).toContain('cobol');
    expect(out.content[0]?.text).toContain('"language"');
  });

  it('reports an unknown dataset id as a tool error', async () => {
    const out = await callTool('get_loader_snippet', { dataset_id: 'not-a-dataset' });
    expect(out.isError).toBe(true);
  });
});

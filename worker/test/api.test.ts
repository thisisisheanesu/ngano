import { describe, expect, it } from 'vitest';
import { call, getJson, type DatasetListBody, type ErrorBody } from './helpers.js';
import catalogue from '../../data/catalogue.json';
import type { Dataset, Stats } from '../src/types.js';

const datasets = catalogue as unknown as Dataset[];

interface LanguageBody {
  tag: string;
  iso639_3: string;
  region: string | null;
  name: string;
  slug: string;
  aliases: string[];
  datasets: number;
  requested: string;
  resolved: boolean;
  datasets_list: unknown[];
}
const unverified = datasets.filter((d) => d.unverified_size);

describe('GET /api/v1/datasets', () => {
  it('returns a default page of 50 with catalogue-wide meta', async () => {
    const { res, body } = await getJson<DatasetListBody>('/api/v1/datasets');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=3600');
    expect(res.headers.get('ETag')).toBeTruthy();
    expect(body.data).toHaveLength(50);
    expect(body.meta.per_page).toBe(50);
    expect(body.meta.total).toBe(datasets.length);
    expect(body.meta.total_pages).toBe(Math.ceil(datasets.length / 50));
  });

  it('filters by a single language tag', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?language=sna&per_page=200');
    const expected = datasets.filter((d) => d.language_tags.includes('sna'));
    expect(body.meta.total).toBe(expected.length);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.language_tags).toEqual(['sna']);
    for (const row of body.data) {
      expect(row.language_tags as string[]).toContain('sna');
    }
  });

  it('accepts a code, a tag in any case and an alias for the same language', async () => {
    const results = await Promise.all(
      ['sna', 'SNA', 'Shona', 'shona'].map((value) =>
        getJson<DatasetListBody>(`/api/v1/datasets?language=${encodeURIComponent(value)}`),
      ),
    );
    const totals = results.map((r) => r.body.meta.total);
    expect(new Set(totals).size).toBe(1);
    expect(totals[0]).toBeGreaterThan(0);
    for (const r of results) expect(r.body.meta.language_tags).toEqual(['sna']);
  });

  it('keeps an old free-text language name working and reports the canonical tag', async () => {
    const { res, body } = await getJson<DatasetListBody>('/api/v1/datasets?language=Nigerian%20English&per_page=200');
    expect(res.status).toBe(200);
    expect(body.meta.language_tags).toEqual(['eng-NG']);
    expect(body.meta.total).toBe(datasets.filter((d) => d.language_tags.includes('eng-NG')).length);
    expect(body.meta.total).toBeGreaterThan(0);
    for (const row of body.data) expect(row.language_tags as string[]).toContain('eng-NG');
  });

  it('does not let a bare code match a regional variety', async () => {
    const bare = await getJson<DatasetListBody>('/api/v1/datasets?language=eng&per_page=200');
    expect(bare.body.meta.language_tags).toEqual(['eng']);
    for (const row of bare.body.data) {
      expect(row.language_tags as string[]).toContain('eng');
    }
    const variety = await getJson<DatasetListBody>('/api/v1/datasets?language=eng-NG&per_page=200');
    expect(variety.body.meta.language_tags).toEqual(['eng-NG']);
    const onlyVariety = datasets.filter((d) => d.language_tags.includes('eng-NG') && !d.language_tags.includes('eng'));
    expect(onlyVariety.length).toBeGreaterThan(0);
    const bareIds = new Set(bare.body.data.map((r) => r.id as string));
    for (const d of onlyVariety) expect(bareIds.has(d.id)).toBe(false);
  });

  it('widens a bare code to its varieties only when asked', async () => {
    const narrow = await getJson<DatasetListBody>('/api/v1/datasets?language=eng&per_page=200');
    const wide = await getJson<DatasetListBody>('/api/v1/datasets?language=eng&include_varieties=true&per_page=200');
    expect(wide.body.meta.total).toBeGreaterThan(narrow.body.meta.total);
    expect(wide.body.meta.language_tags).toContain('eng');
    expect(wide.body.meta.language_tags).toContain('eng-NG');
    const expected = datasets.filter((d) => d.language_tags.some((t) => t === 'eng' || t.startsWith('eng-')));
    expect(wide.body.meta.total).toBe(expected.length);
  });

  it('treats iso as the code form of language', async () => {
    const byIso = await getJson<DatasetListBody>('/api/v1/datasets?iso=sna');
    const byLanguage = await getJson<DatasetListBody>('/api/v1/datasets?language=sna');
    expect(byIso.body.meta.total).toBe(byLanguage.body.meta.total);
    expect(byIso.body.meta.language_tags).toEqual(['sna']);

    // The two are merged into one OR-ed filter rather than AND-ed against each other.
    const both = await getJson<DatasetListBody>('/api/v1/datasets?iso=sna&language=swh');
    const swh = await getJson<DatasetListBody>('/api/v1/datasets?language=swh');
    const union = datasets.filter((d) => d.language_tags.includes('sna') || d.language_tags.includes('swh'));
    expect(both.body.meta.total).toBe(union.length);
    expect(both.body.meta.total).toBeGreaterThan(swh.body.meta.total);
  });

  it('names the language values that resolved to nothing', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?language=sna,NotALanguage');
    expect(body.meta.language_unresolved).toEqual(['NotALanguage']);
    expect(body.meta.language_tags).toEqual(['sna']);
  });

  it('ORs repeated values and ANDs across parameters', async () => {
    const asr = await getJson<DatasetListBody>('/api/v1/datasets?task=ASR&per_page=1');
    const tts = await getJson<DatasetListBody>('/api/v1/datasets?task=TTS&per_page=1');
    const both = await getJson<DatasetListBody>('/api/v1/datasets?task=ASR,TTS&per_page=1');
    const repeated = await getJson<DatasetListBody>('/api/v1/datasets?task=ASR&task=TTS&per_page=1');
    expect(both.body.meta.total).toBe(asr.body.meta.total + tts.body.meta.total);
    expect(repeated.body.meta.total).toBe(both.body.meta.total);

    const and = await getJson<DatasetListBody>('/api/v1/datasets?task=ASR&access=Open&per_page=1');
    expect(and.body.meta.total).toBeLessThanOrEqual(asr.body.meta.total);
    expect(and.body.meta.total).toBe(datasets.filter((d) => d.task === 'ASR' && d.access === 'Open').length);
  });

  it('combines country, licence and hf_only filters', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?country=ZW&hf_only=true&per_page=200');
    const expected = datasets.filter((d) => d.country_codes.includes('ZW') && d.hf_repo !== null);
    expect(body.meta.total).toBe(expected.length);
    for (const row of body.data) expect(row.hf_repo).not.toBeNull();
  });

  it('matches filters case insensitively', async () => {
    const upper = await getJson<DatasetListBody>('/api/v1/datasets?country=zw&per_page=1');
    const lower = await getJson<DatasetListBody>('/api/v1/datasets?country=ZW&per_page=1');
    expect(upper.body.meta.total).toBe(lower.body.meta.total);
  });

  it('narrows with every extra q term', async () => {
    const one = await getJson<DatasetListBody>('/api/v1/datasets?q=swahili&per_page=1');
    const two = await getJson<DatasetListBody>('/api/v1/datasets?q=swahili%20call&per_page=1');
    expect(one.body.meta.total).toBeGreaterThan(0);
    expect(two.body.meta.total).toBeLessThanOrEqual(one.body.meta.total);
  });

  it('honours has_hours in both directions', async () => {
    const withHours = await getJson<DatasetListBody>('/api/v1/datasets?has_hours=true&per_page=1');
    const without = await getJson<DatasetListBody>('/api/v1/datasets?has_hours=false&per_page=1');
    expect(withHours.body.meta.total + without.body.meta.total).toBe(datasets.length);
    expect(withHours.body.meta.total).toBe(datasets.filter((d) => d.hours_num !== null).length);
  });

  it('sorts by name ascending and descending', async () => {
    const asc = await getJson<DatasetListBody>('/api/v1/datasets?sort=name&fields=name&per_page=5');
    const desc = await getJson<DatasetListBody>('/api/v1/datasets?sort=-name&fields=name&per_page=5');
    const names = asc.body.data.map((r) => r.name as string);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    expect(desc.body.data[0]?.name).not.toBe(asc.body.data[0]?.name);
  });

  it('sorts by hours descending by default and never leads with an unverified record', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?fields=hours_num,unverified_size&per_page=5');
    expect(body.data[0]?.unverified_size).toBe(false);
    const first = body.data[0]?.hours_num as number;
    const second = body.data[1]?.hours_num as number;
    expect(first).toBeGreaterThanOrEqual(second);
  });
});

describe('pagination edges', () => {
  it('returns the last partial page', async () => {
    const perPage = 200;
    const lastPage = Math.ceil(datasets.length / perPage);
    const { body } = await getJson<DatasetListBody>(`/api/v1/datasets?per_page=${perPage}&page=${lastPage}`);
    expect(body.meta.total_pages).toBe(lastPage);
    expect(body.data).toHaveLength(datasets.length - perPage * (lastPage - 1));
  });

  it('returns an empty page past the end rather than an error', async () => {
    const { res, body } = await getJson<DatasetListBody>('/api/v1/datasets?page=9999');
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(datasets.length);
  });

  it('reports total_pages 1 when nothing matches', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?language=NotALanguage');
    expect(body.meta.total).toBe(0);
    expect(body.meta.total_pages).toBe(1);
    expect(body.meta.total_hours).toBe(0);
  });

  it('caps per_page at 200', async () => {
    const { res, body } = await getJson<ErrorBody>('/api/v1/datasets?per_page=500');
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('invalid_parameter');
    expect(body.error.status).toBe(400);
  });

  it('rejects page 0 and non-numeric pages', async () => {
    expect((await call('/api/v1/datasets?page=0')).status).toBe(400);
    expect((await call('/api/v1/datasets?page=two')).status).toBe(400);
    expect((await call('/api/v1/datasets?per_page=0')).status).toBe(400);
  });

  it('accepts exactly 200 per page', async () => {
    const { res, body } = await getJson<DatasetListBody>('/api/v1/datasets?per_page=200');
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(200);
  });
});

describe('projection', () => {
  it('returns only the named fields plus id', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?fields=name,hours_num&per_page=3');
    for (const row of body.data) {
      expect(Object.keys(row).sort()).toEqual(['hours_num', 'id', 'name']);
    }
  });

  it('accepts repeated fields parameters', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?fields=name&fields=licence&per_page=1');
    expect(Object.keys(body.data[0] ?? {}).sort()).toEqual(['id', 'licence', 'name']);
  });

  it('rejects an unknown field', async () => {
    const { res, body } = await getJson<ErrorBody>('/api/v1/datasets?fields=name,nope');
    expect(res.status).toBe(400);
    expect(body.error.message).toContain('nope');
  });
});

describe('the unverified-hours exclusion', () => {
  it('has records to exclude', () => {
    expect(unverified.length).toBeGreaterThan(0);
  });

  it('leaves unverified records out of total_hours', async () => {
    const all = await getJson<DatasetListBody>('/api/v1/datasets');
    const expected = datasets.reduce((sum, d) => sum + (d.unverified_size ? 0 : (d.hours_num ?? 0)), 0);
    expect(all.body.meta.total_hours).toBeCloseTo(Math.round(expected * 10) / 10, 1);
    const naive = datasets.reduce((sum, d) => sum + (d.hours_num ?? 0), 0);
    expect(all.body.meta.total_hours).toBeLessThan(naive);
  });

  it('still lists an unverified record with its own published figure', async () => {
    const first = unverified[0];
    expect(first).toBeDefined();
    const { res, body } = await getJson<Dataset>(`/api/v1/datasets/${first?.id}`);
    expect(res.status).toBe(200);
    expect(body.unverified_size).toBe(true);
    expect(body.hours_num).toBe(first?.hours_num);
  });

  it('treats an unverified record as zero hours for min_hours', async () => {
    const { body } = await getJson<DatasetListBody>('/api/v1/datasets?min_hours=1&per_page=200&fields=unverified_size');
    for (const row of body.data) expect(row.unverified_size).toBe(false);
  });

  it('keeps unverified records out of every stats total', async () => {
    const { body } = await getJson<Stats>('/api/v1/stats');
    expect(body.unverified_excluded).toBe(unverified.length);
    const naive = datasets.reduce((sum, d) => sum + (d.hours_num ?? 0), 0);
    expect(body.hours).toBeLessThan(naive);
    expect(body.hours_open).toBeLessThanOrEqual(body.hours);
    for (const facet of body.by_task) expect(facet.hours).toBeLessThanOrEqual(body.hours + 0.1);
  });

  it('keeps them out of country and language aggregates too', async () => {
    const countries = (await getJson<{ hours: number }[]>('/api/v1/countries')).body;
    const total = countries.reduce((sum, c) => sum + c.hours, 0);
    const stats = (await getJson<Stats>('/api/v1/stats')).body;
    expect(total).toBeLessThanOrEqual(stats.hours + 1);
  });
});

describe('single resources and 404s', () => {
  it('returns a dataset by id', async () => {
    const id = datasets[0]?.id as string;
    const { res, body } = await getJson<Dataset>(`/api/v1/datasets/${encodeURIComponent(id)}`);
    expect(res.status).toBe(200);
    expect(body.id).toBe(id);
  });

  it('404s an unknown dataset id', async () => {
    const { res, body } = await getJson<ErrorBody>('/api/v1/datasets/does-not-exist');
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('not_found');
    expect(body.error.status).toBe(404);
  });

  it('returns a country with its datasets and languages', async () => {
    const { res, body } = await getJson<{ name: string; datasets: number; datasets_list: unknown[]; languages_list: unknown[] }>(
      '/api/v1/countries/zw',
    );
    expect(res.status).toBe(200);
    expect(body.name).toBe('Zimbabwe');
    expect(body.datasets_list).toHaveLength(body.datasets);
    expect(body.languages_list.length).toBeGreaterThan(0);
  });

  it('404s an unknown country code', async () => {
    const { res, body } = await getJson<ErrorBody>('/api/v1/countries/xx');
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });

  it('returns a language with its datasets, keyed on the tag', async () => {
    const { res, body } = await getJson<LanguageBody>('/api/v1/languages/sna');
    expect(res.status).toBe(200);
    expect(body.tag).toBe('sna');
    expect(body.iso639_3).toBe('sna');
    expect(body.region).toBeNull();
    expect(body.name).toBe('Shona');
    expect(body.slug).toBe('sna');
    expect(body.resolved).toBe(false);
    expect(body.datasets_list).toHaveLength(body.datasets);
  });

  it('accepts the tag in any case and an alias, always answering with the canonical tag', async () => {
    for (const spelling of ['SNA', 'Shona', 'shona']) {
      const { res, body } = await getJson<LanguageBody>(`/api/v1/languages/${encodeURIComponent(spelling)}`);
      expect(res.status, spelling).toBe(200);
      expect(body.tag, spelling).toBe('sna');
      expect(body.requested, spelling).toBe(spelling);
      expect(body.resolved, spelling).toBe(spelling !== 'sna');
    }
  });

  it('resolves a regional variety by tag in either case and by name', async () => {
    for (const spelling of ['eng-NG', 'eng-ng', 'ENG-NG', 'Nigerian English', 'English (Nigeria)']) {
      const { res, body } = await getJson<LanguageBody>(`/api/v1/languages/${encodeURIComponent(spelling)}`);
      expect(res.status, spelling).toBe(200);
      expect(body.tag, spelling).toBe('eng-NG');
      expect(body.iso639_3, spelling).toBe('eng');
      expect(body.region, spelling).toBe('NG');
    }
  });

  it('never resolves a bare code to a regional variety', async () => {
    const { body } = await getJson<LanguageBody>('/api/v1/languages/eng');
    expect(body.tag).toBe('eng');
    expect(body.region).toBeNull();
  });

  it('carries every alias on the language object', async () => {
    const { body } = await getJson<LanguageBody>('/api/v1/languages/eng-ng');
    expect(body.aliases).toContain('Nigerian English');
    expect(body.aliases).toContain('English (Nigeria)');
  });

  it('serves the aliases of one tag on their own', async () => {
    const { res, body } = await getJson<{ tag: string; aliases: string[]; resolution: string }>(
      '/api/v1/languages/Nigerian%20English/aliases',
    );
    expect(res.status).toBe(200);
    expect(body.tag).toBe('eng-NG');
    expect(body.aliases).toContain('Nigerian English');
    expect(typeof body.resolution).toBe('string');
  });

  it('filters the language list by code and by region', async () => {
    const { body } = await getJson<LanguageBody[]>('/api/v1/languages?iso=eng');
    expect(body.length).toBeGreaterThan(1);
    for (const l of body) expect(l.iso639_3).toBe('eng');

    const regional = (await getJson<LanguageBody[]>('/api/v1/languages?region=NG')).body;
    expect(regional.length).toBeGreaterThan(0);
    for (const l of regional) expect(l.region).toBe('NG');
  });

  it('matches an alias in the language list query', async () => {
    const { body } = await getJson<LanguageBody[]>('/api/v1/languages?q=nigerian english');
    expect(body.map((l) => l.tag)).toContain('eng-NG');
  });

  it('404s a language that resolves to nothing', async () => {
    expect((await call('/api/v1/languages/klingon')).status).toBe(404);
    expect((await call('/api/v1/languages/zzz')).status).toBe(404);
    expect((await call('/api/v1/languages/klingon/aliases')).status).toBe(404);
  });

  it('404s an unknown API route', async () => {
    const { res, body } = await getJson<ErrorBody>('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('not_found');
  });
});

describe('meta endpoints', () => {
  it('serves healthz', async () => {
    const { res, body } = await getJson<{ ok: boolean; version: string; datasets: number }>('/api/v1/healthz');
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.datasets).toBe(datasets.length);
    expect(body.version).toBe('0.1.0');
  });

  it('serves the field map at /schema', async () => {
    const { body } = await getJson<Record<string, unknown>>('/api/v1/schema');
    expect(body.canonical).toBeDefined();
    expect(body.aliases).toBeDefined();
  });

  it('serves the SDK snippets at /snippets', async () => {
    const { res, body } = await getJson<{ version: number; placeholders: string[]; languages: Record<string, unknown> }>(
      '/api/v1/snippets',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeTruthy();
    expect(body.version).toBe(1);
    expect(Object.keys(body.languages).sort()).toEqual(['javascript', 'python', 'rust']);
    expect(body.placeholders).toContain('{{LANGUAGE}}');
  });

  it('keeps /schema to field_map.json alone', async () => {
    const { body } = await getJson<Record<string, unknown>>('/api/v1/schema');
    expect(body.canonical).toBeDefined();
    expect(body.languages).toBeUndefined();
    expect(body.placeholders).toBeUndefined();
  });

  it('serves an OpenAPI 3.1 document describing every endpoint', async () => {
    const { res, body } = await getJson<{ openapi: string; paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } }>(
      '/api/v1/openapi.json',
    );
    expect(res.status).toBe(200);
    expect(body.openapi).toBe('3.1.0');
    expect(Object.keys(body.paths).sort()).toEqual(
      [
        '/countries',
        '/countries/{iso2}',
        '/datasets',
        '/datasets/{id}',
        '/healthz',
        '/languages',
        '/languages/{slug}',
        '/languages/{slug}/aliases',
        '/openapi.json',
        '/schema',
        '/snippets',
        '/stats',
      ].sort(),
    );
    expect(Object.keys(body.components.schemas)).toContain('Dataset');
  });
});

describe('caching and CORS', () => {
  it('answers a preflight', async () => {
    const res = await call('/api/v1/datasets', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns 304 when the ETag still matches', async () => {
    const first = await call('/api/v1/stats');
    const tag = first.headers.get('ETag');
    expect(tag).toBeTruthy();
    const second = await call('/api/v1/stats', { headers: { 'If-None-Match': tag as string } });
    expect(second.status).toBe(304);
  });

  it('rejects a write method', async () => {
    const res = await call('/api/v1/datasets', { method: 'POST' });
    expect(res.status).toBe(405);
  });
});

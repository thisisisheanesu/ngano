import { describe, expect, it } from 'vitest';
import { call } from './helpers.js';
import catalogue from '../../data/catalogue.json';
import countriesJson from '../../data/countries.json';
import languagesJson from '../../data/languages.json';
import type { Country, Dataset, Language } from '../src/types.js';

const datasets = catalogue as unknown as Dataset[];
const countries = countriesJson as unknown as Country[];
const languages = languagesJson as unknown as Language[];

describe('site routes', () => {
  const paths = ['/', '/map', '/credits', '/docs'];

  for (const path of paths) {
    it(`serves HTML at ${path}`, async () => {
      const res = await call(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');
      expect((await res.text()).length).toBeGreaterThan(50);
    });
  }

  it('serves a country, a dataset and a language page', async () => {
    for (const path of [
      `/countries/${(countries[0] as Country).iso2.toLowerCase()}`,
      `/datasets/${encodeURIComponent((datasets[0] as Dataset).id)}`,
      `/languages/${(languages[0] as Language).slug}`,
    ]) {
      const res = await call(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');
    }
  });

  it('treats a trailing slash as the same page', async () => {
    expect((await call('/docs/')).status).toBe(200);
  });

  it('404s an unknown page as HTML', async () => {
    const res = await call('/nowhere');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(await res.text()).toContain('/nowhere');
  });

  it('404s an unknown country, dataset and language', async () => {
    expect((await call('/countries/xx')).status).toBe(404);
    expect((await call('/datasets/nope')).status).toBe(404);
    expect((await call('/languages/klingon')).status).toBe(404);
  });

  it('redirects www to the apex', async () => {
    const res = await call('https://www.ngano.dev/docs');
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://ngano.dev/docs');
  });

  it('rejects a write method on a site route', async () => {
    expect((await call('/docs', { method: 'POST' })).status).toBe(405);
  });
});

describe('raw data downloads', () => {
  const files = [
    'catalogue.json',
    'countries.json',
    'languages.json',
    'language_codes.json',
    'africa.geo.json',
    'field_map.json',
    'snippets.json',
  ];

  for (const file of files) {
    it(`serves /data/${file} with a long cache`, async () => {
      const res = await call(`/data/${file}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('ETag')).toBeTruthy();
      const body = await res.json();
      expect(body).toBeTruthy();
    });
  }

  it('serves the catalogue unchanged', async () => {
    const res = await call('/data/catalogue.json');
    const body = (await res.json()) as Dataset[];
    expect(body).toHaveLength(datasets.length);
    expect(body[0]?.id).toBe(datasets[0]?.id);
  });

  it('answers a matching ETag with 304', async () => {
    const first = await call('/data/countries.json');
    const tag = first.headers.get('ETag') as string;
    const second = await call('/data/countries.json', { headers: { 'If-None-Match': tag } });
    expect(second.status).toBe(304);
  });

  it('404s an unknown data file', async () => {
    const res = await call('/data/secrets.json');
    expect(res.status).toBe(404);
  });
});

describe('site assets', () => {
  for (const path of ['/styles.css', '/site.js', '/map.js', '/og.svg']) {
    it(`serves ${path} with a long cache`, async () => {
      const res = await call(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
      expect(res.headers.get('ETag')).toBeTruthy();
      expect((await res.text()).length).toBeGreaterThan(0);
    });
  }

  it('serves the favicon at the .ico path too', async () => {
    const res = await call('/favicon.ico');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
  });

  it('answers a matching ETag on an asset with 304', async () => {
    const first = await call('/styles.css');
    const tag = first.headers.get('ETag') as string;
    expect((await call('/styles.css', { headers: { 'If-None-Match': tag } })).status).toBe(304);
  });
});

describe('robots, sitemap and favicon', () => {
  it('serves robots.txt pointing at the sitemap', async () => {
    const res = await call('/robots.txt');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('Sitemap: https://ngano.dev/sitemap.xml');
    expect(body).toContain('User-agent: *');
  });

  it('lists every country, dataset and language in the sitemap', async () => {
    const res = await call('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');
    const body = await res.text();
    const count = (body.match(/<url>/g) ?? []).length;
    /* Home, map, docs, credits, plus the two directories, plus every record page. */
    expect(count).toBe(6 + countries.length + datasets.length + languages.length);
    expect(body).toContain('<loc>https://ngano.dev/</loc>');
    expect(body).toContain(`<loc>https://ngano.dev/countries/${(countries[0] as Country).iso2.toLowerCase()}</loc>`);
    expect(body).toContain(`<loc>https://ngano.dev/languages/${(languages[0] as Language).slug}</loc>`);
    expect(body).toContain('<loc>https://ngano.dev/countries</loc>');
    expect(body).toContain('<loc>https://ngano.dev/languages</loc>');
  });

  it('serves an SVG favicon', async () => {
    const res = await call('/favicon.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(await res.text()).toContain('<svg');
  });
});

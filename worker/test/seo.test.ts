import { describe, expect, it } from 'vitest';
import { SELF } from 'cloudflare:test';

const call = (path: string) => SELF.fetch(`https://ngano.dev${path}`);

describe('how a machine finds out what this is', () => {
  it('serves llms.txt with the figures taken from the catalogue', async () => {
    const res = await call('/llms.txt');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const body = await res.text();
    expect(body.startsWith('# ngano')).toBe(true);
    /* The numbers must come from the catalogue, never be typed in beside it. */
    const stats = await (await call('/api/v1/stats')).json<{ datasets: number; languages: number }>();
    expect(body).toContain(String(stats.datasets));
    expect(body).toContain(String(stats.languages));
    /* The point of the file is the machine-readable surfaces, so they have to be in it. */
    for (const surface of ['/data/catalogue.json', '/api/v1/datasets', '/api/v1/openapi.json', '/mcp']) {
      expect(body, surface).toContain(surface);
    }
  });

  it('points crawlers at llms.txt from robots.txt', async () => {
    const body = await (await call('/robots.txt')).text();
    expect(body).toContain('/llms.txt');
    expect(body).toContain('Sitemap:');
  });

  it('declares the site as a DataCatalog, not only a WebSite', async () => {
    const html = await (await call('/')).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const types = blocks.flatMap((m) => {
      const parsed = JSON.parse(m[1] as string) as unknown;
      return (Array.isArray(parsed) ? parsed : [parsed]).map((o) => (o as { '@type': string })['@type']);
    });
    expect(types).toContain('WebSite');
    /* Without this the per-dataset records read as strays rather than one collection. */
    expect(types).toContain('DataCatalog');
  });

  it('keeps a Dataset record on every dataset page, inside the catalogue', async () => {
    const html = await (await call('/datasets/waxal-corpus-paper')).text();
    expect(html).toContain('"@type":"Dataset"');
    expect(html).toContain('"includedInDataCatalog"');
  });
});

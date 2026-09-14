import { describe, expect, it } from 'vitest';
import { routeLabel, surfaceOf } from '../src/analytics';

describe('what the counter records', () => {
  it('collapses record paths to their route pattern', () => {
    /* Without this the dataset grows a value per dataset id and per country page. */
    expect(routeLabel('/countries/zw')).toBe('/countries/:iso2');
    expect(routeLabel('/countries/ng')).toBe('/countries/:iso2');
    expect(routeLabel('/languages/eng-ng')).toBe('/languages/:tag');
    expect(routeLabel('/datasets/waxal-corpus-paper')).toBe('/datasets/:id');
    expect(routeLabel('/api/v1/datasets/fleurs')).toBe('/api/v1/datasets/:id');
    expect(routeLabel('/data/catalogue.json')).toBe('/data/:file');
  });

  it('keeps the fixed pages as themselves', () => {
    for (const path of ['/', '/map', '/docs', '/credits', '/countries', '/languages']) {
      expect(routeLabel(path)).toBe(path);
    }
  });

  it('refuses to make a column value out of an arbitrarily long path', () => {
    expect(routeLabel(`/${'x'.repeat(200)}`)).toBe('/other');
  });

  it('separates pages, the API, MCP, the admin and the data files', () => {
    expect(surfaceOf('/')).toBe('site');
    expect(surfaceOf('/languages/sna')).toBe('site');
    expect(surfaceOf('/api/v1/stats')).toBe('api');
    expect(surfaceOf('/mcp')).toBe('mcp');
    expect(surfaceOf('/data/catalogue.json')).toBe('data');
  });

  it('counts admin traffic as its own thing, never as a page view', () => {
    /* Reading my own dashboard should not show up as someone reading the site. */
    expect(surfaceOf('/admin')).toBe('admin');
    expect(surfaceOf('/admin/login')).toBe('admin');
    expect(surfaceOf('/admin/password')).toBe('admin');
  });

  it('still recognises assets, which is what lets them be dropped', () => {
    for (const path of ['/styles.css', '/filter.js', '/site.js', '/map.js', '/favicon.svg', '/og.svg']) {
      expect(surfaceOf(path), path).toBe('asset');
    }
  });
});

describe('country names on the dashboard', () => {
  it('turns a code into something readable', async () => {
    const { countryName } = await import('../src/admin/page');
    expect(countryName('ZW')).toBe('Zimbabwe');
    expect(countryName('NL')).toBe('Netherlands');
    expect(countryName('zw')).toBe('Zimbabwe');
  });

  it('falls back rather than inventing a name', async () => {
    const { countryName } = await import('../src/admin/page');
    /* XX is what analytics.ts writes when Cloudflare resolved nothing. */
    expect(countryName('XX')).toBe('XX');
    /* T1 is Cloudflare's code for traffic over Tor; ICU rejects it outright. */
    expect(countryName('T1')).toBe('T1');
    /* ZZ is a real code meaning unknown, and ICU's own name for it is the honest one. */
    expect(countryName('ZZ')).toBe('Unknown Region');
    expect(countryName('')).toBe('Unknown');
    expect(countryName('nonsense')).toBe('Unknown');
  });
});

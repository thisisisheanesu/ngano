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

  it('separates the site from the API, the MCP endpoint, the data files and the assets', () => {
    expect(surfaceOf('/')).toBe('site');
    expect(surfaceOf('/languages/sna')).toBe('site');
    expect(surfaceOf('/api/v1/stats')).toBe('api');
    expect(surfaceOf('/mcp')).toBe('mcp');
    expect(surfaceOf('/data/catalogue.json')).toBe('data');
    expect(surfaceOf('/styles.css')).toBe('asset');
    expect(surfaceOf('/filter.js')).toBe('asset');
  });
});

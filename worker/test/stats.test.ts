import { describe, expect, it } from 'vitest';
import { getJson } from './helpers.js';
import type { Stats } from '../src/types.js';

/**
 * One snapshot of /api/v1/stats. It is the contract the site, the SDKs and the MCP
 * tools all quote numbers from, so a change here should be a deliberate act: either
 * the catalogue was rebuilt or an aggregate rule moved. Update the snapshot only
 * when you meant to.
 */
describe('GET /api/v1/stats', () => {
  it('matches the snapshot', async () => {
    const { res, body } = await getJson<Stats>('/api/v1/stats');
    expect(res.status).toBe(200);
    expect(body).toMatchSnapshot();
  });

  it('keeps its facets internally consistent', async () => {
    const { body } = await getJson<Stats>('/api/v1/stats');
    for (const [name, facets] of Object.entries({
      by_task: body.by_task,
      by_commercial: body.by_commercial,
      by_licence_class: body.by_licence_class,
      by_access: body.by_access,
      by_labelled: body.by_labelled,
      by_quality: body.by_quality,
      by_variety: body.by_variety,
    })) {
      // Each of these facets comes from a single-valued field, so the dataset
      // counts must add back up to the catalogue size exactly.
      const total = facets.reduce((sum, f) => sum + f.datasets, 0);
      expect(total, name).toBe(body.datasets);
      const hours = facets.reduce((sum, f) => sum + f.hours, 0);
      expect(Math.abs(hours - body.hours), name).toBeLessThan(1);
    }
  });

  it('never reports more open or commercial hours than it has hours', () => {
    return getJson<Stats>('/api/v1/stats').then(({ body }) => {
      expect(body.hours_open).toBeLessThanOrEqual(body.hours);
      expect(body.hours_commercial).toBeLessThanOrEqual(body.hours);
      expect(body.hours).toBeGreaterThan(0);
    });
  });
});

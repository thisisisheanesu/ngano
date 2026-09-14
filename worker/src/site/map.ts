/**
 * The map of Africa, drawn as inline SVG straight from `ctx.geo`.
 *
 * There is no mapping library and there are no tiles. The GeoJSON is projected with a
 * plain spherical Mercator transform whose scale and offset are derived from the
 * geometry's own bounds, so the drawing is self-contained and renders offline.
 *
 * Seven island states have no polygon in the source geometry. They are drawn as
 * labelled circles at the latitude and longitude recorded in countries.json, so that
 * every one of the 58 entries in the catalogue is present and clickable.
 *
 * The three colour metrics are all resolved server side: each country carries a bucket
 * index per metric as a data attribute, and the client script only swaps a class. That
 * keeps the page correct with JavaScript switched off, where it shows hours of audio.
 */

import type { Country, CountryStats, SiteContext } from './context';
import { esc, round, num, hours as fmtHours, niceBreaks, bucketOf, bucketLabels } from './util';

export type MapMetric = 'hours' | 'datasets' | 'languages';

export const METRICS: { id: MapMetric; label: string; unit: string }[] = [
  { id: 'hours', label: 'Hours of audio', unit: 'hours' },
  { id: 'datasets', label: 'Datasets', unit: 'datasets' },
  { id: 'languages', label: 'Language tags', unit: 'language tags' },
];

const CLASSES = 5;
const VIEW_WIDTH = 1000;
const PADDING = 14;
const ISLAND_RADIUS = 11;
/** Invisible circle behind each island so a finger can hit it on a phone. */
const ISLAND_HIT_RADIUS = 24;
/** Minimum gap between two island labels before one is nudged down. */
const LABEL_GAP = 34;

/** A GeoJSON coordinate pair. Indexed access is checked, so both members are read defensively. */
type Coord = number[];

interface GeoFeature {
  properties: { name?: unknown };
  geometry: { type: string; coordinates: unknown };
}

interface Projection {
  width: number;
  height: number;
  project(lon: number, lat: number): [number, number];
}

interface MapModel {
  width: number;
  height: number;
  /** Projected path data per `map_name`. */
  paths: Map<string, string>;
  /** Break points and legend labels per metric. */
  scales: Record<MapMetric, { breaks: number[]; labels: string[] }>;
  project(lon: number, lat: number): [number, number];
}

const CACHE = new WeakMap<object, MapModel>();

/* ------------------------------------------------------------------ geometry */

/**
 * Spherical Mercator, returned in the same units as longitude so that one degree of
 * longitude and one degree of latitude at the equator occupy the same distance on the
 * drawing. Without the radians-to-degrees factor the map comes out flat.
 */
function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  return (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}

function isFeatureCollection(geo: unknown): geo is { features: GeoFeature[] } {
  return (
    typeof geo === 'object' &&
    geo !== null &&
    Array.isArray((geo as { features?: unknown }).features)
  );
}

function ringsOf(feature: GeoFeature): Coord[][] {
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') return coordinates as unknown as Coord[][];
  if (type === 'MultiPolygon') {
    const out: Coord[][] = [];
    for (const polygon of coordinates as unknown as Coord[][][]) out.push(...polygon);
    return out;
  }
  return [];
}

function featureName(feature: GeoFeature): string | null {
  const name = feature.properties?.name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

function pathData(rings: Coord[][], projection: Projection): string {
  const parts: string[] = [];
  for (const ring of rings) {
    let previous = '';
    const points: string[] = [];
    for (const point of ring) {
      const lon = point[0];
      const lat = point[1];
      if (typeof lon !== 'number' || typeof lat !== 'number') continue;
      const [x, y] = projection.project(lon, lat);
      const token = `${round(x, 1)} ${round(y, 1)}`;
      if (token === previous) continue;
      previous = token;
      points.push(token);
    }
    if (points.length < 3) continue;
    parts.push(`M${points.join('L')}Z`);
  }
  return parts.join('');
}

/* ------------------------------------------------------------------ model */

function metricValue(stats: CountryStats | undefined, metric: MapMetric): number {
  if (!stats) return 0;
  if (metric === 'hours') return stats.hours;
  if (metric === 'datasets') return stats.datasets;
  // Counted as BCP 47 tags, so a regional variety counts on its own.
  return stats.language_tags.length;
}

function formatFor(metric: MapMetric): (value: number) => string {
  return metric === 'hours' ? (value) => `${fmtHours(value)} h` : (value) => num(value);
}

/** Build (or reuse) the projected geometry and colour scales for a context. */
export function mapModel(ctx: SiteContext): MapModel {
  const cached = CACHE.get(ctx as unknown as object);
  if (cached) return cached;

  const features = isFeatureCollection(ctx.geo) ? ctx.geo.features : [];

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const observe = (lon: number, lat: number): void => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const y = mercatorY(lat);
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const feature of features) {
    for (const ring of ringsOf(feature)) {
      for (const point of ring) {
        const lon = point[0];
        const lat = point[1];
        if (typeof lon === 'number' && typeof lat === 'number') observe(lon, lat);
      }
    }
  }
  // Island states sit outside the polygon bounds, so they widen the frame.
  for (const country of ctx.countries) {
    if (!country.map_name) observe(country.lon, country.lat);
  }

  if (!Number.isFinite(minLon)) {
    minLon = -26;
    maxLon = 58;
    minY = mercatorY(-36);
    maxY = mercatorY(38);
  }

  const spanLon = Math.max(maxLon - minLon, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = (VIEW_WIDTH - PADDING * 2) / spanLon;
  const height = Math.round(spanY * scale + PADDING * 2);

  const projection: Projection = {
    width: VIEW_WIDTH,
    height,
    project(lon, lat) {
      return [PADDING + (lon - minLon) * scale, PADDING + (maxY - mercatorY(lat)) * scale];
    },
  };

  const paths = new Map<string, string>();
  for (const feature of features) {
    const name = featureName(feature);
    if (!name) continue;
    const d = pathData(ringsOf(feature), projection);
    if (d) paths.set(name, d);
  }

  const scales = {} as MapModel['scales'];
  for (const metric of METRICS) {
    const values = ctx.countries.map((c) => metricValue(ctx.countryStats.get(c.iso2), metric.id));
    const breaks = niceBreaks(values, CLASSES);
    scales[metric.id] = { breaks, labels: bucketLabels(breaks, formatFor(metric.id)) };
  }

  const model: MapModel = { width: VIEW_WIDTH, height, paths, scales, project: projection.project };
  CACHE.set(ctx as unknown as object, model);
  return model;
}

/* ------------------------------------------------------------------ rendering */

function countryAttrs(ctx: SiteContext, model: MapModel, country: Country): string {
  const stats = ctx.countryStats.get(country.iso2);
  const values: Record<MapMetric, number> = {
    hours: metricValue(stats, 'hours'),
    datasets: metricValue(stats, 'datasets'),
    languages: metricValue(stats, 'languages'),
  };
  const attrs = [
    `data-iso="${esc(country.iso2)}"`,
    `data-name="${esc(country.name)}"`,
    `data-hours="${esc(fmtHours(values.hours))}"`,
    `data-datasets="${esc(num(values.datasets))}"`,
    `data-languages="${esc(num(values.languages))}"`,
  ];
  for (const metric of METRICS) {
    attrs.push(`data-b-${metric.id}="${bucketOf(values[metric.id], model.scales[metric.id].breaks)}"`);
  }
  return attrs.join(' ');
}

function describe(country: Country, stats: CountryStats | undefined): string {
  if (!stats || stats.datasets === 0) {
    return `${country.name}: no datasets in the catalogue`;
  }
  const parts = [
    `${fmtHours(stats.hours)} hours`,
    `${num(stats.datasets)} ${stats.datasets === 1 ? 'dataset' : 'datasets'}`,
    `${num(stats.language_tags.length)} ${stats.language_tags.length === 1 ? 'language tag' : 'language tags'}`,
  ];
  return `${country.name}: ${parts.join(', ')}`;
}

function legend(model: MapModel, metric: MapMetric, active: boolean): string {
  const { labels } = model.scales[metric];
  const swatches = labels
    .map((label, i) => `<span class="sw"><i class="b${i}" style="background:var(--c${i})"></i>${esc(label)}</span>`)
    .join('');
  const name = METRICS.find((m) => m.id === metric)?.label ?? metric;
  return `<div class="legend" data-legend="${esc(metric)}"${active ? '' : ' hidden'}><span class="sr">Colour scale for ${esc(name)}.</span>${swatches}</div>`;
}

export interface MapOptions {
  /** Element id prefix, so the map can appear twice in one document without clashing. */
  id: string;
  /** Metric coloured on first paint, and the one used with JavaScript switched off. */
  metric?: MapMetric;
  /** Heading rendered above the map. */
  heading?: string;
}

/** Render the interactive choropleth as a self-contained card. */
export function renderMapFigure(ctx: SiteContext, options: MapOptions): string {
  const model = mapModel(ctx);
  const active: MapMetric = options.metric ?? 'hours';
  const id = options.id;

  const shapes: string[] = [];
  const islands: string[] = [];
  /* Comoros, Mayotte and Reunion sit close together, so labels are nudged apart. */
  const placedLabels: { x: number; y: number }[] = [];

  for (const country of ctx.countries) {
    const stats = ctx.countryStats.get(country.iso2);
    const attrs = countryAttrs(ctx, model, country);
    const bucket = bucketOf(metricValue(stats, active), model.scales[active].breaks);
    const label = describe(country, stats);
    const href = `/countries/${esc(country.iso2.toLowerCase())}`;

    if (country.map_name) {
      const d = model.paths.get(country.map_name);
      if (!d) continue;
      shapes.push(
        `<a href="${href}" ${attrs}><title>${esc(label)}</title><path class="geo b${bucket}" d="${d}"/></a>`,
      );
    } else {
      const [x, y] = model.project(country.lon, country.lat);
      /* Mauritius and Reunion sit on the right edge of the frame, so their labels
         are flipped inwards rather than running off the drawing. */
      const flip = x > model.width * 0.86;
      const labelX = flip ? x - ISLAND_RADIUS - 5 : x + ISLAND_RADIUS + 5;
      let labelY = y + 7;
      while (placedLabels.some((p) => Math.abs(p.x - labelX) < LABEL_GAP * 2 && Math.abs(p.y - labelY) < LABEL_GAP)) {
        labelY += LABEL_GAP;
      }
      placedLabels.push({ x: labelX, y: labelY });
      islands.push(
        `<a href="${href}" ${attrs}><title>${esc(label)}</title>` +
          `<circle class="hit" cx="${round(x, 1)}" cy="${round(y, 1)}" r="${ISLAND_HIT_RADIUS}"/>` +
          `<circle class="geo isl b${bucket}" cx="${round(x, 1)}" cy="${round(y, 1)}" r="${ISLAND_RADIUS}"/>` +
          `<text class="isllab" x="${round(labelX, 1)}" y="${round(labelY, 1)}"${flip ? ' text-anchor="end"' : ''}>${esc(country.iso2)}</text></a>`,
      );
    }
  }

  const buttons = METRICS.map(
    (metric) =>
      `<button type="button" data-metric="${esc(metric.id)}" aria-pressed="${metric.id === active ? 'true' : 'false'}">${esc(metric.label)}</button>`,
  ).join('');

  const legends = METRICS.map((metric) => legend(model, metric.id, metric.id === active)).join('');

  const heading = options.heading
    ? `<h2 class="sec" id="${esc(id)}-heading">${esc(options.heading)}</h2>`
    : '';

  return `<figure class="mapcard" id="${esc(id)}" data-map data-metric="${esc(active)}" style="margin:0">
<div class="maphead">
<div>${heading}<p class="note" style="margin:0">Colour shows ${esc(METRICS.find((m) => m.id === active)?.label.toLowerCase() ?? 'hours of audio')} per country. Click a country for its datasets.</p></div>
<div class="metricbar" role="group" aria-label="Colour the map by" data-metricbar hidden>${buttons}</div>
</div>
<div class="mapstage">
<svg class="africa" viewBox="0 0 ${model.width} ${model.height}" role="group" aria-label="Map of Africa. Every country is a link to its page in the catalogue." preserveAspectRatio="xMidYMid meet">
<g data-layer="mainland">${shapes.join('')}</g>
<g data-layer="islands">${islands.join('')}</g>
</svg>
<div class="maptip" role="status" data-tip hidden></div>
</div>
${legends}
<figcaption class="note">Island states have no outline in the source geometry, so they are drawn as circles at their centre point. Figures are as published by each source, and self-reported totals of 20,000 hours or more are excluded.</figcaption>
</figure>`;
}

/**
 * A small outline of one country, projected to its own bounds. Used as a locator on
 * country pages. Island states have no polygon, so they get a marked point instead.
 */
export function renderLocator(ctx: SiteContext, country: Country): string {
  const label = `Outline of ${country.name}`;
  if (!country.map_name) {
    return `<svg class="locator" viewBox="0 0 100 100" role="img" aria-label="${esc(country.name)} is an island state, shown as a point.">
<circle class="ctx" cx="50" cy="50" r="34"/><circle class="me" cx="50" cy="50" r="9"/></svg>`;
  }

  const features = isFeatureCollection(ctx.geo) ? ctx.geo.features : [];
  const feature = features.find((f) => featureName(f) === country.map_name);
  if (!feature) return '';

  const rings = ringsOf(feature);
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const point of ring) {
      const lon = point[0];
      const lat = point[1];
      if (typeof lon !== 'number' || typeof lat !== 'number') continue;
      const y = mercatorY(lat);
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minLon)) return '';

  const pad = 4;
  const box = 200;
  const spanLon = Math.max(maxLon - minLon, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = (box - pad * 2) / Math.max(spanLon, spanY);
  const offsetX = (box - spanLon * scale) / 2;
  const offsetY = (box - spanY * scale) / 2;

  const projection: Projection = {
    width: box,
    height: box,
    project(lon, lat) {
      return [offsetX + (lon - minLon) * scale, offsetY + (maxY - mercatorY(lat)) * scale];
    },
  };

  const d = pathData(rings, projection);
  if (!d) return '';
  return `<svg class="locator" viewBox="0 0 ${box} ${box}" role="img" aria-label="${esc(label)}"><path class="me" d="${d}"/></svg>`;
}

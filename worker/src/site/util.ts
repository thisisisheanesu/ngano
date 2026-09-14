/**
 * Small pure helpers shared by every page renderer.
 *
 * Everything that reaches the HTML output goes through `esc`. Dataset names, notes,
 * language names, licence strings and credits are all treated as untrusted text.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a value for interpolation into HTML text or into a quoted attribute.
 * Non-strings are coerced; null and undefined become the empty string.
 */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  return s.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/** Escape a value for use inside a URL path or query segment. */
export function escUrl(value: unknown): string {
  if (value === null || value === undefined) return '';
  return encodeURIComponent(typeof value === 'string' ? value : String(value));
}

/**
 * Serialise a value for a `<script type="application/ld+json">` or data island.
 * `<`, `>` and `&` are escaped as unicode so the string can never close the script
 * element or open a comment.
 */
export function jsonScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Group an array by a derived key, preserving insertion order of both keys and items. */
export function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Count occurrences of each derived key. */
export function countBy<T>(items: readonly T[], key: (item: T) => string | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** Sort a map's entries by descending count, then by key, and return them as an array. */
export function rankCounts(counts: Map<string, number>): { value: string; count: number }[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Format a whole number with thin thousands separators. */
export function num(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}

/**
 * Format an hours figure. Below ten hours one decimal is kept, because the
 * difference between 1.2 and 8.4 hours matters at that scale.
 */
export function hours(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'not stated';
  if (value === 0) return '0';
  if (value < 10) return (Math.round(value * 10) / 10).toString();
  return num(value);
}

/** Compact form for tight spaces: 1.2k, 44.7k, 250. */
export function compact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${Math.round(value / 100000) / 10}M`;
  if (abs >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (abs >= 10) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

/** `1 dataset` / `4 datasets`, with the count formatted. */
export function plural(count: number, one: string, many: string): string {
  return `${num(count)} ${count === 1 ? one : many}`;
}

/** Join a list into readable prose: "a, b and c". */
export function listSentence(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const head = items.slice(0, -1).join(', ');
  return `${head} and ${items[items.length - 1] ?? ''}`;
}

/** Cut a string to a maximum length on a word boundary, appending an ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

/** Collapse whitespace, for meta descriptions built from multi-line copy. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Deduplicate while preserving order. */
export function uniq(items: readonly string[]): string[] {
  return [...new Set(items)];
}

/** Round to a fixed number of decimals and drop trailing zeroes, for SVG path data. */
export function round(value: number, places = 2): string {
  const factor = 10 ** places;
  const r = Math.round(value * factor) / factor;
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * Choose "nice" ascending break points for a choropleth from the observed values.
 * Breaks are quantiles of the non-zero values snapped to a 1 / 2 / 5 x 10^n ladder,
 * so every legend label names a value a reader can recognise.
 */
export function niceBreaks(values: readonly number[], classes: number): number[] {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (positive.length === 0) return [];
  const breaks: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    const at = positive[Math.min(positive.length - 1, Math.floor((positive.length * i) / classes))];
    if (at === undefined) continue;
    const snapped = snap(at);
    if (snapped > 0 && breaks[breaks.length - 1] !== snapped) breaks.push(snapped);
  }
  const top = positive[positive.length - 1] ?? 0;
  return breaks.filter((b) => b <= top);
}

function snap(value: number): number {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1.5 ? 1 : scaled <= 3.5 ? 2 : scaled <= 7.5 ? 5 : 10;
  return step * magnitude;
}

/** Index of the class a value falls into, given ascending breaks. 0 means "none". */
export function bucketOf(value: number, breaks: readonly number[]): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  let i = 0;
  while (i < breaks.length && value >= (breaks[i] ?? Infinity)) i += 1;
  return i + 1;
}

/** Human legend labels for the buckets produced by `bucketOf`. */
export function bucketLabels(breaks: readonly number[], format: (n: number) => string): string[] {
  const labels = ['none'];
  if (breaks.length === 0) {
    labels.push('any');
    return labels;
  }
  labels.push(`under ${format(breaks[0] ?? 0)}`);
  for (let i = 0; i < breaks.length - 1; i += 1) {
    labels.push(`${format(breaks[i] ?? 0)} to ${format(breaks[i + 1] ?? 0)}`);
  }
  labels.push(`${format(breaks[breaks.length - 1] ?? 0)} and up`);
  return labels;
}

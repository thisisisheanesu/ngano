/**
 * Inline SVG icons. Every glyph is drawn here rather than fetched, so the site has no
 * external requests and works offline. Icons are decorative unless a label is passed.
 */

function wrap(body: string, size: number, opts: { label?: string; stroke?: boolean }): string {
  const a = opts.label
    ? `role="img" aria-label="${opts.label.replace(/[&<>"']/g, '')}"`
    : 'aria-hidden="true" focusable="false"';
  const paint = opts.stroke
    ? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    : 'fill="currentColor"';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${paint} ${a}>${body}</svg>`;
}

const STROKE: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
  moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18a15 15 0 010-18z"/>',
  mail: '<rect x="2.8" y="4.8" width="18.4" height="14.4" rx="2.4"/><path d="M3.4 6.4L12 13l8.6-6.6"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8.4 8.4"/><path d="M18 14.4V19a1.6 1.6 0 01-1.6 1.6H5A1.6 1.6 0 013.4 19V7.6A1.6 1.6 0 015 6h4.6"/>',
  arrow: '<path d="M5 12h13"/><path d="M12.6 5.8L18.8 12l-6.2 6.2"/>',
  map: '<path d="M9 3.4L3.6 5.8v14.8L9 18.2l6 2.4 5.4-2.4V3.4L15 5.8z"/><path d="M9 3.4v14.8M15 5.8v14.8"/>',
  book: '<path d="M4 4.6h6a3 3 0 013 3v12a2.4 2.4 0 00-2.4-2.4H4z"/><path d="M20 4.6h-6a3 3 0 00-3 3v12a2.4 2.4 0 012.4-2.4H20z"/>',
  copy: '<rect x="9" y="9" width="11.4" height="11.4" rx="2"/><path d="M5.6 15H4.8A1.8 1.8 0 013 13.2V4.8A1.8 1.8 0 014.8 3h8.4A1.8 1.8 0 0115 4.8v.8"/>',
  flag: '<path d="M5 21V4.2"/><path d="M5 4.8c4-2 8 2 12 0v8.6c-4 2-8-2-12 0z"/>',
  spark: '<path d="M12 3l2.3 6.1L20.4 11l-6.1 2.3L12 19.4l-2.3-6.1L3.6 11l6.1-1.9z"/>',
  list: '<path d="M8.4 6.4h12M8.4 12h12M8.4 17.6h12"/><path d="M4 6.4h.01M4 12h.01M4 17.6h.01"/>',
};

const FILL: Record<string, string> = {
  github:
    '<path d="M12 1.6a10.4 10.4 0 00-3.3 20.3c.5.1.7-.2.7-.5v-1.9c-2.9.6-3.5-1.3-3.5-1.3-.5-1.2-1.2-1.5-1.2-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.2.4-2.1 1.1-2.9-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 015.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.8 1.1 1.7 1.1 2.9 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v3c0 .3.2.6.7.5A10.4 10.4 0 0012 1.6z"/>',
  linkedin:
    '<path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3.2 21.3h3.6V9.4H3.2zM9.3 9.4h3.45v1.63h.05c.48-.9 1.66-1.86 3.42-1.86 3.65 0 4.33 2.4 4.33 5.53v6.6h-3.6v-5.85c0-1.4-.03-3.2-1.95-3.2-1.96 0-2.26 1.52-2.26 3.1v5.95H9.3z"/>',
  x: '<path d="M17.53 3h3.2l-6.99 7.99L22 21h-6.44l-5.04-6.6L4.75 21H1.54l7.48-8.55L2 3h6.6l4.56 6.03zM16.4 19.08h1.77L7.7 4.82H5.8z"/>',
  huggingface:
    '<path d="M12 2.6a8.3 8.3 0 00-7.7 11.45 2.36 2.36 0 00-1.2 1.2c-.45 1 .02 2 .6 2.66.2.87.8 1.5 1.6 1.86.5.6 1.3.93 2.2.8A8.28 8.28 0 0012 21.4a8.28 8.28 0 004.5-.83c.9.13 1.7-.2 2.2-.8.8-.36 1.4-1 1.6-1.86.58-.67 1.05-1.66.6-2.66a2.36 2.36 0 00-1.2-1.2A8.3 8.3 0 0012 2.6zm-3.1 6a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zm6.2 0a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zM7.9 13.6h8.2a4.2 4.2 0 01-8.2 0z"/>',
  mastodon:
    '<path d="M20.9 8.3c0-3.6-2.34-4.66-2.34-4.66C17.38 3.1 15.35 2.87 13.25 2.85h-.05c-2.1.02-4.13.25-5.3.79 0 0-2.35 1.06-2.35 4.67 0 .82-.02 1.8.01 2.85.09 3.5.65 6.96 3.9 7.82 1.5.4 2.78.48 3.82.42 1.88-.1 2.94-.67 2.94-.67l-.06-1.36s-1.35.42-2.86.37c-1.5-.05-3.08-.16-3.32-2a3.7 3.7 0 01-.03-.5s1.47.35 3.34.44c1.14.05 2.2-.07 3.29-.2 2.08-.25 3.9-1.54 4.13-2.72.36-1.86.33-4.55.33-4.55zm-3.05 5.1H15.96v-4.6c0-.98-.4-1.47-1.22-1.47-.9 0-1.36.58-1.36 1.74v2.52h-1.88V9.07c0-1.16-.45-1.74-1.36-1.74-.81 0-1.22.49-1.22 1.46v4.61H7.03V8.65c0-.97.25-1.74.75-2.31.51-.57 1.18-.86 2.01-.87.96 0 1.69.37 2.18 1.11l.47.79.47-.79c.49-.74 1.22-1.11 2.18-1.11.83.01 1.5.3 2.01.87.5.57.75 1.34.75 2.31z"/>',
  scholar:
    '<path d="M12 2.6L1.2 8.9 12 15.2l8.2-4.79v5.9h1.8V8.9zM4.9 13.3v3.6c0 2.1 3.18 3.8 7.1 3.8s7.1-1.7 7.1-3.8v-3.6L12 17.3z"/>',
  link: '<path d="M10.3 13.7a3.9 3.9 0 005.9.42l2.4-2.4a3.9 3.9 0 00-5.52-5.52l-1.38 1.37 1.42 1.42 1.37-1.38a1.9 1.9 0 012.69 2.69l-2.4 2.4a1.9 1.9 0 01-2.87-.2zm3.4-3.4a3.9 3.9 0 00-5.9-.42l-2.4 2.4a3.9 3.9 0 005.52 5.52l1.38-1.37-1.42-1.42-1.37 1.38a1.9 1.9 0 01-2.69-2.69l2.4-2.4a1.9 1.9 0 012.87.2z"/>',
};

/** Render an icon by name. Unknown names render nothing rather than a broken glyph. */
export function icon(name: string, size = 16, label?: string): string {
  const stroke = STROKE[name];
  if (stroke) return wrap(stroke, size, label === undefined ? { stroke: true } : { stroke: true, label });
  const fill = FILL[name];
  if (fill) return wrap(fill, size, label === undefined ? {} : { label });
  return '';
}

/** True when the icon name is one this module can draw. */
export function hasIcon(name: string): boolean {
  return name in STROKE || name in FILL;
}

/** Fallback icon for a credits link whose `icon` field names something unknown. */
export const GENERIC_LINK_ICON = 'link';

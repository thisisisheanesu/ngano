/**
 * Code blocks, the three-language tab strip, and the loader snippets.
 *
 * Nothing here writes SDK code. Every snippet comes from `data/snippets.json`, which is
 * generated from each package's own `snippets.json` and covered by a test in that
 * package that compiles or type checks it. This module only substitutes the seven
 * tokens from the record the reader is looking at, so what lands on the page is code
 * that runs against the real API for that exact dataset, language or country.
 */

import type { Dataset, Language, SiteContext, SnippetKey, SnippetPack, SnippetToken } from './context';
import { esc } from './util';

export type Lang = 'python' | 'javascript' | 'rust';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'rust', label: 'Rust' },
];

/** Highlighting mode for a code block. Shell transcripts are not source. */
export type Highlight = Lang | 'shell' | 'json' | 'text';

const KEYWORDS: Record<Lang, Set<string>> = {
  python: new Set([
    'import', 'from', 'for', 'in', 'if', 'else', 'elif', 'break', 'continue', 'return',
    'def', 'class', 'with', 'as', 'print', 'True', 'False', 'None', 'and', 'or', 'not', 'is',
  ]),
  javascript: new Set([
    'import', 'from', 'export', 'const', 'let', 'var', 'for', 'of', 'in', 'await', 'async',
    'if', 'else', 'break', 'continue', 'return', 'function', 'new', 'true', 'false', 'null',
  ]),
  rust: new Set([
    'use', 'let', 'mut', 'fn', 'while', 'for', 'in', 'if', 'else', 'match', 'return',
    'pub', 'struct', 'impl', 'async', 'await', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'crate',
  ]),
};

const TOKENS: Record<Lang, RegExp> = {
  python: /("""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[^\n]*|[A-Za-z_][A-Za-z0-9_]*)/g,
  javascript: /(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\/\/[^\n]*|[A-Za-z_$][A-Za-z0-9_$]*)/g,
  rust: /("(?:\\.|[^"\\\n])*"|\/\/\/?[^\n]*|[A-Za-z_][A-Za-z0-9_]*)/g,
};

const SHELL_TOKENS = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[^\n]*|--?[A-Za-z][A-Za-z0-9-]*)/g;

function isSource(highlight: Highlight): highlight is Lang {
  return highlight === 'python' || highlight === 'javascript' || highlight === 'rust';
}

/**
 * A deliberately small highlighter: strings, line comments, keywords and shell flags.
 * Every emitted chunk is escaped, so snippet text is never trusted as markup.
 */
export function highlight(code: string, mode: Highlight): string {
  if (mode === 'json' || mode === 'text') return esc(code);
  const pattern = mode === 'shell' ? SHELL_TOKENS : TOKENS[mode];
  const keywords = isSource(mode) ? KEYWORDS[mode] : null;
  pattern.lastIndex = 0;
  let out = '';
  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(code);
  while (match !== null) {
    const token = match[0];
    out += esc(code.slice(last, match.index));
    if (token.startsWith('#') || token.startsWith('//')) out += `<span class="cm">${esc(token)}</span>`;
    else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`'))
      out += `<span class="st">${esc(token)}</span>`;
    else if (token.startsWith('-')) out += `<span class="kw">${esc(token)}</span>`;
    else if (keywords?.has(token)) out += `<span class="kw">${esc(token)}</span>`;
    else out += esc(token);
    last = match.index + token.length;
    match = pattern.exec(code);
  }
  out += esc(code.slice(last));
  return out;
}

const MODE_LABELS: Record<Highlight, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  rust: 'Rust',
  shell: 'Shell',
  json: 'JSON',
  text: 'Text',
};

/**
 * A single code block. The copy button sits in a strip above the code rather than
 * floating over it, so it cannot cover the end of a short line or sit on top of
 * content the reader has scrolled sideways to reach.
 */
export interface CodeBlockOptions {
  /**
   * Wrap long lines instead of scrolling them. Used for the citation blocks, where a
   * horizontal scrollbar under a seven-line record reads as breakage rather than as an
   * affordance, and the reader wants to see the whole record at once anyway.
   */
  wrap?: boolean;
}

export function codeBlock(code: string, mode: Highlight, label?: string, options: CodeBlockOptions = {}): string {
  const name = label ?? MODE_LABELS[mode];
  return `<div class="codewrap${options.wrap ? ' wrapped' : ''}">
<div class="codebar"><span class="codelang">${esc(name)}</span><button class="copybtn" type="button" data-copy>Copy</button></div>
<pre class="code"><code>${highlight(code, mode)}</code></pre>
</div>`;
}

/* ------------------------------------------------------------------ tabs */

export interface Tab {
  id: string;
  label: string;
  content: string;
}

export interface TabOptions {
  /**
   * Groups sharing a key remember the reader's choice together, in localStorage.
   * The SDK strips all use `sdk`, so a Rust reader picks Rust once per browser.
   */
  rememberAs?: string;
}

/** An accessible tab strip. The first panel is the one visible without JavaScript. */
export function tabs(groupId: string, label: string, items: Tab[], options: TabOptions = {}): string {
  const buttons = items
    .map(
      (item, i) =>
        `<button type="button" role="tab" data-tab="${esc(item.id)}" id="${esc(groupId)}-t-${esc(item.id)}" aria-controls="${esc(groupId)}-p-${esc(item.id)}" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? '0' : '-1'}">${esc(item.label)}</button>`,
    )
    .join('');
  const panels = items
    .map(
      (item, i) =>
        `<div role="tabpanel" id="${esc(groupId)}-p-${esc(item.id)}" aria-labelledby="${esc(groupId)}-t-${esc(item.id)}" tabindex="0"${i === 0 ? '' : ' hidden'}>${item.content}</div>`,
    )
    .join('');
  const remember = options.rememberAs ? ` data-tabs-remember="${esc(options.rememberAs)}"` : '';
  return `<div class="tabgroup" data-tabs${remember}>
<div class="tabbar" role="tablist" aria-label="${esc(label)}">${buttons}</div>
${panels}
</div>`;
}

/* ------------------------------------------------------------------ substitution */

export type SnippetVars = Partial<Record<SnippetToken, string>>;

/**
 * Values used when a page has nothing more specific. The home page example is a real,
 * well-populated corner of the catalogue: Shona in Zimbabwe.
 *
 * `LANGUAGE` is a BCP 47 tag rather than a name, because that is what the SDKs and the
 * API filter on. `sna` is Shona.
 */
export const DEFAULT_VARS: Record<SnippetToken, string> = {
  CONFIG: 'default',
  COUNTRY_ISO2: 'ZW',
  COUNTRY_NAME: 'Zimbabwe',
  DATASET_ID: 'waxal-corpus-paper',
  HF_REPO: 'google/fleurs',
  LANGUAGE: 'sna',
  TASK: 'ASR',
};

/** Token names carry digits too, as in COUNTRY_ISO2. */
const TOKEN_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

/**
 * Fill every `{{TOKEN}}` in a snippet. Anything the caller did not supply falls back to
 * the default, and an unrecognised token falls back to its own name, so a rendered
 * snippet never carries braces a reader would have to edit by hand.
 */
export function substitute(template: string, vars: SnippetVars): string {
  return template.replace(TOKEN_PATTERN, (_match, name: string) => {
    const key = name as SnippetToken;
    return vars[key] ?? DEFAULT_VARS[key] ?? name.toLowerCase();
  });
}

function languageOf(ctx: SiteContext, id: Lang): SnippetPack | undefined {
  return ctx.snippets?.languages?.[id];
}

function isShell(entry: SnippetPack, key: SnippetKey): boolean {
  return Array.isArray(entry.shell_snippets) && entry.shell_snippets.includes(key);
}

/** Render one snippet key across all three languages as a tab strip. */
export function snippetTabs(
  ctx: SiteContext,
  groupId: string,
  key: SnippetKey,
  vars: SnippetVars = {},
  label = 'SDK language',
): string {
  const items: Tab[] = [];
  for (const lang of LANGS) {
    const entry = languageOf(ctx, lang.id);
    const template = entry?.snippets?.[key];
    if (!entry || typeof template !== 'string' || template.trim() === '') continue;
    const shell = isShell(entry, key);
    const code = substitute(template, vars);
    const badge = shell
      ? `<p class="note" style="margin:12px 0 0">Shell transcript for the ${esc(lang.label)} package. Every line is a command, not ${esc(lang.label)} source.</p>`
      : '';
    items.push({
      id: lang.id,
      label: shell ? `${lang.label} CLI` : lang.label,
      content: `${badge}${codeBlock(code, shell ? 'shell' : lang.id)}`,
    });
  }
  if (items.length === 0) return snippetsMissing();
  return tabs(groupId, label, items, { rememberAs: 'sdk' });
}

/** Install lines and the first real call, per language. */
export function installTabs(ctx: SiteContext, groupId: string, vars: SnippetVars = {}): string {
  const items: Tab[] = [];
  for (const lang of LANGS) {
    const entry = languageOf(ctx, lang.id);
    if (!entry) continue;
    const install = [entry.install, entry.install_audio].filter(
      (line): line is string => typeof line === 'string' && line.trim() !== '',
    );
    const template = entry.snippets?.['stream_filter'] ?? entry.snippets?.['catalogue_filter'];
    const audioNote = entry.install_audio
      ? `<p class="note" style="margin:10px 0 0">The second line is optional. It is only needed to decode audio into an array; streaming the bytes needs nothing extra.</p>`
      : '';
    items.push({
      id: lang.id,
      label: lang.label,
      content:
        `<p class="note" style="margin:12px 0 0">Package <code class="inl">${esc(entry.package)}</code></p>` +
        codeBlock(install.join('\n'), 'shell') +
        audioNote +
        (typeof template === 'string' && template.trim() !== ''
          ? codeBlock(substitute(template, vars), lang.id)
          : ''),
    });
  }
  if (items.length === 0) return snippetsMissing();
  return tabs(groupId, 'Install and first call', items, { rememberAs: 'sdk' });
}

/** The CLI transcripts, which are shell rather than source in every language. */
export function cliTabs(ctx: SiteContext, groupId: string, vars: SnippetVars = {}): string {
  return snippetTabs(ctx, groupId, 'cli', vars, 'Command line package');
}

/**
 * Shown only if the merged snippet file is missing or empty. Saying so plainly beats
 * printing code that nobody has compiled.
 */
function snippetsMissing(): string {
  return '<p class="note">The generated SDK snippets are not available in this build. The packages are <code class="inl">ngano</code> on PyPI, npm and crates.io, and the endpoints on this page work without them.</p>';
}

/* ------------------------------------------------------------------ page helpers */

/** Variables for a dataset page: its own id, repo, first language tag and first country. */
export function varsForDataset(ctx: SiteContext, record: Dataset): SnippetVars {
  const tag = record.language_tags[0];
  const iso2 = record.country_codes[0];
  const country = iso2 ? ctx.byIso2.get(iso2)?.name : undefined;
  const vars: SnippetVars = { DATASET_ID: record.id, TASK: record.task };
  if (record.hf_repo) vars.HF_REPO = record.hf_repo;
  if (tag) vars.LANGUAGE = tag;
  if (iso2) vars.COUNTRY_ISO2 = iso2;
  if (country) vars.COUNTRY_NAME = country;
  return vars;
}

/** Variables for a language page. The SDKs filter on the tag, so the tag is what goes in. */
export function varsForLanguage(language: Language): SnippetVars {
  return { LANGUAGE: language.tag };
}

/** Variables for a country page. */
export function varsForCountry(iso2: string, name: string): SnippetVars {
  return { COUNTRY_ISO2: iso2, COUNTRY_NAME: name };
}

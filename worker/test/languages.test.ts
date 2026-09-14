import { describe, expect, it } from 'vitest';
import catalogue from '../../data/catalogue.json';
import languagesJson from '../../data/languages.json';
import languageCodesJson from '../../data/language_codes.json';
import { canonicaliseTag, hoursByLanguageTag, lookupLanguage, resolveLanguage, resolveLanguages } from '../src/data.js';
import type { Dataset, Language, LanguageCodes } from '../src/types.js';

const datasets = catalogue as unknown as Dataset[];
const languages = languagesJson as unknown as Language[];
const registry = languageCodesJson as unknown as LanguageCodes;

/**
 * The registry is the contract the whole Worker keys on, so these tests check the
 * shape of the data as well as the resolver that reads it.
 */
describe('the ISO 639-3 registry', () => {
  it('keys every entry on a tag whose primary subtag is a three-letter code', () => {
    for (const [key, entry] of Object.entries(registry.codes)) {
      expect(entry.tag, key).toBe(key);
      expect(key, key).toMatch(/^[a-z]{3}(-[A-Z]{2}|-[0-9]{3})?$/);
      expect(entry.iso639_3, key).toBe(key.split('-')[0]);
      expect(entry.region, key).toBe(key.includes('-') ? (key.split('-')[1] as string) : null);
    }
  });

  it('gives every language entry a slug that is its tag lowercased', () => {
    expect(languages.length).toBe(Object.keys(registry.codes).length);
    for (const l of languages) {
      expect(l.slug, l.tag).toBe(l.tag.toLowerCase());
      expect(registry.codes[l.tag], l.tag).toBeDefined();
    }
  });

  it('uses only tags the registry knows, on every catalogue record', () => {
    for (const d of datasets) {
      for (const tag of d.language_tags) expect(registry.codes[tag], `${d.id} ${tag}`).toBeDefined();
      // The bare codes are the tags with their region dropped, deduplicated.
      expect(d.language_codes).toEqual([...new Set(d.language_tags.map((t) => t.split('-')[0] as string))]);
      expect(d.languages_clean.length, d.id).toBe(d.language_tags.length);
    }
  });

  it('explains itself when a record carries no tags', () => {
    const untagged = datasets.filter((d) => d.language_tags.length === 0);
    expect(untagged.length).toBeGreaterThan(0);
    // Not every untagged record needs a note, but a note only ever appears on one.
    for (const d of datasets) {
      if (d.language_note !== undefined) {
        expect(d.language_tags, d.id).toHaveLength(0);
        expect(d.language_note.length, d.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('canonicaliseTag', () => {
  it('lowercases the primary subtag and uppercases the region', () => {
    expect(canonicaliseTag('sna')).toBe('sna');
    expect(canonicaliseTag('SNA')).toBe('sna');
    expect(canonicaliseTag('eng-ng')).toBe('eng-NG');
    expect(canonicaliseTag('ENG-Ng')).toBe('eng-NG');
    expect(canonicaliseTag('  swh  ')).toBe('swh');
  });

  it('rejects anything that is not tag shaped', () => {
    for (const value of ['', 'en', 'english', 'eng-NGA', 'sna_ZW', 'Nigerian English']) {
      expect(canonicaliseTag(value), value).toBeNull();
    }
  });
});

describe('resolveLanguage', () => {
  it('accepts a tag in any case', () => {
    for (const value of ['sna', 'SNA', 'Sna']) expect(resolveLanguage(value)).toEqual(['sna']);
    for (const value of ['eng-NG', 'eng-ng', 'ENG-NG']) expect(resolveLanguage(value)).toEqual(['eng-NG']);
  });

  it('accepts any alias of a tag, which is how an old free-text name still works', () => {
    expect(resolveLanguage('Shona')).toEqual(['sna']);
    expect(resolveLanguage('shona')).toEqual(['sna']);
    expect(resolveLanguage('Nigerian English')).toEqual(['eng-NG']);
    expect(resolveLanguage('nigerian-english')).toEqual(['eng-NG']);
    expect(resolveLanguage('English (Nigeria)')).toEqual(['eng-NG']);
  });

  it('resolves every alias in the registry back to its own tag', () => {
    for (const [tag, entry] of Object.entries(registry.codes)) {
      for (const alias of entry.aliases) {
        // A three-letter alias is read as a tag first, which is the documented rule.
        if (canonicaliseTag(alias)) continue;
        expect(resolveLanguage(alias), alias).toEqual([tag]);
      }
    }
  });

  it('never lets a bare code stand for a regional variety', () => {
    expect(resolveLanguage('eng')).toEqual(['eng']);
    expect(resolveLanguage('English')).toEqual(['eng']);
    expect(resolveLanguage('por')).toEqual(['por']);
  });

  it('widens a bare code to its varieties when asked, and never a tag that has a region', () => {
    const wide = resolveLanguage('eng', { includeVarieties: true });
    expect(wide[0]).toBe('eng');
    expect(wide).toContain('eng-NG');
    expect(wide).toContain('eng-ZA');
    expect(new Set(wide).size).toBe(wide.length);
    for (const tag of wide) expect(tag.split('-')[0]).toBe('eng');

    expect(resolveLanguage('eng-NG', { includeVarieties: true })).toEqual(['eng-NG']);
  });

  it('widens a name as well as a code', () => {
    expect(resolveLanguage('English', { includeVarieties: true })).toEqual(resolveLanguage('eng', { includeVarieties: true }));
  });

  it('lets a tag win over a name where the two spellings collide', () => {
    // "Tem" is a name of kdh, while "tem" is the tag for Timne, whose own name is
    // "Temne". A three-letter input is read as a tag, so the tag wins.
    expect(registry.codes.kdh?.aliases.map((a) => a.toLowerCase())).toContain('tem');
    expect(resolveLanguage('tem')).toEqual(['tem']);
    expect(resolveLanguage('Tem')).toEqual(['tem']);
    // The longer spelling is unambiguous and still reaches the name.
    expect(resolveLanguage('Temne')).toEqual(['tem']);
  });

  it('returns nothing for a language it does not know', () => {
    for (const value of ['', '   ', 'Klingon', 'zzz', 'not-a-language']) {
      expect(resolveLanguage(value), value).toEqual([]);
    }
  });

  it('deduplicates across several values and keeps the order asked for', () => {
    expect(resolveLanguages(['Shona', 'sna', 'swh', 'Swahili'])).toEqual(['sna', 'swh']);
    expect(resolveLanguages(['eng-NG', 'eng'], { includeVarieties: true })[0]).toBe('eng-NG');
  });
});

describe('lookupLanguage', () => {
  it('finds the same record whichever spelling is used', () => {
    const wanted = languages.find((l) => l.tag === 'sna');
    for (const value of ['sna', 'SNA', 'Shona', 'shona']) {
      expect(lookupLanguage(value), value).toBe(wanted);
    }
  });

  it('returns null rather than guessing', () => {
    expect(lookupLanguage('Klingon')).toBeNull();
    expect(lookupLanguage('zzz')).toBeNull();
  });
});

describe('per-language hours', () => {
  it('apportions a record evenly across its language_tags', () => {
    // Two languages on one record means half its countable hours each. The shipped
    // file rounds to one decimal, so allow exactly that much difference.
    for (const l of languages) {
      expect(Math.abs((hoursByLanguageTag.get(l.tag) ?? 0) - l.hours), l.tag).toBeLessThanOrEqual(0.1001);
    }
  });

  it('sums back to the catalogue total, unverified records excluded', () => {
    const apportioned = [...hoursByLanguageTag.values()].reduce((sum, h) => sum + h, 0);
    const tagged = datasets
      .filter((d) => d.language_tags.length > 0 && !d.unverified_size)
      .reduce((sum, d) => sum + (d.hours_num ?? 0), 0);
    expect(Math.abs(apportioned - tagged)).toBeLessThan(len(languages));
  });
});

/** A tolerance of one tenth of an hour per tag, which is the rounding the data uses. */
function len(list: readonly unknown[]): number {
  return list.length / 10;
}

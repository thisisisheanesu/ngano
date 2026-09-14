import { describe, expect, it } from "vitest";
import { FIELD_MAP } from "../src/data/snapshot.js";
import { resolveLanguage } from "../src/languages.js";
import {
  applyMapping,
  asNumber,
  buildMapping,
  decodeBase64,
  isAudioFeature,
  normaliseColumn,
  parseAudioCell,
} from "../src/mapping.js";
import type { FieldMap, RowContext } from "../src/index.js";

const fieldMap = FIELD_MAP as FieldMap;

/**
 * Builds a row context with a fetch that should never be called.
 *
 * @param repo Hugging Face repo id
 * @returns a context
 */
function context(repo: string): RowContext {
  return {
    hfRepo: repo,
    split: "train",
    datasetId: "test-dataset",
    licence: "CC-BY-4.0",
    sourceUrl: `https://huggingface.co/datasets/${repo}`,
    country: "ZW",
    language: "Shona",
    languageTag: "sna",
    languageIso: "sna",
    fetchImpl: async () => {
      throw new Error("no network in unit tests");
    },
    headers: {},
    resolveCountry: (value) => (value.toLowerCase() === "zimbabwe" ? "ZW" : null),
    resolveLanguageTag: (value) => {
      const tags = resolveLanguage(value);
      return tags.length === 1 ? (tags[0] as string) : null;
    },
  };
}

describe("normaliseColumn", () => {
  it("ignores case, underscores, hyphens and dots", () => {
    expect(normaliseColumn("Client_ID")).toBe("clientid");
    expect(normaliseColumn("client-id")).toBe("clientid");
    expect(normaliseColumn("CLIENT.ID")).toBe("clientid");
  });
});

describe("buildMapping", () => {
  it("applies the repo override first, for common_voice", () => {
    const columns = ["client_id", "audio", "sentence", "up_votes", "down_votes", "age", "gender", "accent", "locale", "segment"];
    const mapping = buildMapping(columns, "mozilla-foundation/common_voice_17_0", fieldMap);
    expect(mapping.verified).toBe(true);
    expect(mapping.fields).toMatchObject({
      transcript: "sentence",
      speaker_id: "client_id",
      language: "locale",
      audio: "audio",
      age: "age",
      gender: "gender",
    });
    expect(mapping.dropped.sort()).toEqual(["down_votes", "segment", "up_votes"]);
    // `accent` is a country alias in the table, so it is claimed, not dropped.
    expect(mapping.fields.country).toBe("accent");
    expect(mapping.extra).toEqual([]);
  });

  it("maps an uncatalogued common_voice style schema by alias alone", () => {
    const columns = ["client_id", "path", "audio", "sentence", "locale"];
    const mapping = buildMapping(columns, "someone/common_voice_clone", fieldMap);
    expect(mapping.verified).toBe(false);
    expect(mapping.fields.transcript).toBe("sentence");
    expect(mapping.fields.speaker_id).toBe("client_id");
    expect(mapping.fields.language).toBe("locale");
    expect(mapping.fields.audio).toBe("audio");
    // `path` is an audio alias but audio was claimed first, so it is kept.
    expect(mapping.extra).toContain("path");
  });

  it("maps the fleurs schema", () => {
    const columns = ["id", "num_samples", "path", "audio", "transcription", "raw_transcription", "gender", "lang_id", "language", "lang_group_id"];
    const mapping = buildMapping(columns, "google/fleurs", fieldMap);
    expect(mapping.fields.transcript).toBe("transcription");
    expect(mapping.fields.language_iso).toBe("lang_id");
    expect(mapping.fields.language).toBe("language");
    expect(mapping.fields.audio).toBe("audio");
    expect(mapping.dropped).toEqual(expect.arrayContaining(["id", "num_samples"]));
    expect(mapping.extra).toEqual(expect.arrayContaining(["lang_group_id"]));
  });

  it("handles an oddball schema from the alias table alone", () => {
    const mapping = buildMapping(["Text", "WAV_PATH", "Speaker Name"], "odd/corpus", fieldMap);
    expect(mapping.fields.transcript).toBe("Text");
    expect(mapping.fields.speaker_id).toBe("Speaker Name");
    // `wav_path` is an audio alias, matched ignoring case and underscores.
    expect(mapping.fields.audio).toBe("WAV_PATH");
    expect(mapping.extra).toEqual([]);
    expect(mapping.audioConfirmed).toBeNull();
  });

  it("degrades without throwing when no alias covers the audio column", () => {
    const mapping = buildMapping(["Text", "blob_ref"], "odd/corpus", fieldMap);
    expect(mapping.fields.transcript).toBe("Text");
    expect(mapping.fields.audio).toBeUndefined();
    expect(mapping.extra).toContain("blob_ref");
  });

  it("uses feature types to confirm the claimed audio column, never to claim one", () => {
    const features = [
      { name: "Text", type: { dtype: "string", _type: "Value" } },
      { name: "WAV_PATH", type: { sampling_rate: 16000, _type: "Audio" } },
    ];
    const confirmed = buildMapping(["Text", "WAV_PATH"], "odd/corpus", fieldMap, features);
    expect(confirmed.fields.audio).toBe("WAV_PATH");
    expect(confirmed.audioConfirmed).toBe(true);

    // An Audio feature the alias table does not name stays unclaimed, so that
    // all three SDKs map the same column list the same way.
    const unnamed = buildMapping(["Text", "blob_ref"], "odd/corpus", fieldMap, [
      { name: "Text", type: { dtype: "string", _type: "Value" } },
      { name: "blob_ref", type: { _type: "Audio" } },
    ]);
    expect(unnamed.fields.audio).toBeUndefined();
    expect(unnamed.extra).toContain("blob_ref");
    expect(unnamed.audioConfirmed).toBeNull();

    // A claimed column the server says is not audio is reported, not remapped.
    const doubted = buildMapping(["text", "path"], "odd/corpus", fieldMap, [
      { name: "text", type: { dtype: "string", _type: "Value" } },
      { name: "path", type: { dtype: "string", _type: "Value" } },
    ]);
    expect(doubted.fields.audio).toBe("path");
    expect(doubted.audioConfirmed).toBe(false);
  });

  it("converts duration_ms into duration_s through unit_hints", () => {
    const mapping = buildMapping(["audio", "text", "duration_ms"], "some/corpus", fieldMap);
    expect(mapping.fields.duration_s).toBe("duration_ms");
    expect(mapping.scale.duration_s).toBeCloseTo(0.001);
    const row = applyMapping(
      { audio: "clip.wav", text: "mhoro", duration_ms: 2500 },
      mapping,
      context("some/corpus"),
    );
    expect(row.durationS).toBeCloseTo(2.5);
  });

  it("prefers a real seconds column over a millisecond one", () => {
    const mapping = buildMapping(["duration", "duration_ms"], "some/corpus", fieldMap);
    expect(mapping.fields.duration_s).toBe("duration");
    expect(mapping.scale.duration_s).toBeUndefined();
    expect(mapping.extra).toContain("duration_ms");
  });

  it("keeps everything in extra for a completely unknown schema", () => {
    const mapping = buildMapping(["alpha", "beta"], "unknown/repo", fieldMap);
    expect(Object.keys(mapping.fields)).toEqual([]);
    expect(mapping.extra).toEqual(["alpha", "beta"]);
    const row = applyMapping({ alpha: 1, beta: "two" }, mapping, context("unknown/repo"));
    expect(row.transcript).toBeNull();
    expect(row.extra).toEqual({ alpha: 1, beta: "two" });
  });

  it("ignores an override whose column the dataset no longer has", () => {
    const mapping = buildMapping(["text", "audio"], "google/fleurs", fieldMap);
    expect(mapping.fields.transcript).toBe("text");
    expect(mapping.fields.audio).toBe("audio");
  });
});

describe("applyMapping", () => {
  const mapping = buildMapping(
    ["sentence", "audio", "locale", "client_id", "up_votes", "notes_field"],
    "mozilla-foundation/common_voice_17_0",
    fieldMap,
  );

  it("produces the unified row and preserves unmapped columns", () => {
    const row = applyMapping(
      {
        sentence: "Mhoroi munhu wese",
        audio: [{ src: "https://example.test/a.wav", type: "audio/wav" }],
        locale: "sn",
        client_id: "spk-1",
        up_votes: 3,
        notes_field: "kept",
      },
      mapping,
      context("mozilla-foundation/common_voice_17_0"),
    );
    expect(row.transcript).toBe("Mhoroi munhu wese");
    expect(row.language).toBe("sn");
    expect(row.speakerId).toBe("spk-1");
    expect(row.split).toBe("train");
    expect(row.licence).toBe("CC-BY-4.0");
    expect(row.datasetId).toBe("test-dataset");
    expect(row.country).toBe("ZW");
    expect(row.extra).toEqual({ notes_field: "kept" });
    expect(row.audio?.url).toBe("https://example.test/a.wav");
  });

  it("falls back to the catalogue language when the row states none", () => {
    const bare = buildMapping(["sentence"], "x/y", fieldMap);
    const row = applyMapping({ sentence: "hi" }, bare, context("x/y"));
    expect(row.language).toBe("Shona");
    expect(row.languageTag).toBe("sna");
    expect(row.languageIso).toBe("sna");
  });

  it("keeps the source's own language value and resolves a tag from it", () => {
    const mapping = buildMapping(["sentence", "language"], "x/y", fieldMap);
    const row = applyMapping({ sentence: "hi", language: "isiZulu" }, mapping, context("x/y"));
    // The source spelling survives, and the tag is what the registry makes of it.
    expect(row.language).toBe("isiZulu");
    expect(row.languageTag).toBe("zul");
    expect(row.languageIso).toBe("zul");
  });

  it("canonicalises a tag stated by the row, in any case", () => {
    const mapping = buildMapping(["sentence", "language"], "x/y", fieldMap);
    const row = applyMapping({ sentence: "hi", language: "ENG-ng" }, mapping, context("x/y"));
    expect(row.languageTag).toBe("eng-NG");
    // languageIso always carries the bare three-letter code, never the region.
    expect(row.languageIso).toBe("eng");
  });

  it("claims a column that states a BCP 47 tag outright", () => {
    const mapping = buildMapping(["sentence", "bcp47"], "x/y", fieldMap);
    expect(mapping.fields.language_tag).toBe("bcp47");
    const row = applyMapping({ sentence: "hi", bcp47: "eng-ng" }, mapping, context("x/y"));
    expect(row.languageTag).toBe("eng-NG");
    expect(row.languageIso).toBe("eng");
  });

  it("reads a stated tag before the row's code and name columns", () => {
    const mapping = buildMapping(["sentence", "language_tag", "iso_639_3", "language"], "x/y", fieldMap);
    expect(mapping.fields.language_tag).toBe("language_tag");
    const row = applyMapping(
      { sentence: "hi", language_tag: "zul", iso_639_3: "sna", language: "Shona" },
      mapping,
      context("x/y"),
    );
    expect(row.languageTag).toBe("zul");
    // languageIso still prefers the row's own code column where it states one.
    expect(row.languageIso).toBe("sna");
    expect(row.language).toBe("Shona");
  });

  it("falls back to the row's own columns when a stated tag resolves to nothing", () => {
    const mapping = buildMapping(["sentence", "lang_tag", "language"], "x/y", fieldMap);
    const row = applyMapping(
      { sentence: "hi", lang_tag: "x-private", language: "isiZulu" },
      mapping,
      context("x/y"),
    );
    expect(row.languageTag).toBe("zul");
  });

  it("prefers the row's code column over its language name", () => {
    const mapping = buildMapping(["sentence", "language", "iso_639_3"], "x/y", fieldMap);
    const row = applyMapping(
      { sentence: "hi", language: "Shona", iso_639_3: "zul" },
      mapping,
      context("x/y"),
    );
    expect(row.language).toBe("Shona");
    expect(row.languageTag).toBe("zul");
    expect(row.languageIso).toBe("zul");
  });

  it("keeps a code the registry does not carry and claims no tag for it", () => {
    const mapping = buildMapping(["sentence", "iso_639_3"], "x/y", fieldMap);
    const row = applyMapping({ sentence: "hi", iso_639_3: "sw" }, mapping, context("x/y"));
    // ISO 639-1 is not ISO 639-3, so the stated value is kept as it stands.
    expect(row.languageIso).toBe("sw");
    expect(row.languageTag).toBe("sna");
  });

  it("leaves the tag null when neither the row nor the catalogue names one", () => {
    const bare = buildMapping(["sentence"], "x/y", fieldMap);
    const ctx = context("x/y");
    ctx.language = null;
    ctx.languageTag = null;
    ctx.languageIso = null;
    const row = applyMapping({ sentence: "hi" }, bare, ctx);
    expect(row.language).toBeNull();
    expect(row.languageTag).toBeNull();
    expect(row.languageIso).toBeNull();
  });

  it("resolves a country name on the row to alpha-2", () => {
    const withCountry = buildMapping(["sentence", "country"], "x/y", fieldMap);
    const row = applyMapping({ sentence: "hi", country: "Zimbabwe" }, withCountry, context("x/y"));
    expect(row.country).toBe("ZW");
  });

  it("does not fetch audio until read is called", async () => {
    let fetched = 0;
    const ctx = context("x/y");
    ctx.fetchImpl = async () => {
      fetched += 1;
      return new Response(new Uint8Array([1, 2, 3]));
    };
    const single = buildMapping(["audio"], "x/y", fieldMap);
    const row = applyMapping(
      { audio: [{ src: "https://example.test/a.wav", type: "audio/wav" }] },
      single,
      ctx,
    );
    expect(fetched).toBe(0);
    const bytes = await row.audio!.read();
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    expect(fetched).toBe(1);
    // Cached, so a second read makes no request.
    await row.audio!.read();
    expect(fetched).toBe(1);
    const blob = await row.audio!.blob();
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(3);
  });
});

describe("audio cells", () => {
  it("reads the datasets server list form", () => {
    const parts = parseAudioCell([{ src: "/assets/x.wav", type: "audio/wav" }]);
    expect(parts.url).toBe("https://datasets-server.huggingface.co/assets/x.wav");
    expect(parts.contentType).toBe("audio/wav");
  });

  it("reads the path and sampling rate form", () => {
    const parts = parseAudioCell({ path: "clips/x.mp3", sampling_rate: 48000 });
    expect(parts.path).toBe("clips/x.mp3");
    expect(parts.samplingRate).toBe(48000);
    expect(parts.url).toBeNull();
  });

  it("decodes inlined base64 bytes", () => {
    const parts = parseAudioCell({ path: "x.wav", bytes: "AQID" });
    expect(Array.from(parts.bytes ?? [])).toEqual([1, 2, 3]);
  });

  it("survives nonsense", () => {
    expect(parseAudioCell(null).url).toBeNull();
    expect(parseAudioCell(42).url).toBeNull();
  });
});

describe("small helpers", () => {
  it("parses numbers from strings", () => {
    expect(asNumber("12.5")).toBe(12.5);
    expect(asNumber("")).toBeNull();
    expect(asNumber(Number.NaN)).toBeNull();
  });

  it("detects audio features inside sequences", () => {
    expect(isAudioFeature({ _type: "Audio" })).toBe(true);
    expect(isAudioFeature({ _type: "Sequence", feature: { _type: "Audio" } })).toBe(true);
    expect(isAudioFeature({ _type: "Value", dtype: "string" })).toBe(false);
  });

  it("decodes base64", () => {
    expect(Array.from(decodeBase64("aGk="))).toEqual([104, 105]);
  });
});

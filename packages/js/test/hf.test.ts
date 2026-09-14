import { describe, expect, it, vi } from "vitest";
import {
  DatasetsServerClient,
  MAX_PAGE_SIZE,
  combineSignals,
  defaultSleep,
  featuresFromInfo,
  tokenFromEnv,
} from "../src/hf.js";
import { NganoGatedError, NganoHttpError, NganoNotFoundError } from "../src/errors.js";
import { fakeFetch, numberedRows, recordingSleep, rowsBody, splitsBody } from "./helpers.js";

/**
 * Builds a client wired to a fake fetch, with instant sleeps.
 *
 * @param routes route table
 * @param options extra client options
 * @returns the client, the call log and the recorded backoff delays
 */
function client(
  routes: Parameters<typeof fakeFetch>[0],
  options: Record<string, unknown> = {},
): {
  api: DatasetsServerClient;
  calls: string[];
  delays: number[];
  signals: Array<AbortSignal | undefined>;
} {
  const fake = fakeFetch(routes);
  const { sleep, delays } = recordingSleep();
  const api = new DatasetsServerClient({
    fetch: fake.fetch,
    sleep,
    hfToken: null,
    ...options,
  });
  return { api, calls: fake.calls, delays, signals: fake.signals };
}

describe("pagination", () => {
  it("pages through a split, one page in flight at a time", async () => {
    const total = 250;
    const { api, calls } = client([
      {
        match: "/rows",
        body: (params) => {
          const offset = Number(params.get("offset") ?? 0);
          const length = Number(params.get("length") ?? 100);
          const size = Math.max(0, Math.min(length, total - offset));
          return rowsBody(numberedRows(size, offset), { total, offset });
        },
      },
    ]);

    const seen: string[] = [];
    for await (const row of api.rows({ dataset: "a/b", config: "c", split: "train" })) {
      seen.push(row.row["sentence"] as string);
    }
    expect(seen).toHaveLength(total);
    expect(seen[0]).toBe("row-0");
    expect(seen[249]).toBe("row-249");
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(call).toContain("length=100");
    expect(calls[1]).toContain("offset=100");
    expect(calls[2]).toContain("offset=200");
  });

  it("never asks for more than the server cap", async () => {
    const { api, calls } = client([
      { match: "/rows", body: () => rowsBody(numberedRows(100), { total: 100 }) },
    ]);
    const rows = [];
    for await (const row of api.rows({
      dataset: "a/b",
      config: "c",
      split: "train",
      pageSize: 5000,
    })) {
      rows.push(row);
    }
    expect(rows).toHaveLength(100);
    expect(calls[0]).toContain(`length=${MAX_PAGE_SIZE}`);
  });

  it("stops at the requested limit and asks for no more than it needs", async () => {
    const { api, calls } = client([
      {
        match: "/rows",
        body: (params) => {
          const offset = Number(params.get("offset") ?? 0);
          return rowsBody(numberedRows(Number(params.get("length")), offset), {
            total: 1000,
            offset,
          });
        },
      },
    ]);
    const rows = [];
    for await (const row of api.rows({
      dataset: "a/b",
      config: "c",
      split: "train",
      limit: 7,
      pageSize: 5,
    })) {
      rows.push(row);
    }
    expect(rows).toHaveLength(7);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("length=2");
  });

  it("stops fetching as soon as the consumer breaks", async () => {
    const { api, calls } = client([
      {
        match: "/rows",
        body: (params) => {
          const offset = Number(params.get("offset") ?? 0);
          return rowsBody(numberedRows(100, offset), { total: 10_000, offset });
        },
      },
    ]);
    let count = 0;
    for await (const _row of api.rows({ dataset: "a/b", config: "c", split: "train" })) {
      count += 1;
      if (count === 3) break;
    }
    expect(count).toBe(3);
    expect(calls).toHaveLength(1);
  });
});

describe("retry and backoff", () => {
  it("retries a 429 with a jittered, growing delay", async () => {
    const { api, calls, delays } = client(
      [
        { match: "/rows", status: 429, text: "slow down", times: 3 },
        { match: "/rows", body: () => rowsBody(numberedRows(2), { total: 2 }) },
      ],
      { retryBaseMs: 1000 },
    );
    const rows = [];
    for await (const row of api.rows({ dataset: "a/b", config: "c", split: "train" })) {
      rows.push(row);
    }
    expect(rows).toHaveLength(2);
    expect(calls).toHaveLength(4);
    expect(delays).toHaveLength(3);
    // Full jitter: each delay sits inside its own exponential window.
    expect(delays[0]).toBeLessThanOrEqual(1000);
    expect(delays[1]).toBeLessThanOrEqual(2000);
    expect(delays[2]).toBeLessThanOrEqual(4000);
  });

  it("honours Retry-After", async () => {
    const { api, delays } = client(
      [
        { match: "/rows", status: 429, headers: { "retry-after": "3" }, times: 1 },
        { match: "/rows", body: () => rowsBody(numberedRows(1), { total: 1 }) },
      ],
      { retryBaseMs: 10 },
    );
    await api.rows({ dataset: "a/b", config: "c", split: "train" }).next();
    expect(delays[0]).toBe(3000);
  });

  it("retries 5xx and then gives up with the last error", async () => {
    const { api, calls } = client([{ match: "/rows", status: 503, text: "unavailable" }], {
      maxRetries: 2,
    });
    await expect(
      api.rows({ dataset: "a/b", config: "c", split: "train" }).next(),
    ).rejects.toBeInstanceOf(NganoHttpError);
    expect(calls).toHaveLength(3);
  });

  it("retries a transport failure", async () => {
    let attempts = 0;
    const api = new DatasetsServerClient({
      fetch: async () => {
        attempts += 1;
        if (attempts < 3) throw new TypeError("network down");
        return new Response(JSON.stringify(rowsBody(numberedRows(1), { total: 1 })));
      },
      sleep: async () => {},
      hfToken: null,
    });
    const first = await api.rows({ dataset: "a/b", config: "c", split: "train" }).next();
    expect(first.done).toBe(false);
    expect(attempts).toBe(3);
  });

  it("does not retry a 400", async () => {
    const { api, calls } = client([{ match: "/rows", status: 400, text: "bad config" }]);
    await expect(
      api.rows({ dataset: "a/b", config: "c", split: "train" }).next(),
    ).rejects.toBeInstanceOf(NganoHttpError);
    expect(calls).toHaveLength(1);
  });
});

describe("errors", () => {
  it("raises a gated error naming the repo and its access page", async () => {
    const { api } = client([{ match: "/rows", status: 401, text: "gated dataset" }]);
    const promise = api.rows({ dataset: "mozilla-foundation/common_voice_17_0", config: "sn", split: "train" }).next();
    await expect(promise).rejects.toBeInstanceOf(NganoGatedError);
    await promise.catch((error: NganoGatedError) => {
      expect(error.repo).toBe("mozilla-foundation/common_voice_17_0");
      expect(error.accessUrl).toBe(
        "https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0",
      );
      expect(error.hadToken).toBe(false);
      expect(error.message).toContain("HF_TOKEN");
    });
  });

  it("reports a gate even when the server answers 404 with a gated body", async () => {
    const { api } = client([
      { match: "/splits", status: 404, text: "The dataset is gated and you are not authenticated." },
    ]);
    await expect(api.splits("private/repo")).rejects.toBeInstanceOf(NganoGatedError);
  });

  it("says the token was rejected when one was sent", async () => {
    const { api } = client([{ match: "/splits", status: 403, text: "forbidden" }], {
      hfToken: "hf_test",
    });
    await expect(api.splits("gated/repo")).rejects.toMatchObject({
      name: "NganoGatedError",
      hadToken: true,
    });
  });

  it("raises not found for a missing dataset", async () => {
    const { api } = client([{ match: "/splits", status: 404, text: "Not found." }]);
    await expect(api.splits("nobody/nothing")).rejects.toBeInstanceOf(NganoNotFoundError);
  });

  it("sends the bearer token when one is configured", async () => {
    const fake = fakeFetch([{ match: "/splits", body: splitsBody("a/b", [["c", "train"]]) }]);
    const api = new DatasetsServerClient({ fetch: fake.fetch, hfToken: "hf_secret" });
    await api.splits("a/b");
    const call = (fake.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((call?.[1] as RequestInit).headers).toMatchObject({
      authorization: "Bearer hf_secret",
    });
    expect(api.headers["authorization"]).toBe("Bearer hf_secret");
  });
});

describe("abort", () => {
  it("stops pagination when the signal fires", async () => {
    const controller = new AbortController();
    const { api, calls } = client([
      {
        match: "/rows",
        body: (params) => {
          const offset = Number(params.get("offset") ?? 0);
          return rowsBody(numberedRows(100, offset), { total: 10_000, offset });
        },
      },
    ]);
    let seen = 0;
    const run = async (): Promise<void> => {
      for await (const _row of api.rows({
        dataset: "a/b",
        config: "c",
        split: "train",
        signal: controller.signal,
      })) {
        seen += 1;
        if (seen === 100) controller.abort();
      }
    };
    await expect(run()).rejects.toMatchObject({ name: "AbortError" });
    // The second page is never requested: the abort is seen before the fetch.
    expect(calls).toHaveLength(1);
  });

  it("passes the signal down to fetch", async () => {
    const controller = new AbortController();
    const { api, signals } = client([
      { match: "/splits", body: splitsBody("a/b", [["c", "train"]]) },
    ]);
    await api.splits("a/b", controller.signal);
    expect(signals[0]).toBeDefined();
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { api, calls } = client([{ match: "/splits", body: splitsBody("a/b", [["c", "train"]]) }]);
    await expect(api.splits("a/b", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(calls).toHaveLength(0);
  });

  it("combines signals without AbortSignal.any", () => {
    const first = new AbortController();
    const second = new AbortController();
    const combined = combineSignals(first.signal, second.signal);
    expect(combined.signal?.aborted).toBe(false);
    second.abort();
    expect(combined.signal?.aborted).toBe(true);
    combined.dispose();
  });

  it("aborts a pending sleep", async () => {
    const controller = new AbortController();
    const promise = defaultSleep(10_000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("discovery", () => {
  it("lists config and split pairs", async () => {
    const { api } = client([
      {
        match: "/splits",
        body: splitsBody("google/fleurs", [
          ["sn_zw", "train"],
          ["sn_zw", "test"],
        ]),
      },
    ]);
    expect(await api.splits("google/fleurs")).toEqual([
      { config: "sn_zw", split: "train" },
      { config: "sn_zw", split: "test" },
    ]);
  });

  it("reads features from first-rows", async () => {
    const { api } = client([
      {
        match: "/first-rows",
        body: rowsBody([{ transcription: "x", audio: null }], {
          features: [
            { name: "transcription", type: { dtype: "string", _type: "Value" } },
            { name: "audio", type: { _type: "Audio" } },
          ],
        }),
      },
    ]);
    const first = await api.firstRows("google/fleurs", "sn_zw", "train");
    expect(first.features.map((f) => f.name)).toEqual(["transcription", "audio"]);
  });

  it("reads features from info, flat or nested by config", () => {
    expect(featuresFromInfo({ features: { a: { _type: "Value" } } })).toEqual([
      { name: "a", type: { _type: "Value" } },
    ]);
    expect(
      featuresFromInfo({ sn_zw: { features: { b: { _type: "Audio" } } } }, "sn_zw").map((f) => f.name),
    ).toEqual(["b"]);
    expect(featuresFromInfo(null)).toEqual([]);
  });
});

describe("token discovery", () => {
  it("reads HF_TOKEN from the environment", () => {
    const previous = process.env["HF_TOKEN"];
    process.env["HF_TOKEN"] = "hf_from_env";
    try {
      expect(tokenFromEnv()).toBe("hf_from_env");
      expect(new DatasetsServerClient({ fetch: async () => new Response("{}") }).token).toBe(
        "hf_from_env",
      );
    } finally {
      if (previous === undefined) delete process.env["HF_TOKEN"];
      else process.env["HF_TOKEN"] = previous;
    }
  });
});

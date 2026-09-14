/**
 * Typed errors raised by the ngano SDK.
 *
 * @packageDocumentation
 */

/** Base class for every error the SDK raises deliberately. */
export class NganoError extends Error {
  /**
   * @param message human readable description
   * @param options standard error options, including `cause`
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NganoError";
  }
}

/** An HTTP request to the datasets server or the ngano API failed. */
export class NganoHttpError extends NganoError {
  /** HTTP status code of the failed response. */
  readonly status: number;
  /** URL that was requested. */
  readonly url: string;
  /** Response body, truncated to a readable length. */
  readonly body: string;

  /**
   * @param status HTTP status code
   * @param url requested URL
   * @param body response body text
   */
  constructor(status: number, url: string, body: string) {
    super(`HTTP ${status} from ${url}${body ? `: ${body.slice(0, 300)}` : ""}`);
    this.name = "NganoHttpError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/**
 * A dataset is gated or private on Hugging Face. Accept the terms on the repo
 * page and pass a token with `hfToken`, or set `HF_TOKEN` in the environment.
 */
export class NganoGatedError extends NganoError {
  /** Hugging Face repo id, for example `mozilla-foundation/common_voice_17_0`. */
  readonly repo: string;
  /** Page where access can be requested. */
  readonly accessUrl: string;
  /** HTTP status that revealed the gate, 401 or 403. */
  readonly status: number;
  /** True when a token was supplied and still rejected. */
  readonly hadToken: boolean;

  /**
   * @param repo Hugging Face repo id
   * @param status HTTP status that revealed the gate
   * @param hadToken whether a token was sent with the request
   */
  constructor(repo: string, status: number, hadToken: boolean) {
    const accessUrl = `https://huggingface.co/datasets/${repo}`;
    const advice = hadToken
      ? "The token supplied does not have access. Accept the terms on that page with the same account."
      : "Accept the terms on that page, then pass hfToken or set HF_TOKEN.";
    super(`Dataset ${repo} is gated or private (HTTP ${status}). ${advice} See ${accessUrl}`);
    this.name = "NganoGatedError";
    this.repo = repo;
    this.accessUrl = accessUrl;
    this.status = status;
    this.hadToken = hadToken;
  }
}

/** A dataset, config or split that was asked for does not exist. */
export class NganoNotFoundError extends NganoError {
  /** What was looked for, for example a repo id or a split name. */
  readonly target: string;

  /**
   * @param target identifier that could not be resolved
   * @param message optional override message
   */
  constructor(target: string, message?: string) {
    super(message ?? `Not found: ${target}`);
    this.name = "NganoNotFoundError";
    this.target = target;
  }
}

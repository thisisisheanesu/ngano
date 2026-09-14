# Security policy

## Supported versions

ngano is at 0.1.x across all three packages and the Worker. Security fixes land
on the latest release of each package. There are no maintained older branches
yet.

| Package | Registry | Supported |
| --- | --- | --- |
| `ngano` (Python) | PyPI | 0.1.x |
| `ngano` (JavaScript) | npm | 0.1.x |
| `ngano` (Rust) | crates.io | 0.1.x |
| `ngano-worker` | ngano.dev | current deployment |

## Reporting a vulnerability

Report privately through GitHub's
[private vulnerability reporting](https://github.com/thisisisheanesu/ngano/security/advisories/new)
for this repository. That opens a channel visible only to the maintainers.

Please do not open a public issue for a security problem.

Include, as far as you can:

- what the problem is and which package or endpoint it affects
- the version or the deployment you tested
- a minimal reproduction
- what an attacker gets out of it

You should get an acknowledgement within 72 hours and an assessment within seven
days. If a fix is warranted, a patched release and a public advisory follow, and
you will be credited unless you ask otherwise.

## Scope

In scope:

- the three SDKs in `packages/`, including anything that executes source-supplied
  data, parses untrusted input, or writes outside an expected path
- the Worker in `worker/`, including the API, the MCP server and the site
- the build and release workflows in `.github/workflows/`
- exposure of a maintainer credential through this repository

Out of scope:

- the datasets ngano catalogues. They belong to other people. Report a problem
  in a dataset to its publisher
- availability of a third-party host such as the Hugging Face Hub, OpenSLR or a
  university server
- a wrong or stale field in a catalogue record. That is a correction, open an
  issue with the correction template
- missing rate limits or authentication on `ngano.dev`. The API is deliberately
  public, unauthenticated and read only

## Design notes that bear on security

- The API is read only and serves a static snapshot of the catalogue. There is
  no database to inject into and no user data to leak.
- There is no authentication anywhere in the project, by design. No package asks
  for an ngano credential, and any prompt claiming to be one is not from us.
- The loaders read a Hugging Face token from `HF_TOKEN` when the user sets one.
  It is passed only to `huggingface.co`, never logged, and never written to disk.
- The loaders never execute dataset-supplied code. Loading a catalogued dataset
  can still download arbitrary files from its host, so treat an unfamiliar host
  with the same care you would treat any download.

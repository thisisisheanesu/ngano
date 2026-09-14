## What this changes

<!-- One or two sentences. What is different after this is merged. -->

## Why

<!-- The problem, the issue number, or the source that prompted it. Link it. -->

Closes #

## Type of change

- [ ] Catalogue: new dataset record
- [ ] Catalogue: correction to an existing record
- [ ] Column mapping in `data/field_map.json`
- [ ] Python package
- [ ] JavaScript package
- [ ] Rust crate
- [ ] Worker: API, MCP or site
- [ ] Documentation
- [ ] Build, CI or release

## Evidence, for any catalogue change

<!-- Delete this section if you touched no data. -->

Primary source URL:

- [ ] The URL above is a primary source, not a secondary mention.
- [ ] Every figure comes from that source. Nothing is estimated, averaged or rounded.
- [ ] Fields the source is silent about are `null` or `Unstated`, never guessed.
- [ ] `unverified_size` is `true` on any self-reported figure of 20,000 hours or more,
      and `false` otherwise.
- [ ] `country_codes` and `regions` are consistent with `countries`, which the
      validator checks.

## Checklist

- [ ] One logical change. Catalogue edits are separate from code changes.
- [ ] `make validate` passes.
- [ ] `make test` passes for the packages I touched.
- [ ] `make lint` passes.
- [ ] Tests added or updated for the behaviour I changed.
- [ ] Behaviour shared across the SDKs is the same in all three, or I have
      explained below why it cannot be.
- [ ] Docs updated, including `docs/` and the README if the surface changed.
- [ ] `CHANGELOG.md` updated under Unreleased.
- [ ] No em dashes in prose. The author's standing preference is commas or full stops.
- [ ] No TODO comments, no stubbed functions, no commented-out code.

## Notes for the reviewer

<!-- Anything surprising, anything you are unsure about, anything you left out. -->

# Demo takes

`ngano-tour.jsonl` is a [lensa](https://github.com/thisisisheanesu/lensa) script: a
programmable browser that records the page it drives and renders an MP4 with automatic
zoom onto every interaction.

```sh
lensa record --script demos/ngano-tour.jsonl --out demos/ngano-tour.mp4
```

Seventeen seconds: the map recoloured by two metrics, a click through to Zimbabwe, the
language directory filtered to Shona, a live API request from the docs page, and the raw
`/api/v1/stats` JSON. The first navigate deliberately happens before `start_recording`,
so the take opens on a loaded page rather than on Chromium booting.

The MP4 is not committed. Re-record it when the site changes.

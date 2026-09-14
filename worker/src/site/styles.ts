/**
 * The whole site stylesheet. Served once from /styles.css with a long cache header
 * rather than inlined into every page, so a reader pays for it on the first view only.
 *
 * The palette evolves the one used by the earlier African Speech Data Atlas: a rose
 * accent on violet-biased neutrals, Archivo for headings, IBM Plex Sans for body copy
 * and IBM Plex Mono for labels and numbers. New here is a sequential rose ramp
 * (--c0 to --c5) for the choropleth, and a chalk surface for code.
 */
export const STYLESHEET = `@font-face{font-family:"Archivo Fallback";src:local("Arial Bold"),local("Helvetica Bold");ascent-override:92%;size-adjust:104%}

:root{
  --bg:#F6F5FA; --surface:#FFFFFF; --surface-2:#FBFAFD; --surface-3:#F1EFF7;
  --ink:#191527; --ink-2:#4A4460; --muted:#7A7391;
  --line:#E4E1EE; --line-2:#D2CEE2;
  --accent:#C0356E; --accent-soft:#FBE9F1; --accent-ink:#8E2351;
  --ok:#1B7A62; --ok-bg:#E2F2ED;
  --warn:#A66410; --warn-bg:#FBEEDA;
  --pay:#5F44A0; --pay-bg:#EEEAF9;
  --raw:#4E5872; --raw-bg:#E9ECF3;
  --no:#B03A3A; --no-bg:#FBE8E8;
  --code-bg:#1C1830; --code-ink:#E8E4F4; --code-dim:#9C93BC; --code-str:#F3A8C6; --code-key:#C5A8F0;
  --c0:#ECE9F3; --c1:#F9DCE7; --c2:#EFAECB; --c3:#DC7BA7; --c4:#C0356E; --c5:#84204B;
  --map-stroke:#FFFFFF;
  --shadow:0 1px 2px rgba(25,21,39,.05), 0 8px 24px -12px rgba(25,21,39,.14);
  --font-head:Archivo,"Archivo Fallback",ui-sans-serif,system-ui,sans-serif;
  --font-body:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#100E18; --surface:#1A1726; --surface-2:#201C2F; --surface-3:#262133;
    --ink:#EFECF7; --ink-2:#C2BCD6; --muted:#928BAA;
    --line:#2C2740; --line-2:#3A3452;
    --accent:#F0709F; --accent-soft:#3A1B2C; --accent-ink:#FFA8C4;
    --ok:#5CC4A6; --ok-bg:#12332A;
    --warn:#E2A94A; --warn-bg:#3A2C12;
    --pay:#A78CE8; --pay-bg:#2A2340;
    --raw:#9AA6C0; --raw-bg:#232838;
    --no:#F08585; --no-bg:#3A1E1E;
    --code-bg:#0B0912; --code-ink:#E8E4F4; --code-dim:#8A82A8; --code-str:#F3A8C6; --code-key:#C5A8F0;
    --c0:#241F33; --c1:#3E2136; --c2:#6B2B50; --c3:#A13B70; --c4:#D9538D; --c5:#F794BA;
    --map-stroke:#100E18;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.7);
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --bg:#100E18; --surface:#1A1726; --surface-2:#201C2F; --surface-3:#262133;
  --ink:#EFECF7; --ink-2:#C2BCD6; --muted:#928BAA;
  --line:#2C2740; --line-2:#3A3452;
  --accent:#F0709F; --accent-soft:#3A1B2C; --accent-ink:#FFA8C4;
  --ok:#5CC4A6; --ok-bg:#12332A;
  --warn:#E2A94A; --warn-bg:#3A2C12;
  --pay:#A78CE8; --pay-bg:#2A2340;
  --raw:#9AA6C0; --raw-bg:#232838;
  --no:#F08585; --no-bg:#3A1E1E;
  --code-bg:#0B0912; --code-ink:#E8E4F4; --code-dim:#8A82A8; --code-str:#F3A8C6; --code-key:#C5A8F0;
  --c0:#241F33; --c1:#3E2136; --c2:#6B2B50; --c3:#A13B70; --c4:#D9538D; --c5:#F794BA;
  --map-stroke:#100E18;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.7);
  color-scheme:dark;
}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:var(--font-body); font-size:15px; line-height:1.55;
  -webkit-font-smoothing:antialiased; overflow-wrap:break-word;
}
img,svg{max-width:100%}
a{color:var(--accent-ink); text-decoration:none}
a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--accent); outline-offset:2px; border-radius:4px}
[hidden]{display:none !important}
.wrap{max-width:1120px; margin:0 auto; padding-inline:20px}
.narrow{max-width:860px}
.skip{position:absolute; left:-9999px; top:0; background:var(--surface); color:var(--ink);
  padding:10px 14px; border-radius:0 0 8px 0; z-index:100; font-weight:600}
.skip:focus{left:0}
.sr{position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden;
  clip:rect(0 0 0 0); white-space:nowrap; border:0}

/* ---------- masthead ---------- */
header.mast{border-bottom:1px solid var(--line); background:var(--surface); position:sticky; top:0; z-index:40}
.mast-in{display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding-block:12px}
.brand{display:flex; align-items:center; gap:9px; min-width:0; color:var(--ink)}
.brand:hover{text-decoration:none}
.brand .dot{width:9px; height:9px; border-radius:50%; background:var(--accent); flex:none}
.brand b{font-family:var(--font-head); font-weight:800; font-size:19px; letter-spacing:-.03em}
.brand .sub{font-family:var(--font-mono); font-size:11px; color:var(--muted); white-space:nowrap}
.brand .beta{font-family:var(--font-mono); font-size:9.5px; font-weight:600; letter-spacing:.1em;
  text-transform:uppercase; color:var(--accent-ink); background:var(--accent-soft);
  border-radius:5px; padding:2px 5px; flex:none; line-height:1.3}
@media (max-width:620px){ .brand .sub{display:none} }
/*
 * Phone masthead. Six nav items, a search box and a theme toggle cannot share one row
 * at 400px, and letting them wrap builds a 140px sticky header that eats a third of the
 * screen. So: brand and toggle on the first row, search across the second, and the nav
 * on a third row that scrolls sideways instead of wrapping to four lines. The header
 * also stops being sticky, because at this size the space matters more than the nav
 * being permanently in reach.
 */
@media (max-width:760px){
  header.mast{position:static}
  .mast-in{gap:10px; padding-block:10px}
  .mast-spacer{display:none}
  .brand{order:1; flex:1 1 auto}
  .iconbtn{order:2}
  .searchbox{order:3; flex:1 1 100%; max-width:none}
  nav.mainnav{order:4; flex:1 1 100%; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none;
    margin-inline:-20px; padding-inline:20px}
  nav.mainnav::-webkit-scrollbar{display:none}
  nav.mainnav a{white-space:nowrap; flex:none}
}
.mast-spacer{flex:1 1 auto}
nav.mainnav{display:flex; gap:2px; flex-wrap:wrap}
nav.mainnav a{font-size:13.5px; font-weight:600; color:var(--muted); padding:7px 10px; border-radius:8px}
nav.mainnav a:hover{color:var(--ink); background:var(--surface-2); text-decoration:none}
nav.mainnav a[aria-current="page"]{color:var(--accent-ink); background:var(--accent-soft)}
.searchbox{position:relative; flex:1 1 220px; max-width:340px; min-width:160px}
/* Height is pinned to the theme button next to it rather than left to the input's own
   line box, which rendered three pixels taller than everything else in the masthead. */
.searchbox input{width:100%; height:36px; padding:0 12px 0 32px; border-radius:9px;
  border:1px solid var(--line-2); background:var(--surface-2); color:var(--ink);
  font:inherit; font-size:14px; -webkit-appearance:none; appearance:none}
.searchbox input::-webkit-search-cancel-button{-webkit-appearance:none; appearance:none}
/* The global focus-visible outline sits 2px off the element with a 4px radius, which
   reads as a square box floating around a 9px-radius pill. Keep the same accent, drawn
   as a ring that follows the input's own corners. */
.searchbox input:focus-visible{outline:none; border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-soft)}
.searchbox .ic{position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--muted); pointer-events:none; display:flex}
.sugg{position:absolute; z-index:60; top:calc(100% + 6px); left:0; right:0; background:var(--surface);
  border:1px solid var(--line-2); border-radius:10px; box-shadow:var(--shadow); overflow:hidden; max-height:60vh; overflow-y:auto}
.sugg a{display:block; padding:8px 11px; font-size:13.5px; color:var(--ink); border-bottom:1px solid var(--line)}
.sugg a:last-child{border-bottom:0}
.sugg a:hover,.sugg a:focus,.sugg a[aria-selected="true"]{background:var(--accent-soft); text-decoration:none}
.sugg .k{font-family:var(--font-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); display:block}
.sugg .none{padding:10px 11px; font-size:13px; color:var(--muted)}
.iconbtn{border:1px solid var(--line-2); background:var(--surface-2); color:var(--ink-2);
  width:36px; height:36px; border-radius:9px; cursor:pointer; display:grid; place-items:center; flex:none}
.iconbtn:hover{border-color:var(--accent); color:var(--accent)}
.moon{display:none} .sun{display:block}
:root[data-theme="dark"] .moon{display:block} :root[data-theme="dark"] .sun{display:none}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .moon{display:block}
  :root:not([data-theme="light"]) .sun{display:none}
}

/* ---------- structure ---------- */
main{padding-block:26px 56px; display:block}
.crumb{font-family:var(--font-mono); font-size:11.5px; color:var(--muted); margin:0 0 12px; letter-spacing:.02em}
.crumb a{color:var(--muted)}
.crumb a:hover{color:var(--accent-ink)}
h1.title{font-family:var(--font-head); font-weight:800; letter-spacing:-.035em; font-size:clamp(28px,5vw,42px);
  line-height:1.08; margin:0 0 10px; text-wrap:balance}
h2.sec{font-family:var(--font-head); font-weight:800; letter-spacing:-.025em; font-size:21px; margin:0 0 4px}
h3.sub{font-family:var(--font-mono); font-size:10.5px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--muted); margin:0 0 10px; font-weight:600}
.lede{font-size:16.5px; color:var(--ink-2); max-width:68ch; margin:0 0 18px; line-height:1.6}
.note{font-size:13px; color:var(--muted); max-width:76ch; margin:10px 0 0}
section.block{margin-block:34px}
.panel{background:var(--surface); border:1px solid var(--line); border-radius:13px; padding:18px 20px; min-width:0}
.panel + .panel{margin-top:14px}
.grid{display:grid; gap:14px}
.grid > *{min-width:0}
.g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.rowsplit{display:grid; grid-template-columns:1.35fr 1fr; gap:22px; align-items:start}
.rowsplit > *{min-width:0}
@media (max-width:860px){ .rowsplit{grid-template-columns:1fr} }

/* ---------- numbers ---------- */
.bignums{display:grid; grid-template-columns:repeat(auto-fit,minmax(124px,1fr)); gap:16px 22px}
.bn .v{font-family:var(--font-head); font-weight:800; font-size:clamp(24px,4vw,32px); letter-spacing:-.03em;
  font-variant-numeric:tabular-nums; line-height:1.05}
.bn .k{font-family:var(--font-mono); font-size:10px; letter-spacing:.09em; text-transform:uppercase;
  color:var(--muted); margin-top:5px}
.bn.hi .v{color:var(--accent)}
.kv{display:grid; grid-template-columns:auto 1fr; gap:7px 16px; font-size:14px; margin:0}
.kv dt{font-family:var(--font-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--muted); padding-top:3px}
.kv dd{margin:0; color:var(--ink)}
@media (max-width:520px){ .kv{grid-template-columns:1fr; gap:2px 0} .kv dd{margin-bottom:9px} }

/* ---------- badges ---------- */
.badges{display:flex; gap:5px; flex-wrap:wrap; align-items:center}
.b{font-family:var(--font-mono); font-size:10px; font-weight:600; letter-spacing:.05em;
  text-transform:uppercase; padding:3px 6px; border-radius:5px; white-space:nowrap; display:inline-block}
.b-task{background:var(--surface-2); color:var(--ink-2); border:1px solid var(--line-2)}
.b-open{background:var(--ok-bg); color:var(--ok)}
.b-request{background:var(--warn-bg); color:var(--warn)}
.b-paid{background:var(--pay-bg); color:var(--pay)}
.b-scrape,.b-unclear{background:var(--raw-bg); color:var(--raw)}
.b-no{background:var(--no-bg); color:var(--no)}
.b-var{background:transparent; color:var(--muted); border:1px dashed var(--line-2)}
.b-flag{background:var(--warn-bg); color:var(--warn)}

/* ---------- cards / lists ---------- */
.list{display:flex; flex-direction:column; gap:10px}
.card{background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:13px 15px;
  display:grid; grid-template-columns:1fr auto; gap:6px 18px}
.card:hover{border-color:var(--line-2)}
.card .hd{display:flex; align-items:flex-start; gap:9px; flex-wrap:wrap; min-width:0}
.card h4{font-family:var(--font-head); font-weight:700; font-size:15.5px; letter-spacing:-.015em;
  margin:0; line-height:1.3; text-wrap:balance}
.card h4 a{color:var(--ink)}
.card h4 a:hover{color:var(--accent-ink)}
.card .meta{font-size:13px; color:var(--ink-2); display:flex; flex-wrap:wrap; gap:3px 14px; grid-column:1/-1}
.card .meta .lbl{font-family:var(--font-mono); font-size:10px; letter-spacing:.07em;
  text-transform:uppercase; color:var(--muted); margin-right:4px}
.card .notes{font-size:13.5px; color:var(--ink-2); grid-column:1/-1; margin:2px 0 0; max-width:82ch}
.hours{text-align:right; min-width:96px}
.hours .n{font-family:var(--font-head); font-weight:800; font-size:20px; letter-spacing:-.025em;
  font-variant-numeric:tabular-nums; line-height:1.1}
.hours .u{font-family:var(--font-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted)}
.hours.none .n{color:var(--muted); font-size:14px; font-weight:600}
@media (max-width:520px){ .card{grid-template-columns:1fr} .hours{text-align:left} }

.pills{display:flex; flex-wrap:wrap; gap:6px}
.pill{display:inline-flex; align-items:center; gap:7px; font-size:13px; padding:5px 10px; border-radius:8px;
  border:1px solid var(--line-2); background:var(--surface); color:var(--ink-2)}
a.pill:hover{border-color:var(--accent); color:var(--accent-ink); text-decoration:none}
.pill .c{font-family:var(--font-mono); font-size:10.5px; color:var(--muted); font-variant-numeric:tabular-nums}
.pill.flat{border-style:dashed; background:transparent}

/* ---------- languages ----------
   One treatment everywhere: the canonical name as the link, the BCP 47 tag beside it
   in the mono face the rest of the site uses for identifiers. */
.langs{display:flex; flex-wrap:wrap; gap:6px}
.langs.inline{display:inline-flex; vertical-align:middle}
.lang{display:inline-flex; align-items:baseline; gap:6px; font-size:13px; padding:4px 9px; border-radius:8px;
  border:1px solid var(--line-2); background:var(--surface); color:var(--ink-2)}
a.lang:hover{border-color:var(--accent); color:var(--accent-ink); text-decoration:none}
.lang .tag{font-family:var(--font-mono); font-size:11px; color:var(--muted); letter-spacing:.02em}
a.lang:hover .tag{color:var(--accent-ink)}
.lang .c{font-family:var(--font-mono); font-size:10.5px; color:var(--muted); font-variant-numeric:tabular-nums}
.lang.flat{border-style:dashed; background:transparent}
.brow .bl .lang{padding:0; border:0; background:transparent}
code.tagbig{font-family:var(--font-mono); font-size:.5em; font-weight:500; color:var(--muted);
  border:1px solid var(--line-2); border-radius:7px; padding:3px 8px; vertical-align:middle; white-space:nowrap}

.brk{display:flex; flex-direction:column; gap:8px}
.brow{display:grid; grid-template-columns:1fr auto; gap:3px 12px}
.brow .bl{font-size:13.5px; font-weight:500}
.brow .bv{font-family:var(--font-mono); font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; white-space:nowrap}
.btrack{grid-column:1/-1; height:5px; border-radius:3px; background:var(--line); overflow:hidden}
.btrack i{display:block; height:100%; border-radius:3px; background:var(--accent)}

table.tbl{width:100%; border-collapse:collapse; font-size:13.5px}
/*
 * Scoped to thead. This used to be every th, which caught the row headers that start
 * each body row: country and language names came out as tiny muted uppercase mono, and
 * with the header's 0 top padding they sat eight pixels above the cells beside them,
 * so a name and its code did not line up.
 */
table.tbl thead th{text-align:left; font-family:var(--font-mono); font-size:10px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--muted); font-weight:600; padding:0 12px 8px 0; border-bottom:1px solid var(--line); white-space:nowrap}
table.tbl td,table.tbl tbody th{padding:8px 12px 8px 0; border-bottom:1px solid var(--line); vertical-align:top}
table.tbl tbody th{text-align:left; font-weight:600; color:var(--ink)}
table.tbl tr:last-child td,table.tbl tbody tr:last-child th{border-bottom:0}
table.tbl th.r,table.tbl td.r{text-align:right; font-variant-numeric:tabular-nums}
table.tbl td code{font-size:12.5px}
.tscroll{overflow-x:auto; -webkit-overflow-scrolling:touch}

/* ---------- directory pages ---------- */
.tablehead{display:flex; align-items:center; justify-content:space-between; gap:14px;
  flex-wrap:wrap; margin-bottom:4px}
@media (max-width:620px){ .filterbox{flex:1 1 100%; max-width:none} }
.tablehead .sec{margin:0}
.filterbox{position:relative; flex:1 1 240px; max-width:320px; min-width:180px}
.filterbox input{width:100%; height:38px; padding:0 12px 0 32px; border-radius:9px;
  border:1px solid var(--line-2); background:var(--surface); color:var(--ink);
  font:inherit; font-size:14px; -webkit-appearance:none; appearance:none}
.filterbox input::-webkit-search-cancel-button{-webkit-appearance:none; appearance:none}
.filterbox input:focus-visible{outline:none; border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-soft)}
.filterbox .ic{position:absolute; left:10px; top:50%; transform:translateY(-50%);
  color:var(--muted); pointer-events:none; display:flex}
td.tasks{white-space:nowrap}
.tag{display:inline-block; font-family:var(--font-mono); font-size:10.5px; font-weight:600;
  letter-spacing:.04em; color:var(--ink-2); background:var(--surface-3);
  border:1px solid var(--line); border-radius:5px; padding:1px 6px; margin-right:4px}

/* ---------- map ---------- */
.mapcard{background:var(--surface); border:1px solid var(--line); border-radius:13px; padding:14px 16px 16px}
.maphead{display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px}
.metricbar{display:flex; gap:4px; background:var(--surface-2); border:1px solid var(--line-2); border-radius:9px; padding:3px}
.metricbar button{appearance:none; border:0; background:none; cursor:pointer; font:inherit; font-size:12.5px;
  font-weight:600; color:var(--muted); padding:5px 10px; border-radius:6px}
.metricbar button[aria-pressed="true"]{background:var(--surface); color:var(--accent-ink); box-shadow:var(--shadow)}
.mapstage{position:relative; display:flex; justify-content:center}
/* The drawing is taller than it is wide, so at desktop widths an unconstrained map ran
   well past the fold. Cap it against the viewport and let preserveAspectRatio letterbox
   it; the floor stops it collapsing on a short window. */
svg.africa{display:block; width:100%; height:auto; touch-action:manipulation;
  max-height:calc(100svh - 280px); min-height:340px}
/* The metric buttons and legend wrap on a phone, so the map gets less of the viewport. */
@media (max-width:760px){ svg.africa{max-height:calc(100svh - 200px); min-height:300px} }
svg.africa .geo{stroke:var(--map-stroke); stroke-width:.9; stroke-linejoin:round; vector-effect:non-scaling-stroke;
  transition:fill .18s ease}
svg.africa a{cursor:pointer; outline:none}
svg.africa a:hover .geo,svg.africa a:focus-visible .geo{stroke:var(--accent); stroke-width:2.4}
svg.africa a:focus-visible .geo{stroke-dasharray:none}
svg.africa .isl{stroke:var(--map-stroke); stroke-width:1}
svg.africa .hit{fill:transparent; stroke:none}
svg.africa a:hover .hit,svg.africa a:focus-visible .hit{stroke:none}
svg.africa .isllab{font-family:var(--font-mono); font-size:26px; font-weight:600; fill:var(--muted);
  paint-order:stroke; stroke:var(--surface); stroke-width:5px; pointer-events:none}
.b0{fill:var(--c0)} .b1{fill:var(--c1)} .b2{fill:var(--c2)}
.b3{fill:var(--c3)} .b4{fill:var(--c4)} .b5{fill:var(--c5)}
.maptip{position:absolute; pointer-events:none; z-index:20; background:var(--surface); border:1px solid var(--line-2);
  border-radius:9px; box-shadow:var(--shadow); padding:9px 11px; font-size:12.5px; min-width:150px; max-width:230px}
.maptip b{font-family:var(--font-head); font-size:14px; letter-spacing:-.01em; display:block; margin-bottom:4px}
.maptip dl{display:grid; grid-template-columns:1fr auto; gap:2px 10px; margin:0;
  font-family:var(--font-mono); font-size:11px; color:var(--muted)}
.maptip dd{margin:0; color:var(--ink); font-variant-numeric:tabular-nums}
.legend{display:flex; flex-wrap:wrap; gap:3px 12px; align-items:center; margin-top:12px; font-size:12px; color:var(--muted)}
.legend .sw{display:inline-flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px}
.legend .sw i{width:16px; height:11px; border-radius:3px; display:block; border:1px solid var(--line)}
.locator{width:100%; max-width:160px; height:auto}
.locator .ctx{fill:var(--c0); stroke:var(--line-2); stroke-width:.6; vector-effect:non-scaling-stroke}
.locator .me{fill:var(--accent); stroke:var(--surface); stroke-width:.8; vector-effect:non-scaling-stroke}

/* ---------- code ---------- */
.tabgroup,.tabgroup [role="tabpanel"]{min-width:0}
.tabbar{display:flex; gap:2px; border-bottom:1px solid var(--line); margin-bottom:0; overflow-x:auto}
.tabbar button{appearance:none; border:0; background:none; cursor:pointer; font:inherit; font-size:13px;
  font-weight:600; color:var(--muted); padding:8px 13px; border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap}
.tabbar button[aria-selected="true"]{color:var(--ink); border-bottom-color:var(--accent)}
.tabbar button:hover{color:var(--ink)}
/* The copy button lives in a strip above the code rather than floating over it, so it
   can never cover the last word of a short line, and never covers scrolled content
   either. min-width:0 lets the pre shrink inside grid and flex parents, which is what
   makes overflow-x actually scroll instead of pushing the page wide. */
.codewrap{margin-top:12px; min-width:0; border-radius:11px; overflow:hidden; background:var(--code-bg)}
.codebar{display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:7px 10px 7px 14px; background:var(--code-bg); border-bottom:1px solid rgba(255,255,255,.09)}
.codelang{font-family:var(--font-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  font-weight:600; color:var(--code-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
pre.code{margin:0; background:var(--code-bg); color:var(--code-ink); border-radius:0; padding:14px 16px;
  overflow-x:auto; min-width:0; max-width:100%; font-family:var(--font-mono); font-size:12.5px;
  line-height:1.65; tab-size:2}
pre.code code{font:inherit; color:inherit; white-space:pre}
/* A wrapped block also stretches to its grid row, so two citation formats printed side
   by side end level with each other instead of one hanging lower than the other. */
.codewrap.wrapped{display:flex; flex-direction:column; height:100%}
.codewrap.wrapped pre.code{flex:1; overflow-x:hidden}
.codewrap.wrapped pre.code code{white-space:pre-wrap; overflow-wrap:anywhere}
pre.code .cm{color:var(--code-dim)}
pre.code .st{color:var(--code-str)}
pre.code .kw{color:var(--code-key)}
.copybtn{appearance:none; cursor:pointer; font-family:var(--font-mono); flex:none;
  font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; font-weight:600;
  border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.07); color:#D9D3EC;
  padding:4px 9px; border-radius:6px}
.copybtn:hover{background:rgba(255,255,255,.15); color:#fff}
.copybtn:focus-visible{outline:2px solid var(--accent); outline-offset:-2px}
code.inl{font-family:var(--font-mono); font-size:.9em; background:var(--surface-3); border:1px solid var(--line);
  border-radius:5px; padding:1px 5px}

/* ---------- buttons ---------- */
.btn{display:inline-flex; align-items:center; gap:8px; font:inherit; font-size:14px; font-weight:600;
  padding:9px 15px; border-radius:9px; border:1px solid var(--line-2); background:var(--surface);
  color:var(--ink); cursor:pointer; text-decoration:none}
.btn:hover{border-color:var(--accent); color:var(--accent-ink); text-decoration:none}
.btn.pri{background:var(--accent); border-color:var(--accent); color:#fff}
.btn.pri:hover{background:var(--accent-ink); border-color:var(--accent-ink); color:#fff}
.btnrow{display:flex; flex-wrap:wrap; gap:9px; align-items:center}
/* Stretching to the row makes the echoed URL exactly as tall as Send request rather
   than a thin strip floating beside it. */
.urlchip{align-self:stretch; display:inline-flex; align-items:center; padding:0 12px;
  border-radius:9px; overflow-wrap:anywhere; min-width:0}
.sociallist{display:flex; flex-wrap:wrap; gap:9px}
.social{display:inline-flex; align-items:center; gap:9px; padding:9px 14px; border-radius:10px;
  border:1px solid var(--line-2); background:var(--surface); color:var(--ink); font-size:14px; font-weight:600}
.social:hover{border-color:var(--accent); color:var(--accent-ink); text-decoration:none}
.social .h{font-family:var(--font-mono); font-size:11.5px; color:var(--muted); font-weight:400}
.social:hover .h{color:var(--accent-ink)}

/* ---------- forms ---------- */
.form{display:grid; gap:12px}
.field{display:grid; gap:5px}
.field label{font-family:var(--font-mono); font-size:10px; letter-spacing:.09em; text-transform:uppercase;
  color:var(--muted); font-weight:600}
.field input,.field select,.field textarea{font:inherit; font-size:14px; padding:8px 11px; border-radius:9px;
  border:1px solid var(--line-2); background:var(--surface-2); color:var(--ink); width:100%}
.inline3{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px}
.out{margin-top:12px}
.status{font-family:var(--font-mono); font-size:11.5px; color:var(--muted); margin:8px 0 0}

/* ---------- callouts ---------- */
.callout{border-left:3px solid var(--accent); background:var(--accent-soft); border-radius:0 10px 10px 0;
  padding:12px 15px; font-size:13.5px; color:var(--ink-2)}
.callout.warn{border-left-color:var(--warn); background:var(--warn-bg); color:var(--ink-2)}
.callout strong{color:var(--ink)}

/* ---------- footer ---------- */
footer.foot{border-top:1px solid var(--line); background:var(--surface); padding-block:26px 40px;
  color:var(--muted); font-size:13px}
footer.foot p{margin:0 0 9px; max-width:80ch}
footer.foot .cols{display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:20px; margin-bottom:18px}
footer.foot h4{font-family:var(--font-mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--muted); margin:0 0 9px; font-weight:600}
footer.foot ul{list-style:none; margin:0; padding:0; display:grid; gap:6px}
footer.foot a{color:var(--ink-2)}
footer.foot a:hover{color:var(--accent-ink)}

@media (prefers-reduced-motion:no-preference){
  .card,.pill,.btn,.social,.iconbtn{transition:border-color .15s ease, color .15s ease, background .15s ease}
}
@media (prefers-reduced-motion:reduce){ *{animation:none !important; transition:none !important} }

/* ---------- navigation ---------- */
/*
 * Cross-document view transitions. With the prerendering rules in the head, the next
 * page is already built when the click lands, so this is what removes the last visible
 * trace of a reload: the old document cross-fades into the new one instead of the
 * browser blanking to white and painting again. The masthead is given its own name so
 * it stays put across the swap rather than fading with the content under it.
 */
@view-transition{navigation:auto}
header.mast{view-transition-name:mast}
footer.foot{view-transition-name:foot}
@media (prefers-reduced-motion:no-preference){
  ::view-transition-old(root){animation:vt-out .16s ease both}
  ::view-transition-new(root){animation:vt-in .22s ease both}
}
@keyframes vt-out{to{opacity:0}}
@keyframes vt-in{from{opacity:0; transform:translateY(4px)} to{opacity:1; transform:none}}
/* A reader who asked for less motion gets the instant swap, not a crossfade. */
@media (prefers-reduced-motion:reduce){
  ::view-transition-old(root),::view-transition-new(root){animation:none !important}
}
`;

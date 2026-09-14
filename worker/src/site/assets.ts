/**
 * Everything served from a fixed path: the stylesheet, the two client scripts, the
 * favicon and the social card. The router serves these straight from `siteAssets`
 * with a long cache header, so none of it is inlined into a page.
 *
 * The scripts are progressive enhancement only. With JavaScript switched off the site
 * still renders every page, the map still shows hours of audio, every country is still
 * a link, the first tab of each code block is visible, and the search box submits
 * straight to the JSON API.
 */

import { STYLESHEET } from './styles';

const SITE_JS = `"use strict";
(function () {
  var doc = document;

  /* ---------------- theme ---------------- */
  var toggle = doc.getElementById("theme-toggle");
  function activeTheme() {
    var set = doc.documentElement.getAttribute("data-theme");
    if (set === "dark" || set === "light") return set;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function describeToggle() {
    if (!toggle) return;
    var next = activeTheme() === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", "Switch to the " + next + " theme");
    toggle.setAttribute("title", "Switch to the " + next + " theme");
  }
  if (toggle) {
    describeToggle();
    toggle.addEventListener("click", function () {
      var next = activeTheme() === "dark" ? "light" : "dark";
      doc.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("ngano-theme", next); } catch (err) { /* private mode */ }
      describeToggle();
    });
  }

  /* ---------------- tabs ----------------
     Groups that carry data-tabs-remember share a choice through localStorage, so a
     Rust reader picks Rust once rather than on every page. */
  var tabGroups = [].slice.call(doc.querySelectorAll("[data-tabs]"));

  function rememberedTab(key) {
    try { return localStorage.getItem("ngano-tab-" + key); } catch (err) { return null; }
  }
  function rememberTab(key, value) {
    try { localStorage.setItem("ngano-tab-" + key, value); } catch (err) { /* private mode */ }
  }

  tabGroups.forEach(function (group) {
    var tabs = [].slice.call(group.querySelectorAll('[role="tab"]'));
    var key = group.getAttribute("data-tabs-remember");

    function select(index, persist) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.setAttribute("tabindex", on ? "0" : "-1");
        var panel = doc.getElementById(tab.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (key && persist) {
        var name = tabs[index] && tabs[index].getAttribute("data-tab");
        if (name) {
          rememberTab(key, name);
          /* Keep every other group with the same key in step on this page. The sync
             call never persists, so two groups cannot bounce the choice back and
             forth between each other. */
          tabGroups.forEach(function (other) {
            if (other === group || other.getAttribute("data-tabs-remember") !== key) return;
            if (typeof other.ngSelectByName === "function") other.ngSelectByName(name);
          });
        }
      }
    }

    group.ngSelectByName = function (name) {
      for (var i = 0; i < tabs.length; i += 1) {
        if (tabs[i].getAttribute("data-tab") === name) { select(i, false); return; }
      }
    };

    if (key) {
      var saved = rememberedTab(key);
      if (saved) group.ngSelectByName(saved);
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(i, true); });
      tab.addEventListener("keydown", function (event) {
        var next = -1;
        if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        if (next < 0) return;
        event.preventDefault();
        select(next, true);
        tabs[next].focus();
      });
    });
  });

  /* ---------------- copy buttons ---------------- */
  Array.prototype.forEach.call(doc.querySelectorAll("[data-copy]"), function (button) {
    button.addEventListener("click", function () {
      var wrap = button.closest ? button.closest(".codewrap") : button.parentNode.parentNode;
      var block = wrap && wrap.querySelector("code");
      if (!block) return;
      var text = block.textContent || "";
      var done = function () {
        var original = button.textContent;
        button.textContent = "Copied";
        setTimeout(function () { button.textContent = original; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { button.textContent = "Press Ctrl C"; });
      } else {
        var area = doc.createElement("textarea");
        area.value = text;
        doc.body.appendChild(area);
        area.select();
        try { doc.execCommand("copy"); done(); } catch (err) { button.textContent = "Press Ctrl C"; }
        doc.body.removeChild(area);
      }
    });
  });

  /* ---------------- search suggestions ----------------
     Languages are matched in the page, against the tag, the bare ISO 639-3 code and
     every spelling a source used, so "sna", "Shona" and "chiShona" all reach Shona
     without a round trip. Datasets still come from the JSON API. */
  var langIndex = (function () {
    var island = doc.getElementById("lang-index");
    if (!island) return [];
    try { return JSON.parse(island.textContent || "[]"); } catch (err) { return []; }
  })();

  function languageMatches(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var exact = [];
    var prefix = [];
    var loose = [];
    for (var i = 0; i < langIndex.length; i++) {
      var row = langIndex[i];
      var tag = row[0];
      var name = row[1];
      var spellings = [tag, tag.split("-")[0], name];
      if (row[2]) spellings = spellings.concat(row[2].split("|"));
      var best = 0;
      for (var j = 0; j < spellings.length; j++) {
        var value = spellings[j].toLowerCase();
        if (value === q) { best = 3; break; }
        if (value.indexOf(q) === 0) { best = Math.max(best, 2); }
        else if (value.indexOf(q) > 0) { best = Math.max(best, 1); }
      }
      var hit = { tag: tag, name: name };
      if (best === 3) exact.push(hit);
      else if (best === 2) prefix.push(hit);
      else if (best === 1) loose.push(hit);
    }
    return exact.concat(prefix, loose).slice(0, 5);
  }

  var form = doc.getElementById("site-search");
  var input = doc.getElementById("site-q");
  var panel = doc.getElementById("site-sugg");
  if (form && input && panel) {
    var timer = null;
    var cursor = -1;
    var items = [];

    function close() {
      panel.hidden = true;
      panel.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      cursor = -1;
      items = [];
    }
    function move(delta) {
      if (!items.length) return;
      if (cursor >= 0 && items[cursor]) items[cursor].removeAttribute("aria-selected");
      cursor = (cursor + delta + items.length) % items.length;
      items[cursor].setAttribute("aria-selected", "true");
      items[cursor].scrollIntoView({ block: "nearest" });
    }
    function render(query, rows) {
      panel.innerHTML = "";
      var languages = languageMatches(query);
      languages.forEach(function (language) {
        var link = doc.createElement("a");
        link.href = "/languages/" + encodeURIComponent(language.tag.toLowerCase());
        link.setAttribute("role", "option");
        var kind = doc.createElement("span");
        kind.className = "k";
        kind.textContent = "Language \u00b7 " + language.tag;
        var name = doc.createElement("span");
        name.textContent = language.name;
        link.appendChild(kind);
        link.appendChild(name);
        panel.appendChild(link);
      });
      if (!rows.length && !languages.length) {
        var empty = doc.createElement("p");
        empty.className = "none";
        empty.textContent = "Nothing in the catalogue matches that.";
        panel.appendChild(empty);
      }
      rows.slice(0, 7).forEach(function (row) {
        var link = doc.createElement("a");
        link.href = "/datasets/" + encodeURIComponent(row.id);
        link.setAttribute("role", "option");
        var kind = doc.createElement("span");
        kind.className = "k";
        kind.textContent = row.task + (row.hours ? " \\u00b7 " + row.hours + " h" : "");
        var name = doc.createElement("span");
        name.textContent = row.name;
        link.appendChild(kind);
        link.appendChild(name);
        panel.appendChild(link);
      });
      var all = doc.createElement("a");
      all.href = "/api/v1/datasets?q=" + encodeURIComponent(query);
      all.setAttribute("role", "option");
      all.innerHTML = '<span class="k">JSON API</span>';
      all.appendChild(doc.createTextNode("All matches for " + query));
      panel.appendChild(all);
      items = [].slice.call(panel.querySelectorAll("a"));
      cursor = -1;
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    function lookup() {
      var query = input.value.trim();
      if (query.length < 2) { close(); return; }
      fetch("/api/v1/datasets?per_page=7&fields=id,name,task,hours&q=" + encodeURIComponent(query), {
        headers: { accept: "application/json" }
      })
        .then(function (response) { return response.ok ? response.json() : { data: [] }; })
        .then(function (body) { render(query, (body && body.data) || []); })
        .catch(function () { close(); });
    }

    input.addEventListener("input", function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(lookup, 180);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
      else if (event.key === "Escape") { close(); }
      else if (event.key === "Enter" && cursor >= 0 && items[cursor]) {
        event.preventDefault();
        window.location.href = items[cursor].href;
      }
    });
    doc.addEventListener("click", function (event) {
      if (!form.contains(event.target)) close();
    });
  }

  /* ---------------- live API console on /docs ---------------- */
  var tryForm = doc.getElementById("tryit");
  if (tryForm) {
    var output = doc.getElementById("tryit-out");
    var status = doc.getElementById("tryit-status");
    var urlView = doc.getElementById("tryit-url");

    function buildUrl() {
      var endpoint = tryForm.elements["endpoint"].value;
      var query = tryForm.elements["query"].value.trim();
      return endpoint + (query ? (endpoint.indexOf("?") >= 0 ? "&" : "?") + query : "");
    }
    function preview() {
      if (urlView) urlView.textContent = window.location.origin + buildUrl();
    }
    tryForm.addEventListener("input", preview);
    preview();

    tryForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var url = buildUrl();
      if (status) status.textContent = "Requesting " + url;
      var started = Date.now();
      fetch(url, { headers: { accept: "application/json" } })
        .then(function (response) {
          return response.text().then(function (text) {
            var body = text;
            try { body = JSON.stringify(JSON.parse(text), null, 2); } catch (err) { /* not JSON */ }
            if (body.length > 20000) body = body.slice(0, 20000) + "\\n... truncated ...";
            if (output) output.textContent = body;
            if (status) {
              status.textContent = response.status + " " + response.statusText +
                " in " + (Date.now() - started) + " ms";
            }
          });
        })
        .catch(function (error) {
          if (output) output.textContent = String(error);
          if (status) status.textContent = "Request failed";
        });
    });
  }
})();
`;

const MAP_JS = `"use strict";
(function () {
  var METRICS = ["hours", "datasets", "languages"];
  var LABELS = { hours: "Hours", datasets: "Datasets", languages: "Languages" };

  Array.prototype.forEach.call(document.querySelectorAll("[data-map]"), function (map) {
    var svg = map.querySelector("svg.africa");
    var stage = map.querySelector(".mapstage");
    var tip = map.querySelector("[data-tip]");
    var bar = map.querySelector("[data-metricbar]");
    var caption = map.querySelector(".maphead .note");
    if (!svg || !stage) return;

    var links = [].slice.call(svg.querySelectorAll("a"));
    var current = map.getAttribute("data-metric") || "hours";

    /* The toggle only appears once the script that drives it has loaded. */
    if (bar) bar.hidden = false;

    function paint(metric) {
      current = metric;
      map.setAttribute("data-metric", metric);
      links.forEach(function (link) {
        var bucket = link.getAttribute("data-b-" + metric) || "0";
        var shape = link.querySelector(".geo");
        if (!shape) return;
        shape.setAttribute("class", shape.getAttribute("class").replace(/\\bb[0-5]\\b/, "b" + bucket));
      });
      Array.prototype.forEach.call(map.querySelectorAll("[data-legend]"), function (legend) {
        legend.hidden = legend.getAttribute("data-legend") !== metric;
      });
      if (bar) {
        Array.prototype.forEach.call(bar.querySelectorAll("button"), function (button) {
          button.setAttribute("aria-pressed", button.getAttribute("data-metric") === metric ? "true" : "false");
        });
      }
      if (caption) {
        caption.textContent = "Colour shows " + LABELS[metric].toLowerCase() +
          " per country. Click a country for its datasets.";
      }
    }

    if (bar) {
      Array.prototype.forEach.call(bar.querySelectorAll("button"), function (button) {
        button.addEventListener("click", function () {
          var metric = button.getAttribute("data-metric");
          if (METRICS.indexOf(metric) >= 0) paint(metric);
        });
      });
    }

    function fill(link) {
      if (!tip) return;
      tip.innerHTML = "";
      var name = document.createElement("b");
      name.textContent = link.getAttribute("data-name") || "";
      tip.appendChild(name);
      var list = document.createElement("dl");
      METRICS.forEach(function (metric) {
        var term = document.createElement("dt");
        term.textContent = LABELS[metric];
        var value = document.createElement("dd");
        value.textContent = link.getAttribute("data-" + metric) || "0";
        if (metric === current) {
          term.style.color = "var(--accent-ink)";
          value.style.fontWeight = "600";
        }
        list.appendChild(term);
        list.appendChild(value);
      });
      tip.appendChild(list);
      tip.hidden = false;
    }

    function place(x, y) {
      if (!tip || tip.hidden) return;
      var box = stage.getBoundingClientRect();
      var width = tip.offsetWidth;
      var height = tip.offsetHeight;
      var left = Math.max(4, Math.min(box.width - width - 4, x + 14));
      var top = y - height - 12;
      if (top < 4) top = y + 18;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }

    function hide() { if (tip) tip.hidden = true; }

    links.forEach(function (link) {
      link.addEventListener("mouseenter", function (event) {
        var box = stage.getBoundingClientRect();
        fill(link);
        place(event.clientX - box.left, event.clientY - box.top);
      });
      link.addEventListener("mousemove", function (event) {
        var box = stage.getBoundingClientRect();
        place(event.clientX - box.left, event.clientY - box.top);
      });
      link.addEventListener("mouseleave", hide);
      link.addEventListener("focus", function () {
        var box = stage.getBoundingClientRect();
        var shape = link.getBoundingClientRect();
        fill(link);
        place(shape.left - box.left + shape.width / 2, shape.top - box.top + shape.height / 2);
      });
      link.addEventListener("blur", hide);
    });

    svg.addEventListener("mouseleave", hide);
    paint(current);
  });
})();
`;

/*
 * The directory filter. One input, one table: rows carry a lowercased `data-find`
 * string built on the server, so a keystroke is a substring test and nothing else. No
 * debounce, because 315 rows is well inside a frame; no fetch, because the whole list
 * is already on the page.
 */
const FILTER_JS = `"use strict";
(function () {
  var input = document.querySelector("[data-filter]");
  if (!input) return;
  var table = document.querySelector(input.getAttribute("data-filter"));
  if (!table) return;
  var rows = Array.prototype.slice.call(table.tBodies[0].rows);
  var count = document.querySelector("[data-filter-count]");
  var total = count ? Number(count.getAttribute("data-total")) : rows.length;

  function apply() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    for (var i = 0; i < rows.length; i++) {
      var hit = q === "" || (rows[i].getAttribute("data-find") || "").indexOf(q) !== -1;
      rows[i].hidden = !hit;
      if (hit) shown++;
    }
    if (count) {
      count.textContent = q === ""
        ? "Showing all " + total.toLocaleString("en-GB") + "."
        : "Showing " + shown.toLocaleString("en-GB") + " of " + total.toLocaleString("en-GB") + ".";
    }
  }

  input.addEventListener("input", apply);
  /* A filter typed, then restored by the back button, should still be applied. */
  if (input.value) apply();
})();
`;

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#191527"/>
<circle cx="32" cy="20" r="7" fill="#C0356E"/>
<path d="M14 50c0-9.4 8-17 18-17s18 7.6 18 17z" fill="#F0709F"/>
</svg>
`;

const OG_CARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
<rect width="1200" height="630" fill="#100E18"/>
<circle cx="1020" cy="150" r="230" fill="#3A1B2C"/>
<circle cx="1020" cy="150" r="120" fill="#C0356E" opacity="0.55"/>
<g fill="#EFECF7" font-family="Archivo, Arial, sans-serif">
<text x="80" y="250" font-size="104" font-weight="800" letter-spacing="-4">ngano</text>
<text x="80" y="330" font-size="40" font-weight="600" fill="#C2BCD6">A catalogue and unified loader for</text>
<text x="80" y="386" font-size="40" font-weight="600" fill="#C2BCD6">African-language speech datasets</text>
</g>
<g fill="#928BAA" font-family="IBM Plex Mono, monospace" font-size="26">
<text x="80" y="500">Python &#183; JavaScript &#183; Rust &#183; JSON API &#183; MCP</text>
<text x="80" y="546">ngano.dev</text>
</g>
<rect x="0" y="614" width="1200" height="16" fill="#C0356E"/>
</svg>
`;

/**
 * A short content fingerprint, used to version asset URLs. FNV-1a, the same cheap hash
 * the API etags use, kept local so the site module does not reach into the router.
 */
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** Fixed-path assets, keyed by the path the router should serve them from. */
export const siteAssets: Record<string, { body: string; contentType: string }> = {
  '/styles.css': { body: STYLESHEET, contentType: 'text/css; charset=utf-8' },
  '/site.js': { body: SITE_JS, contentType: 'text/javascript; charset=utf-8' },
  '/map.js': { body: MAP_JS, contentType: 'text/javascript; charset=utf-8' },
  '/filter.js': { body: FILTER_JS, contentType: 'text/javascript; charset=utf-8' },
  '/favicon.svg': { body: FAVICON, contentType: 'image/svg+xml; charset=utf-8' },
  '/og.svg': { body: OG_CARD, contentType: 'image/svg+xml; charset=utf-8' },
};

/**
 * The stylesheet and scripts are served with a long cache lifetime, so a redeploy that
 * changes them has to change their URL as well or a returning reader keeps the old CSS
 * until the browser and the edge both expire it. The query string is derived from the
 * body, so it moves exactly when the file does and stays put when it does not.
 */
const ASSET_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(siteAssets).map(([path, asset]) => [path, `${path}?v=${fingerprint(asset.body)}`]),
);

/** The cache-busted URL for a fixed-path asset. Unknown paths are returned unchanged. */
export function assetUrl(path: string): string {
  return ASSET_URLS[path] ?? path;
}

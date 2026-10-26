// Clippings archive: reads clippings.json (or window.CLIPPINGS) and renders a filterable wall.
(function () {
  const $ = (s) => document.querySelector(s);
  const state = { all: [], view: [], q: "", open: -1 };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function domain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  function fmtDate(d) {
    if (!d) return "";
    const t = new Date(d + "T00:00:00");
    return isNaN(t) ? d : t.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function metaLine(c) {
    return [domain(c.source), fmtDate(c.date)].filter(Boolean).join("  ·  ");
  }

  function paragraphs(text) {
    const box = el("div", "quote");
    String(text || "").split(/\n\s*\n/).forEach((p) => box.appendChild(el("p", null, p.trim())));
    return box;
  }

  function matches(c) {
    if (!state.q) return true;
    const hay = [c.caption, c.text, c.alt, c.source, ...(c.tags || [])].join(" ").toLowerCase();
    return state.q.split(/\s+/).every((w) => hay.includes(w));
  }

  function renderWall() {
    const wall = $("#wall");
    wall.textContent = "";
    state.view = state.all.filter(matches);
    $("#count").textContent = state.view.length === state.all.length
      ? `${state.all.length} clippings`
      : `${state.view.length} of ${state.all.length} clippings`;
    $("#empty").hidden = state.view.length > 0;

    state.view.forEach((c, i) => {
      const card = el("button", "clip " + c.type);
      card.type = "button";
      if (c.type === "image") {
        const img = el("img");
        img.src = c.src;
        img.alt = c.alt || c.caption || "";
        img.loading = "lazy";
        if (c.width && c.height) { img.width = c.width; img.height = c.height; }
        card.appendChild(img);
      } else {
        card.appendChild(paragraphs(c.text));
      }
      if (c.caption) card.appendChild(el("p", "cap", c.caption));
      const m = metaLine(c);
      if (m) card.appendChild(el("div", "meta", m));
      card.onclick = () => openViewer(i);
      wall.appendChild(card);
    });
  }

  function update() { renderWall(); }

  function openViewer(i) {
    state.open = i;
    const c = state.view[i];
    const v = $("#viewer");
    const media = v.querySelector(".media");
    const info = v.querySelector(".info");
    media.textContent = "";
    info.textContent = "";

    if (c.type === "image") {
      const img = el("img");
      img.src = c.src;
      img.alt = c.alt || c.caption || "";
      media.appendChild(img);
    } else {
      media.appendChild(paragraphs(c.text));
    }
    if (c.caption) info.appendChild(el("p", "cap", c.caption));

    const meta = el("div", "meta");
    if (c.source) {
      const a = el("a", null, domain(c.source) || c.source);
      a.href = c.source; a.target = "_blank"; a.rel = "noopener";
      meta.appendChild(a);
    }
    if (c.date) meta.appendChild(document.createTextNode((c.source ? "  ·  clipped " : "clipped ") + fmtDate(c.date)));
    if (meta.childNodes.length) info.appendChild(meta);

    if ((c.tags || []).length) {
      const tags = el("div", "tags");
      c.tags.forEach((t) => {
        tags.appendChild(el("span", "tag", t));
      });
      info.appendChild(tags);
    }

    v.querySelector(".vprev").hidden = v.querySelector(".vnext").hidden = state.view.length < 2;
    v.hidden = false;
    document.body.style.overflow = "hidden";
    v.querySelector(".vclose").focus();
  }

  function closeViewer() {
    $("#viewer").hidden = true;
    document.body.style.overflow = "";
    state.open = -1;
  }

  function step(d) {
    if (state.open < 0) return;
    openViewer((state.open + d + state.view.length) % state.view.length);
  }

  function wire() {
    let t;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); renderWall(); }, 80);
    });
    const v = $("#viewer");
    v.querySelector(".vclose").onclick = closeViewer;
    v.querySelector(".vprev").onclick = () => step(-1);
    v.querySelector(".vnext").onclick = () => step(1);
    v.addEventListener("click", (e) => { if (e.target === v) closeViewer(); });
    document.addEventListener("keydown", (e) => {
      if (state.open < 0) {
        if (e.key === "/" && document.activeElement !== $("#search")) { e.preventDefault(); $("#search").focus(); }
        return;
      }
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
  }

  async function start() {
    wire();
    let data = window.CLIPPINGS;
    if (!data) {
      try { data = await fetch("clippings.json", { cache: "no-store" }).then((r) => r.json()); }
      catch { data = []; $("#empty").textContent = "Could not load clippings.json. Serve this folder with a local web server (see README)."; }
    }
    state.all = data.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    update();
  }

  start();
})();

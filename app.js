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

  function metaLine(c) {
    return domain(c.source);
  }

  // Text clippings can carry a style: quote (big and bold), headline, excerpt (default) or note.
  const STYLES = ["quote", "headline", "excerpt", "note"];
  function textStyle(c) {
    const st = String(c.style || "").toLowerCase();
    return STYLES.includes(st) ? st : "excerpt";
  }

  function paragraphs(text, style) {
    const box = el("div", "quote style-" + (style || "excerpt"));
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
    $("#empty").hidden = state.view.length > 0;

    const feat = !state.q && state.featured;
    const box = $("#feature");
    box.textContent = "";
    box.hidden = !feat;

    state.view.forEach((c, i) => {
      (feat && i === 0 ? box : wall).appendChild(card(c, i));
    });
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // A clipping tagged "featured" is pinned above the wall; the newest one wins.
  function isFeatured(c) {
    return (c.tags || []).some((t) => t.toLowerCase() === "featured");
  }

  function card(c, i) {
    const card = el("button", "clip " + c.type + (c.type === "text" ? " is-" + textStyle(c) : ""));
    card.type = "button";
    if (c.type === "image") {
      const img = el("img");
      img.src = c.src;
      img.alt = c.alt || c.caption || "";
      if (i > 0) img.loading = "lazy";
      if (c.width && c.height) { img.width = c.width; img.height = c.height; }
      card.appendChild(img);
    } else {
      card.appendChild(paragraphs(c.text, textStyle(c)));
    }
    if (c.caption) card.appendChild(el("p", "cap", c.caption));
    const m = metaLine(c);
    if (m) card.appendChild(el("div", "meta", m));
    card.onclick = () => openViewer(i);
    return card;
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
      media.appendChild(paragraphs(c.text, textStyle(c)));
    }
    if (c.caption) info.appendChild(el("p", "cap", c.caption));

    const meta = el("div", "meta");
    if (c.source) {
      const a = el("a", null, domain(c.source) || c.source);
      a.href = c.source; a.target = "_blank"; a.rel = "noopener";
      meta.appendChild(a);
    }
    if (meta.childNodes.length) info.appendChild(meta);

    const shown = (c.tags || []).filter((t) => t.toLowerCase() !== "featured");
    if (shown.length) {
      const tags = el("div", "tags");
      shown.forEach((t) => {
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
    // Top slot is always an image: the newest image tagged "featured", else the newest image
    // (same-day ties go to the one added last).
    const newest = data.slice().reverse().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const images = newest.filter((c) => c.type === "image");
    state.featured = images.find(isFeatured) || images[0] || null;
    // Everything else is shuffled on each page load.
    state.all = shuffle(data.filter((c) => c !== state.featured));
    if (state.featured) state.all.unshift(state.featured);
    update();
  }

  start();
})();

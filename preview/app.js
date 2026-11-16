// One clipping at a time: scroll, swipe or use the arrow keys to fade to the next.
(function () {
  const $ = (s) => document.querySelector(s);
  const stage = $("#stage");
  const base = "../";
  const state = { all: [], seq: [], i: 0, cur: null, lockUntil: 0, acc: 0 };

  // Plain colour fields for text clippings: [background, ink].
  const FIELDS = [
    ["#1f3a5f", "#f4efe6"], ["#c8553d", "#fbf3ea"], ["#e8dcc8", "#1c2024"],
    ["#2b2d2f", "#eceae4"], ["#f2c14e", "#1c2024"], ["#dce3d5", "#1c2024"], ["#5b2a3c", "#f6ece9"],
  ];
  const STYLES = ["quote", "headline", "excerpt", "note"];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function domain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }
  function hash(s) {
    let h = 0;
    for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function isFeatured(c) {
    return (c.tags || []).some((t) => t.toLowerCase() === "featured");
  }
  // Short text reads as a quote; long text as an excerpt, unless the clipping sets a style.
  function textStyle(c) {
    const st = String(c.style || "").toLowerCase();
    if (STYLES.includes(st)) return st;
    return c.text.length <= 160 ? "quote" : "excerpt";
  }

  function build(c) {
    const s = el("section", "slide " + c.type);
    const art = el("div", "art");
    if (c.type === "image") {
      const img = el("img");
      img.src = base + c.src;
      img.alt = c.alt || c.caption || "";
      art.appendChild(img);
    } else {
      const [bg, fg] = FIELDS[hash(c.id) % FIELDS.length];
      s.style.setProperty("--bg", bg);
      s.style.setProperty("--fg", fg);
      const words = el("blockquote", "words " + textStyle(c));
      String(c.text).split(/\n\s*\n/).forEach((p) => words.appendChild(el("p", null, p.trim())));
      art.appendChild(words);
    }
    s.appendChild(art);

    const label = el("div", "label");
    // The speaker of a text clipping is set large above the caption and in bold within it.
    if (c.type === "text" && c.by) label.appendChild(el("div", "who", c.by));
    if (c.caption) {
      const cap = el("p", "cap");
      const k = c.by ? c.caption.indexOf(c.by) : -1;
      if (k >= 0) {
        cap.append(c.caption.slice(0, k), el("strong", null, c.by), c.caption.slice(k + c.by.length));
      } else {
        cap.textContent = c.caption;
      }
      label.appendChild(cap);
    }
    if (c.source) {
      const src = el("div", "src");
      const a = el("a", null, domain(c.source) || c.source);
      a.href = c.source; a.target = "_blank"; a.rel = "noopener";
      src.appendChild(a);
      label.appendChild(src);
    }
    s.appendChild(label);
    return s;
  }

  // Images fill the stage, scaled up at most 2x so small GIFs don't turn to mush.
  function sizeImage(slide) {
    const img = slide.querySelector(".art img");
    const box = slide.querySelector(".art");
    if (!img || !img.naturalWidth) return;
    const cs = getComputedStyle(box);
    const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight, 2);
    img.style.width = Math.floor(img.naturalWidth * k) + "px";
    img.style.height = Math.floor(img.naturalHeight * k) + "px";
  }

  // Largest font size at which the text fits its box.
  function fit(slide) {
    const words = slide.querySelector(".words");
    if (!words) return;
    const box = slide.querySelector(".art");
    const room = box.clientHeight - parseFloat(getComputedStyle(box).paddingTop) - parseFloat(getComputedStyle(box).paddingBottom);
    const max = words.classList.contains("quote") || words.classList.contains("headline") ? 120 : 44;
    let lo = 14, hi = max;
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      words.style.fontSize = mid + "px";
      if (words.scrollHeight <= room && words.scrollWidth <= words.clientWidth + 1) lo = mid; else hi = mid;
    }
    words.style.fontSize = lo + "px";
  }

  function show(i, dir) {
    const n = state.seq.length;
    $("#empty").hidden = n > 0;
    if (state.cur) {
      const old = state.cur;
      old.style.opacity = "";
      old.classList.remove("on");
      old.classList.add("leaving");
      if (dir < 0) old.style.transform = "translateY(18px)";
      setTimeout(() => old.remove(), 750);
      state.cur = null;
    }
    if (!n) return;
    state.i = ((i % n) + n) % n;
    const s = build(state.seq[state.i]);
    if (dir < 0) s.style.transform = "translateY(-18px)";
    stage.appendChild(s);
    fit(s);
    const img = s.querySelector("img");
    if (img) {
      if (img.complete) sizeImage(s);
      else img.addEventListener("load", () => sizeImage(s), { once: true });
    }
    requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = ""; s.classList.add("on"); }));
    state.cur = s;
    preload(state.i + 1); preload(state.i - 1);
  }

  function preload(i) {
    const n = state.seq.length;
    const c = state.seq[((i % n) + n) % n];
    if (c && c.type === "image") new Image().src = base + c.src;
  }

  function go(dir) {
    const now = Date.now();
    if (now < state.lockUntil || state.seq.length < 2) return;
    state.lockUntil = now + 800;
    state.acc = 0;
    $("#hint").classList.add("gone");
    show(state.i + dir, dir);
  }

  // Scroll builds up; past the threshold the clipping fades to the next. Until then it dims slightly.
  function push(delta, threshold) {
    const now = Date.now();
    if (now < state.lockUntil) { state.lockUntil = Math.max(state.lockUntil, now + 150); return; }
    if (Math.sign(delta) !== Math.sign(state.acc)) state.acc = 0;
    state.acc += delta;
    const p = Math.min(Math.abs(state.acc) / threshold, 1);
    if (state.cur) { state.cur.style.transition = "opacity .15s linear"; state.cur.style.opacity = String(1 - p * 0.4); }
    clearTimeout(push.t);
    push.t = setTimeout(settle, 220);
    if (p >= 1) {
      if (state.cur) state.cur.style.transition = "";
      go(state.acc > 0 ? 1 : -1);
    }
  }
  function settle() {
    state.acc = 0;
    if (state.cur) { state.cur.style.transition = ""; state.cur.style.opacity = ""; }
  }

  function wire() {
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      push(d, 180);
    }, { passive: false });

    let ty = null;
    stage.addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener("touchmove", (e) => {
      if (ty == null) return;
      const y = e.touches[0].clientY;
      push(ty - y, 90);
      ty = y;
    }, { passive: true });
    stage.addEventListener("touchend", () => { ty = null; });

    document.addEventListener("keydown", (e) => {
      if (e.target === $("#search")) {
        if (e.key === "Enter" || e.key === "Escape") e.target.blur();
        return;
      }
      if (["ArrowDown", "PageDown", " ", "j"].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowUp", "PageUp", "k"].includes(e.key)) { e.preventDefault(); go(-1); }
      if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
    });

    let t;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => filter(e.target.value.trim().toLowerCase()), 200);
    });

    let r;
    window.addEventListener("resize", () => { clearTimeout(r); r = setTimeout(() => { if (state.cur) { fit(state.cur); sizeImage(state.cur); } }, 120); });
  }

  function filter(q) {
    state.seq = !q ? state.all : state.all.filter((c) => {
      const hay = [c.caption, c.text, c.alt, c.source, ...(c.tags || [])].join(" ").toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    state.lockUntil = 0;
    show(0, 1);
  }

  // The featured clipping sits in the left column for the whole visit; it loads before anything else.
  function pin(c) {
    const fig = $("#pinned");
    const btn = el("button", "pin-art");
    btn.type = "button";
    btn.setAttribute("aria-label", "Show the featured clipping full size");
    const img = el("img");
    img.src = base + c.src;
    img.alt = c.alt || c.caption || "";
    img.fetchPriority = "high";
    if (c.width && c.height) { img.width = c.width; img.height = c.height; }
    btn.appendChild(img);
    btn.onclick = () => { state.lockUntil = 0; state.seq = [c, ...state.seq.filter((x) => x !== c)]; show(0, 1); };
    fig.append(el("div", "pin-tag", "Featured"), btn);
    if (c.caption) fig.appendChild(el("figcaption", null, c.caption));
    fig.hidden = false;
  }

  async function start() {
    wire();
    let data = [];
    try { data = await fetch(base + "clippings.json", { cache: "no-store" }).then((r) => r.json()); }
    catch { $("#empty").textContent = "Could not load the clippings."; }
    // First: the newest image tagged "featured", else the newest image. Same-day ties go to the one added last.
    const newest = data.slice().reverse().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const images = newest.filter((c) => c.type === "image");
    const featured = images.find(isFeatured) || images[0] || null;
    if (featured) pin(featured);
    state.all = shuffle(data.filter((c) => c !== featured));
    // Phones have no left column, so the featured clipping opens the sequence instead.
    if (featured && matchMedia("(max-width: 720px)").matches) state.all.unshift(featured);
    state.seq = state.all;
    show(0, 1);
  }

  start();
})();

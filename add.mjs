#!/usr/bin/env node
// Add a clipping to clippings.json.
//   node add.mjs image <file-or-url> --caption "..." [--source URL] [--tags a,b] [--alt "..."]
//   node add.mjs text "<quoted text>" [--caption "note"] [--source URL] [--tags a,b]
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const dbPath = path.join(root, "clippings.json");
const mediaDir = path.join(root, "media");

const [type, value, ...rest] = process.argv.slice(2);
const opts = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) opts[rest[i].slice(2)] = rest[i + 1], i++;
}

if (!["image", "text"].includes(type) || !value) {
  console.error('Usage:\n  node add.mjs image <file-or-url> --caption "..." [--source URL] [--tags a,b]\n  node add.mjs text "<text>" [--caption "..."] [--source URL] [--tags a,b]');
  process.exit(1);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "clip";
const today = new Date().toISOString().slice(0, 10);

// Width/height from PNG, GIF or JPEG headers, so the wall doesn't jump while images load.
function size(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.toString("ascii", 0, 3) === "GIF") return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length) {
      if (buf[o] !== 0xff) break;
      const m = buf[o + 1], len = buf.readUInt16BE(o + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [buf.readUInt16BE(o + 7), buf.readUInt16BE(o + 5)];
      o += 2 + len;
    }
  }
  return null;
}

const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : [];
const id = `${today}-${slug(opts.caption || value)}`;
const clip = { id, type, date: today };

if (type === "image") {
  let buf, ext;
  if (/^https?:\/\//.test(value)) {
    const res = await fetch(value);
    if (!res.ok) { console.error(`Download failed: ${res.status}`); process.exit(1); }
    buf = Buffer.from(await res.arrayBuffer());
    ext = path.extname(new URL(value).pathname) || ".jpg";
    opts.source ??= value;
  } else {
    buf = fs.readFileSync(value);
    ext = path.extname(value) || ".jpg";
  }
  fs.mkdirSync(mediaDir, { recursive: true });
  const file = `${id}${ext.toLowerCase()}`;
  fs.writeFileSync(path.join(mediaDir, file), buf);
  clip.src = `media/${file}`;
  const wh = size(buf);
  if (wh) [clip.width, clip.height] = wh;
  if (opts.alt) clip.alt = opts.alt;
} else {
  clip.text = value;
}
if (opts.caption) clip.caption = opts.caption;
if (opts.source) clip.source = opts.source;
if (opts.tags) clip.tags = opts.tags.split(",").map((t) => t.trim()).filter(Boolean);

db.push(clip);
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + "\n");
console.log(`Added ${id}`);

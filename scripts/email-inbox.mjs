// Imports unread emails from approved senders as clippings.
// Subject = caption. Optional body lines: "source: <url>", "tags: a, b".
// Each image attachment becomes an image clipping; an email with no image becomes a text clipping of its body.
// Blank subject: if ANTHROPIC_API_KEY is set, Claude writes the caption in the house style.
import fs from "node:fs";
import path from "node:path";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dbPath = path.join(root, "clippings.json");
const mediaDir = path.join(root, "media");
const allowed = (process.env.ALLOWED_SENDERS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
if (!allowed.length) throw new Error("ALLOWED_SENDERS is empty; refusing to import.");

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "clip";
const today = new Date().toISOString().slice(0, 10);
const extFor = { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/heic": ".heic" };

function size(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.toString("ascii", 0, 3) === "GIF") return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length && buf[o] === 0xff) {
      const m = buf[o + 1], len = buf.readUInt16BE(o + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [buf.readUInt16BE(o + 7), buf.readUInt16BE(o + 5)];
      o += 2 + len;
    }
  }
  return null;
}

function parseBody(text) {
  const meta = {};
  const rest = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = line.match(/^\s*(source|tags)\s*:\s*(.+)$/i);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
    else rest.push(line);
  }
  // Drop signatures and quoted replies.
  const cut = rest.findIndex((l) => /^--\s*$/.test(l) || /^On .+wrote:$/.test(l));
  return { meta, body: (cut >= 0 ? rest.slice(0, cut) : rest).join("\n").trim() };
}

const captionRules = `Write a caption for an archived clipping. It reads like a museum wall label: a factual description of what it depicts, with a short descriptor for each person (nationality + role), the context, the outlet or medium, and the date. No commentary, no opinion.
Examples:
- Tweet by American entertainer Cher (@cher), posted to Twitter, August 18, 2012
- American actor Tom Cruise in an interview with Barbara Walters, 20/20, ABC, March 1990
Name a person only if visible text (a name, handle, on-screen caption) or the source says who they are. Never identify anyone from their face or appearance. If who, when, or where isn't shown, leave that part out rather than guess.
Reply with the caption only, one line, no quotes.`;

async function aiCaption(content) {
  if (!process.env.ANTHROPIC_API_KEY) return "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 200, system: captionRules, messages: [{ role: "user", content }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || res.status);
    return (data.content?.[0]?.text || "").trim().replace(/^["']|["']$/g, "");
  } catch (e) {
    console.log(`AI caption failed: ${e.message}`);
    return "";
  }
}
const sourceNote = (src) => (src ? [{ type: "text", text: `Source: ${src}` }] : []);

const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
const ids = new Set(db.map((c) => c.id));
const uniqueId = (base) => { let id = base, n = 2; while (ids.has(id)) id = `${base}-${n++}`; ids.add(id); return id; };

const client = new ImapFlow({
  host: "imap.gmail.com", port: 993, secure: true, logger: false,
  auth: { user: process.env.INBOX_USER, pass: process.env.INBOX_APP_PASSWORD },
});
await client.connect();
const lock = await client.getMailboxLock("INBOX");
let added = 0;
try {
  const uids = await client.search({ seen: false }, { uid: true });
  for (const uid of uids) {
    const msg = await client.fetchOne(uid, { source: true }, { uid: true });
    const mail = await simpleParser(msg.source);
    const from = (mail.from?.value?.[0]?.address || "").toLowerCase();
    await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    if (!allowed.includes(from)) { console.log(`Skipped mail from ${from}`); continue; }

    const caption = (mail.subject || "").replace(/^(fwd?|re):\s*/i, "").trim();
    const { meta, body } = parseBody(mail.text);
    const extra = {};
    if (caption) extra.caption = caption;
    if (meta.source) extra.source = meta.source;
    if (meta.tags) extra.tags = meta.tags.split(",").map((t) => t.trim()).filter(Boolean);

    const images = (mail.attachments || []).filter((a) => extFor[a.contentType]);
    if (images.length) {
      fs.mkdirSync(mediaDir, { recursive: true });
      for (const a of images) {
        const id = uniqueId(`${today}-${slug(caption || a.filename || "image")}`);
        const file = id + extFor[a.contentType];
        const cap = caption || (a.contentType === "image/heic" ? "" : await aiCaption([
          { type: "image", source: { type: "base64", media_type: a.contentType, data: a.content.toString("base64") } },
          ...sourceNote(meta.source),
        ]));
        fs.writeFileSync(path.join(mediaDir, file), a.content);
        const clip = { id, type: "image", date: today, src: `media/${file}` };
        const wh = size(a.content);
        if (wh) [clip.width, clip.height] = wh;
        db.push({ ...clip, ...extra, ...(cap && { caption: cap }) });
        added++;
      }
    } else if (body) {
      const cap = caption || await aiCaption([{ type: "text", text: body }, ...sourceNote(meta.source)]);
      db.push({ id: uniqueId(`${today}-${slug(cap || body)}`), type: "text", date: today, text: body, ...extra, ...(cap && { caption: cap }) });
      added++;
    }
  }
} finally {
  lock.release();
  await client.logout();
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + "\n");
console.log(`Added ${added} clipping(s).`);

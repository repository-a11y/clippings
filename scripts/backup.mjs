// Saves a zip of clippings.json + media/ into the Gmail account's "Clippings backups" label.
// Files go into parts of at most ~15 MB so each message stays under Gmail's size limit.
// Keeps the newest KEEP weekly backups and moves older ones to Trash. With --dry-run, writes the .eml files to backup-out/ instead.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FOLDER = "Clippings backups";
const KEEP = 8;
const PART_LIMIT = 15 * 1024 * 1024;
const dryRun = process.argv.includes("--dry-run");
const today = new Date().toISOString().slice(0, 10);

const files = ["clippings.json", ...fs.readdirSync(path.join(root, "media")).sort().map((f) => `media/${f}`)];
const parts = [[]];
let partSize = 0;
for (const f of files) {
  const n = fs.statSync(path.join(root, f)).size;
  if (partSize + n > PART_LIMIT && parts.at(-1).length) { parts.push([]); partSize = 0; }
  parts.at(-1).push(f);
  partSize += n;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clippings-backup-"));
const count = JSON.parse(fs.readFileSync(path.join(root, "clippings.json"), "utf8")).length;
const messages = parts.map((list, i) => {
  const label = parts.length > 1 ? ` (part ${i + 1} of ${parts.length})` : "";
  const name = `clippings-${today}${parts.length > 1 ? `-part${i + 1}` : ""}.zip`;
  const zipPath = path.join(tmp, name);
  execFileSync("zip", ["-q", "-X", zipPath, ...list], { cwd: root });
  const b64 = fs.readFileSync(zipPath).toString("base64").replace(/.{76}/g, "$&\r\n");
  const boundary = `b${Date.now()}${i}`;
  const text = `Backup of the clippings archive, ${today}: ${count} clippings, ${files.length - 1} media files.${label}\r\n` +
    `To restore: unzip ${parts.length > 1 ? "every part" : "the attachment"} into one folder; it is the site's clippings.json and media/.\r\n\r\n` +
    `Files in this message:\r\n${list.join("\r\n")}\r\n`;
  return [
    `From: Clippings backup <${process.env.INBOX_USER || "backup@localhost"}>`,
    `To: ${process.env.INBOX_USER || "backup@localhost"}`,
    `Subject: Clippings backup ${today}${label}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
    `--${boundary}`,
    `Content-Type: application/zip; name="${name}"`,
    `Content-Disposition: attachment; filename="${name}"`,
    "Content-Transfer-Encoding: base64",
    "",
    b64,
    `--${boundary}--`,
    "",
  ].join("\r\n");
});

if (dryRun) {
  const out = path.join(root, "backup-out");
  fs.mkdirSync(out, { recursive: true });
  messages.forEach((m, i) => fs.writeFileSync(path.join(out, `part${i + 1}.eml`), m));
  console.log(`Wrote ${messages.length} message(s) to backup-out/.`);
  process.exit(0);
}

const { ImapFlow } = await import("imapflow");
const client = new ImapFlow({
  host: "imap.gmail.com", port: 993, secure: true, logger: false,
  auth: { user: process.env.INBOX_USER, pass: process.env.INBOX_APP_PASSWORD },
});
await client.connect();
try {
  const boxes = await client.list();
  if (!boxes.some((b) => b.path === FOLDER)) await client.mailboxCreate(FOLDER);
  const trash = boxes.find((b) => b.specialUse === "\\Trash")?.path || "[Gmail]/Trash";

  const lock = await client.getMailboxLock(FOLDER);
  try {
    // Earlier backups, by date. A second run on the same day replaces that day's copy.
    const earlier = new Map();
    if (client.mailbox.exists) {
      for await (const msg of client.fetch("1:*", { envelope: true })) {
        const d = (msg.envelope?.subject || "").match(/^Clippings backup (\d{4}-\d{2}-\d{2})/)?.[1];
        if (d) earlier.set(msg.uid, d);
      }
    }
    for (const m of messages) await client.append(FOLDER, m, ["\\Seen"]);
    console.log(`Saved ${messages.length} message(s) to "${FOLDER}".`);

    const keep = new Set([...new Set(earlier.values())].filter((d) => d !== today).sort().slice(-(KEEP - 1)));
    const old = [...earlier].filter(([, d]) => !keep.has(d)).map(([uid]) => uid);
    if (old.length) {
      // In Gmail, deleting from a label only removes the label; move to Trash so old copies are actually removed.
      await client.messageMove(old, trash, { uid: true });
      console.log(`Removed ${old.length} old backup message(s).`);
    }
  } finally {
    lock.release();
  }
} finally {
  await client.logout();
}

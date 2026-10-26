# Clippings archive

Static site served by GitHub Pages from `main`. `clippings.json` is the archive; images live in `media/`. Pushing to `main` publishes.

## Adding a clipping

Use `node add.mjs image <file-or-url> --caption "..." [--source URL] [--tags a,b] [--alt "..."]` or `node add.mjs text "<text>" [--caption "..."] [--source URL] [--tags a,b]`, then commit and push.

## Caption style (Robert's rule)

Captions read like museum wall labels: a factual description of what the image depicts, with a short descriptor for each person (nationality + role), the context, the outlet or medium, and the date. No commentary, no opinion.
Examples:
- "Tweet by American entertainer Cher (@cher), posted to Twitter, August 18, 2012"
- "American actor Tom Cruise in an interview with Barbara Walters, 20/20, ABC, March 1990"

Name people only when the source page, on-screen text, or Robert says who they are. Never from their face. If who/when/where isn't established, ask Robert or leave that part out rather than guessing.

## Editing code

When changing `app.js` or `style.css`, bump the `?v=` number on both in `index.html` so browsers don't pair a new page with a cached old script.

## Email inbox

`.github/workflows/email-inbox.yml` runs every 5 minutes (only when repo variable `INBOX_ENABLED` is `true`) and runs `scripts/email-inbox.mjs`: unread Gmail messages from `ALLOWED_SENDERS` become clippings. Subject = caption; optional body lines `source: <url>` and `tags: a, b`; each image attachment = one image clipping; no image = text clipping of the body. Secrets: `INBOX_USER`, `INBOX_APP_PASSWORD` (Gmail app password), `ALLOWED_SENDERS` (comma-separated).

## Featured clipping

The top slot always holds an image: the most recently added image tagged `featured`, or if none is tagged, the most recently added image. It isn't repeated in the grid; other `featured` clippings appear in the grid normally. The tag itself isn't shown to visitors. Featured is hidden while searching.

## Order and text styles

The grid is shuffled on every page load (the featured clipping stays on top). Text clippings take an optional `style`: `quote` (largest, bold sans, for things people said), `headline` (bold serif, for news headlines/titles), `excerpt` (default, reading text in a card, for passages from articles/books), `note` (small monospace, for notes/captions/screens of text).

## Backup

`.github/workflows/backup.yml` runs Sundays 09:00 UTC (and on manual "Run workflow") and runs `scripts/backup.mjs`: zips `clippings.json` + `media/` and saves it as a read message under the Gmail label "Clippings backups" in the inbox account (same `INBOX_USER`/`INBOX_APP_PASSWORD` secrets). Large archives split into ~15 MB parts. Keeps the newest 8 backups. `node scripts/backup.mjs --dry-run` writes the messages to `backup-out/` to inspect.

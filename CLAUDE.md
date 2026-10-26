# Clippings archive

Static site served by GitHub Pages from `main`. `clippings.json` is the archive; images live in `media/`. Pushing to `main` publishes.

## Adding a clipping

Use `node add.mjs image <file-or-url> --caption "..." [--source URL] [--tags a,b] [--alt "..."]` or `node add.mjs text "<text>" [--caption "..."] [--source URL] [--tags a,b]`, then commit and push.

## Caption style (Robert's rule)

Image captions are a factual description of what the image depicts: who/what, the context, the outlet or source, and the date. No commentary.
Example: "Tom Cruise in an interview with Barbara Walters, 20/20 ABC, March 1990"

Name people only when the source page, on-screen text, or Robert says who they are. Never from their face. If who/when/where isn't established, ask Robert or leave that part out rather than guessing.

## Editing code

When changing `app.js` or `style.css`, bump the `?v=` number on both in `index.html` so browsers don't pair a new page with a cached old script.

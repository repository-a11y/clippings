# Clippings

A static archive for saved images and text. No build step, no database: `clippings.json` is the archive and `media/` holds the images.

## View locally

    python3 -m http.server -d .     # then open http://localhost:8000

(Opening index.html directly won't load the JSON; browsers block that.)

## Add a clipping

    node add.mjs image ~/Downloads/poster.jpg --caption "Concert poster, 1968" --source https://example.com/page --tags design,posters
    node add.mjs image https://example.com/photo.jpg --caption "..."          # downloads it into media/
    node add.mjs text "The quoted passage..." --caption "Who said it / why" --source https://... --tags reading

Or edit `clippings.json` by hand. Fields: `type` (image|text), `src`, `text`, `caption`, `source`, `date` (YYYY-MM-DD), `tags`, `alt`.

The `sample-*` entries and `media/sample-*.svg` are placeholders; delete them when you add your own.

## Use

Search box (press `/`), filter by type or tag, click any clipping to open it. Arrow keys step through, Esc closes.

## Hosting

Any static host works: GitHub Pages, Netlify, Cloudflare Pages. Push the folder and point the host at the root.

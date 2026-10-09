# Inspo Library

A personal shelf for design references (flyers, presentation decks and websites). Drop in a screenshot and it pulls out the colour palette and works out the format. You add a few notes, and it writes a prompt you can paste into Claude (or an image or design tool) to get something in the same style.

Plain HTML, CSS and JS. No build step, no dependencies, no account.

## Use it

- **Online:** once GitHub Pages is switched on (see below), it lives at `https://paulen101.github.io/f1-race/`.
- **Locally:** open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit `http://localhost:8000`.

## Daily flow

1. Pick a section in the top bar: **Flyers**, **Presentation decks** or **Websites**.
2. Add a reference: **Add reference**, drag files onto the page, or paste a screenshot with `Ctrl/Cmd + V`. You can add several at once; the forms open one after another.
3. Fill in what you noticed: style keywords, typography, layout, and what makes it work. The palette is pre-filled from the image; click a swatch to change it.
4. Click a card to see the details. **Detailed** gives a full brief for Claude or another code/design assistant. **Short** gives a one-liner for image generators or Canva. Paste it **together with the screenshot**: the prompt describes the reference, the image shows it.

Shortcuts: `/` focuses search, arrow keys move between sections, `Esc` closes a panel.

## Where your data lives

Everything is stored in this browser's IndexedDB. It does **not** sync between devices or browsers, and clearing site data wipes it. Use **Export backup** in the footer now and then; **Import backup** restores or merges a backup on any device.

Images are downscaled (2000px on the long edge, 1600px wide for website screenshots) and re-encoded on upload to keep storage small.

## Turning on GitHub Pages

The workflow in `.github/workflows/inspo-pages.yml` publishes this folder whenever it changes on `main`. It needs one setting first: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then re-run the workflow, or push any change to this folder.

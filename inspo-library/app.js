'use strict';

/* Inspo Library — a personal reference shelf for flyers, decks and websites.
   Everything lives in IndexedDB in this browser; images are stored as Blobs. */

const CATEGORIES = {
  flyer: { label: 'Flyer', plural: 'flyers' },
  deck: { label: 'Presentation deck', plural: 'presentation decks' },
  website: { label: 'Website', plural: 'websites' },
};

const MAX_EDGE = 2000;           // longest side for flyers/decks
const MAX_WEBSITE_WIDTH = 1600;  // full-page screenshots keep their height
const MAX_PIXELS = 14_000_000;   // stays under Safari's canvas area limit

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------- Storage ---------------- */

const db = (() => {
  let conn;
  const open = () => conn || (conn = new Promise((resolve, reject) => {
    const req = indexedDB.open('inspo-library', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('items', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const run = async (mode, fn) => {
    const store = (await open()).transaction('items', mode).objectStore('items');
    return new Promise((resolve, reject) => {
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  return {
    all: () => run('readonly', s => s.getAll()),
    put: item => run('readwrite', s => s.put(item)),
    remove: id => run('readwrite', s => s.delete(id)),
  };
})();

/* ---------------- State ---------------- */

const state = {
  items: [],
  cat: 'flyer',
  query: '',
  openId: null,
  variant: 'full',
  draft: null,        // item being created or edited
  queue: [],          // files waiting to be added after the current one
};

const urls = new Map(); // id -> object URL
function imageUrl(item) {
  if (!urls.has(item.id)) urls.set(item.id, URL.createObjectURL(item.image));
  return urls.get(item.id);
}
function dropUrl(id) {
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
  urls.delete(id);
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ---------------- Image processing ---------------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be read as an image.'));
    img.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function processImage(file, category) {
  const src = URL.createObjectURL(file);
  try {
    const img = await loadImage(src);
    let w = img.naturalWidth, h = img.naturalHeight;
    let scale = category === 'website' ? Math.min(1, MAX_WEBSITE_WIDTH / w) : Math.min(1, MAX_EDGE / Math.max(w, h));
    scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (w * h)));
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // flatten transparency so JPEG fallback doesn't go black
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    let blob = await canvasToBlob(canvas, 'image/webp', 0.86);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
    // Small originals can come out bigger after re-encoding; keep whichever is lighter.
    if (file.size < blob.size && scale === 1) blob = file;

    return { image: blob, width: w, height: h, palette: extractPalette(img) };
  } finally {
    URL.revokeObjectURL(src);
  }
}

/* Pulls up to six dominant, visually distinct colours. Coarse buckets keep
   anti-aliasing noise from splitting one colour into several near-duplicates. */
function extractPalette(img, max = 6) {
  const sw = 240;
  const sh = Math.max(1, Math.min(960, Math.round(sw * img.naturalHeight / img.naturalWidth)));
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
    const bk = buckets.get(key) || buckets.set(key, { r: 0, g: 0, b: 0, n: 0 }).get(key);
    bk.r += r; bk.g += g; bk.b += b; bk.n++;
  }
  const total = data.length / 4;
  const colours = [...buckets.values()]
    .map(b => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n }))
    .sort((a, b) => b.n - a.n);

  const picked = [];
  const far = (c, min) => picked.every(p => dist(p, c) > min);
  for (const col of colours) {
    if (picked.length >= max) break;
    if (far(col, 44)) picked.push(col);
  }
  // Accents are usually small in area; make sure a saturated one gets in.
  if (!picked.some(p => saturation(p) > 0.35)) {
    const accent = colours.find(col => saturation(col) > 0.4 && col.n / total > 0.002 && far(col, 30));
    if (accent) picked.splice(Math.min(picked.length, max - 1), 1, accent);
  }
  // Text is thin and anti-aliased, so it rarely wins on area. If nothing reads
  // well against the background, pull in the strongest-contrast colour present.
  const bg = picked[0] && toHex(picked[0]);
  if (bg) {
    const score = col => contrast(toHex(col), bg);
    const pickedBest = Math.max(0, ...picked.slice(1).map(score));
    const text = colours
      .filter(col => col.n / total > 0.0005)
      .reduce((best, col) => (!best || score(col) > score(best) ? col : best), null);
    if (text && score(text) >= 4.5 && score(text) - pickedBest > 2.5 && far(text, 20)) {
      if (picked.length >= max) picked.pop();
      picked.splice(1, 0, text);
    }
  }
  return picked.map(toHex);
}

function dist(a, b) {
  // Weighted RGB distance, close enough to perceptual for picking swatches.
  const rm = (a.r + b.r) / 2;
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3;
}
function saturation({ r, g, b }) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  const l = (mx + mn) / 2;
  return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
}
const toHex = ({ r, g, b }) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const fromHex = hex => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
function luminance(hex) {
  const lin = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const { r, g, b } = fromHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/* Assign roles: most common colour is the background, the highest-contrast one
   is the text, and the most saturated of the rest is the accent. */
function paletteRoles(palette) {
  if (!palette.length) return null;
  const [bg, ...rest] = palette;
  const text = rest.slice().sort((a, b) => contrast(b, bg) - contrast(a, bg))[0];
  const others = rest.filter(c => c !== text);
  const accent = others.slice().sort((a, b) => saturation(fromHex(b)) - saturation(fromHex(a)))[0];
  return { bg, text, accent, support: others.filter(c => c !== accent) };
}

/* ---------------- Format detection ---------------- */

function describeFormat(item) {
  const { width: w, height: h, category } = item;
  if (!w || !h) return null;
  const r = w / h;
  if (category === 'website') {
    const device = w < 700 ? 'Mobile' : 'Desktop';
    return h / w > 1.8 ? `${device}, long scrolling page` : `${device}, single viewport`;
  }
  const options = category === 'deck'
    ? [['16:9 widescreen slides', 16 / 9], ['4:3 slides', 4 / 3], ['1:1 square slides', 1], ['4:5 portrait carousel slides', 4 / 5]]
    : [['A4 portrait (210 x 297 mm)', 1 / Math.SQRT2], ['US Letter portrait (8.5 x 11 in)', 8.5 / 11],
      ['4:5 portrait social post', 4 / 5], ['1:1 square post', 1], ['9:16 story', 9 / 16],
      ['2:3 poster', 2 / 3], ['A4 landscape', Math.SQRT2], ['16:9 landscape', 16 / 9]];
  return options.reduce((best, o) => Math.abs(Math.log(o[1] / r)) < Math.abs(Math.log(best[1] / r)) ? o : best)[0];
}

function aspectLabel(item) {
  const fmt = describeFormat(item) || '';
  const m = fmt.match(/\d+:\d+/);
  if (m) return m[0];
  if (fmt.startsWith('A4 portrait')) return '1:1.41';
  if (fmt.startsWith('US Letter')) return '8.5:11';
  if (fmt.startsWith('A4 landscape')) return '1.41:1';
  return '';
}

/* ---------------- Prompt builder ---------------- */

function buildPrompt(item, variant) {
  const roles = paletteRoles(item.palette || []);
  const tags = (item.tags || []).join(', ');
  const fmt = describeFormat(item);

  if (variant === 'short') {
    const parts = [];
    const kind = { flyer: 'flyer', deck: 'presentation slide', website: 'website homepage' }[item.category];
    parts.push(`A ${tags ? tags + ' ' : ''}${kind}`);
    if (roles) parts.push(`colour palette ${[roles.bg, roles.text, roles.accent, ...roles.support].filter(Boolean).join(', ')}`);
    if (item.typography) parts.push(item.typography.toLowerCase());
    if (item.layout) parts.push(item.layout.toLowerCase());
    if (item.details) parts.push(item.details.toLowerCase());
    if (item.category !== 'website' && aspectLabel(item)) parts.push(`aspect ratio ${aspectLabel(item)}`);
    return parts.join(', ').replace(/\.(?=,|$)/g, '') + '.';
  }

  const L = [];
  const intro = {
    flyer: 'Design a flyer that recreates the visual style of the reference below. Keep the look; swap in my content.',
    deck: 'Design a presentation deck that recreates the visual style of the reference below. Keep the look; swap in my content.',
    website: 'Build a website page that recreates the look and feel of the reference below. Match the visual system closely; swap in my content.',
  }[item.category];
  L.push(intro);
  L.push('I have attached a screenshot of the reference. Treat it as the source of truth wherever this brief is vague.');
  L.push('');
  L.push(`Reference: ${item.title}${item.source ? ` (${item.source})` : ''}`);
  if (tags) L.push(`Style: ${tags}`);
  if (fmt) L.push(`Format: ${fmt}`);

  if (roles) {
    L.push('', 'Colour palette');
    L.push(`- Background: ${roles.bg}`);
    if (roles.text) L.push(`- Text: ${roles.text}`);
    if (roles.accent) L.push(`- Accent: ${roles.accent}`);
    if (roles.support.length) L.push(`- Supporting: ${roles.support.join(', ')}`);
  }

  const spec = [['Typography', item.typography], ['Layout', item.layout], ['Details to keep', item.details], ['Notes', item.notes]]
    .filter(([, v]) => v && v.trim());
  if (spec.length) {
    L.push('');
    spec.forEach(([k, v]) => L.push(`${k}: ${v.trim()}`));
  }

  L.push('', 'Requirements');
  if (item.category === 'website') {
    L.push(
      '- Responsive from 375px to 1440px wide with no horizontal scroll.',
      '- Semantic HTML, visible hover and focus states, transitions between 150 and 400ms, and respect prefers-reduced-motion.',
      '- Use realistic placeholder copy for [my brand / product]. No lorem ipsum, emoji or stock gradients.',
      '- Deliver a single HTML file with inline CSS and JS.',
    );
  } else if (item.category === 'deck') {
    L.push(
      `- ${fmt || '16:9'} format. Build these slides: title, agenda, section divider, content with image, key number or chart, quote, closing.`,
      '- One consistent margin grid and type scale across every slide; max one idea per slide.',
      '- Content placeholder: [topic, audience, key points].',
    );
  } else {
    L.push(
      `- ${fmt || 'A4 portrait'}, print-ready with 3mm bleed.`,
      '- One dominant headline, then a clear hierarchy: date / time / place, short supporting line, call to action.',
      '- Content placeholder: [event or product name, date, location, CTA, contact].',
    );
  }
  return L.join('\n');
}

/* ---------------- Rendering ---------------- */

const grid = $('#grid');

function matches(item, q) {
  if (!q) return true;
  const hay = [item.title, item.source, item.typography, item.layout, item.details, item.notes, ...(item.tags || [])]
    .join(' ').toLowerCase();
  return q.split(/\s+/).every(word => hay.includes(word));
}

function render({ stagger = true } = {}) {
  const inCat = state.items.filter(i => i.category === state.cat);
  const visible = inCat.filter(i => matches(i, state.query));

  grid.dataset.cat = state.cat;
  grid.replaceChildren(...visible.map((item, i) => card(item, stagger ? Math.min(i, 14) : 0)));

  $('#empty').hidden = inCat.length > 0;
  $('#no-results').hidden = !(inCat.length && !visible.length);
  $('#empty-cat').textContent = CATEGORIES[state.cat].plural;
  $('#veil-cat').textContent = CATEGORIES[state.cat].plural;

  for (const key of Object.keys(CATEGORIES)) {
    $(`[data-count="${key}"]`).textContent = state.items.filter(i => i.category === key).length;
  }
}

function card(item, index) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'card';
  el.dataset.id = item.id;
  el.style.setProperty('--i', index);

  const frame = document.createElement('div');
  frame.className = 'card-frame';
  const img = document.createElement('img');
  img.src = imageUrl(item);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  frame.append(img);

  if (item.palette && item.palette.length) {
    const strip = document.createElement('div');
    strip.className = 'card-strip';
    item.palette.forEach(hex => {
      const s = document.createElement('span');
      s.style.background = hex;
      strip.append(s);
    });
    frame.append(strip);
  }

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const title = document.createElement('p');
  title.className = 'card-title';
  title.textContent = item.title;
  const sub = document.createElement('p');
  sub.className = 'card-sub';
  sub.textContent = item.tags && item.tags.length ? item.tags.join(' · ') : hostOf(item.source) || formatDate(item.createdAt);
  meta.append(title, sub);

  el.append(frame, meta);
  return el;
}

function hostOf(url) {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { return ''; }
}
const formatDate = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/* ---------------- Tabs ---------------- */

const tabs = $$('.tab');
const indicator = $('.tab-indicator');

function moveIndicator() {
  const active = tabs.find(t => t.dataset.cat === state.cat);
  indicator.style.width = active.offsetWidth + 'px';
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

function withTransition(update) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return document.startViewTransition(update);
  }
  update();
  return null;
}

function selectTab(cat, { focus = false } = {}) {
  if (!CATEGORIES[cat]) return;
  const changed = cat !== state.cat;
  state.cat = cat;
  tabs.forEach(t => {
    const on = t.dataset.cat === cat;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  $('#library').setAttribute('aria-labelledby', `tab-${cat}`);
  moveIndicator();
  if (location.hash.slice(1) !== cat) history.replaceState(null, '', '#' + cat);
  if (changed) withTransition(() => render());
}

tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab.dataset.cat)));
$('.taskbar').addEventListener('keydown', e => {
  const i = tabs.findIndex(t => t.dataset.cat === state.cat);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  selectTab(tabs[(next + tabs.length) % tabs.length].dataset.cat, { focus: true });
});
window.addEventListener('resize', moveIndicator);
document.fonts && document.fonts.ready.then(moveIndicator);

/* ---------------- Dialog helpers ---------------- */

function openSheet(dialog) {
  dialog.classList.remove('closing');
  if (!dialog.open) dialog.showModal();
}

function closeSheet(dialog) {
  if (!dialog.open || dialog.classList.contains('closing')) return Promise.resolve();
  return new Promise(resolve => {
    let timer;
    const onEnd = e => { if (e.target === dialog && e.animationName === 'sheet-out') done(); };
    // Runs exactly once, and detaches the listener so a later open animation can't trigger a stale close.
    const done = () => {
      clearTimeout(timer);
      dialog.removeEventListener('animationend', onEnd);
      dialog.classList.remove('closing');
      dialog.close();
      resolve();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    dialog.classList.add('closing');
    dialog.addEventListener('animationend', onEnd);
    timer = setTimeout(done, 320); // in case animationend never fires
  });
}

$$('dialog').forEach(dialog => {
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeSheet(dialog); });
  dialog.addEventListener('click', e => {
    if (e.target === dialog || e.target.closest('[data-close]')) closeSheet(dialog); // backdrop or close button
  });
  // 'close' also fires when the browser force-closes (e.g. Esc pressed twice), so cleanup lives here.
  dialog.addEventListener('close', () => afterClose(dialog));
});

function afterClose(dialog) {
  if (dialog.id === 'detail') {
    const el = grid.querySelector(`[data-id="${state.openId}"]`);
    state.openId = null;
    el && el.focus({ preventScroll: true });
  }
  if (dialog.id === 'editor') {
    state.draft = null;
    nextInQueue();
  }
}

/* ---------------- Detail view ---------------- */

const detail = $('#detail');

function openDetail(id, fromCard) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  state.openId = id;
  const cardImg = fromCard && fromCard.querySelector('img');
  const dImg = $('#d-img');

  const show = () => {
    fillDetail(item);
    if (cardImg) cardImg.style.viewTransitionName = '';
    dImg.style.viewTransitionName = 'hero';
    openSheet(detail);
  };

  if (cardImg && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cardImg.style.viewTransitionName = 'hero';
    detail.classList.add('no-anim');
    const t = document.startViewTransition(show);
    t.finished.finally(() => {
      dImg.style.viewTransitionName = '';
      detail.classList.remove('no-anim');
    });
  } else {
    show();
  }
}

function fillDetail(item) {
  $('#d-cat').textContent = CATEGORIES[item.category].label + ' · added ' + formatDate(item.createdAt);
  $('#d-title').textContent = item.title;
  $('#d-img').src = imageUrl(item);
  $('#d-img').alt = item.title;
  $('#d-media').classList.toggle('contain', item.category !== 'website');
  $('#d-media').scrollTop = 0;

  const src = $('#d-source');
  src.hidden = !item.source;
  src.href = item.source || '#';
  src.textContent = item.source ? item.source.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') + ' ↗' : '';

  $('#d-tags').replaceChildren(...(item.tags || []).map(t => {
    const li = document.createElement('li');
    li.textContent = t;
    return li;
  }));

  $('#d-palette').replaceChildren(...(item.palette || []).map(hex => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.title = 'Copy ' + hex;
    b.innerHTML = `<span class="chip" style="background:${hex}"></span>${hex}`;
    b.addEventListener('click', () => copy(hex, `Copied ${hex}`));
    li.append(b);
    return li;
  }));
  $('#d-palette').closest('.block').hidden = !(item.palette && item.palette.length);

  const facts = [['Format', describeFormat(item)], ['Typography', item.typography], ['Layout', item.layout], ['What makes it work', item.details]]
    .filter(([, v]) => v);
  $('#d-facts').replaceChildren(...facts.flatMap(([k, v]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    const wrap = document.createElement('div');
    wrap.append(dt, dd);
    return wrap;
  }));

  $('#d-notes').textContent = item.notes || '';
  $('#d-notes-block').hidden = !item.notes;

  setVariant(state.variant, false);
}

function setVariant(variant, animate = true) {
  state.variant = variant;
  $$('.seg [data-variant]').forEach(b => b.setAttribute('aria-checked', b.dataset.variant === variant));
  const item = state.items.find(i => i.id === state.openId);
  if (!item) return;
  const pre = $('#d-prompt');
  if (!animate) { pre.textContent = buildPrompt(item, variant); return; }
  pre.classList.add('swap');
  setTimeout(() => {
    pre.textContent = buildPrompt(item, variant);
    pre.scrollTop = 0;
    pre.classList.remove('swap');
  }, 150);
}

grid.addEventListener('click', e => {
  const el = e.target.closest('.card');
  if (el) openDetail(el.dataset.id, el);
});
$$('.seg [data-variant]').forEach(b => b.addEventListener('click', () => setVariant(b.dataset.variant)));
$('#copy-prompt').addEventListener('click', () => copy($('#d-prompt').textContent, 'Prompt copied'));

$('#edit-btn').addEventListener('click', async () => {
  const item = state.items.find(i => i.id === state.openId);
  await closeSheet(detail);
  state.openId = null;
  openEditor({ ...item, tags: [...(item.tags || [])], palette: [...(item.palette || [])] }, { isNew: false });
});

$('#delete-btn').addEventListener('click', async () => {
  const item = state.items.find(i => i.id === state.openId);
  if (!item || !confirm(`Delete "${item.title}"? This can't be undone.`)) return;
  await db.remove(item.id);
  await closeSheet(detail);
  state.openId = null;
  state.items = state.items.filter(i => i.id !== item.id);
  const el = grid.querySelector(`[data-id="${item.id}"]`);
  const finish = () => { dropUrl(item.id); render({ stagger: false }); updateStorageNote(); };
  if (el) {
    el.classList.add('leaving');
    el.addEventListener('animationend', finish, { once: true });
  } else finish();
  toast('Deleted');
});

/* ---------------- Editor (add + edit) ---------------- */

const editor = $('#editor');
const form = $('#editor-form');
let draftPreviewUrl = null;

function setDraftPreview(blob) {
  if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
  draftPreviewUrl = URL.createObjectURL(blob);
  $('#e-img').src = draftPreviewUrl;
}

function openEditor(draft, { isNew }) {
  state.draft = { ...draft, isNew };
  $('#e-heading').textContent = isNew ? 'New reference' : 'Edit reference';
  $('#save-btn').textContent = isNew ? 'Save to library' : 'Save changes';
  setDraftPreview(draft.image);

  form.category.value = draft.category;
  form.title.value = draft.title || '';
  form.source.value = draft.source || '';
  form.tags.value = (draft.tags || []).join(', ');
  form.typography.value = draft.typography || '';
  form.layout.value = draft.layout || '';
  form.details.value = draft.details || '';
  form.notes.value = draft.notes || '';
  renderPaletteEditor();

  openSheet(editor);
  $('.editor-body').scrollTop = 0;
  requestAnimationFrame(() => form.title.focus());
}

function renderPaletteEditor() {
  const wrap = $('#e-palette');
  const swatches = state.draft.palette.map((hex, i) => {
    const label = document.createElement('label');
    label.style.background = hex;
    label.title = hex;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = hex;
    input.setAttribute('aria-label', `Colour ${i + 1}, ${hex}`);
    input.addEventListener('input', () => {
      state.draft.palette[i] = input.value;
      label.style.background = input.value;
      label.title = input.value;
    });
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'remove';
    rm.textContent = '×';
    rm.setAttribute('aria-label', `Remove ${hex}`);
    rm.addEventListener('click', e => {
      e.preventDefault();
      state.draft.palette.splice(i, 1);
      renderPaletteEditor();
    });
    label.append(input, rm);
    return label;
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-swatch';
  add.textContent = '+';
  add.setAttribute('aria-label', 'Add colour');
  add.hidden = state.draft.palette.length >= 8;
  add.addEventListener('click', () => {
    state.draft.palette.push('#888888');
    renderPaletteEditor();
    $$('#e-palette input').at(-1).click();
  });
  wrap.replaceChildren(...swatches, add);
}

$('#e-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const processed = await processImage(file, form.category.value);
    Object.assign(state.draft, processed);
    setDraftPreview(processed.image);
    renderPaletteEditor();
  } catch (err) {
    toast(err.message);
  }
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const d = state.draft;
  const now = Date.now();
  const item = {
    id: d.id || uid(),
    category: form.category.value,
    title: form.title.value.trim(),
    source: normaliseUrl(form.source.value.trim()),
    tags: form.tags.value.split(',').map(t => t.trim()).filter(Boolean),
    typography: form.typography.value.trim(),
    layout: form.layout.value.trim(),
    details: form.details.value.trim(),
    notes: form.notes.value.trim(),
    palette: d.palette,
    image: d.image,
    width: d.width,
    height: d.height,
    createdAt: d.createdAt || now,
    updatedAt: now,
  };

  try {
    await db.put(item);
  } catch (err) {
    toast(err.name === 'QuotaExceededError' ? 'Browser storage is full. Export a backup and delete a few items.' : 'Could not save: ' + err.message);
    return;
  }
  if (d.isNew && navigator.storage && navigator.storage.persist) navigator.storage.persist();

  dropUrl(item.id);
  const idx = state.items.findIndex(i => i.id === item.id);
  if (idx >= 0) state.items[idx] = item; else state.items.unshift(item);

  const wasNew = d.isNew;
  state.draft = null;
  await closeSheet(editor);

  if (item.category !== state.cat) selectTab(item.category);
  else render({ stagger: false });
  updateStorageNote();

  if (wasNew) {
    const el = grid.querySelector(`[data-id="${item.id}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    toast('Saved');
  } else {
    openDetail(item.id, grid.querySelector(`[data-id="${item.id}"]`));
  }
});

function normaliseUrl(v) {
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}

/* ---------------- Adding files ---------------- */

function titleFromFile(name) {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  if (/^(image|screenshot|screen shot|img[_-]?\d|photo|untitled)/i.test(base)) return '';
  return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function addFiles(files) {
  const images = [...files].filter(f => f.type.startsWith('image/'));
  if (!images.length) { toast('Only image files can be added'); return; }
  state.queue.push(...images);
  if (!state.draft && !editor.open) nextInQueue();
}

async function nextInQueue() {
  const file = state.queue.shift();
  if (!file) return;
  try {
    const processed = await processImage(file, state.cat);
    openEditor({ category: state.cat, title: titleFromFile(file.name || ''), tags: [], ...processed }, { isNew: true });
    if (state.queue.length) toast(`${state.queue.length} more waiting after this one`);
  } catch (err) {
    toast(err.message);
    nextInQueue();
  }
}

const fileInput = $('#file-input');
fileInput.multiple = true;
$('#add-btn').addEventListener('click', () => fileInput.click());
$('#empty-add').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

let dragDepth = 0;
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', e => {
  if (!hasFiles(e) || editor.open) return;
  dragDepth++;
  document.body.classList.add('dragging');
});
window.addEventListener('dragleave', e => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('dragging');
});
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  if (!editor.open) addFiles(e.dataTransfer.files);
});

window.addEventListener('paste', e => {
  if (editor.open || detail.open) return;
  const files = [...(e.clipboardData ? e.clipboardData.files : [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});

/* ---------------- Search + shortcuts ---------------- */

const search = $('#search');
search.addEventListener('input', () => {
  state.query = search.value.trim().toLowerCase();
  render({ stagger: false });
});
window.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.closest('input, textarea') && !$('dialog[open]')) {
    e.preventDefault();
    search.focus();
  }
  if (e.key === 'Escape' && e.target === search && search.value) {
    search.value = '';
    search.dispatchEvent(new Event('input'));
  }
});

/* ---------------- Clipboard + toast ---------------- */

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    (document.querySelector('dialog[open]') || document.body).append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(message);
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  // Keep the toast above an open modal, which sits in the top layer.
  const host = document.querySelector('dialog[open]') || document.body;
  if (el.parentElement !== host) host.append(el);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- Backup ---------------- */

const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

$('#export-btn').addEventListener('click', async () => {
  if (!state.items.length) { toast('Nothing to export yet'); return; }
  const items = await Promise.all(state.items.map(async i => ({ ...i, image: await blobToDataUrl(i.image) })));
  const blob = new Blob([JSON.stringify({ app: 'inspo-library', version: 1, exportedAt: new Date().toISOString(), items })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inspo-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${items.length} reference${items.length === 1 ? '' : 's'}`);
});

$('#import-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'inspo-library' || !Array.isArray(data.items)) throw new Error('Not an Inspo Library backup');
    let count = 0;
    for (const raw of data.items) {
      if (!raw.id || !CATEGORIES[raw.category] || typeof raw.image !== 'string' || !raw.image.startsWith('data:image/')) continue;
      const image = await (await fetch(raw.image)).blob();
      const item = { ...raw, image };
      await db.put(item);
      dropUrl(item.id);
      count++;
    }
    state.items = await loadItems();
    render();
    updateStorageNote();
    toast(`Imported ${count} reference${count === 1 ? '' : 's'}`);
  } catch (err) {
    toast('Import failed: ' + err.message);
  }
});

async function updateStorageNote() {
  const note = $('#storage-note');
  let text = 'Saved in this browser only. Export a backup now and then.';
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage } = await navigator.storage.estimate();
      if (usage) {
        const size = usage < 1048576 ? `${Math.max(1, Math.round(usage / 1024))} KB` : `${(usage / 1048576).toFixed(1)} MB`;
        text = `Saved in this browser only · ${size} used. Export a backup now and then.`;
      }
    }
  } catch { /* estimate is optional */ }
  note.textContent = text;
}

/* ---------------- Boot ---------------- */

async function loadItems() {
  const items = await db.all();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

(async function init() {
  const fromHash = location.hash.slice(1);
  if (CATEGORIES[fromHash]) state.cat = fromHash;
  selectTab(state.cat);
  try {
    state.items = await loadItems();
  } catch (err) {
    toast('Storage is unavailable in this browser mode (private window?)');
  }
  render();
  updateStorageNote();
})();

window.addEventListener('hashchange', () => selectTab(location.hash.slice(1)));

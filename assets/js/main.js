/* ================================================
   PURPLEHAT PUBLISHING — MAIN JAVASCRIPT
   ================================================

   CONTENT — two sources, tried in order:
   1. Google Sheet (if CONFIG.sheetId is set)       ← preferred
   2. Fallback arrays below                          ← used until sheet is set up

   GOOGLE SHEET SETUP:
     1. Create a Google Sheet with two tabs named exactly:  Novels  and  FanArt
     2. Add column headers in row 1 (see column guide below)
     3. File → Share → Share with others → set to "Anyone with the link" → Viewer
     4. Copy the Sheet ID from the URL:
          https://docs.google.com/spreadsheets/d/ ►SHEET_ID◄ /edit
     5. Paste it into CONFIG.sheetId below

   NOVELS tab columns (row 1 headers, order doesn't matter):
     id          | URL slug, e.g.  the-iron-crown
     title       | Full title
     subtitle    | Optional subtitle (leave blank if none)
     tagline     | Short one-liner for carousel card
     synopsis    | Full blurb (can be long — Google Sheets handles multiline)
     cover       | Full image URL (GitHub raw URL, imgur, etc.) — blank if none
     genres      | Pipe-separated, e.g.  Fantasy|Adventure|Epic
     featured    | TRUE to show on home page, FALSE otherwise
     chapterFile | URL to a .txt file, or blank
     buyLabel    | Button text, e.g.  Buy on Amazon  (blank = no button)
     buyUrl      | Purchase URL (blank = no button)

   FANART tab columns:
     id    | Unique identifier, e.g.  art-1
     src   | Full image URL
     title | Display title
     alt   | Accessibility description

   SOCIAL_LINKS — update the four URLs below with real profile links.

   ================================================ */


/* ─── CONFIGURATION ───────────────────────────────── */

const CONFIG = {
  // Paste your Google Sheet ID here once the sheet is set up.
  // Leave as null to use the fallback arrays below.
  sheetId: '1ylYmry1A-C4a-PL5V4H-DR4bI8rGd4ftjh9Gt0lkO1Y',   // e.g. '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'
};


/* ─── FALLBACK NOVEL DATA ─────────────────────────── */
/* Used when CONFIG.sheetId is null or the fetch fails. */

let NOVELS = [
  {
    id: 'novel-one',
    title: 'Title Coming Soon',
    subtitle: '',
    tagline: 'An epic fantasy adventure awaits',
    synopsis: 'The full synopsis for this novel will appear here. Replace this placeholder text with your own description — the world, the stakes, and the hero who must face them.',
    cover: null,
    genres: ['Fantasy', 'Adventure'],
    featured: true,
    chapterFile: null,
    buyLinks: []
  },
];


/* ─── FALLBACK FAN ART DATA ───────────────────────── */
/* Used when CONFIG.sheetId is null or the fetch fails. */

let FANART = [
  // { id: 'art-1', src: 'https://...', title: 'Concept Art 1', alt: 'Description' },
];


/* ─── SOCIAL LINKS ────────────────────────────────── */

const SOCIAL_LINKS = {
  instagram: '#',   // e.g. 'https://www.instagram.com/yourhandle'
  facebook:  '#',   // e.g. 'https://www.facebook.com/yourpage'
  tiktok:    '#',   // e.g. 'https://www.tiktok.com/@yourhandle'
  amazon:    '#'    // e.g. 'https://www.amazon.com/author/yourname'
};


/* ================================================
   INITIALISATION
   ================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  renderFooter();
  initScrollReveal();
  await loadSheetData();   // replaces NOVELS / FANART if sheet is configured
  renderFeaturedNovels();
  renderNovelCards();
  renderFanArt();
  initCarousel();
  initChapterModal();
  initLightbox();
  initNovelDetail();
});


/* ─── GOOGLE SHEETS DATA LOADER ───────────────────── */

async function loadSheetData() {
  if (!CONFIG.sheetId) return;

  const base = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&sheet=`;

  await Promise.all([
    fetchSheet(base + 'Novels')
      .then(rows => { if (rows.length) NOVELS = parseNovels(rows); })
      .catch(() => { /* network failure — keep fallback array */ }),

    fetchSheet(base + 'FanArt')
      .then(rows => { if (rows.length) FANART = parseFanArt(rows); })
      .catch(() => { /* network failure — keep fallback array */ }),
  ]);
  // Debug: list loaded IDs (helps diagnose mismatches between sheet and fallback)
  try { console.debug('loadSheetData: NOVELS ids =', NOVELS.map(n => n.id)); } catch (e) { /* ignore */ }
}

/* Fetch a sheet tab and return an array of row objects keyed by header name */
async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1)
    .map(cells => Object.fromEntries(headers.map((h, i) => [h, (cells[i] || '').trim()])))
    .filter(r => Object.values(r).some(v => v)); // skip fully blank rows
}

/* RFC 4180 CSV parser — handles quoted fields, embedded commas, newlines */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"')                   { inQuotes = false; }
      else                                   { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else if (ch === '\r') { /* skip */ }
      else                  { field += ch; }
    }
  }
  row.push(field);
  if (row.some(f => f)) rows.push(row);
  return rows;
}

/* Map sheet rows → NOVELS array entries */
function parseNovels(rows) {
  return rows
    .filter(r => r.id && r.title)
    .map(r => ({
      id:          r.id,
      title:       r.title,
      subtitle:    r.subtitle  || '',
      tagline:     r.tagline   || '',
      synopsis:    r.synopsis  || '',
      cover:       r.cover     || null,
      genres:      r.genres ? r.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
      featured:    r.featured?.toLowerCase() === 'true',
      chapterFile: r.chapterfile || null,
      buyLinks:    (r.buylabel && r.buyurl) ? [{ label: r.buylabel, url: r.buyurl }] : [],
    }));
}

/* Map sheet rows → FANART array entries */
function parseFanArt(rows) {
  return rows
    .filter(r => r.id && r.src)
    .map(r => ({
      id:    r.id,
      src:   r.src,
      title: r.title || '',
      alt:   r.alt   || r.title || '',
    }));
}


/* ─── NAVIGATION ──────────────────────────────────── */

function initNav() {
  // Highlight the active page link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Mobile hamburger / overlay
  const toggle = document.querySelector('.nav-toggle');
  const overlay = document.querySelector('.nav-overlay');
  const overlayClose = document.querySelector('.nav-overlay-close');

  if (toggle && overlay) {
    toggle.addEventListener('click', () => overlay.classList.add('open'));
    overlayClose?.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => overlay.classList.remove('open'));
    });
  }
}


/* ─── FOOTER ──────────────────────────────────────── */

function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-divider"></div>
      <div class="footer-socials">
        <a href="${SOCIAL_LINKS.instagram}" class="footer-social-link" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
          <i class="fab fa-instagram" aria-hidden="true"></i>
          <span>Instagram</span>
        </a>
        <a href="${SOCIAL_LINKS.facebook}" class="footer-social-link" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
          <i class="fab fa-facebook-f" aria-hidden="true"></i>
          <span>Facebook</span>
        </a>
        <a href="${SOCIAL_LINKS.tiktok}" class="footer-social-link" aria-label="TikTok" target="_blank" rel="noopener noreferrer">
          <i class="fab fa-tiktok" aria-hidden="true"></i>
          <span>TikTok</span>
        </a>
        <a href="${SOCIAL_LINKS.amazon}" class="footer-social-link" aria-label="Amazon Author Page" target="_blank" rel="noopener noreferrer">
          <i class="fab fa-amazon" aria-hidden="true"></i>
          <span>Amazon</span>
        </a>
      </div>
      <p class="footer-copy">&copy; ${new Date().getFullYear()} Purplehat Publishing &middot; All rights reserved</p>
    </div>
  `;
}


/* ─── SCROLL REVEAL ───────────────────────────────── */

function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  elements.forEach(el => observer.observe(el));
}


/* ─── FEATURED NOVELS — HOME PAGE ─────────────────── */

function renderFeaturedNovels() {
  const container = document.getElementById('featured-novels');
  if (!container) return;

  const featured = NOVELS.filter(n => n.featured);

  if (!featured.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--color-muted);font-style:italic">Novels coming soon.</p>';
    return;
  }

  container.innerHTML = featured.map(novel => {
    const coverHtml = novel.cover
      ? `<img src="${novel.cover}" alt="${escapeAttr(novel.title)} cover">`
      : coverPlaceholderHtml(novel.title);

    const chapterBtn = (novel.chapterFile !== undefined)
      ? `<button class="btn btn-outline" data-chapter="${novel.id}" style="margin-top:0.5rem">Read First Chapter</button>`
      : '';

    return `
      <div class="featured-novel-card reveal">
        <a href="novel-detail.html?id=${novel.id}" class="cover-wrap" aria-label="${escapeAttr(novel.title)}">
          ${coverHtml}
        </a>
        <h3><a href="novel-detail.html?id=${novel.id}" style="color:var(--color-gold)">${novel.title}</a></h3>
        ${novel.tagline ? `<p class="feat-tagline">${novel.tagline}</p>` : ''}
        ${chapterBtn}
      </div>
    `;
  }).join('');

  // Cards were injected after initScrollReveal() ran — re-observe new .reveal elements
  initScrollReveal();
}


/* ─── NOVEL CAROUSEL — NOVELS PAGE ────────────────── */

function renderNovelCards() {
  const track = document.querySelector('.carousel-track');
  if (!track) return;

  if (!NOVELS.length) {
    track.closest('.carousel-wrapper').innerHTML =
      '<p style="text-align:center;color:var(--color-muted);font-style:italic;padding:3rem">Novels coming soon.</p>';
    return;
  }

  track.innerHTML = NOVELS.map(novel => {
    const coverHtml = novel.cover
      ? `<img src="${novel.cover}" alt="${escapeAttr(novel.title)} cover" loading="lazy">`
      : coverPlaceholderHtml(novel.title);

    return `
      <div class="novel-card" data-id="${novel.id}" role="button" tabindex="0" aria-label="View ${escapeAttr(novel.title)}">
        <div class="novel-card-cover">${coverHtml}</div>
        <div class="novel-card-info">
          <h3>${novel.title}</h3>
          ${novel.tagline ? `<p class="novel-card-tagline">${novel.tagline}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Click / keyboard navigation to detail page
  track.querySelectorAll('.novel-card').forEach(card => {
    const go = () => { window.location.href = `novel-detail.html?id=${card.dataset.id}`; };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}


/* ─── CAROUSEL LOGIC ──────────────────────────────── */

function initCarousel() {
  const track = document.querySelector('.carousel-track');
  if (!track) return;

  const prevBtn = document.querySelector('.carousel-btn-prev');
  const nextBtn = document.querySelector('.carousel-btn-next');
  let currentIndex = 0;
  let startX = 0;
  let isDragging = false;

  function getVisibleCount() {
    if (window.innerWidth < 768) return 1;
    if (window.innerWidth < 1100) return 2;
    return 3;
  }

  function getStepWidth() {
    const cards = track.querySelectorAll('.novel-card');
    if (!cards.length) return 0;
    const gap = 28; // matches CSS gap: 1.75rem ≈ 28px
    return cards[0].offsetWidth + gap;
  }

  function totalCards() {
    return track.querySelectorAll('.novel-card').length;
  }

  function clampIndex() {
    const max = Math.max(0, totalCards() - getVisibleCount());
    currentIndex = Math.min(Math.max(0, currentIndex), max);
  }

  function updateTrack() {
    clampIndex();
    track.style.transform = `translateX(-${currentIndex * getStepWidth()}px)`;
    const max = Math.max(0, totalCards() - getVisibleCount());
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= max;
  }

  prevBtn?.addEventListener('click', () => { currentIndex--; updateTrack(); });
  nextBtn?.addEventListener('click', () => { currentIndex++; updateTrack(); });

  // Touch/pointer swipe — hasMoved flag prevents click suppression on tap
  let hasMoved = false;

  track.addEventListener('pointerdown', e => {
    startX = e.clientX;
    isDragging = true;
    hasMoved = false;
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener('pointermove', e => {
    if (!isDragging) return;
    if (Math.abs(e.clientX - startX) > 6) {
      hasMoved = true;
      e.preventDefault(); // only prevent scroll when actually dragging
    }
  }, { passive: false });

  track.addEventListener('pointerup', e => {
    if (!isDragging) return;
    isDragging = false;

    if (!hasMoved) {
      // Tap — pointer capture sends events to track, so find the card manually
      const card = document.elementFromPoint(e.clientX, e.clientY)?.closest('.novel-card');
      if (card?.dataset.id) {
        window.location.href = `novel-detail.html?id=${card.dataset.id}`;
      }
      return;
    }

    const delta = startX - e.clientX;
    if (Math.abs(delta) > 48) {
      const max = Math.max(0, totalCards() - getVisibleCount());
      if (delta > 0 && currentIndex < max) currentIndex++;
      else if (delta < 0 && currentIndex > 0) currentIndex--;
      updateTrack();
    }
  });

  track.addEventListener('pointercancel', () => { isDragging = false; });

  window.addEventListener('resize', updateTrack);
  updateTrack();
}


/* ─── CHAPTER READER MODAL ────────────────────────── */

function initChapterModal() {
  const modal = document.getElementById('chapter-modal');
  if (!modal) return;

  const closeBtn   = modal.querySelector('.chapter-modal-close');
  const titleEl    = modal.querySelector('.chapter-modal-title');
  const bodyEl     = modal.querySelector('.chapter-modal-body');

  function openModal(novelId) {
    const novel = NOVELS.find(n => n.id === novelId);
    if (!novel) return;

    if (titleEl) titleEl.textContent = novel.title;
    if (bodyEl) bodyEl.innerHTML = `
      <h2 class="chapter-book-title">${novel.title}</h2>
      <p class="chapter-heading">Chapter One</p>
      <div class="chapter-loading">Loading&hellip;</div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (novel.chapterFile) {
      fetch(novel.chapterFile)
        .then(r => {
          if (!r.ok) throw new Error('Not found');
          return r.text();
        })
        .then(text => {
          if (bodyEl) bodyEl.innerHTML = `
            <h2 class="chapter-book-title">${novel.title}</h2>
            <p class="chapter-heading">Chapter One</p>
            <div class="chapter-text">${escapeHtml(text)}</div>
          `;
        })
        .catch(() => {
          if (bodyEl) bodyEl.innerHTML = `
            <h2 class="chapter-book-title">${novel.title}</h2>
            <p class="chapter-heading">Chapter One</p>
            <p class="chapter-unavailable">Chapter coming soon &mdash; check back later.</p>
          `;
        });
    } else {
      if (bodyEl) bodyEl.innerHTML = `
        <h2 class="chapter-book-title">${novel.title}</h2>
        <p class="chapter-heading">Chapter One</p>
        <p class="chapter-unavailable">Chapter coming soon &mdash; check back later.</p>
      `;
    }
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

  // Attach to all [data-chapter] buttons (called after DOM injection too)
  document.querySelectorAll('[data-chapter]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.chapter));
  });

  // Expose so novel-detail can re-attach after injecting buttons
  window._openChapterModal = openModal;
}


/* ─── LIGHTBOX ────────────────────────────────────── */

function initLightbox() {
  const lightbox  = document.getElementById('lightbox');
  if (!lightbox) return;

  const imgEl     = lightbox.querySelector('.lightbox-img');
  const captionEl = lightbox.querySelector('.lightbox-caption');
  const closeBtn  = lightbox.querySelector('.lightbox-close');
  const prevBtn   = lightbox.querySelector('.lightbox-prev');
  const nextBtn   = lightbox.querySelector('.lightbox-next');
  let currentIdx  = 0;
  let items       = [];

  function buildItems() {
    items = Array.from(document.querySelectorAll('.fanart-item'));
  }

  function show(idx) {
    buildItems();
    if (!items.length) return;
    currentIdx = Math.max(0, Math.min(idx, items.length - 1));
    const img = items[currentIdx].querySelector('img');
    if (!img || !imgEl) return;
    imgEl.src = img.src;
    imgEl.alt = img.alt;
    if (captionEl) captionEl.textContent = img.alt || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (prevBtn) prevBtn.disabled = currentIdx === 0;
    if (nextBtn) nextBtn.disabled = currentIdx === items.length - 1;
  }

  function close() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Delegation: works even when grid is rendered after init
  document.addEventListener('click', e => {
    const item = e.target.closest('.fanart-item');
    if (!item) return;
    buildItems();
    show(items.indexOf(item));
  });

  closeBtn?.addEventListener('click', close);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
  prevBtn?.addEventListener('click', () => show(currentIdx - 1));
  nextBtn?.addEventListener('click', () => show(currentIdx + 1));

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')      close();
    if (e.key === 'ArrowLeft')   show(currentIdx - 1);
    if (e.key === 'ArrowRight')  show(currentIdx + 1);
  });
}


/* ─── NOVEL DETAIL PAGE ───────────────────────────── */

function initNovelDetail() {
  const container = document.getElementById('novel-detail-content');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const novel  = NOVELS.find(n => n.id === params.get('id'));

  if (!novel) {
    const requested = params.get('id');
    const available = NOVELS.map(n => n.id).join(', ') || 'none';
    container.innerHTML = `
      <p style="text-align:center;color:var(--color-muted);padding:2rem;font-style:italic">
        Novel not found for id "${escapeHtml(requested || '')}".<br>
        Available ids: ${escapeHtml(available)}
      </p>
    `;
    console.warn('novel-detail: requested id', requested, 'available ids', NOVELS.map(n => n.id));
    return;
  }

  document.title = `${novel.title} — Purplehat Publishing`;

  const coverHtml = novel.cover
    ? `<img src="${novel.cover}" alt="${escapeAttr(novel.title)} cover">`
    : coverPlaceholderHtml(novel.title);

  const genresHtml = novel.genres.map(g => `<span class="genre-tag">${g}</span>`).join('');

  const buyLinksHtml = novel.buyLinks.length
    ? novel.buyLinks.map(l => `<a href="${l.url}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join('')
    : '';

  const chapterBtnHtml = (novel.chapterFile !== undefined)
    ? `<button class="btn btn-outline" data-chapter="${novel.id}">Read First Chapter</button>`
    : '';

  container.innerHTML = `
    <div class="novel-detail-cover">
      ${coverHtml}
    </div>
    <div class="novel-detail-info">
      ${novel.subtitle ? `<p class="text-muted" style="letter-spacing:0.18em;text-transform:uppercase;font-size:0.75rem;margin-bottom:0.6rem">${novel.subtitle}</p>` : ''}
      <h1 style="margin-bottom:1.25rem">${novel.title}</h1>
      <div class="genre-tags">${genresHtml}</div>
      <div class="gold-divider" style="margin-left:0;margin-right:auto"></div>
      <p style="line-height:1.85">${novel.synopsis}</p>
      ${buyLinksHtml || chapterBtnHtml ? `<div class="buy-links">${buyLinksHtml}${chapterBtnHtml}</div>` : ''}
    </div>
  `;

  // Re-attach chapter modal buttons injected above
  container.querySelectorAll('[data-chapter]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window._openChapterModal) window._openChapterModal(btn.dataset.chapter);
    });
  });
}


/* ─── FAN ART GRID ────────────────────────────────── */

function renderFanArt() {
  const grid = document.querySelector('.fanart-grid');
  if (!grid) return;

  if (!FANART.length) {
    grid.innerHTML = '<p class="fanart-empty">Concepts and fan art coming soon.</p>';
    return;
  }

  grid.innerHTML = FANART.map((item, i) => `
    <div class="fanart-item reveal" data-index="${i}">
      <img src="${item.src}" alt="${escapeAttr(item.alt || item.title)}" loading="lazy">
      <div class="fanart-item-overlay" aria-hidden="true"><i class="fas fa-expand"></i></div>
    </div>
  `).join('');

  // Trigger scroll reveal for new elements
  initScrollReveal();
}


/* ─── UTILITIES ───────────────────────────────────── */

function coverPlaceholderHtml(title) {
  return `
    <div class="cover-placeholder">
      <span class="cover-placeholder-icon" aria-hidden="true">&#9998;</span>
      <span class="cover-placeholder-title">${title}</span>
      <span class="cover-placeholder-label">Cover coming soon</span>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

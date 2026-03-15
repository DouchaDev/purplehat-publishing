/* ================================================
   PURPLEHAT PUBLISHING — MAIN JAVASCRIPT
   ================================================

   CONTENT MANAGEMENT — edit these arrays to update the site:

   NOVELS  → Add/edit books. Drop cover images in assets/images/covers/.
             Set chapterFile to load a first chapter in the reader.

   FANART  → Add/edit fan art or concept images.
             Drop images in assets/images/fanart/.

   SOCIAL_LINKS → Update href values with real social media URLs.

   ================================================ */


/* ─── NOVEL DATA ──────────────────────────────────── */
/*
  Each novel object:
  {
    id:          'unique-slug',        // used in URL: novel-detail.html?id=<slug>
    title:       'Novel Title',
    subtitle:    'Optional subtitle',
    tagline:     'Short tagline',
    synopsis:    'Full synopsis paragraph(s).',
    cover:       'assets/images/covers/<slug>.jpg',  // null if no image yet
    genres:      ['Fantasy', 'Adventure'],
    featured:    true,                 // shows on home page
    chapterFile: 'assets/chapters/<slug>.txt',       // null if not ready
    buyLinks:    [{ label: 'Buy on Amazon', url: 'https://...' }]
  }
*/
const NOVELS = [
  {
    id: 'novel-one',
    title: 'Title Coming Soon',
    subtitle: '',
    tagline: 'An epic fantasy adventure awaits',
    synopsis: 'The full synopsis for this novel will appear here. Replace this placeholder text with your own description — the world, the stakes, and the hero who must face them. Make it compelling enough that readers cannot help but turn the first page.',
    cover: null,           // replace with: 'assets/images/covers/novel-one.jpg'
    genres: ['Fantasy', 'Adventure'],
    featured: true,
    chapterFile: null,     // replace with: 'assets/chapters/novel-one.txt'
    buyLinks: []
  },
  {
    id: 'novel-two',
    title: 'Second Novel',
    subtitle: '',
    tagline: 'Worlds beyond imagination',
    synopsis: 'Placeholder synopsis for the second novel. Replace this with your own description when ready.',
    cover: null,
    genres: ['Fantasy', 'Epic'],
    featured: false,
    chapterFile: null,
    buyLinks: []
  }
];


/* ─── FAN ART / CONCEPTS DATA ─────────────────────── */
/*
  Each item:
  { id: 'art-1', src: 'assets/images/fanart/art-1.jpg', title: 'Title', alt: 'Description' }

  Drop images in assets/images/fanart/ and add entries here.
*/
const FANART = [
  // Example (remove the leading // to activate):
  // { id: 'art-1', src: 'assets/images/fanart/art-1.jpg', title: 'Concept Art 1', alt: 'Concept artwork description' },
];


/* ─── SOCIAL LINKS ────────────────────────────────── */
/*
  Replace '#' with your actual social media profile URLs.
*/
const SOCIAL_LINKS = {
  instagram: '#',   // e.g. 'https://www.instagram.com/yourhandle'
  facebook:  '#',   // e.g. 'https://www.facebook.com/yourpage'
  tiktok:    '#',   // e.g. 'https://www.tiktok.com/@yourhandle'
  amazon:    '#'    // e.g. 'https://www.amazon.com/author/yourname'
};


/* ================================================
   INITIALISATION
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  renderFooter();
  initScrollReveal();
  renderFeaturedNovels();
  renderNovelCards();
  renderFanArt();
  initCarousel();
  initChapterModal();
  initLightbox();
  initNovelDetail();
});


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

  // Touch/pointer swipe
  track.addEventListener('pointerdown', e => {
    startX = e.clientX;
    isDragging = true;
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener('pointermove', e => {
    if (!isDragging) return;
    e.preventDefault();
  }, { passive: false });

  track.addEventListener('pointerup', e => {
    if (!isDragging) return;
    isDragging = false;
    const delta = startX - e.clientX;
    if (Math.abs(delta) > 48) {
      const max = Math.max(0, totalCards() - getVisibleCount());
      if (delta > 0 && currentIndex < max) currentIndex++;
      else if (delta < 0 && currentIndex > 0) currentIndex--;
      updateTrack();
    }
  });

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
    container.innerHTML = '<p style="text-align:center;color:var(--color-muted);padding:5rem;font-style:italic">Novel not found.</p>';
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

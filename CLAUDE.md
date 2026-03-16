# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Static fantasy author website for **Hayden Rajamanie**, published by Purplehat Publishing. Hosted on GitHub Pages. **No build tools, no framework, no npm** — pure HTML5/CSS3/Vanilla JS. Open any `.html` file directly in a browser or serve with any static server (e.g. `npx serve .` or VS Code Live Server).

## Architecture

All logic lives in two files:

- **`assets/js/main.js`** — single JS file. All content data is at the top:
  - `NOVELS[]` — novel data (title, synopsis, cover path, genres, chapter file, buy links, `featured` flag)
  - `FANART[]` — fan art/concept image entries
  - `SOCIAL_LINKS{}` — footer social URLs
  - Functions render into empty container elements in the HTML; pages are otherwise static shells.

- **`assets/css/style.css`** — single stylesheet, 17 labelled sections. Design tokens are in the `:root` block at the top. The woodcut texture is pure CSS (`repeating-linear-gradient` crosshatch, `background-attachment: fixed`).

### Page → JS function mapping

| Page | Container | JS function |
|---|---|---|
| `index.html` | `#featured-novels` | `renderFeaturedNovels()` |
| `novels.html` | `.carousel-track` | `renderNovelCards()` + `initCarousel()` |
| `novel-detail.html` | `#novel-detail-content` | `initNovelDetail()` (reads `?id=` query param) |
| `concepts.html` | `.fanart-grid` | `renderFanArt()` |
| All pages | `#site-footer` | `renderFooter()` |

The chapter reader modal (`#chapter-modal`) is present in `index.html` and `novel-detail.html`. It loads `.txt` files via `fetch()` from `assets/chapters/`.

### Carousel pointer events

`initCarousel()` uses `setPointerCapture` + a `hasMoved` flag to distinguish swipe from tap. On tap (`!hasMoved`), navigation uses `document.elementFromPoint()` because pointer capture redirects events to the track element rather than the card.

### Scroll reveal

`initScrollReveal()` uses `IntersectionObserver` and must be called **after** injecting dynamic `.reveal` elements. `renderFeaturedNovels()` and `renderFanArt()` both call it at the end for this reason.

## Content management

**Preferred: Google Sheets** — set `CONFIG.sheetId` in `main.js` to the ID from the sheet URL. The sheet must be shared "Anyone with the link → Viewer". Two tabs required, named exactly `Novels` and `FanArt`. Column headers are documented in the block comment at the top of `main.js`. Image URLs in the sheet can be GitHub raw URLs (`raw.githubusercontent.com/...`) or any public host.

**Fallback: local arrays** — when `CONFIG.sheetId` is `null` (or fetch fails), the site uses the `NOVELS` and `FANART` arrays in `main.js`. These also serve as worked examples of the expected data shape.

- **Social links**: update `SOCIAL_LINKS{}` in `main.js` (these are not in the sheet).
- **First chapter**: the `chapterFile` value (sheet or local) is passed directly to `fetch()` — use a relative path (`assets/chapters/slug.txt`) or an absolute URL.

## Design system

Aesthetic: woodcut/linocut print — ink-black background, CSS hatching texture, amber gold accent (`#C8922A`), minimal colour.

- **`--font-heading`**: Pirata One (display headings h1–h4)
- **`--font-label`**: Cinzel (nav, buttons, tags, small-caps UI)
- **`--font-body`**: Lora (body text)
- **`--color-gold`** / **`--color-gold-light`**: only accent colour — used sparingly
- **`--color-border`**: `rgba(200, 146, 42, 0.28)` — subtle gold borders
- Sharp corners (`--radius: 2px`) — ink print aesthetic, not rounded/soft

The gold divider between hero/page-hero sections and the first content section is a CSS `::before` pseudo-element on `.hero + .section`, `.page-hero + .section`, and `.page-hero + .author-section`. Any new page that follows this pattern gets the divider automatically; pages with a different first-section class need an explicit selector added.

## GitHub Pages

Deploy from `main` branch root. `.nojekyll` is present. All asset paths are relative (no leading `/`), so the site works at any subdirectory path.

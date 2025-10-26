clines-plan.txt

Mobile issues found (with root causes)

- Inline SVG overflow: The Alaska map SVG declares fixed width/height (800×520) with no responsive CSS. Inline SVGs don’t respect img max-width:100% defaults, so the figure overflows on narrow screens and creates horizontal scroll.
- Hover-only mega menu: The top-level navigation relies on hover/focus-within to reveal absolutely positioned .mega-panel. On touch devices there is no persistent hover, so panels are inaccessible; absolute panels can also render off-screen.
- No mobile menu toggle: .mobile-menu-toggle exists but is never shown/used. At ≤720px the horizontal, scrollable tile bar remains visible and heavy, consuming viewport height and still not giving access to panel content.
- Footer columns don’t collapse: .footer-grid stays 1fr .6fr at small widths; content squishes or overflows.
- Logos grid stays 3 columns at ≤640px (only reduced at ≤1000px); tiles compress excessively on small phones.
- Stats grid stays 2 columns down to the smallest widths; copy can wrap awkwardly on ≤360px devices.
- Modal can overflow viewport height: .modal lacks max-height and internal scrolling; on short screens actions can be off-screen.
- Status bar layout can crowd on small widths: .status-row is a single flex row; the link and message compete for space; no stacking rule at very small widths.
- Safe-area insets: meta viewport-fit=cover is set, but no CSS env(safe-area-inset-*) padding for header/status bar/modals; risk of content under notches/home indicators.
- ARIA pattern mismatch: Current menubar/menu/menuitem roles with hover mega panels don’t match a touch-friendly disclosure pattern; aria-expanded is never toggled.

Responsive architecture proposal

- Mobile-first CSS with targeted breakpoints:

  - Base: single-column defaults, fully fluid components.
  - Breakpoints: 900px (switch to desktop header/mega), 700px (tablet tuning), 480px (small phones), 360px (narrow fallback).
  - Add container-bound rules for key grids; consider container queries later if we split CSS.

- Navigation: hybrid desktop mega + mobile disclosure

  - Desktop (≥900px): keep current hover/focus mega panels, but ensure panels are clipped within the container and don’t exceed viewport.

  - Mobile (<900px): replace hover mega with an off-canvas or in-flow accordion:

    - Add a visible .mobile-menu-toggle button that toggles aria-expanded and a data-state on the nav.
    - Use per top-level category with as the tile; move/show the existing .mega-panel content in-flow for mobile (no absolute positioning).
    - Disable/display:none the absolute .mega-panel under 900px; show the in-flow disclosure content instead (CSS-only for layout; minimal JS to manage aria-expanded on the toggle).
    - Remove menubar/menu roles on mobile; use disclosure pattern semantics (details/summary) or button+aria-controls per section.

- Make all media fully fluid:
  - Add .map svg {width:100%; height:auto} and similar for inline SVGs prone to overflow; optionally strip width/height attributes if kept inline.

- Grid rationalization:

  - Footer: collapse to 1 column at ≤700px.
  - Logos: 2 columns at ≤700px, 1 column at ≤480px.
  - Stats: 1 column at ≤480px.
  - Ensure .cols-2/3/4 already collapse to 1 column at ≤640px (leave as-is).

- Modal resilience:
  - .modal { max-height: min(90vh, 600px); overflow: auto; } backdrop remains fixed. Keep actions visible; ensure focus moves to first actionable control; Esc closes.

- Status bar stacking:
  - At ≤480px, put the link on its own line below the message; allow wrapping.

- Safe-area usage:
  - Add padding-top using env(safe-area-inset-top) on .status-bar and header; padding-bottom on .modal-backdrop content if needed.

- Minor typography:
  - Clamp sizes for hero, stats, and tiles are already present; ensure tight letter-spacing doesn’t clip; allow word-break for long headings on tiny widths.

- Accessibility:

  - Keyboard support for off-canvas/accordion; aria-expanded toggled on controls; focus trap not strictly necessary for an in-flow accordion (required for off-canvas).
  - Respect prefers-reduced-motion (already covered).

Concrete implementation plan (prioritized) Phase 1: Quick wins (CSS-only)

1. Fix inline SVG overflow:
   - .map svg, header .brand svg, .security svg {width:100%; height:auto; max-width:100%}

2. Footer and grids:

   - Footer grid -> 1 column at ≤700px.
   - Logos -> 2 cols at ≤700px, 1 col at ≤480px.
   - Stats -> 1 col at ≤480px.

3. Status bar:
   - At ≤480px, stack the link under the message; allow wrapping.

4. Safe-area:
   - Add safe-area padding to .status-bar and header.

5. Modal:
   - Add max-height:90vh and overflow:auto; ensure padding respects safe area.

Phase 2: Navigation refactor (mobile) 6) Add a real .mobile-menu-toggle button (visible <900px) with aria-controls="primary-nav" and aria-expanded. 7) Convert nav to disclosure on mobile:

- Under 900px, hide absolute .mega-panel; reveal its content in-flow under each tile (via CSS) or wrap content in .
- Minimal JS: toggle aria-expanded on the toggle; optionally close other sections when opening one.

8. Desktop containment:
   - Keep absolute mega panel on desktop; ensure width <= container; add overflow containment and z-index hygiene; prevent page horizontal scroll when panels open.

Phase 3: Polish and a11y 9) Update roles:

- Remove menubar/menu roles on mobile; adopt disclosure semantics. Keep focus-visible styling.

10. Performance:

- Ensure no horizontal scroll at any width; test heavy shadows don’t cause jank on low-end phones (optional tone-down if needed).

File structure options

- Option A (stay single-file): Implement all changes directly in index.html (maintains GitHub Pages simplicity).
- Option B (split for maintainability): index.html + assets/styles.css + assets/main.js. Given the size and the nav logic, splitting will improve readability while remaining static-host friendly.

Testing matrix

- Viewports: 360×640, 375×667/812 (iPhone SE/mini), 390×844 (iPhone 13/14), 412×915 (Pixel), 480, 640, 700, 900, 1024, 1280.
- Orientation: portrait/landscape on phones.
- Browsers: iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari.
- Accessibility: keyboard-only nav; VoiceOver/TalkBack reading of menu/disclosures; focus order; visible focus.
- Preferences: prefers-reduced-motion; 200% page zoom; high-contrast OS mode basic sanity.
- Non-regression: no horizontal scroll; hero/readability intact; modal usable and dismissible.

Acceptance criteria

- No horizontal scrolling at ≤360px (except intentional horizontal industries scroller).
- Navigation usable on touch: clear Menu button; expanding sections reveal items; aria-expanded states correct; Esc closes off-canvas if used.
- All grids reflow predictably: Solutions, Press, Testimonials, Logos, Footer collapse as specified.
- Alaska map scales fluidly without overflow.
- Modal content scrolls within viewport and remains operable.
- Lighthouse mobile scores: no “tap targets too small” or “content wider than screen”.

Next steps (when you toggle to

Act Mode (⌘⇧A))

- Implement Phase 1 CSS adjustments.
- Implement navigation toggle/disclosure (Phase 2) with minimal JS and ARIA.
- Run the testing matrix and iterate.

If you prefer splitting files, I will scaffold assets/styles.css and assets/main.js and rewire index.html accordingly; otherwise I’ll keep it single-file.

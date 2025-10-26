// assets/main.js
// Mobile-friendly behavior and minimal site JS moved out of index.html.
// Responsibilities:
// - update copyright year
// - prevent navigation for aria-disabled anchors
// - modal show/close (sessionStorage remembered)
// - mobile menu toggle (create if missing) and in-flow mega reveal toggles
// - ensure keyboard Escape closes modal and mobile nav

(function () {
  'use strict';

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  document.addEventListener('DOMContentLoaded', function () {
    // 1) Year update
    try {
      var y = qs('#year');
      if (y) y.textContent = new Date().getFullYear();
    } catch (e) { /* non-fatal */ }

    // 2) Disabled anchors: prevent navigation
    try {
      qsa('a[aria-disabled="true"]').forEach(function (link) {
        link.addEventListener('click', function (evt) {
          evt.preventDefault();
          evt.stopPropagation();
        });
        // make keyboard Enter harmless
        link.addEventListener('keydown', function (evt) {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            evt.stopPropagation();
          }
        });
      });
    } catch (e) {}

    // 3) Modal handling (graceful if JS disabled)
    var modal = qs('#upgradeModal');
    var ack = qs('#ack');
    var seen = false;
    try { seen = sessionStorage.getItem('gacis_modal_seen') === '1'; } catch (e) { seen = false; }

    function showModal() {
      if (!modal) return;
      modal.style.display = 'flex';
      // focus first focusable inside modal
      try {
        var focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable && focusable.focus) focusable.focus({ preventScroll: true });
      } catch (e) {}
      try { sessionStorage.setItem('gacis_modal_seen', '1'); } catch (e) {}
    }
    function closeModal() {
      if (!modal) return;
      modal.style.display = 'none';
    }
    if (!seen) {
      // small delay so page paint isn't blocked by focusing
      setTimeout(showModal, 300);
    }
    if (ack) {
      ack.addEventListener('click', function () { closeModal(); });
    }

    // 4) Mobile nav: ensure toggle exists, handle disclosure behavior
    var nav = qs('.midnight-nav');
    var mobileToggle = qs('.mobile-menu-toggle');

    if (!mobileToggle && nav) {
      // create a toggle to insert before the nav (keeps markup safe)
      mobileToggle = document.createElement('button');
      mobileToggle.className = 'mobile-menu-toggle';
      mobileToggle.type = 'button';
      mobileToggle.setAttribute('aria-controls', 'primary-nav');
      mobileToggle.setAttribute('aria-expanded', 'false');
      mobileToggle.setAttribute('aria-label', 'Open primary navigation');
      mobileToggle.textContent = 'Menu';
      // try to insert before nav in header
      try {
        nav.parentNode.insertBefore(mobileToggle, nav);
      } catch (e) { /* ignore if insertion fails */ }
    }

    if (mobileToggle && nav) {
      mobileToggle.addEventListener('click', function () {
        var expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
        mobileToggle.setAttribute('aria-expanded', String(!expanded));
        document.body.classList.toggle('nav-open', !expanded);
        nav.classList.toggle('open', !expanded);
      });
    }

    // Helper to detect mobile breakpoint used in CSS
    function isMobileBreakpoint() {
      return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    }

    // Nav item toggles (in-flow on mobile)
    var navItems = qsa('.nav-item');
    function closeAllNav() {
      navItems.forEach(function (item) {
        item.classList.remove('open');
        var btn = item.querySelector('.nav-tile');
        if (btn) {
          btn.setAttribute('aria-expanded', 'false');
          if (btn.blur) btn.blur();
        }
      });
    }

    navItems.forEach(function (item) {
      var btn = item.querySelector('.nav-tile');
      if (!btn) return;
      // ensure aria-expanded exists for assistive tech
      if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');

      btn.addEventListener('click', function (evt) {
        // only act as disclosure on mobile; on desktop it's hover-based
        if (!isMobileBreakpoint()) return;
        evt.preventDefault && evt.preventDefault();
        var willOpen = !item.classList.contains('open');
        // close others
        navItems.forEach(function (other) {
          if (other !== item) {
            other.classList.remove('open');
            var b = other.querySelector('.nav-tile');
            if (b) {
              b.setAttribute('aria-expanded', 'false');
              if (b.blur) b.blur();
            }
          }
        });
        item.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
        if (!willOpen && btn.blur) btn.blur();
      });
    });

    // close mobile nav or disclosures on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        try { closeModal(); } catch (er) {}
        try {
          if (document.body.classList.contains('nav-open')) {
            document.body.classList.remove('nav-open');
            if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
            if (nav) nav.classList.remove('open');
          }
          closeAllNav();
        } catch (er) {}
      }
    });

    // On resize beyond breakpoint, ensure mobile states are cleared
    var resizeTimeout = null;
    window.addEventListener('resize', function () {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function () {
        if (!isMobileBreakpoint()) {
          // clear mobile-open states
          try {
            document.body.classList.remove('nav-open');
            if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
            if (nav) nav.classList.remove('open');
            closeAllNav();
          } catch (e) {}
        }
      }, 120);
    }, { passive: true });

    // pointerenter subtle focus handling (mirrors original behavior; non-critical)
    try {
      var navTiles = qsa('.nav-tile');
      navTiles.forEach(function (tile) {
        tile.addEventListener('pointerenter', function (evt) {
          if (evt.pointerType !== 'mouse') return;
          var active = document.activeElement;
          if (!active || active === tile) return;
          if (active.classList && active.classList.contains('nav-tile')) active.blur();
        }, { passive: true });
      });
    } catch (e) {}

  }); // DOMContentLoaded
})();

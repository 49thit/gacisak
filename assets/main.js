/* assets/main.js
   Extended mobile navigation implementation:
   - retains previous behavior (year update, disabled anchors, modal)
   - implements off-canvas drilldown mobile nav that parses the existing mega-menu DOM
   - search/typeahead, session persistence, focus-trap, body scroll lock
*/

(function () {
  'use strict';

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function $(sel, ctx) { return qs(sel, ctx); }

  document.addEventListener('DOMContentLoaded', function () {
    // Quick test helper: if URL contains ?nomodal=1 set sessionStorage to suppress the modal during QA.
    try {
      if (typeof location !== 'undefined' && location.search && location.search.indexOf('nomodal=1') !== -1) {
        try { sessionStorage.setItem('gacis_modal_seen', '1'); } catch (e) {}
      }
    } catch (e) {}
    // Force-mobile QA helper: if URL contains ?forceMobile=1, add a class that makes mobile rules apply at desktop widths.
    try {
      if (typeof location !== 'undefined' && location.search && location.search.indexOf('forceMobile=1') !== -1) {
        if (document.body && document.body.classList) document.body.classList.add('force-mobile');
      }
    } catch (e) {}
    // --- Basic utilities & small helpers ---
    var KEY_ESC = 'Escape';
    var STORAGE_KEY = 'gacis_mnp_path_v1';

    function setAttr(el, name, value){ if(!el) return; el.setAttribute(name, value); }
    function removeAttr(el, name){ if(!el) return; el.removeAttribute(name); }
    function hide(el){ if(!el) return; el.hidden = true; }
    function show(el){ if(!el) return; el.hidden = false; }

    // focusable selector
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // --- Keep existing behaviors: year, disabled anchors, modal ---
    try {
      var y = qs('#year'); if(y) y.textContent = new Date().getFullYear();
    } catch(e){}

    try {
      qsa('a[aria-disabled="true"]').forEach(function (link) {
        link.addEventListener('click', function (evt) { evt.preventDefault(); evt.stopPropagation(); });
        link.addEventListener('keydown', function (evt) { if (evt.key === 'Enter') { evt.preventDefault(); evt.stopPropagation(); } });
      });
    } catch(e){}

    // Modal handling (unchanged)
    var modal = qs('#upgradeModal'), ack = qs('#ack');
    try {
      var seen = false;
      try{ seen = sessionStorage.getItem('gacis_modal_seen') === '1'; }catch(e){ seen = false; }
      function showModal(){ if(!modal) return; modal.style.display = 'flex'; try{ var f = modal.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])'); if(f && f.focus) f.focus({preventScroll:true}); }catch(e){} try{ sessionStorage.setItem('gacis_modal_seen','1'); }catch(e){} }
      function closeModal(){ if(!modal) return; modal.style.display = 'none'; }
      if(!seen) setTimeout(showModal, 300);
      if(ack) ack.addEventListener('click', closeModal);
    } catch(e){}

    // --- Mobile nav elements & state ---
    var mToggle = qs('.mobile-nav-toggle');                       // the hamburger toggle in header
    var mPanel = qs('#mobile-nav-panel');                        // aside container
    var mBody = qs('.mnp-body', mPanel);                         // where lists are rendered
    var mSearch = qs('.mnp-search', mPanel);
    var mClose = qs('.mnp-close', mPanel);
    var mBack = qs('.mnp-back', mPanel);
    var mBackdrop = qs('.mnp-backdrop', mPanel);

    // Safety: if elements missing, do nothing
    if (!mToggle || !mPanel || !mBody) {
      // no mobile nav scaffold available (degrades to original behavior)
      return;
    }

    // Defensive: ensure the panel is hidden by default to prevent CSS-only rendering
    // (some browsers may render the aside before JS attaches handlers)
    try {
      mPanel.hidden = true;
      mToggle && mToggle.setAttribute('aria-expanded', 'false');
      console.debug && console.debug('[MNP] defensive hide applied at DOMContentLoaded');
    } catch (e) {
      /* noop */
    }

    // Parsed IA model (built lazily on first open)
    var IA = null; // { tiles: [{ title, columns: [{ title, boxes:[{title,pages:[{title,el}] }] }] }] }
    var flatPages = []; // {title, tileIndex, colIndex, boxIndex, pageIndex, el}

    function buildIA() {
      if (IA) return IA;
      IA = { tiles: [] };
      flatPages = [];
      var navItems = qsa('.nav-item');
      navItems.forEach(function (item, tileIndex) {
        var titleEl = qs('.nav-tile', item);
        var tileTitle = titleEl ? titleEl.textContent.trim() : ('Tile ' + tileIndex);
        var panel = qs('.mega-panel', item);
        var columns = [];
        if (panel) {
          qsa('.mega-col', panel).forEach(function (colEl, colIndex) {
            var colTitleEl = qs('h4', colEl);
            var colTitle = colTitleEl ? colTitleEl.textContent.trim() : ('Column ' + colIndex);
            var boxes = [];
            qsa('.mega-tier', colEl).forEach(function (tierEl, boxIndex) {
              var boxTitleEl = qs('h5', tierEl);
              var boxTitle = boxTitleEl ? boxTitleEl.textContent.trim() : ('Box ' + boxIndex);
              var pages = [];
              qsa('.mega-page', tierEl).forEach(function (pageEl, pageIndex) {
                var pageTitle = pageEl.textContent.trim() || pageEl.getAttribute('aria-label') || ('Page ' + pageIndex);
                pages.push({ title: pageTitle, el: pageEl.cloneNode(true) }); // clone to avoid moving DOM
                flatPages.push({ title: pageTitle, tileIndex: tileIndex, colIndex: colIndex, boxIndex: boxIndex, pageIndex: pageIndex });
              });
              boxes.push({ title: boxTitle, pages: pages });
            });
            columns.push({ title: colTitle, boxes: boxes });
          });
        }
        IA.tiles.push({ title: tileTitle, columns: columns });
      });
      try {
        console.debug && console.debug('[MNP] buildIA complete - tiles:', IA.tiles.length, 'flatPages:', flatPages.length);
      } catch (e) {}
      return IA;
    }

    // --- rendering and navigation stack ---
    var stack = []; // array of {level:'tile'|'col'|'box'|'page', index: number}
    var prevActive = null;

    function savePath() {
      try {
        var path = stack.map(function (s) { return s.index; });
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(path));
      } catch (e) {}
    }
    function restorePath() {
      try {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr) || arr.length === 0) return null;
        // convert to stack objects: tile, col, box
        var s = [];
        if (arr.length >= 1) s.push({ level: 'tile', index: arr[0] });
        if (arr.length >= 2) s.push({ level: 'col', index: arr[1] });
        if (arr.length >= 3) s.push({ level: 'box', index: arr[2] });
        return s;
      } catch (e) { return null; }
    }

    // helpers for element creation
    function el(name, props, children) {
      var e = document.createElement(name);
      props = props || {};
      Object.keys(props).forEach(function (k) {
        if (k === 'class') e.className = props[k];
        else if (k === 'html') e.innerHTML = props[k];
        else if (k === 'text') e.textContent = props[k];
        else e.setAttribute(k, props[k]);
      });
      (children || []).forEach(function (c) {
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c) e.appendChild(c);
      });
      return e;
    }

    function clearBody() { mBody.innerHTML = ''; }

    function renderTiles() {
      clearBody();
      var ul = el('ul', { class: 'mnp-list mnp-level-tiles' });
      IA.tiles.forEach(function (tile, i) {
        var btn = el('button', { class: 'mnp-item mnp-tile', type: 'button', 'data-index': String(i), 'aria-label': tile.title });
        btn.innerHTML = '<span class="mnp-item-title"></span><span class="mnp-item-chevron" aria-hidden="true">›</span>';
        btn.querySelector('.mnp-item-title').textContent = tile.title;
        var titleSpan = btn.querySelector('.mnp-item-title');
        if (titleSpan) {
          titleSpan.addEventListener('click', function (evt) {
            try { evt && evt.preventDefault && evt.preventDefault(); evt && evt.stopPropagation && evt.stopPropagation(); } catch(e){}
            push({ level: 'tile', index: i });
          });
        }
        // Tapping anywhere else in the row closes the panel (per requirement)
        btn.addEventListener('click', function () { closePanel(); });
        var li = el('li', {}, [btn]);
        ul.appendChild(li);
      });
      mBody.appendChild(ul);
      setBackVisible(false);
      mBody.setAttribute('data-level', 'tiles');
      announce('Top-level navigation. ' + IA.tiles.length + ' categories.');
    }

    function renderColumns(tileIndex) {
      clearBody();
      var tile = IA.tiles[tileIndex];
      var ul = el('ul', { class: 'mnp-list mnp-level-columns' });
      tile.columns.forEach(function (col, ci) {
        var btn = el('button', { class: 'mnp-item mnp-col', type: 'button', 'data-index': String(ci), 'aria-label': col.title });
        btn.innerHTML = '<span class="mnp-item-title"></span><span class="mnp-item-chevron" aria-hidden="true">›</span>';
        btn.querySelector('.mnp-item-title').textContent = col.title;
        var colTitleSpan = btn.querySelector('.mnp-item-title');
        if (colTitleSpan) {
          colTitleSpan.addEventListener('click', function (evt) {
            try { evt && evt.preventDefault && evt.preventDefault(); evt && evt.stopPropagation && evt.stopPropagation(); } catch(e){}
            push({ level: 'col', index: ci });
          });
        }
        // Tapping non-word space closes
        btn.addEventListener('click', function () { closePanel(); });
        ul.appendChild(el('li', {}, [btn]));
      });
      mBody.appendChild(ul);
      setBackVisible(true);
      mBody.setAttribute('data-level', 'columns');
      announce(tile.title + '. ' + tile.columns.length + ' groups.');
    }

    function renderBoxes(tileIndex, colIndex) {
      clearBody();
      var col = IA.tiles[tileIndex].columns[colIndex];
      var ul = el('ul', { class: 'mnp-list mnp-level-boxes' });
      col.boxes.forEach(function (box, bi) {
        var btn = el('button', { class: 'mnp-item mnp-box', type: 'button', 'data-index': String(bi), 'aria-label': box.title });
        btn.innerHTML = '<span class="mnp-item-title"></span><span class="mnp-item-chevron" aria-hidden="true">›</span>';
        btn.querySelector('.mnp-item-title').textContent = box.title;
        var boxTitleSpan = btn.querySelector('.mnp-item-title');
        if (boxTitleSpan) {
          boxTitleSpan.addEventListener('click', function (evt) {
            try { evt && evt.preventDefault && evt.preventDefault(); evt && evt.stopPropagation && evt.stopPropagation(); } catch(e){}
            push({ level: 'box', index: bi });
          });
        }
        // Tapping non-word space closes
        btn.addEventListener('click', function () { closePanel(); });
        ul.appendChild(el('li', {}, [btn]));
      });
      mBody.appendChild(ul);
      setBackVisible(true);
      mBody.setAttribute('data-level', 'boxes');
      announce(col.title + '. ' + col.boxes.length + ' sections.');
    }

    function renderPages(tileIndex, colIndex, boxIndex) {
      clearBody();
      var pages = IA.tiles[tileIndex].columns[colIndex].boxes[boxIndex].pages;
      var ul = el('ul', { class: 'mnp-list mnp-level-pages' });
      pages.forEach(function (pageObj, pi) {
        // pageObj.el is a cloned anchor node; replace href handling: keep it inert per site policy
        var li = el('li', {});
        var a = pageObj.el.cloneNode(true);
        // ensure it's a button-like link: prevent navigation
        a.addEventListener && a.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
        // add small breadcrumb label
        a.classList.add('mnp-page-link');
        li.appendChild(a);
        ul.appendChild(li);
      });
      mBody.appendChild(ul);
      setBackVisible(true);
      mBody.setAttribute('data-level', 'pages');
      announce('Pages. ' + pages.length + ' items.');
    }

    // accessibility announcement helper (polite)
    var liveRegion = (function () {
      var lr = document.createElement('div');
      lr.setAttribute('aria-live', 'polite');
      lr.className = 'visually-hidden';
      document.body.appendChild(lr);
      return lr;
    })();
    function announce(text) {
      if (!liveRegion) return;
      liveRegion.textContent = '';
      setTimeout(function () { liveRegion.textContent = text; }, 50);
    }

    // back control
    function setBackVisible(visible) {
      if (!mBack) return;
      if (visible) { mBack.hidden = false; mBack.setAttribute('tabindex', '0'); }
      else { mBack.hidden = true; mBack.setAttribute('tabindex', '-1'); }
    }

    // push level onto stack and render appropriate content
    function push(item) {
      // item: {level:'tile'|'col'|'box', index: n}
      // manage stack semantics: if pushing tile, trim to [] then push; pushing col requires tile on stack, etc.
      if (item.level === 'tile') {
        stack = [{ level: 'tile', index: item.index }];
        renderColumns(item.index);
      } else if (item.level === 'col') {
        var tileIdx = stack.length && stack[0] && stack[0].index;
        if (typeof tileIdx !== 'number') return;
        stack = [ { level: 'tile', index: tileIdx }, { level: 'col', index: item.index } ];
        renderBoxes(tileIdx, item.index);
      } else if (item.level === 'box') {
        var tileIdx2 = stack.length && stack[0] && stack[0].index;
        var colIdx2 = stack.length > 1 && stack[1] && stack[1].index;
        if (typeof tileIdx2 !== 'number' || typeof colIdx2 !== 'number') return;
        stack = [ { level: 'tile', index: tileIdx2 }, { level: 'col', index: colIdx2 }, { level: 'box', index: item.index } ];
        renderPages(tileIdx2, colIdx2, item.index);
      }
      savePath();
      trapFocus(); // ensure focus inside panel
    }

    // pop one level
    function pop() {
      if (stack.length === 0) return;
      stack.pop();
      if (stack.length === 0) { renderTiles(); }
      else if (stack.length === 1) { renderColumns(stack[0].index); }
      else if (stack.length === 2) { renderBoxes(stack[0].index, stack[1].index); }
      savePath();
      trapFocus();
    }

    // jump to a specific saved path array (tileIndex, colIndex, boxIndex)
    function jumpToPath(arr) {
      if (!Array.isArray(arr) || arr.length === 0) { renderTiles(); stack = []; savePath(); return; }
      var t = arr[0];
      if (typeof t !== 'number' || !IA.tiles[t]) { renderTiles(); stack = []; return; }
      stack = [{ level:'tile', index: t }];
      if (arr.length === 1) { renderColumns(t); savePath(); return; }
      var c = arr[1];
      if (typeof c !== 'number' || !IA.tiles[t].columns[c]) { renderColumns(t); savePath(); return; }
      stack.push({ level:'col', index: c });
      if (arr.length === 2) { renderBoxes(t,c); savePath(); return; }
      var b = arr[2];
      if (typeof b !== 'number' || !IA.tiles[t].columns[c].boxes[b]) { renderBoxes(t,c); savePath(); return; }
      stack.push({ level:'box', index: b });
      renderPages(t,c,b); savePath();
    }

    // --- search indexing + renderer ---
    function buildFlatIndex() {
      flatPages = [];
      IA.tiles.forEach(function (tile, ti) {
        tile.columns.forEach(function (col, ci) {
          col.boxes.forEach(function (box, bi) {
            box.pages.forEach(function (page, pi) {
              flatPages.push({
                title: page.title,
                breadcrumb: [tile.title, col.title, box.title, page.title],
                tileIndex: ti, colIndex: ci, boxIndex: bi, pageIndex: pi
              });
            });
          });
        });
      });
    }

    var searchResultsEl = null;
    function renderSearchResults(matches) {
      // show flat list
      if (!searchResultsEl) {
        searchResultsEl = el('div', { class: 'mnp-search-results' });
        mBody.parentNode.insertBefore(searchResultsEl, mBody.nextSibling);
      }
      searchResultsEl.innerHTML = '';
      if (!matches || matches.length === 0) {
        searchResultsEl.innerHTML = '<div class="mnp-no-results">No results</div>';
        return;
      }
      var ul = el('ul', { class: 'mnp-search-list' });
      matches.forEach(function (m) {
        var btn = el('button', { class: 'mnp-search-item', type: 'button', 'data-tile': m.tileIndex, 'data-col': m.colIndex, 'data-box': m.boxIndex });
        var crumb = m.breadcrumb.slice(0,3).join(' › ');
        btn.innerHTML = '<div class="mnp-search-title"></div><div class="mnp-search-crumb"></div>';
        btn.querySelector('.mnp-search-title').textContent = m.title;
        btn.querySelector('.mnp-search-crumb').textContent = crumb;
        btn.addEventListener('click', function () {
          // jump into containing path and show pages, highlight selected page
          jumpToPath([m.tileIndex, m.colIndex, m.boxIndex]);
        });
        ul.appendChild(el('li', {}, [btn]));
      });
      searchResultsEl.appendChild(ul);
    }

    function searchIndex(q) {
      var term = (q || '').trim().toLowerCase();
      if (!term) return [];
      var parts = term.split(/\s+/).filter(Boolean);
      return flatPages.filter(function (p) {
        var txt = p.title.toLowerCase() + ' ' + (p.breadcrumb ? p.breadcrumb.join(' ').toLowerCase() : '');
        return parts.every(function (pt) { return txt.indexOf(pt) !== -1; });
      }).slice(0, 50);
    }

    // --- focus trap & open/close behavior ---
    var previouslyFocused = null;
    var keydownHandler = null;

    function trapFocus() {
      if (!mPanel || mPanel.hidden) return;
      // focus first focusable
      setTimeout(function () {
        var first = mPanel.querySelector(FOCUSABLE);
        if (first && first.focus) first.focus();
      }, 0);
    }

    function enableFocusTrap() {
      keydownHandler = function (e) {
        if (e.key === KEY_ESC) { closePanel(); e.preventDefault(); return; }
        if (e.key !== 'Tab') return;
        var focusables = Array.prototype.slice.call(mPanel.querySelectorAll(FOCUSABLE)).filter(function (n) { return n.offsetParent !== null; });
        if (focusables.length === 0) return;
        var idx = focusables.indexOf(document.activeElement);
        if (e.shiftKey) {
          if (idx === 0) { focusables[focusables.length - 1].focus(); e.preventDefault(); }
        } else {
          if (idx === focusables.length - 1) { focusables[0].focus(); e.preventDefault(); }
        }
      };
      document.addEventListener('keydown', keydownHandler);
    }

    function disableFocusTrap() {
      if (keydownHandler) { document.removeEventListener('keydown', keydownHandler); keydownHandler = null; }
    }

    function lockBodyScroll() {
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('mnp-open');
    }
    function unlockBodyScroll() {
      document.documentElement.style.overflow = '';
      document.body.classList.remove('mnp-open');
    }

    function openPanel() {
      console.debug && console.debug('[MNP] openPanel()');
      buildIA();
      buildFlatIndex();
      // Remove pre-hide style if present (inserted in head) so transitions can work
      try {
        var pre = document.getElementById('mnp-prehide');
        if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
      } catch (e) {}
      show(mPanel);
      mPanel.removeAttribute('hidden');
      mToggle.setAttribute('aria-expanded', 'true');
      previouslyFocused = document.activeElement;
      lockBodyScroll();
      enableFocusTrap();
      // restore path if present
      var restored = restorePath();
      if (restored) jumpToPath(restored.map(function(n){return n;}));
      else {
        // if IA is empty, show friendly message
        if (!IA || (IA && IA.tiles && IA.tiles.length === 0)) {
          clearBody();
          var msg = el('div', { class: 'mnp-no-results' });
          msg.textContent = 'Navigation unavailable';
          mBody.appendChild(msg);
          console.debug && console.debug('[MNP] openPanel: IA empty, showing fallback message');
        } else {
          renderTiles();
        }
      }
      trapFocus();
    }

    function closePanel() {
      console.debug && console.debug('[MNP] closePanel()');
      hide(mPanel);
      mPanel.setAttribute('hidden', '');
      mToggle.setAttribute('aria-expanded', 'false');
      disableFocusTrap();
      unlockBodyScroll();
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    }

    // toggle handler
    mToggle.addEventListener('click', function () {
      console.debug && console.debug('[MNP] toggle clicked, current hidden=', mPanel && mPanel.hidden);
      if (mPanel && !mPanel.hidden) closePanel();
      else openPanel();
    });

    // close / back buttons
    if (mClose) mClose.addEventListener('click', closePanel);
    if (mBackdrop) mBackdrop.addEventListener('click', closePanel);
    if (mBack) mBack.addEventListener('click', function () { pop(); });

    // Fallback: if a user clicks the aside (backdrop) or anywhere outside the .mnp sheet,
    // close the panel. This covers edge cases where the backdrop element may not capture the click.
    if (mPanel) {
      mPanel.addEventListener('click', function (evt) {
        try {
          var sheet = mPanel.querySelector('.mnp');
          if (!sheet) return;
          var inside = sheet.contains(evt.target);
          // Allowed interactive targets that should NOT close the panel:
          // - the word label itself (.mnp-item-title)
          // - the back button (.mnp-back)
          // - page links (.mnp-page-link)
          // - search input (.mnp-search)
          var allowedTarget = evt.target && (evt.target.closest('.mnp-item-title') || evt.target.closest('.mnp-back') || evt.target.closest('.mnp-page-link') || evt.target.closest('.mnp-search'));
          if (!inside || (!allowedTarget)) {
            // Clicked outside the sheet OR inside sheet but not on a word/back/search → close panel
            closePanel();
          }
        } catch (e) {
          // defensive no-op
        }
      });
    }

    // keyboard escape global: ensure close
    document.addEventListener('keydown', function (e) {
      if (e.key === KEY_ESC && mPanel && !mPanel.hidden) {
        closePanel();
      }
    });

    // resize behavior: close if crossing to desktop
    var lastIsMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    window.addEventListener('resize', function () {
      var nowMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
      if (!nowMobile && lastIsMobile) { // moved to desktop
        if (mPanel && !mPanel.hidden) closePanel();
      }
      lastIsMobile = nowMobile;
    }, { passive: true });

    // search handling
    if (mSearch) {
      var searchTimer = null;
      mSearch.addEventListener('input', function (e) {
        var q = mSearch.value || '';
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          if (!IA) buildIA(), buildFlatIndex();
          if (!q) {
            if (searchResultsEl) searchResultsEl.innerHTML = '';
            // re-render current level
            if (stack.length === 0) renderTiles();
            else if (stack.length === 1) renderColumns(stack[0].index);
            else if (stack.length === 2) renderBoxes(stack[0].index, stack[1].index);
            else if (stack.length === 3) renderPages(stack[0].index, stack[1].index, stack[2].index);
            return;
          }
          var matches = searchIndex(q);
          renderSearchResults(matches);
        }, 150);
      });
    }

    // initial state: ensure panel hidden (keeps graceful if JS absent)
    hide(mPanel);

  }); // DOMContentLoaded
})();

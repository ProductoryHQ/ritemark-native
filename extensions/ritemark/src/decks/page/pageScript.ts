/**
 * Sprint 159 (technical plan §2.4): the handout page's one inline script.
 *
 *  - **The slide follows the text by the editor's own rule:** `PAGE_SCROLL_RULE` is a copy of the deck view's
 *    `webview/src/components/decks/scrollRule.ts` (one part at a time, both ways; a wheel turn moves on by one at
 *    most), and `pageScript.test.ts` runs both over generated states and fails when they part.
 *  - On a computer the read line is measured from under the page's top bar; on a phone (below 860 px) from the bottom
 *    of the band that holds the slide. j and k, the arrows under the slide and Contents step a part at a time.
 *  - The progress bar and "n / N"; Contents, a finished exercise ticked in it; Copy, which says Copied, or selects the
 *    words where the browser won't copy; and ticks kept in this browser's own storage, on this device only.
 *  - **The printed handout's footer** (small details 13) carries the page's own address, written once as text.
 *  - **The page remembers each reader's place and links to a part** (the decks README, small details 7): the address
 *    follows the part being read (`#6`, through `history.replaceState`, so the history doesn't fill); a `#6` link opens
 *    that part, a number with no part opens the top; and opened again without a link, the page returns to the last
 *    part read in this browser, with a quiet "Start from the beginning" in its bar for 5 s. Only the part's number is
 *    kept, in this browser's own storage, under the page's own name (its client and title, as the ticks are).
 *  - A wide table that scrolls sideways fades softly at the side with more to scroll to (`PAGE_EDGE_RULE`).
 *
 * It only shows, hides and moves what the page already holds: it sets no `src` or `href`, loads nothing, and writes
 * no HTML (text goes in through `textContent`), so 2.2's gather sees every file the page uses and its
 * `scriptBuildsReferences` stays false (the test checks).
 */

/** The deck view's scroll rule (`scrollRule.ts`), as plain JavaScript. Kept the same by `pageScript.test.ts`. */
export const PAGE_SCROLL_RULE = String.raw`
  var READ_LINE = 0.28, TOP_SNAP = 26, PART_TOP_GAP = 6;
  function partStarts(partTops, clientHeight) {
    var starts = [];
    for (var index = 0; index < partTops.length; index++) {
      if (index === 0) { starts.push(-Infinity); continue; }
      var crossesLine = partTops[index] - clientHeight * READ_LINE;
      var aboveLeftTop = partTops[index - 1] - PART_TOP_GAP + TOP_SNAP;
      starts.push(Math.max(crossesLine, aboveLeftTop, starts[index - 1] + 1));
    }
    return starts;
  }
  function partAt(state, starts, scrollTop) {
    var count = state.partTops.length;
    if (scrollTop < 8) return 0;
    if (scrollTop + state.clientHeight >= state.scrollHeight - 4 && scrollTop >= state.partTops[count - 1] - PART_TOP_GAP - 2) return count - 1;
    var current = 0;
    for (var index = 0; index < starts.length; index++) if (starts[index] <= scrollTop) current = index;
    return current;
  }
  function currentPart(state) {
    var count = state.partTops.length;
    if (count === 0) return null;
    if (state.writing !== null && state.writing >= 0 && state.writing < count) return state.writing;
    return partAt(state, partStarts(state.partTops, state.clientHeight), state.scrollTop);
  }
  function wheelStop(state, delta, shown) {
    var maxTop = Math.max(0, state.scrollHeight - state.clientHeight);
    var target = Math.min(maxTop, Math.max(0, state.scrollTop + delta));
    var step = delta > 0 ? 1 : -1;
    var next = shown + step;
    if (state.partTops.length === 0) return null;
    var starts = partStarts(state.partTops, state.clientHeight);
    var at = function (scrollTop) { return partAt(state, starts, scrollTop); };
    var skips = function (part) { return step > 0 ? part > next : part < next; };
    if (delta === 0 || !skips(at(target))) return null;
    var stop = null;
    for (var top = state.scrollTop + step; step > 0 ? top <= target : top >= target; top += step) {
      var part = at(top);
      if (skips(part)) break;
      if (part === next) stop = top;
    }
    return stop;
  }
  function scrollTopFor(partTop) { return Math.max(0, partTop - PART_TOP_GAP); }
`;

/**
 * Where a reader is (small details 7), as plain JavaScript: the part an address names, the address a part has, and the
 * part kept in this browser. `pageScript.test.ts` runs these directly. Storage may be missing or may throw (a private
 * window, blocked site data): every read and write is guarded, and nothing kept means the page opens at the top.
 */
export const PAGE_PLACE_RULE = String.raw`
  var PLACE_NOTICE_MS = 5000;
  // #6 is part 6 (and 2.2's #s6 still works); a number with no part opens the top (0); any other address names no part.
  function linkedPart(hash, count) {
    var match = /^#s?(\d+)$/.exec(hash || '');
    if (!match || count <= 0) return null;
    var index = Number(match[1]) - 1;
    return index >= 0 && index < count ? index : 0;
  }
  // The top part is the page's own address; every other part adds its number.
  function addressFor(index) { return index > 0 ? '#' + (index + 1) : ''; }
  function storageOf(win) {
    try { return win.localStorage || null; } catch (error) { return null; }
  }
  // The part kept in this browser, if it is still on the page and isn't the top one (that one needs no return).
  function readPlace(storage, key, count) {
    var kept = null;
    try { kept = storage ? storage.getItem(key) : null; } catch (error) { return null; }
    if (typeof kept !== 'string' || !/^\d{1,6}$/.test(kept)) return null;
    var index = Number(kept) - 1;
    return index > 0 && index < count ? index : null;
  }
  function keepPlace(storage, key, index) {
    try { if (storage) storage.setItem(key, String(index + 1)); } catch (error) { /* a browser that keeps nothing opens at the top */ }
  }
`;

/**
 * A wide table's soft edges (the Experience lead on #781), as plain JavaScript: the editor's
 * `webview/src/extensions/tables/tableEdges.ts`, which `pageScript.test.ts` runs beside this copy. A table's frame
 * (`.tw`) gets `is-scrollable-left` / `is-scrollable-right` on whichever side has more to scroll to, and the page's CSS
 * fades that side over 24 px. A passive scroll listener draws once per animation frame and a ResizeObserver before the
 * frame is painted; only classes and one CSS variable change, so nothing moves with reduced motion.
 */
export const PAGE_EDGE_RULE = String.raw`
  var EDGE_SLACK = 1;
  function tableEdges(scrollLeft, scrollWidth, clientWidth, rtl) {
    var room = scrollWidth - clientWidth;
    if (!(room > EDGE_SLACK)) return { left: false, right: false };
    var at = Math.min(room, Math.abs(scrollLeft));
    var fromStart = at > EDGE_SLACK, toEnd = at < room - EDGE_SLACK;
    return rtl ? { left: toEnd, right: fromStart } : { left: fromStart, right: toEnd };
  }
  function watchTableEdges(frame, content, win) {
    var pending = 0, bar = '', stopped = false, rtl = null, observer = null;
    function stop() {
      stopped = true;
      frame.removeEventListener('scroll', schedule);
      if (observer) observer.disconnect();
      if (pending) win.cancelAnimationFrame(pending);
      pending = 0;
    }
    function draw() {
      pending = 0;
      if (stopped || !frame.isConnected) return;
      if (rtl === null) {
        var style = win.getComputedStyle(frame);
        if (!/^(auto|scroll)$/.test(style.overflowX)) { stop(); return; }
        rtl = style.direction === 'rtl';
      }
      var edges = tableEdges(frame.scrollLeft, frame.scrollWidth, frame.clientWidth, rtl);
      frame.classList.toggle('is-scrollable-left', edges.left);
      frame.classList.toggle('is-scrollable-right', edges.right);
      var height = edges.left || edges.right ? Math.max(0, frame.offsetHeight - frame.clientHeight) : 0;
      var next = height ? height + 'px' : '';
      if (next === bar) return;
      bar = next;
      if (next) frame.style.setProperty('--rm-fade-bar', next);
      else frame.style.removeProperty('--rm-fade-bar');
    }
    function schedule() { if (!pending && !stopped) pending = win.requestAnimationFrame(draw); }
    var Observer = win.ResizeObserver;
    observer = typeof Observer === 'function' ? new Observer(draw) : null;
    frame.addEventListener('scroll', schedule, { passive: true });
    if (observer) { observer.observe(frame, { box: 'border-box' }); observer.observe(content); }
    schedule();
    return stop;
  }
`;

/** The page's behaviour, run once the page is read (the script is the body's last element). */
const PAGE_BEHAVIOUR = String.raw`
  var doc = document, root = doc.documentElement;
  var box = doc.getElementById('slidebox'), text = doc.getElementById('text');
  var header = doc.querySelector('.top'), stage = doc.querySelector('.stage');
  var pos = doc.getElementById('pos'), bar = doc.getElementById('bar'), stitle = doc.getElementById('stitle');
  var prev = doc.getElementById('prev'), next = doc.getElementById('next');
  var toc = doc.getElementById('toc'), tocbtn = doc.getElementById('tocbtn'), note = doc.getElementById('toast');
  if (!box || !text || !header || !stage) return;
  // ---- the page's address in the printed handout's footer (the decks README, small details 13): this page's own,
  // without the part's #, given only by a page on the web (a file opened from disk has no address to give)
  var addr = doc.getElementById('paddr');
  if (addr && /^https?:$/.test(window.location.protocol)) addr.textContent = window.location.origin + window.location.pathname;
  var list = function (nodes) { return Array.prototype.slice.call(nodes); };
  var layers = list(box.querySelectorAll('.layer'));
  var parts = list(text.querySelectorAll('.part[data-i]'));
  var goers = toc ? list(toc.querySelectorAll('[data-go]')) : [];
  var count = parts.length;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var cur = -1, lockUntil = 0, frame = 0;
  // Where this reader is: the page's own place in this browser's storage (its client and title, as the ticks are).
  var storage = storageOf(window), placeKey = text.getAttribute('data-place') || 'ritemark-place';
  var restart = doc.getElementById('restart'), restartTimer = 0, pointerHeld = false, focusHeld = false;
  // The part the page opened at, until the reader moves: the fonts settling or a picture loading above it may move it,
  // and the page goes back to it. landedAt is where the page put it, so any other scroll is the reader's.
  var landing = null, landedAt = -1;

  // ---- where the text is read: under the top bar, or on a phone under the band that holds the slide
  var phone = function () { return window.innerWidth <= 860; };
  var areaTop = function () { return (phone() ? stage : header).getBoundingClientRect().bottom; };
  function state() {
    var area = areaTop(), y = window.scrollY;
    return {
      partTops: parts.map(function (part) { return part.getBoundingClientRect().top - area + y; }),
      scrollTop: y,
      clientHeight: window.innerHeight - area,
      scrollHeight: root.scrollHeight - area,
      writing: null
    };
  }

  // ---- the slide: drawn on a 960 x 540 canvas, scaled to its box
  function scale() {
    var width = box.clientWidth;
    if (width > 0) box.style.setProperty('--k', String(width / 960));
  }
  // Room under the last part, so it too can be read from the top (the deck view's handout has the same room)
  function room() {
    if (!count) return;
    var s = state(), padding = parseFloat(window.getComputedStyle(text).paddingBottom) || 0;
    var end = text.getBoundingClientRect().bottom - areaTop() + window.scrollY - padding;
    var space = Math.round(Math.max(40, s.clientHeight - (end - s.partTops[count - 1]) - PART_TOP_GAP));
    if (Math.abs(space - padding) > 1) text.style.paddingBottom = space + 'px';
  }

  function show(index) {
    if (index === null || index === cur || index < 0 || index >= count) return;
    cur = index;
    layers.forEach(function (layer, at) { layer.classList.toggle('on', at === index); });
    var title = layers[index] ? layers[index].getAttribute('data-title') || '' : '';
    if (pos) pos.textContent = (index + 1) + ' / ' + count;
    if (bar) bar.style.width = ((index + 1) / count * 100) + '%';
    if (stitle) stitle.textContent = (index + 1) + (title ? ' \u00b7 ' + title : '');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === count - 1;
    // Every part but the current one is dimmed; a section's band stays, its words dim (the Experience lead, PR 3).
    parts.forEach(function (part, at) { part.classList.toggle('dim', at !== index); });
    goers.forEach(function (button) { button.classList.toggle('on', Number(button.getAttribute('data-go')) === index); });
    address(index);
    keepPlace(storage, placeKey, index);
  }

  // The address follows the part being read, in place: the browser's history gets no entry for it.
  function address(index) {
    var want = addressFor(index);
    if ((window.location.hash || '') === want) return;
    try { window.history.replaceState(window.history.state, '', want || window.location.pathname + window.location.search); } catch (error) { /* an address that can't change stays as it is */ }
  }

  // At once when the page opens at a part (instant), smoothly otherwise. The top is the page's top, above any words
  // before the first part.
  function go(index, instant, top) {
    if (!count) return;
    index = Math.max(0, Math.min(count - 1, index));
    var s = state();
    lockUntil = Date.now() + (reduced || instant ? 400 : 1200);
    show(index);
    window.scrollTo({ top: top && index === 0 ? 0 : scrollTopFor(s.partTops[index]), behavior: reduced || instant ? 'auto' : 'smooth' });
  }

  window.addEventListener('scroll', function () {
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      if (Date.now() < lockUntil) return;
      show(currentPart(state()));
    });
  }, { passive: true });

  // One turn of the wheel moves the slide on by one at most, as in the deck view: the turn stops where the next part
  // is the current one, and that part is shown at once.
  window.addEventListener('wheel', function (event) {
    lockUntil = 0;
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (toc && !toc.hidden && event.target && event.target.closest && event.target.closest('.toc')) return;
    var s = state();
    var delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaMode === 2 ? event.deltaY * s.clientHeight : event.deltaY;
    var stop = wheelStop(s, delta, cur);
    if (stop === null) return;
    event.preventDefault();
    window.scrollTo(0, stop);
    show(currentPart({ partTops: s.partTops, scrollTop: stop, clientHeight: s.clientHeight, scrollHeight: s.scrollHeight, writing: null }));
  }, { passive: false });
  window.addEventListener('touchstart', function () { lockUntil = 0; }, { passive: true });

  if (prev) prev.addEventListener('click', function () { go(cur - 1); });
  if (next) next.addEventListener('click', function () { go(cur + 1); });

  // ---- Contents: every part by its title; a finished exercise shows a tick
  function finished() {
    goers.forEach(function (button) {
      var part = parts[Number(button.getAttribute('data-go'))];
      if (!part || !part.hasAttribute('data-exercise')) return;
      var ticks = list(part.querySelectorAll('input[data-tick]'));
      button.classList.toggle('finished', ticks.length > 0 && ticks.every(function (tick) { return tick.checked; }));
    });
  }
  function closeContents(focus) {
    if (!toc || toc.hidden) return;
    toc.hidden = true;
    tocbtn.setAttribute('aria-expanded', 'false');
    if (focus) tocbtn.focus();
  }
  if (toc && tocbtn) {
    tocbtn.addEventListener('click', function (event) {
      event.stopPropagation();
      if (!toc.hidden) { closeContents(false); return; }
      finished();
      toc.hidden = false;
      tocbtn.setAttribute('aria-expanded', 'true');
    });
  }
  doc.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target : null;
    var goer = target ? target.closest('[data-go]') : null;
    if (goer) { go(Number(goer.getAttribute('data-go'))); closeContents(false); return; }
    if (toc && !toc.hidden && !(target && target.closest('.toc'))) closeContents(false);
  });

  window.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') { closeContents(true); return; }
    var target = event.target;
    if (target && target.closest && target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'j') { event.preventDefault(); go(cur + 1); }
    else if (event.key === 'k') { event.preventDefault(); go(cur - 1); }
  });

  // ---- an exercise's ticks: kept in this browser only
  var store = text.getAttribute('data-store') || 'ritemark-ticks';
  var kept = {};
  try { kept = JSON.parse(storage.getItem(store) || '{}') || {}; } catch (error) { kept = {}; }
  list(text.querySelectorAll('input[data-tick]')).forEach(function (tick) {
    var id = tick.getAttribute('data-tick');
    if (Object.prototype.hasOwnProperty.call(kept, id)) tick.checked = kept[id] === true;
  });
  text.addEventListener('change', function (event) {
    var tick = event.target;
    var id = tick && tick.getAttribute ? tick.getAttribute('data-tick') : null;
    if (!id) return;
    kept[id] = tick.checked === true;
    try { storage.setItem(store, JSON.stringify(kept)); } catch (error) { /* a browser that keeps nothing keeps the tick until the page closes */ }
    finished();
  });

  // ---- Copy: the prompt's own words; where the browser won't copy, they are selected for the person to copy
  var noteTimer = 0;
  function say(words) {
    if (!note) return;
    note.textContent = words;
    note.hidden = false;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(function () { note.hidden = true; }, 2600);
  }
  // One Copy for the text's prompts and the slides' code blocks: the block's own words; where the browser won't copy,
  // they are selected for the person to copy.
  function copyWords(button, code) {
    var words = code.textContent || '';
    var copied = function () {
      button.classList.add('ok');
      window.clearTimeout(button.okTimer);
      button.okTimer = window.setTimeout(function () { button.classList.remove('ok'); }, 1600);
    };
    var select = function () {
      var range = doc.createRange();
      range.selectNodeContents(code);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      var done = false;
      try { done = doc.execCommand('copy') === true; } catch (error) { done = false; }
      if (done) { selection.removeAllRanges(); copied(); return; }
      // On a touch screen there are no keys to press: the phone's own menu has Copy (the Experience lead, PR 3).
      var touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      say(touch ? 'Selected. Tap Copy in your phone\'s menu.' : 'Selected. Press Ctrl+C or \u2318C to copy.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(words).then(copied, select);
      else select();
    } catch (error) { select(); }
  }
  text.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('.copy') : null;
    if (!button) return;
    var code = button.parentNode ? button.parentNode.querySelector('code') : null;
    if (code) copyWords(button, code);
  });

  // ---- a slide's code block (Sprint 163 PR 1): Copy takes the whole block, as the text's Copy does; the arrow opens its
  // menu of two links (Open in Claude, Open in ChatGPT), which the reader follows in a new tab. The menu is the page's
  // own markup, shown and hidden here; a click elsewhere or Esc closes it.
  function closeCodeMenus(keep) {
    var closed = false;
    list(box.querySelectorAll('.cb-menu')).forEach(function (menu) {
      if (menu === keep || menu.hidden) return;
      menu.hidden = true;
      var opener = menu.parentNode ? menu.parentNode.querySelector('.cb-open') : null;
      if (opener) opener.setAttribute('aria-expanded', 'false');
      closed = true;
    });
    return closed;
  }
  doc.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target : null;
    var tools = target ? target.closest('.cb-tools') : null;
    if (!tools || !box.contains(tools)) { closeCodeMenus(null); return; }
    if (target.closest('.cb-item')) { closeCodeMenus(null); return; }
    var button = target.closest('.cb-copy');
    if (button) {
      closeCodeMenus(null);
      var code = tools.parentNode ? tools.parentNode.querySelector('code') : null;
      if (code) copyWords(button, code);
      return;
    }
    var opener = target.closest('.cb-open');
    var menu = tools.querySelector('.cb-menu');
    if (!opener || !menu) return;
    var opening = menu.hidden;
    closeCodeMenus(menu);
    menu.hidden = !opening;
    opener.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && closeCodeMenus(null)) event.stopPropagation();
  }, true);

  // ---- a picture, full size (experience 49): a click on a picture in the text or on the slide shows a copy of it over
  // the page, whole; a click anywhere or Esc closes it. The copy is the page's own picture (no new address, nothing
  // loaded), without its crop.
  var zoom = doc.getElementById('zoom'), zoomPic = zoom ? zoom.querySelector('.zoom-pic') : null, zoomFrom = null;
  function closeZoom() {
    if (!zoom || zoom.hidden) return;
    zoom.hidden = true;
    while (zoomPic && zoomPic.firstChild) zoomPic.removeChild(zoomPic.firstChild);
    if (zoomFrom && zoomFrom.focus) zoomFrom.focus();
    zoomFrom = null;
  }
  function openZoom(picture) {
    if (!zoom || !zoomPic) return;
    var copy = picture.cloneNode(false);
    copy.removeAttribute('style');
    copy.removeAttribute('class');
    copy.removeAttribute('loading');
    if (picture.tagName !== 'IMG') {
      // A slide's picture beside or behind its words is its place's background: shown whole.
      copy.className = 'zoom-photo';
      copy.style.backgroundImage = picture.style.backgroundImage;
    }
    while (zoomPic && zoomPic.firstChild) zoomPic.removeChild(zoomPic.firstChild);
    zoomPic.appendChild(copy);
    zoomFrom = doc.activeElement;
    zoom.hidden = false;
    zoom.focus();
  }
  if (zoom) zoom.addEventListener('click', closeZoom);
  doc.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target : null;
    if (!target || (zoom && zoom.contains(target))) return;
    var picture = target.closest('.part img, .pre img, .stage .deck-sl img, .stage .deck-sl .photo');
    if (!picture || (picture.classList.contains('photo') && (picture.classList.contains('empty') || !picture.style.backgroundImage))) return;
    // A picture that is a link's words opens the link, as before.
    if (picture.closest('a')) return;
    event.preventDefault();
    openZoom(picture);
  });
  window.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeZoom(); }, true);

  // ---- "Start from the beginning": in the bar for 5 s when the page returns to a reader's place; it waits while the
  // pointer or the focus is on it, and goes to the top
  function hideRestart() {
    if (!restart) return;
    window.clearTimeout(restartTimer);
    restartTimer = 0;
    restart.hidden = true;
  }
  function offerRestart() {
    if (!restart) return;
    restart.hidden = false;
    window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(function () { restartTimer = 0; if (!pointerHeld && !focusHeld) hideRestart(); }, PLACE_NOTICE_MS);
  }
  if (restart) {
    var letGo = function () { if (!restartTimer && !pointerHeld && !focusHeld) hideRestart(); };
    restart.addEventListener('mouseenter', function () { pointerHeld = true; });
    restart.addEventListener('mouseleave', function () { pointerHeld = false; letGo(); });
    restart.addEventListener('focus', function () { focusHeld = true; });
    restart.addEventListener('blur', function () { focusHeld = false; letGo(); });
    restart.addEventListener('click', function () {
      // The focus goes on to Contents beside it, not to the page's start, before the button goes.
      if (doc.activeElement === restart && tocbtn) tocbtn.focus();
      pointerHeld = focusHeld = false;
      hideRestart();
      landing = null;
      go(0, false, true);
    });
  }

  // A part's address typed or followed while the page is open (Back to the page's own address too) goes to that part.
  window.addEventListener('hashchange', function () {
    var index = window.location.hash ? linkedPart(window.location.hash, count) : 0;
    if (index === null || !count) return;
    landing = null;
    hideRestart();
    go(index, false, true);
  });
  // The reader moving lets the page's opening part go: a wheel, a touch, a key, a click, or a scroll the page didn't
  // make (a dragged scroll bar).
  var moved = function () { landing = null; };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (type) { window.addEventListener(type, moved, { passive: true }); });
  window.addEventListener('scroll', function () { if (landing !== null && Math.abs(window.scrollY - landedAt) > 1) landing = null; }, { passive: true });
  function land() {
    if (landing === null) return;
    go(landing, true, true);
    landedAt = window.scrollY;
  }
  doc.addEventListener('load', function (event) { if (event.target && event.target.tagName === 'IMG') land(); }, true);

  // ---- a wide table's soft edges: the side with more to scroll to fades (PAGE_EDGE_RULE)
  list(doc.querySelectorAll('.tw')).forEach(function (frame) { watchTableEdges(frame, frame.firstElementChild || frame, window); });

  // ---- start: the slide sized and the room set; then the part the address names (#6), else this reader's last part
  // with "Start from the beginning", else the part in view
  function settle() { scale(); room(); }
  window.addEventListener('resize', function () { settle(); show(currentPart(state())); });
  settle();
  var linked = linkedPart(window.location.hash, count);
  var returned = linked === null ? readPlace(storage, placeKey, count) : null;
  landing = linked !== null ? linked : returned;
  if (landing !== null) land();
  else show(count ? currentPart(state()) || 0 : null);
  if (returned !== null) offerRestart();
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { settle(); land(); });
`;

/** The whole script, in its own scope. */
export const PAGE_SCRIPT = `(function () {\n  'use strict';\n${PAGE_SCROLL_RULE}${PAGE_PLACE_RULE}${PAGE_EDGE_RULE}${PAGE_BEHAVIOUR}})();`;

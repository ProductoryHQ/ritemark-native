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

/** The page's behaviour, run once the page is read (the script is the body's last element). */
const PAGE_BEHAVIOUR = String.raw`
  var doc = document, root = doc.documentElement;
  var box = doc.getElementById('slidebox'), text = doc.getElementById('text');
  var header = doc.querySelector('.top'), stage = doc.querySelector('.stage');
  var pos = doc.getElementById('pos'), bar = doc.getElementById('bar'), stitle = doc.getElementById('stitle');
  var prev = doc.getElementById('prev'), next = doc.getElementById('next');
  var toc = doc.getElementById('toc'), tocbtn = doc.getElementById('tocbtn'), note = doc.getElementById('toast');
  if (!box || !text || !header || !stage) return;
  var list = function (nodes) { return Array.prototype.slice.call(nodes); };
  var layers = list(box.querySelectorAll('.layer'));
  var parts = list(text.querySelectorAll('.part[data-i]'));
  var goers = toc ? list(toc.querySelectorAll('[data-go]')) : [];
  var count = parts.length;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var cur = -1, lockUntil = 0, frame = 0;

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
  }

  function go(index) {
    if (!count) return;
    index = Math.max(0, Math.min(count - 1, index));
    var s = state();
    lockUntil = Date.now() + (reduced ? 400 : 1200);
    show(index);
    window.scrollTo({ top: scrollTopFor(s.partTops[index]), behavior: reduced ? 'auto' : 'smooth' });
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
      if (!part || !part.querySelector('.lab .tag')) return;
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
  try { kept = JSON.parse(window.localStorage.getItem(store) || '{}') || {}; } catch (error) { kept = {}; }
  list(text.querySelectorAll('input[data-tick]')).forEach(function (tick) {
    var id = tick.getAttribute('data-tick');
    if (Object.prototype.hasOwnProperty.call(kept, id)) tick.checked = kept[id] === true;
  });
  text.addEventListener('change', function (event) {
    var tick = event.target;
    var id = tick && tick.getAttribute ? tick.getAttribute('data-tick') : null;
    if (!id) return;
    kept[id] = tick.checked === true;
    try { window.localStorage.setItem(store, JSON.stringify(kept)); } catch (error) { /* a browser that keeps nothing keeps the tick until the page closes */ }
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
  text.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('.copy') : null;
    if (!button) return;
    var code = button.parentNode ? button.parentNode.querySelector('code') : null;
    if (!code) return;
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
  });

  // ---- start: the slide sized, the room set, and the part in view shown (an address's #s4 goes to slide 4)
  function settle() { scale(); room(); }
  window.addEventListener('resize', function () { settle(); show(currentPart(state())); });
  settle();
  show(count ? currentPart(state()) || 0 : null);
  var wanted = /^#s(\d+)$/.exec(window.location.hash || '');
  if (wanted) go(Number(wanted[1]) - 1);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(settle);
`;

/** The whole script, in its own scope. */
export const PAGE_SCRIPT = `(function () {\n  'use strict';\n${PAGE_SCROLL_RULE}${PAGE_BEHAVIOUR}})();`;

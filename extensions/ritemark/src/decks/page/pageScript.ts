/**
 * Sprint 163 PR 4 (the decks README, "The page and Present are one player"): the published page's one inline script,
 * the reader's seat of Present's player.
 *
 *  - **One slide at a time, filling the window** as on the wall: the frame is the 16:9 area, as large as fits and
 *    centred above the quiet line (the wall's `wallSlideSize`), and a picture beside or behind runs to the window's edges
 *    (`wallBleed`). Below 860 px the page's CSS lays the slide's blocks in one column and the page scrolls instead.
 *  - **The wall's motion** (README items 18 to 20), with the wall's own numbers (`wallMotion.ts`, put into the script
 *    below): going on, the slide before leaves as one and the new slide's pieces arrive in a row, in reading order
 *    (`rowDelays`); going back or a jump shows the slide whole with the deck's transition (Fade, Push, Zoom); None and
 *    reduced motion cut. A press during any of it puts everything at its end at once and goes on.
 *  - **One by one** (item 18): a slide whose blocks reveal opens with their first item when the reader goes on to it; each
 *    press shows the next with the wall's rise, and back hides the last; a jump, Contents or going back shows it whole.
 *  - **The quiet line**: ‹ n / N ›, the 2 px line for how far along, More (the slide's text beside it, or under it in one
 *    column; the choice kept on this device), and Contents, which opens upward and jumps.
 *  - **The ticks** (the decks README, "The ticks stay"): a tap on a step's number turns it into a check, kept on this
 *    device per deck, slide and step; Contents shows a finished exercise with a check.
 *  - The arrow keys, Page Up and Down, the space bar (not in one column, where it scrolls) and a swipe move; Home and End
 *    jump; `#7` opens slide 7, and the address follows the slide (`history.replaceState`); opened again without a link,
 *    the page returns to the reader's last slide with "Start from the beginning" for 5 s.
 *  - Copy on every code block (the slide's and the text's), the slide's ↗ menu, the full-size picture, a wide table's soft
 *    edges, and the printed handout's footer address, as before.
 *
 * It only shows, hides and moves what the page already holds: it sets no `src` or `href`, loads nothing, and writes no
 * HTML (text goes in through `textContent`), so 2.2's gather sees every file the page uses and its
 * `scriptBuildsReferences` stays false (the test checks).
 */
import { EASE_IN_OUT, EASE_OUT, MOTION_MS, REVEAL_MS, REVEAL_RISE, ROW, ZOOM_FROM } from '../../../webview/src/components/decks/present/wallMotion';

import { PAGE_TABS_FIT } from '../blocks/tabsFit';

/**
 * The wall's motion, as plain JavaScript with the wall's own numbers (`pageScript.test.ts` runs it): the row's timing
 * (README item 20: 70 ms apart up to eight pieces, the gap shrinking to 28 ms at least with more, and from the 14th piece
 * on the rest come with the 14th) and the one-by-one steps (item 18, `revealSteps.ts`).
 */
export const PAGE_MOTION_RULE = String.raw`
  var MOTION = { fade: ${MOTION_MS.fade}, push: ${MOTION_MS.push}, zoom: ${MOTION_MS.zoom} };
  var ZOOM_FROM = ${ZOOM_FROM}, REVEAL_MS = ${REVEAL_MS}, REVEAL_RISE = ${REVEAL_RISE};
  var ROW_GAP = ${ROW.gap}, ROW_MIN_GAP = ${ROW.minGap}, ROW_SPAN = ${ROW.span}, ROW_LAST = ${ROW.last}, ROW_MS = ${ROW.ms}, ROW_RISE = ${ROW.rise}, ROW_ZOOM = ${ROW.zoom}, LEAVE_MS = ${ROW.leaveMs}, PUSH_ROW_GAP = ${ROW.pushGap}, PUSH_MS = ${MOTION_MS.push};
  var EASE_OUT = '${EASE_OUT}', EASE_IN_OUT = '${EASE_IN_OUT}';
  // When each of a slide's n pieces starts, after the lead.
  function rowDelays(n, lead, push) {
    var gap = push ? PUSH_ROW_GAP : n <= 8 ? ROW_GAP : Math.max(ROW_MIN_GAP, Math.round(ROW_SPAN / (n - 1)));
    var out = [];
    for (var index = 0; index < n; index++) out.push(lead + Math.min(index, ROW_LAST) * gap);
    return out;
  }
  // A slide reached by going on opens with its first item; any other way, whole. Null: nothing to reveal.
  function revealOnArrival(count, onward) { return count > 0 ? (onward ? 1 : count) : null; }
  // A press on a slide with items: the next shown, or the last hidden; null when the press moves to another slide.
  function revealStep(shown, count, forward) {
    if (shown === null || !(count > 0)) return null;
    if (forward) return shown < count ? shown + 1 : null;
    return shown > 1 ? shown - 1 : null;
  }
  // Nothing moves with reduced motion, nor in a deck whose transition is None (a cut).
  function stillFor(transition, reduced) { return reduced || transition === 'none'; }
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
  var doc = document, body = doc.body;
  var wrap = doc.getElementById('wrap'), view = doc.getElementById('view'), frame = doc.getElementById('frame');
  var side = doc.getElementById('side'), sclose = doc.getElementById('sclose');
  var pos = doc.getElementById('pos'), bar = doc.getElementById('bar');
  var prev = doc.getElementById('prev'), next = doc.getElementById('next');
  var morebtn = doc.getElementById('morebtn'), moresep = doc.getElementById('moresep');
  var toc = doc.getElementById('toc'), tocbtn = doc.getElementById('tocbtn'), note = doc.getElementById('toast');
  var restart = doc.getElementById('restart');
  if (!frame || !view || !body) return;
  var LINE_H = 44, NARROW = '(max-width: 860px)', SIDE_MIN = 340, SIDE_MAX = 480;
  // ---- the page's address in the printed handout's footer (the decks README, small details 13): this page's own,
  // without the slide's #, given only by a page on the web (a file opened from disk has no address to give)
  var addr = doc.getElementById('paddr');
  if (addr && /^https?:$/.test(window.location.protocol)) addr.textContent = window.location.origin + window.location.pathname;
  var list = function (nodes) { return Array.prototype.slice.call(nodes); };
  var layers = list(frame.querySelectorAll('.layer'));
  var parts = side ? list(side.querySelectorAll('.part')) : [];
  var pre = side ? side.querySelector('.pre') : null;
  var goers = toc ? list(toc.querySelectorAll('[data-go]')) : [];
  var count = layers.length;
  var storage = storageOf(window);
  var placeKey = body.getAttribute('data-place') || 'ritemark-place';
  var transition = body.getAttribute('data-transition') || 'fade';
  var cur = 0, shown = null, open = false;
  var narrow = function () { return !!(window.matchMedia && window.matchMedia(NARROW).matches); };
  var reduced = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };
  try { open = !!storage && storage.getItem(placeKey + '-more') === '1'; } catch (error) { open = false; }
  var itemsOf = function (index) { var layer = layers[index]; return layer ? Number(layer.getAttribute('data-items')) || 0 : 0; };
  var hasText = function (index) {
    var part = parts[index];
    return (!!part && !part.classList.contains('only')) || (index === 0 && !!pre);
  };

  // ---- the frame: 16:9, as large as fits above the line (and beside More when it is open), centred, as the wall's
  function layout() {
    var wide = !narrow(), showSide = open && hasText(cur);
    var sw = Math.round(Math.max(SIDE_MIN, Math.min(SIDE_MAX, window.innerWidth * 0.34)));
    if (side) {
      side.hidden = !showSide;
      side.style.setProperty('--sw', sw + 'px');
    }
    if (wrap) wrap.classList.toggle('more-open', showSide);
    if (!wide) {
      frame.style.left = frame.style.top = frame.style.width = frame.style.height = '';
      // A slide drawn as a picture (a kind this build doesn't lay out in one column) keeps its scale at the column's width.
      frame.style.setProperty('--k', String(Math.max(0, frame.getBoundingClientRect ? frame.getBoundingClientRect().width : window.innerWidth - 32) / 960));
      frame.style.removeProperty('--bleed-x');
      frame.style.removeProperty('--bleed-y');
      return;
    }
    var areaW = Math.max(0, window.innerWidth - (showSide ? sw : 0)), areaH = Math.max(0, window.innerHeight - LINE_H);
    var w = Math.max(0, Math.min(areaW, Math.round(areaH * 16 / 9))), h = Math.round(w * 9 / 16);
    var left = Math.round((areaW - w) / 2), top = Math.round((areaH - h) / 2);
    var k = w / 960;
    frame.style.left = left + 'px';
    frame.style.top = top + 'px';
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.style.setProperty('--k', String(k));
    // The ground and a picture beside or behind run to the window's edges (the wall's wallBleed, in the canvas's pixels).
    var bleed = function (band) { return band > 0 && k > 0 ? Math.ceil((band + 1) / k) : 0; };
    frame.style.setProperty('--bleed-x', bleed(Math.max(left, areaW - left - w)) + 'px');
    frame.style.setProperty('--bleed-y', bleed(Math.max(top, areaH - top - h)) + 'px');
  }

  // ---- the motion: one run at a time; a press puts it at its end at once and goes on
  var running = [], leavers = [], runTimer = 0;
  function finishMotion() {
    window.clearTimeout(runTimer);
    runTimer = 0;
    running.forEach(function (animation) { try { animation.finish(); } catch (error) { /* gone */ } });
    running.forEach(function (animation) { try { animation.cancel(); } catch (error) { /* gone */ } });
    running = [];
    leavers.forEach(function (layer) { layer.classList.remove('leaving'); });
    leavers = [];
  }
  function animate(element, keyframes, ms, delay, easing) {
    if (!element || typeof element.animate !== 'function') return 0;
    running.push(element.animate(keyframes, { duration: ms, delay: delay || 0, easing: easing || 'ease', fill: 'backwards' }));
    return (delay || 0) + ms;
  }
  // A slide's pieces in reading order (README item 20): the title, a paragraph, each point of a list, each box, step and
  // column, a table, a picture in the words. An item not shown yet waits; the logo never moves.
  function piecesOf(layer) {
    var flow = layer.querySelector('.blk-flow'), out = [];
    if (!flow) return [layer.querySelector('.deck-sl') || layer];
    var walk = function (element) {
      if (element.hasAttribute('data-reveal-hidden')) return;
      var tag = element.tagName;
      var c = element.classList;
      if (tag === 'UL' || tag === 'OL' || c.contains('blk-boxes') || c.contains('blk-columns') || c.contains('blk-steps') || c.contains('blk-group')) {
        list(element.children).forEach(walk);
        return;
      }
      out.push(element);
    };
    list(flow.children).forEach(walk);
    return out;
  }
  function frameWidth() { return frame.getBoundingClientRect().width || window.innerWidth; }
  // Going on: the slide before leaves as one, and the new one's pieces arrive in a row (README item 20).
  function arrive(leaving, entering) {
    var end = 0, push = transition === 'push', width = frameWidth();
    if (leaving) {
      end = push
        ? animate(leaving, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-width) + 'px)' }], PUSH_MS, 0, EASE_IN_OUT)
        : animate(leaving, [{ opacity: 1 }, { opacity: 0 }], LEAVE_MS, 0, 'cubic-bezier(0.4, 0, 1, 1)');
    }
    var lead = push ? 0 : leaving ? LEAVE_MS - 10 : 0;
    var pieces = piecesOf(entering), delays = rowDelays(pieces.length, lead, push);
    pieces.forEach(function (piece, index) {
      var frames = push
        ? [{ transform: 'translateX(960px)' }, { transform: 'none' }]
        : transition === 'zoom'
          ? [{ opacity: 0, transform: 'scale(' + ROW_ZOOM + ')' }, { opacity: 1, transform: 'none' }]
          : [{ opacity: 0, transform: 'translateY(' + ROW_RISE + 'px)' }, { opacity: 1, transform: 'none' }];
      end = Math.max(end, animate(piece, frames, push ? PUSH_MS : ROW_MS, delays[index], push ? EASE_IN_OUT : EASE_OUT));
    });
    // A picture on the side slides in from its own edge as the title comes; one Behind settles under the words.
    var photo = entering.querySelector('.deck-sl.is-blocks .photo');
    if (photo && !push) {
      var sl = photo.parentNode;
      if (sl.classList.contains('pic-behind')) end = Math.max(end, animate(photo, [{ transform: 'scale(1.04)' }, { transform: 'none' }], 900, 0, EASE_OUT));
      else end = Math.max(end, animate(photo, [{ opacity: 0, transform: 'translateX(' + (sl.classList.contains('pic-left') ? -28 : 28) + 'px)' }, { opacity: 1, transform: 'none' }], ROW_MS, lead, EASE_OUT));
    }
    return end;
  }
  // Going back or a jump: the slide whole, with the deck's transition (the wall's playStep).
  function whole(leaving, entering, back) {
    var width = frameWidth(), way = back ? -1 : 1;
    if (transition === 'push') {
      animate(entering, [{ transform: 'translateX(' + (way * width) + 'px)' }, { transform: 'translateX(0)' }], MOTION.push, 0, EASE_IN_OUT);
      return animate(leaving, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (-way * width) + 'px)' }], MOTION.push, 0, EASE_IN_OUT);
    }
    if (transition === 'zoom') {
      animate(entering, [{ opacity: 0, transform: 'scale(' + ZOOM_FROM + ')' }, { opacity: 1, transform: 'scale(1)' }], MOTION.zoom, 0, EASE_OUT);
      return animate(leaving, [{ opacity: 1 }, { opacity: 0 }], MOTION.zoom, 0, EASE_OUT);
    }
    animate(entering, [{ opacity: 0 }, { opacity: 1 }], MOTION.fade, 0, 'ease');
    return animate(leaving, [{ opacity: 1 }, { opacity: 0 }], MOTION.fade, 0, 'ease');
  }

  // ---- one by one (README item 18): the items not shown yet keep their places, hidden
  function drawReveal(layer, upTo) {
    list(layer.querySelectorAll('[data-reveal-item]')).forEach(function (item) {
      var hide = upTo !== null && Number(item.getAttribute('data-reveal-item')) >= upTo;
      if (hide) item.setAttribute('data-reveal-hidden', '');
      else item.removeAttribute('data-reveal-hidden');
    });
  }

  // ---- the line, More, Contents and the address follow the slide
  function drawLine() {
    if (pos) pos.textContent = count ? (cur + 1) + ' / ' + count : '';
    if (bar) bar.style.width = (count ? ((cur + 1) / count) * 100 : 0) + '%';
    var items = itemsOf(cur);
    if (prev) prev.disabled = cur <= 0 && !(shown !== null && shown > 1);
    if (next) next.disabled = cur >= count - 1 && !(shown !== null && shown < items);
    var text = hasText(cur);
    if (morebtn) {
      morebtn.hidden = !text;
      morebtn.setAttribute('aria-expanded', open && text ? 'true' : 'false');
      morebtn.setAttribute('data-tip', open && text ? 'Hide the text for this slide' : 'The text for this slide');
    }
    if (moresep) moresep.hidden = !text;
    parts.forEach(function (part, index) { part.classList.toggle('on', index === cur); });
    if (pre) pre.classList.toggle('on', cur === 0);
    goers.forEach(function (button) { button.classList.toggle('on', Number(button.getAttribute('data-go')) === cur); });
  }
  function address(index) {
    var wanted = addressFor(index);
    if ((window.location.hash || '') === wanted) return;
    try { window.history.replaceState(null, '', wanted || (window.location.pathname + window.location.search)); } catch (error) { /* a page opened where the address can't change */ }
  }
  // how: 'next' (a press going on), 'back' (a press going back), 'jump' (Contents, a link, Home, End), 'still' (as it is)
  function go(index, how) {
    if (!count) return;
    index = Math.max(0, Math.min(count - 1, index));
    finishMotion();
    var leaving = layers[cur], entering = layers[index], moved = index !== cur;
    // The focus never stays on a slide that goes (a tick, a tab, Copy): it moves to the slide that comes, which a screen
    // reader then names ("Slide 3 of 8: ...").
    var focusWasOn = moved && leaving && doc.activeElement && leaving.contains(doc.activeElement);
    cur = index;
    shown = revealOnArrival(itemsOf(index), how === 'next' && moved);
    drawReveal(entering, shown);
    layers.forEach(function (layer, at) {
      layer.classList.toggle('on', at === index);
      if (at === index) layer.removeAttribute('aria-hidden'); else layer.setAttribute('aria-hidden', 'true');
    });
    layout();
    // A Tabs block is measured once it is laid out: a slide not shown has no width (README: a tab is never cut).
    fitTabBands();
    drawLine();
    address(index);
    keepPlace(storage, placeKey, index);
    if (focusWasOn && entering.focus) { try { entering.focus({ preventScroll: true }); } catch (error) { entering.focus(); } }
    if (!moved || how === 'still') return;
    if (narrow()) { try { window.scrollTo(0, 0); } catch (error) { /* no scroll */ } }
    if (side) side.scrollTop = 0;
    if (stillFor(transition, reduced())) return;
    leaving.classList.add('leaving');
    leavers.push(leaving);
    var end = narrow() ? arrive(null, entering) : how === 'next' ? arrive(leaving, entering) : whole(leaving, entering, how === 'back');
    runTimer = window.setTimeout(finishMotion, end + 20);
  }
  // A press: the next item of a slide that reveals, else the next slide; back hides the last item shown, else goes back.
  function step(forward) {
    var stepped = revealStep(shown, itemsOf(cur), forward);
    if (stepped === null) { go(cur + (forward ? 1 : -1), forward ? 'next' : 'back'); return; }
    finishMotion();
    var before = shown;
    shown = stepped;
    var layer = layers[cur];
    drawReveal(layer, shown);
    drawLine();
    if (!forward || stillFor(transition, reduced())) return;
    var item = layer.querySelector('[data-reveal-item="' + before + '"]');
    var end = animate(item, [{ opacity: 0, transform: 'translateY(' + REVEAL_RISE + 'px)' }, { opacity: 1, transform: 'translateY(0)' }], REVEAL_MS, 0, EASE_OUT);
    if (end) runTimer = window.setTimeout(finishMotion, end + 20);
  }
  if (prev) prev.addEventListener('click', function () { step(false); });
  if (next) next.addEventListener('click', function () { step(true); });

  // ---- More: the slide's text beside it (under it in one column); the choice kept on this device
  function setMore(value) {
    open = value;
    try { if (storage) storage.setItem(placeKey + '-more', open ? '1' : '0'); } catch (error) { /* kept for this visit */ }
    layout();
    drawLine();
    if (open && narrow() && side && !side.hidden) side.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  }
  if (morebtn) morebtn.addEventListener('click', function () { setMore(!(open && hasText(cur))); });
  if (sclose) sclose.addEventListener('click', function () { setMore(false); if (morebtn) morebtn.focus(); });

  // ---- the ticks (the decks README, "The ticks stay"): kept in this browser only, per deck, slide and step
  var store = body.getAttribute('data-store') || 'ritemark-ticks';
  var kept = {};
  try { kept = JSON.parse((storage && storage.getItem(store)) || '{}') || {}; } catch (error) { kept = {}; }
  var tickId = function (tick) {
    var layer = tick.closest('.layer');
    return layer ? 'slide:' + layer.getAttribute('data-key') + ':' + tick.getAttribute('data-step') : null;
  };
  function drawTick(tick, done) {
    tick.setAttribute('aria-checked', done ? 'true' : 'false');
    tick.setAttribute('data-tip', done ? 'Done. Tap to undo.' : 'Mark this step done');
    if (tick.parentNode && tick.parentNode.classList) tick.parentNode.classList.toggle('done', done);
  }
  list(frame.querySelectorAll('.tick')).forEach(function (tick) {
    var id = tickId(tick);
    drawTick(tick, !!id && kept[id] === true);
  });
  if (side) list(side.querySelectorAll('input[data-tick]')).forEach(function (tick) {
    var id = tick.getAttribute('data-tick');
    if (Object.prototype.hasOwnProperty.call(kept, id)) tick.checked = kept[id] === true;
  });
  function keepTicks() {
    try { if (storage) storage.setItem(store, JSON.stringify(kept)); } catch (error) { /* a browser that keeps nothing keeps the tick until the page closes */ }
  }
  frame.addEventListener('click', function (event) {
    var tick = event.target && event.target.closest ? event.target.closest('.tick') : null;
    if (!tick) return;
    var id = tickId(tick);
    if (!id) return;
    var done = tick.getAttribute('aria-checked') !== 'true';
    if (done) kept[id] = true; else delete kept[id];
    drawTick(tick, done);
    keepTicks();
    finished();
  });
  if (side) side.addEventListener('change', function (event) {
    var tick = event.target;
    var id = tick && tick.getAttribute ? tick.getAttribute('data-tick') : null;
    if (!id) return;
    kept[id] = tick.checked === true;
    keepTicks();
    finished();
  });

  // ---- Contents: every slide by its title; a finished exercise shows a check in place of its tag
  function finished() {
    goers.forEach(function (button) {
      var index = Number(button.getAttribute('data-go'));
      var layer = layers[index];
      if (!layer || !layer.hasAttribute('data-exercise')) return;
      var steps = list(layer.querySelectorAll('.tick')).map(function (tick) { return tick.getAttribute('aria-checked') === 'true'; });
      var part = parts[index];
      if (part) list(part.querySelectorAll('input[data-tick]')).forEach(function (tick) { steps.push(tick.checked); });
      button.classList.toggle('finished', steps.length > 0 && steps.every(function (done) { return done; }));
    });
  }
  function closeContents(focus) {
    if (!toc || toc.hidden) return false;
    toc.hidden = true;
    if (tocbtn) { tocbtn.setAttribute('aria-expanded', 'false'); if (focus) tocbtn.focus(); }
    return true;
  }
  if (toc && tocbtn) {
    tocbtn.addEventListener('click', function (event) {
      event.stopPropagation();
      if (!toc.hidden) { closeContents(false); return; }
      finished();
      toc.hidden = false;
      tocbtn.setAttribute('aria-expanded', 'true');
      var here = goers[cur] || goers[0];
      if (here) {
        if (here.scrollIntoView) here.scrollIntoView({ block: 'nearest' });
        if (event.detail === 0) here.focus();
      }
    });
    toc.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      var at = goers.indexOf(doc.activeElement);
      var to = at < 0 ? 0 : Math.max(0, Math.min(goers.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)));
      if (goers[to]) goers[to].focus();
    });
  }
  doc.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target : null;
    var goer = target ? target.closest('[data-go]') : null;
    if (goer) { closeContents(false); landing = null; hideRestart(); go(Number(goer.getAttribute('data-go')), 'jump'); return; }
    if (toc && !toc.hidden && !(target && target.closest('.toc'))) closeContents(false);
  });

  // ---- a Tabs block (Sprint 163 PR 2): its tabs are the reader's to choose here, as on the presenter view. The page
  // marks them as tabs for the keyboard and a screen reader; a click or Enter shows that tab's pane, and the arrow keys
  // move between the tabs. The choice is the reader's for this visit only.
  var tabBlocks = list(frame.querySelectorAll('.blk-tabs'));
  // A block's own band and panes (never a Tabs block's inside one of its panes).
  var own = function (block, band, item) {
    var holder = list(block.children).filter(function (child) { return child.classList.contains(band); })[0];
    return holder ? list(holder.children).filter(function (child) { return child.classList.contains(item); }) : [];
  };
  function chooseTab(block, at, focus) {
    var tabs = own(block, 'blk-tabbar', 'blk-tab');
    var panes = own(block, 'blk-tabpanes', 'blk-tabpane');
    if (!tabs[at]) return;
    block.setAttribute('data-active', String(at));
    tabs.forEach(function (tab, index) {
      var on = index === at;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
    });
    panes.forEach(function (pane, index) {
      pane.classList.toggle('is-active', index === at);
      pane.setAttribute('aria-hidden', index === at ? 'false' : 'true');
    });
    if (focus) tabs[at].focus();
  }
  tabBlocks.forEach(function (block, blockIndex) {
    var bandEl = list(block.children).filter(function (child) { return child.classList.contains('blk-tabbar'); })[0];
    if (bandEl) bandEl.setAttribute('role', 'tablist');
    var tabs = own(block, 'blk-tabbar', 'blk-tab');
    var panes = own(block, 'blk-tabpanes', 'blk-tabpane');
    tabs.forEach(function (tab, index) {
      var id = 'tab-' + blockIndex + '-' + index;
      tab.id = id;
      tab.setAttribute('role', 'tab');
      if (panes[index]) { panes[index].setAttribute('role', 'tabpanel'); panes[index].setAttribute('aria-labelledby', id); }
    });
    var active = Number(block.getAttribute('data-active')) || 0;
    chooseTab(block, active < tabs.length ? active : 0, false);
  });
  frame.addEventListener('click', function (event) {
    var tab = event.target && event.target.closest ? event.target.closest('.blk-tab') : null;
    var block = tab ? tab.closest('.blk-tabs') : null;
    if (!tab || !block) return;
    chooseTab(block, list(tab.parentNode.children).indexOf(tab), false);
  });
  frame.addEventListener('keydown', function (event) {
    var tab = event.target && event.target.closest ? event.target.closest('.blk-tab') : null;
    var block = tab ? tab.closest('.blk-tabs') : null;
    if (!tab || !block) return;
    var tabs = list(tab.parentNode.children), at = tabs.indexOf(tab);
    var to = event.key === 'ArrowRight' ? at + 1 : event.key === 'ArrowLeft' ? at - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); chooseTab(block, at, true); return; }
    if (to === null) return;
    event.preventDefault();
    event.stopPropagation();
    chooseTab(block, (to + tabs.length) % tabs.length, true);
  });

  // ---- keys and a swipe, as on the wall
  window.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') { closeContents(true); return; }
    var target = event.target && event.target.closest ? event.target : null;
    if (target && target.closest('input, textarea, select, [contenteditable], .zoom')) return;
    if (toc && !toc.hidden && target && target.closest('.toc')) return;
    // A tab bar and a pane that scrolls keep their own keys.
    if (target && target.closest('[role="tab"], [role="tablist"]') && /^Arrow(Left|Right)$/.test(event.key)) return;
    var key = event.key;
    if (key === 'ArrowRight' || key === 'PageDown' || key === 'j' || (key === ' ' && !narrow() && !(target && target.closest('button, a, [role="checkbox"]')))) { event.preventDefault(); step(true); }
    else if (key === 'ArrowLeft' || key === 'PageUp' || key === 'k') { event.preventDefault(); step(false); }
    else if (key === 'Home') { event.preventDefault(); go(0, 'jump'); }
    else if (key === 'End') { event.preventDefault(); go(count - 1, 'jump'); }
  });
  var touchX = null, touchY = null, touchFrom = null;
  doc.addEventListener('touchstart', function (event) {
    var touch = event.touches && event.touches[0];
    touchX = touch ? touch.clientX : null;
    touchY = touch ? touch.clientY : null;
    touchFrom = event.target;
  }, { passive: true });
  doc.addEventListener('touchend', function (event) {
    var touch = event.changedTouches && event.changedTouches[0];
    if (touchX === null || !touch) return;
    var dx = touch.clientX - touchX, dy = touch.clientY - touchY;
    var from = touchFrom && touchFrom.closest ? touchFrom : null;
    touchX = null;
    // Sideways only, and never where the reader scrolls sideways (a table, a tab bar, a code block) or in the text.
    if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;
    if (from && from.closest('.tw, table, pre, [role="tablist"], .side, .toc, .zoom')) return;
    step(dx < 0);
  }, { passive: true });

  // ---- Copy: the code block's own words; where the browser won't copy, they are selected for the person to copy
  var noteTimer = 0;
  function say(words) {
    if (!note) return;
    note.textContent = words;
    note.hidden = false;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(function () { note.hidden = true; }, 2600);
  }
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
  if (side) side.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('.copy') : null;
    if (!button) return;
    var code = button.parentNode ? button.parentNode.querySelector('code') : null;
    if (code) copyWords(button, code);
  });

  // ---- a slide's code block (Sprint 163 PR 1): Copy takes the whole block; the arrow opens its menu of two links (Open
  // in Claude, Open in ChatGPT), which the reader follows in a new tab. A click elsewhere or Esc closes it.
  function closeCodeMenus(keep) {
    var closed = false;
    list(frame.querySelectorAll('.cb-menu')).forEach(function (menu) {
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
    if (!tools || !frame.contains(tools)) { closeCodeMenus(null); return; }
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
    // Below the arrow, or above it when the slide (which clips) has no room below and more above.
    menu.classList.remove('is-up');
    var flow = opening ? menu.closest('.blk-flow') : null;
    if (flow && !narrow()) {
      var room = flow.getBoundingClientRect(), at = opener.getBoundingClientRect();
      if (menu.getBoundingClientRect().bottom > room.bottom && at.top - room.top > room.bottom - at.bottom) menu.classList.add('is-up');
    }
  });
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && closeCodeMenus(null)) event.stopPropagation();
  }, true);

  // ---- a picture, full size (experience 49): a click on a picture in the text or on the slide shows a copy of it over
  // the page, whole; a click anywhere or Esc closes it. The copy is the page's own picture (no new address, nothing
  // loaded), without its crop.
  var zoom = doc.getElementById('zoom'), zoomPic = zoom ? zoom.querySelector('.zoom-pic') : null, zoomFrom = null;
  function closeZoom() {
    if (!zoom || zoom.hidden) return false;
    zoom.hidden = true;
    while (zoomPic && zoomPic.firstChild) zoomPic.removeChild(zoomPic.firstChild);
    if (zoomFrom && zoomFrom.focus) zoomFrom.focus();
    zoomFrom = null;
    return true;
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
    var picture = target.closest('.part img, .pre img, .layer .deck-sl img, .layer .deck-sl .photo');
    if (!picture || picture.classList.contains('slide-logo') || (picture.classList.contains('photo') && (picture.classList.contains('empty') || !picture.style.backgroundImage))) return;
    // A picture that is a link's words opens the link, as before.
    if (picture.closest('a')) return;
    event.preventDefault();
    openZoom(picture);
  });
  window.addEventListener('keydown', function (event) { if (event.key === 'Escape' && closeZoom()) event.stopPropagation(); }, true);

  // ---- "Start from the beginning": over the line for 5 s when the page returns to a reader's place; it waits while
  // the pointer or the focus is on it, and goes to the first slide
  var restartTimer = 0, pointerHeld = false, focusHeld = false, landing = null;
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
      // The focus goes on to Contents in the line, not to the page's start, before the button goes.
      if (doc.activeElement === restart && tocbtn) tocbtn.focus();
      pointerHeld = focusHeld = false;
      hideRestart();
      go(0, 'jump');
    });
  }

  // A slide's address typed or followed while the page is open (Back to the page's own address too) shows that slide whole.
  window.addEventListener('hashchange', function () {
    var index = window.location.hash ? linkedPart(window.location.hash, count) : 0;
    if (index === null || !count) return;
    hideRestart();
    go(index, 'jump');
  });

  // ---- a wide table's soft edges: the side with more to scroll to fades (PAGE_EDGE_RULE)
  list(doc.querySelectorAll('.tw')).forEach(function (table) { watchTableEdges(table, table.firstElementChild || table, window); });

  // ---- start: the slide the address names (#6), else this reader's last slide with "Start from the beginning", else
  // the first; shown whole, as a jump is
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { finishMotion(); layout(); fitTabBands(); }, 40);
  });
  var linked = linkedPart(window.location.hash, count);
  var returned = linked === null ? readPlace(storage, placeKey, count) : null;
  landing = linked !== null ? linked : returned;
  cur = landing !== null ? landing : 0;
  layers.forEach(function (layer, at) { layer.classList.toggle('on', at === cur); });
  go(cur, 'still');
  finished();
  if (returned !== null) offerRestart();
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { layout(); });
`;

/** The whole script, in its own scope. */
export const PAGE_SCRIPT = `(function () {\n  'use strict';\n${PAGE_PLACE_RULE}${PAGE_EDGE_RULE}${PAGE_MOTION_RULE}${PAGE_BEHAVIOUR}${PAGE_TABS_FIT}})();`;

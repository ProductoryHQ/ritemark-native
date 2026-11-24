/** The second, separately pinned script on a published deck page. */
export const DECK_VERSION_META = 'ritemark-deck-version';
export const DECK_VERSION_PATH = '/version.json';

export const PAGE_FOLLOWER = String.raw`
(function () {
  'use strict';
  var doc = document;
  var versionMeta = doc.querySelector('meta[name="${DECK_VERSION_META}"]');
  var version = versionMeta && Number(versionMeta.content);
  if (!Number.isSafeInteger(version) || version < 1 || !/^https?:$/.test(location.protocol)) return;

  var layers = Array.from(doc.querySelectorAll('#frame > .layer'));
  var keys = layers.map(function (layer) { return layer.getAttribute('data-key'); });
  var store = 'ritemark-follow:' + location.pathname;
  var handoff;
  try { handoff = JSON.parse(sessionStorage.getItem(store)); } catch (error) { return; }
  var restoring = handoff && Number.isSafeInteger(handoff.v) && Date.now() - handoff.at < 60000;
  var floor = restoring ? Math.max(version, handoff.v) : version;
  var lastInput = Date.now();
  var pending, busy = false, leaving = false, timer, fingers = 0, pointers = new Set();
  var updated = doc.getElementById('deck-updated');
  var removed = doc.getElementById('deck-removed');
  var onward = doc.getElementById('deck-onward');
  var position = doc.getElementById('pos');
  var blockSelector = 'h1,h2,h3,h4,h5,h6,p,li,pre,td,th,dt,dd,figcaption,blockquote,'
    + '.blk-label,.blk-by,.blk-tab,.blk-tabname,.eyebrow,.blk-link,'
    + '.deck-sl .st,.deck-sl .sx,.deck-sl .sn,.deck-sl .stc,.deck-sl .sxc,.deck-sl .tag,'
    + '.deck-sl .cap,.deck-sl .ch,.deck-sl .cx,.deck-sl .bh,.deck-sl .bt';
  var request = { cache: 'no-store', mode: 'same-origin', redirect: 'error' };

  function blocks(root, index) {
    var slide = root.querySelector('#s' + (index + 1));
    if (!slide) return [];
    var part = root.querySelector('#t' + (index + 1));
    var nodes = Array.from(slide.querySelectorAll(blockSelector));
    if (part) nodes.push.apply(nodes, part.querySelectorAll(blockSelector));
    return nodes.filter(function (node) {
      return !node.querySelector(blockSelector) && words(node);
    });
  }

  function words(node) { return node.tagName === 'PRE' ? node.textContent : node.textContent.replace(/\s+/g, ' ').trim(); }

  function changedBlocks(before, after) {
    var remaining = new Map();
    before.forEach(function (node) {
      var text = words(node);
      remaining.set(text, (remaining.get(text) || 0) + 1);
    });
    var changed = [];
    after.forEach(function (node, index) {
      var text = words(node), count = remaining.get(text) || 0;
      if (count) remaining.set(text, count - 1);
      else changed.push({ index: index, text: text });
    });
    return { changed: changed, announce: changed.length > 0 || before.length !== after.length };
  }

  var restored = restoring ? keys.indexOf(handoff.key) : -1;
  if (restored >= 0) history.replaceState(null, '', '#' + (restored + 1));
  if (restoring && version >= handoff.v) {
    try { sessionStorage.removeItem(store); } catch (error) { /* storage is optional */ }
    if (handoff.announce) {
      var nodes = restored < 0 ? [] : blocks(doc, restored);
      var glowing = version === handoff.v && Array.isArray(handoff.changed)
        ? handoff.changed.map(function (change) { return nodes[change.index]; }) : [];
      // The deployed HTML can advance again between the comparison and the reload.
      if (!glowing.every(function (node, i) { return node && words(node) === handoff.changed[i].text; })) glowing = [];
      glowing.forEach(function (node) { node.classList.add('deck-changed-block'); });
      updated.hidden = false;
      setTimeout(function () {
        updated.hidden = true;
        glowing.forEach(function (node) { node.classList.remove('deck-changed-block'); });
      }, 2000);
    }
    restoring = false;
  }

  function idle() {
    var selection = window.getSelection();
    return doc.visibilityState === 'visible' && Date.now() - lastInput >= 1000
      && !fingers && !pointers.size && (!selection || selection.isCollapsed);
  }

  function active() { return layers.findIndex(function (layer) { return layer.classList.contains('on'); }); }

  function schedule() {
    clearTimeout(timer);
    if (pending && !leaving && doc.visibilityState === 'visible') timer = setTimeout(apply, 1000);
  }

  function activity() { lastInput = Date.now(); schedule(); }

  async function get(path, read) {
    var response = await fetch(path, request);
    if (!response.ok) throw new Error('Deck update unavailable');
    return response[read]();
  }

  function valid(info) {
    if (!info || !Number.isSafeInteger(info.v) || !Array.isArray(info.slides)) return false;
    var seen = new Set();
    return info.slides.every(function (slide) {
      if (!slide || typeof slide.key !== 'string' || !/^[a-f0-9]{12}$/.test(slide.key)
          || typeof slide.title !== 'string' || seen.has(slide.key)) return false;
      seen.add(slide.key);
      return true;
    });
  }

  function reload(info, key, comparison) {
    try {
      sessionStorage.setItem(store, JSON.stringify({
        v: info.v, key: key, at: Date.now(), changed: comparison.changed, announce: comparison.announce
      }));
    } catch (error) { return; }
    leaving = true;
    location.reload();
  }

  function offer(info, current) {
    var remaining = new Set(info.slides.map(function (slide) { return slide.key; }));
    var nextKey = keys.slice(current + 1).find(function (key) { return remaining.has(key); });
    var next = info.slides.find(function (slide) { return slide.key === nextKey; }) || info.slides[info.slides.length - 1];
    layers[current].classList.add('deck-removed-slide');
    position.textContent = '– / ' + info.slides.length;
    onward.textContent = next ? 'Go on to ' + (next.title || 'Slide ' + (info.slides.indexOf(next) + 1)) : 'Go on to the deck';
    onward.onclick = function () { reload(info, next && next.key, { announce: false }); };
    removed.hidden = false;
  }

  async function apply() {
    var info = pending;
    if (!info || busy || leaving) return;
    if (!idle()) { schedule(); return; }
    var current = active();
    var key = restoring ? handoff.key : keys[current];
    var nextIndex = info.slides.findIndex(function (slide) { return slide.key === key; });
    if (nextIndex < 0 && current >= 0 && !restoring) { offer(info, current); return; }
    busy = true;
    var comparison = { announce: true };
    try {
      // A template is inert. The fetched document is only read for text and never inserted into this page.
      var template = doc.createElement('template');
      template.innerHTML = await get(location.pathname, 'text');
      var fresh = template.content;
      if (!fresh) throw new Error('Deck comparison unavailable');
      var stamp = fresh.querySelector('meta[name="${DECK_VERSION_META}"]');
      // A version response can reach this edge before its HTML, or the edge can step backwards.
      if (!stamp || Number(stamp.content) !== info.v) return;
      if (restoring) comparison = { announce: handoff.announce, changed: info.v === handoff.v ? handoff.changed : null };
      else if (current < 0 || nextIndex < 0) comparison = { announce: false };
      else {
        var nextSlide = fresh.querySelector('#s' + (nextIndex + 1));
        if (nextSlide && nextSlide.getAttribute('data-key') === key) comparison = changedBlocks(blocks(doc, current), blocks(fresh, nextIndex));
      }
    } catch (error) {
      // A failed comparison still allows a reload with a notice and without a glow.
    } finally { busy = false; }
    if (pending !== info || active() !== current || !idle()) { schedule(); return; }
    reload(info, key, comparison);
  }

  async function check() {
    if (doc.visibilityState !== 'visible' || leaving || checking) return;
    checking = true;
    try {
      var info = await get('${DECK_VERSION_PATH}', 'json');
      if (!valid(info) || info.v < floor || (info.v === floor && pending)) return;
      if (info.v === version) return;
      floor = info.v;
      pending = info;
      hideRemoved();
      schedule();
    } catch (error) { /* An unavailable version check changes nothing. */ }
    finally {
      checking = false;
      // A mixed edge may now have the HTML for a version we already saw.
      if (pending && removed.hidden && !leaving) schedule();
    }
  }

  function hideRemoved() {
    if (removed.hidden) return;
    removed.hidden = true;
    layers.forEach(function (layer) { layer.classList.remove('deck-removed-slide'); });
    var current = active();
    position.textContent = current < 0 ? '' : (current + 1) + ' / ' + layers.length;
  }

  var checking = false;
  ['scroll', 'keydown', 'pointermove', 'touchmove', 'selectionchange'].forEach(function (event) {
    doc.addEventListener(event, activity, { capture: true, passive: true });
  });
  doc.addEventListener('pointerdown', function (event) { pointers.add(event.pointerId); activity(); }, true);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (event) {
    doc.addEventListener(event, function () { pointers.delete(event.pointerId); activity(); }, true);
  });
  ['touchstart', 'touchend', 'touchcancel'].forEach(function (event) {
    doc.addEventListener(event, function (touch) { fingers = touch.touches.length; activity(); }, { passive: true });
  });
  var previous = active();
  var navigation = new MutationObserver(function () {
    var current = active();
    if (current === previous) {
      if (!removed.hidden) {
        var count = '– / ' + pending.slides.length;
        if (position.textContent !== count) position.textContent = count;
      }
      return;
    }
    previous = current;
    hideRemoved();
    activity();
  });
  layers.forEach(function (layer) { navigation.observe(layer, { attributes: true, attributeFilter: ['class'] }); });
  navigation.observe(position, { childList: true });
  window.addEventListener('blur', function () { pointers.clear(); fingers = 0; });
  window.addEventListener('focus', check);
  doc.addEventListener('visibilitychange', check);
  setInterval(check, 10000);
  if (restoring) check();
})();
`;

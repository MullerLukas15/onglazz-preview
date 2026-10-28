/*
 * Test náhledu na onglazz.cz bez zásahu IT – spouští ho záložka v prohlížeči.
 * Načte nejnovější widget.js a templates.js z hostingu a vloží náhled
 * místo hlavní fotky v galerii. Vše se děje jen ve vašem prohlížeči.
 */
(function () {
  'use strict';

  var me = document.currentScript;
  var BASE = me && me.src ? me.src.replace(/[^/?#]*([?#].*)?$/, '') : '';
  var V = String(Date.now()); // vždy nejnovější verze, bez cache

  var STYLE =
    // .gallery navíc, aby to přebilo .ogp{position:relative} z jádra
    '.gallery .ogp-test{position:absolute;inset:0;z-index:3;background:#fff}' +
    '.gallery .ogp-test[hidden]{display:none}' +
    '.gallery .ogp-test .ogp-tools{position:absolute;left:8px;right:8px;bottom:8px;border-radius:6px;' +
    'background:rgba(255,255,255,.92);color:#333}' +
    // šipky galerie musí zůstat nad náhledem, jinak nejde listovat
    '.gallery .position-relative .control-button{z-index:5}' +
    '.ogp-test-badge{position:absolute;top:8px;left:8px;z-index:4;background:#f5c542;color:#17171a;' +
    'font:700 12px/1 sans-serif;padding:6px 8px;border-radius:4px;cursor:pointer}' +
    '.ogp-test-badge[hidden]{display:none}';

  function productId() {
    var m = location.pathname.match(/\/([^/]+)\/?$/);
    return m ? m[1] : '';
  }

  function badgeIn(host, text) {
    var b = document.createElement('div');
    b.className = 'ogp-test-badge';
    b.textContent = text;
    host.appendChild(b);
    return b;
  }

  function ensure() {
    if (window.__ogpTestHidden) return;
    var host = document.querySelector('.gallery .position-relative');
    if (!host) return;
    var id = productId();
    var box = host.querySelector('.ogp-test');

    if (!box || box.getAttribute('data-onglazz-preview') !== id) {
      if (box) { box.remove(); }
      var old = host.querySelector('.ogp-test-badge');
      if (old) old.remove();
      if (!window.OnglazzPreview.has(id)) {
        var info = badgeIn(host, 'Tento produkt zatím nemá šablonu');
        setTimeout(function () { info.remove(); }, 3000);
        return;
      }
      box = document.createElement('div');
      box.className = 'ogp-test';
      box.setAttribute('data-onglazz-preview', id);
      var main0 = host.querySelector('img.main-photo');
      box.__mainSrc = main0 ? main0.getAttribute('src') : '';
      var badge = badgeIn(host, 'Test náhledu · skrýt');
      badge.onclick = function () { window.__ogpTestHidden = true; box.remove(); badge.remove(); };
      host.appendChild(box);
    }

    // náhled patří k hlavní fotce; u ostatních fotek galerie ho schováme
    var main = host.querySelector('img.main-photo');
    var show = !main || !box.__mainSrc || main.getAttribute('src') === box.__mainSrc;
    var b = host.querySelector('.ogp-test-badge');
    if (box.hidden === show) { box.hidden = !show; if (b) b.hidden = !show; }
  }

  function setup() {
    if (!document.getElementById('ogp-test-style')) {
      var s = document.createElement('style');
      s.id = 'ogp-test-style';
      s.textContent = STYLE;
      document.head.appendChild(s);
    }
    window.__ogpTestHidden = false;
    ensure();
    if (!window.__ogpTestObserver) {
      window.__ogpTestObserver = new MutationObserver(ensure);
      window.__ogpTestObserver.observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['src']
      });
    }
  }

  if (window.OnglazzPreview) {
    window.OnglazzPreview.ready.then(setup);
  } else {
    var w = document.createElement('script');
    w.src = BASE + 'widget.js?v=' + V;
    w.onload = function () { window.OnglazzPreview.ready.then(setup); };
    w.onerror = function () { console.warn('Test náhledu: nelze načíst ' + w.src); };
    document.head.appendChild(w);
  }
})();

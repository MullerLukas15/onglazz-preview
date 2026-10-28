/*!
 * OnGlazz živý náhled – jádro
 *
 * Vložení do e-shopu (jednorázově, IT):
 *   <div data-onglazz-preview></div>          (v galerii produktu, nad hlavní fotkou)
 *   <script src="https://preview.onglazz.cz/widget.js" defer></script>
 *
 * Jádro samo načte templates.js ze stejné adresy. Šablona se vybere podle
 * atributu data-onglazz-preview, a když je prázdný, podle adresy produktu
 * (např. /…/vinylova-deska-skladba → šablona 'vinylova-deska-skladba').
 * Produkt bez šablony nic nezobrazí, kontejner zůstane skrytý.
 *
 * Pole formuláře se hledají podle data-config-key (klíč pole z databáze),
 * a dokud ho e-shop nevypisuje, podle nadpisu nad polem.
 */
(function () {
  'use strict';

  if (window.OnglazzPreview) return;

  var script = document.currentScript;
  var BASE = script && script.src ? script.src.replace(/[^/?#]*([?#].*)?$/, '') : '';
  var vMatch = script && script.src ? script.src.match(/[?&]v=([^&#]+)/) : null;
  var VERSION = vMatch ? vMatch[1] : '';

  var TEMPLATES = {};
  var instances = [];
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });

  function asset(path) {
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    if (path.charAt(0) === '/') return path; // soubor z e-shopu
    return BASE + path + (VERSION ? (path.indexOf('?') < 0 ? '?' : '&') + 'v=' + VERSION : '');
  }

  // ---------------------------------------------------------------------------
  // Pomocné funkce pro šablony
  // ---------------------------------------------------------------------------
  function circlePath(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  var imageCache = {};
  function loadImage(src) {
    var url = asset(src);
    if (!imageCache[url]) {
      imageCache[url] = new Promise(function (resolve, reject) {
        var img = new Image();
        // obrázky z hostingu widgetu: bez CORS by nešel export náhledu
        if (!/^(\/|data:|blob:)/.test(url) && url.indexOf(location.origin) !== 0) img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('OnglazzPreview: nelze načíst ' + url)); };
        img.src = url;
      });
    }
    return imageCache[url];
  }

  // Fotka zákazníka vyplní oblast (kruh nebo obdélník) jako "cover",
  // posunutá a přiblížená podle view. Bez fotky se vykreslí zástupná plocha.
  function areaPath(ctx, A) {
    if (A.shape === 'circle') return circlePath(ctx, A.cx, A.cy, A.r);
    ctx.beginPath();
    if (ctx.roundRect && A.radius) ctx.roundRect(A.x, A.y, A.w, A.h, A.radius);
    else ctx.rect(A.x, A.y, A.w, A.h);
  }

  function areaBox(A) {
    return A.shape === 'circle'
      ? { x: A.cx - A.r, y: A.cy - A.r, w: A.r * 2, h: A.r * 2 }
      : { x: A.x, y: A.y, w: A.w, h: A.h };
  }

  function coverScale(A, img, zoom) {
    var b = areaBox(A);
    return Math.max(b.w / img.width, b.h / img.height) * zoom;
  }

  function clampView(A, img, view) {
    var b = areaBox(A), s = coverScale(A, img, view.zoom);
    var maxX = Math.max(0, (img.width * s - b.w) / 2), maxY = Math.max(0, (img.height * s - b.h) / 2);
    view.x = Math.max(-maxX, Math.min(maxX, view.x));
    view.y = Math.max(-maxY, Math.min(maxY, view.y));
  }

  function drawPhoto(ctx, A, img, view, placeholder) {
    var b = areaBox(A);
    ctx.save();
    areaPath(ctx, A);
    ctx.clip();
    if (img) {
      clampView(A, img, view);
      var s = coverScale(A, img, view.zoom), w = img.width * s, h = img.height * s;
      ctx.drawImage(img, b.x + b.w / 2 - w / 2 + view.x, b.y + b.h / 2 - h / 2 + view.y, w, h);
    } else if (placeholder) {
      placeholder(ctx, b);
    }
    ctx.restore();
  }

  // Výřez z původní fotky, který je vidět v oblasti (v pixelech původní fotky).
  function cropOf(A, img, view) {
    clampView(A, img, view);
    var b = areaBox(A), s = coverScale(A, img, view.zoom);
    return {
      x: img.width / 2 - (view.x + b.w / 2) / s,
      y: img.height / 2 - (view.y + b.h / 2) / s,
      width: b.w / s,
      height: b.h / s
    };
  }

  // ---------------------------------------------------------------------------
  // Hledání polí formuláře
  // ---------------------------------------------------------------------------
  function norm(s) {
    return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // Nadpis pole: <strong>Název</strong> ve stejném obalu jako input.
  function fieldLabel(el) {
    var box = el.parentElement;
    var head = box && box.querySelector('strong, label, b, span');
    return head ? norm(head.textContent) : '';
  }

  function defaultSelector(spec) {
    return spec.type === 'photo' ? 'input[type="file"]' : 'input[type="text"], textarea';
  }

  function matchField(el, spec) {
    if (!el || !el.matches || !spec) return false;
    var key = el.getAttribute('data-config-key');
    if (key && spec.key) return key === spec.key;
    if (!el.matches(spec.selector || defaultSelector(spec))) return false;
    if (spec.label) return fieldLabel(el) === norm(spec.label);
    return true;
  }

  function findField(spec) {
    if (spec.key) {
      var byKey = document.querySelector('[data-config-key="' + spec.key + '"]');
      if (byKey) return byKey;
    }
    var list = document.querySelectorAll(spec.selector || defaultSelector(spec));
    for (var i = 0; i < list.length; i++) if (matchField(list[i], spec)) return list[i];
    return null;
  }

  // ---------------------------------------------------------------------------
  // Instance náhledu
  // ---------------------------------------------------------------------------
  function Preview(container, id, tpl) {
    this.id = id;
    this.tpl = tpl;
    this.container = container;
    this.values = {};
    this.photo = null;
    this.background = null;
    this.view = { x: 0, y: 0, zoom: 1 };

    container.hidden = false;
    container.classList.add('ogp');
    container.innerHTML =
      '<canvas class="ogp-canvas" width="' + tpl.size + '" height="' + tpl.size + '"></canvas>' +
      '<div class="ogp-tools" hidden>' +
      '  <label>Přiblížení <input type="range" min="1" max="3" step="0.01" value="1"></label>' +
      '  <span class="ogp-hint">Fotku můžete posunout tažením</span>' +
      '</div>';
    this.canvas = container.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.tools = container.querySelector('.ogp-tools');
    this.zoomInput = this.tools.querySelector('input');

    this._bindPointer();
    this.zoomInput.addEventListener('input', this._onZoom.bind(this));
    this.readForm();

    var self = this;
    // bez hostingu (samostatná záložka) se použije fotka přímo z e-shopu
    loadImage(BASE ? tpl.background : (tpl.siteImage || tpl.background)).then(function (img) { self.background = img; self.render(); }, console.warn);
    if (document.fonts && document.fonts.load && tpl.fonts) {
      Promise.all(tpl.fonts.map(function (f) {
        return document.fonts.load(f, 'Léto ěščřžýáíé 0123').catch(function () {});
      })).then(function () { self.render(); });
    }
  }

  // Texty pro vykreslení: co zákazník napsal → placeholder z e-shopu → záložní text šablony.
  Preview.prototype.texts = function () {
    var out = {}, fields = this.tpl.fields;
    for (var name in fields) {
      var spec = fields[name];
      if (spec.type === 'photo') continue;
      var el = this.values[name] ? null : findField(spec);
      out[name] = this.values[name] || (el && el.placeholder) || spec.fallback || '';
    }
    return out;
  };

  Preview.prototype.render = function () {
    if (!this.background) return;
    var ctx = this.ctx, T = this.tpl;
    ctx.save();
    ctx.clearRect(0, 0, T.size, T.size);
    T.draw(ctx, {
      background: this.background,
      photo: this.photo,
      view: this.view,
      area: T.photoArea,
      texts: this.texts(),
      size: T.size
    });
    ctx.restore();
  };

  Preview.prototype.set = function (patch) {
    var fields = this.tpl.fields;
    for (var name in patch) {
      if (!fields[name]) continue;
      if (fields[name].type === 'photo') { if (patch[name] instanceof Blob) this.setPhoto(patch[name]); continue; }
      var max = fields[name].maxLength || 200;
      this.values[name] = String(patch[name] || '').slice(0, max);
    }
    this.render();
  };

  Preview.prototype.setPhoto = function (file) {
    var self = this;
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      self.photo = img;
      self.view = { x: 0, y: 0, zoom: 1 };
      self.zoomInput.value = 1;
      self.tools.hidden = false;
      // s nahranou fotkou patří tažení po náhledu posunu fotky, ne scrollování stránky
      self.canvas.style.touchAction = 'none';
      self.render();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      console.warn('OnglazzPreview: fotku se nepodařilo načíst (formát ' + file.type + ')');
    };
    img.src = url;
  };

  Preview.prototype.readForm = function () {
    var fields = this.tpl.fields;
    for (var name in fields) {
      if (fields[name].type === 'photo') continue;
      var el = findField(fields[name]);
      if (el && el.value) this.values[name] = el.value;
    }
  };

  Preview.prototype.onField = function (el) {
    var fields = this.tpl.fields;
    for (var name in fields) {
      if (!matchField(el, fields[name])) continue;
      if (fields[name].type === 'photo') { if (el.files && el.files[0]) this.setPhoto(el.files[0]); }
      else { var p = {}; p[name] = el.value; this.set(p); }
      return;
    }
  };

  Preview.prototype.toBlob = function (type, quality) {
    var c = this.canvas;
    this.render();
    return new Promise(function (resolve) { c.toBlob(resolve, type || 'image/jpeg', quality || 0.9); });
  };

  Preview.prototype.getCrop = function () {
    return this.photo ? cropOf(this.tpl.photoArea, this.photo, this.view) : null;
  };

  // Oříznutá fotka v plném rozlišení původní fotky (nejvýš maxSize px na delší straně).
  Preview.prototype.croppedPhotoBlob = function (maxSize) {
    var crop = this.getCrop();
    if (!crop) return Promise.resolve(null);
    var k = Math.min(1, (maxSize || 3000) / Math.max(crop.width, crop.height));
    var c = document.createElement('canvas');
    c.width = Math.round(crop.width * k);
    c.height = Math.round(crop.height * k);
    c.getContext('2d').drawImage(this.photo, crop.x, crop.y, crop.width, crop.height, 0, 0, c.width, c.height);
    return new Promise(function (resolve) { c.toBlob(resolve, 'image/jpeg', 0.92); });
  };

  // Vše, co se posílá s objednávkou ke kontrole: náhled, oříznutá fotka, ořez a texty.
  Preview.prototype.exportForOrder = function () {
    var self = this, crop = this.getCrop();
    return Promise.all([this.toBlob('image/jpeg', 0.9), this.croppedPhotoBlob()]).then(function (r) {
      return {
        template: self.id,
        preview: r[0],
        photo: r[1],
        crop: crop && {
          x: Math.round(crop.x), y: Math.round(crop.y),
          width: Math.round(crop.width), height: Math.round(crop.height),
          zoom: self.view.zoom, imageWidth: self.photo.width, imageHeight: self.photo.height
        },
        texts: self.values
      };
    });
  };

  Preview.prototype._onZoom = function () {
    this.view.zoom = parseFloat(this.zoomInput.value);
    this.render();
  };

  // Fotku lze posouvat jen tažením uvnitř oblasti, jinde se stránka normálně posouvá.
  Preview.prototype._bindPointer = function () {
    var self = this, start = null;
    this.canvas.style.touchAction = 'pan-y';
    this.canvas.addEventListener('pointerdown', function (e) {
      if (!self.photo) return;
      var rect = self.canvas.getBoundingClientRect(), k = self.tpl.size / rect.width;
      var x = (e.clientX - rect.left) * k, y = (e.clientY - rect.top) * k, b = areaBox(self.tpl.photoArea);
      if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return;
      start = { x: e.clientX, y: e.clientY, vx: self.view.x, vy: self.view.y, k: k };
      self.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.canvas.addEventListener('pointermove', function (e) {
      if (!start) return;
      self.view.x = start.vx + (e.clientX - start.x) * start.k;
      self.view.y = start.vy + (e.clientY - start.y) * start.k;
      self.render();
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      self.canvas.addEventListener(ev, function () { start = null; });
    });
  };

  // ---------------------------------------------------------------------------
  // Napojení na stránku
  // ---------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('ogp-styles')) return;
    var s = document.createElement('style');
    s.id = 'ogp-styles';
    s.textContent =
      '.ogp{position:relative;width:100%;font-family:inherit}' +
      '.ogp-canvas{display:block;width:100%;height:auto;aspect-ratio:1/1;max-width:100%}' +
      '.ogp-tools{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;justify-content:center;' +
      'padding:8px 0;font-size:13px;color:#555}' +
      '.ogp-tools[hidden]{display:none}' +
      '.ogp-tools label{display:flex;gap:8px;align-items:center}' +
      '.ogp-tools input{width:140px;accent-color:#f5c542}';
    document.head.appendChild(s);
  }

  function templateIdFor(el) {
    var id = el.getAttribute('data-onglazz-preview');
    if (id) return id;
    var m = location.pathname.match(/\/([^/]+)\/?$/);
    return m ? m[1] : '';
  }

  function mountAll() {
    instances = instances.filter(function (p) { return document.contains(p.container); });
    document.querySelectorAll('[data-onglazz-preview]').forEach(function (el) {
      if (el.__ogp) return;
      var id = templateIdFor(el), tpl = TEMPLATES[id];
      if (!tpl) { el.hidden = true; return; } // produkt bez šablony: nic nezobrazovat
      injectStyles();
      el.__ogp = new Preview(el, id, tpl);
      instances.push(el.__ogp);
    });
  }

  function onFieldEvent(e) {
    if (!e.target || !e.target.matches) return;
    instances.forEach(function (p) { p.onField(e.target); });
  }

  document.addEventListener('input', onFieldEvent, true);
  document.addEventListener('change', onFieldEvent, true);

  window.addEventListener('onglazz:input', function (e) {
    instances.forEach(function (p) { p.set(e.detail || {}); });
  });

  window.OnglazzPreview = {
    base: BASE,
    templates: TEMPLATES,
    ready: ready,
    register: function (id, tpl) {
      TEMPLATES[id] = tpl;
      // kontejner, který čekal na šablonu, zkusíme znovu
      document.querySelectorAll('[data-onglazz-preview]').forEach(function (el) {
        if (!el.__ogp && templateIdFor(el) === id) el.hidden = false;
      });
      mountAll();
    },
    has: function (id) { return !!TEMPLATES[id]; },
    mount: function (el, id) {
      el.setAttribute('data-onglazz-preview', id || '');
      mountAll();
      return el.__ogp;
    },
    get instances() { return instances.slice(); },
    helpers: {
      circlePath: circlePath, fitText: fitText, drawPhoto: drawPhoto, areaBox: areaBox, loadImage: loadImage
    }
  };

  function start() {
    // Nuxt mění stránky bez reloadu – hlídáme, kdy se objeví nový kontejner.
    new MutationObserver(mountAll).observe(document.documentElement, { childList: true, subtree: true });
    // samostatná záložka má šablony přibalené hned za jádrem
    if (!BASE) { readyResolve(); return; }
    var s = document.createElement('script');
    s.src = asset('templates.js');
    s.onload = function () { readyResolve(); mountAll(); };
    s.onerror = function () { console.warn('OnglazzPreview: nelze načíst templates.js'); readyResolve(); };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

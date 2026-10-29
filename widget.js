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

  // Písma, která web nemá (např. Allura): šablona uvede odkaz na Google Fonts.
  var cssCache = {};
  function loadCss(url) {
    if (!cssCache[url]) {
      cssCache[url] = new Promise(function (resolve) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = link.onerror = function () { resolve(); };
        document.head.appendChild(link);
      });
    }
    return cssCache[url];
  }

  // Fotka zákazníka vyplní oblast (kruh, obdélník nebo vlastní tvar) jako "cover",
  // posunutá a přiblížená podle view. Bez fotky se vykreslí zástupná plocha.
  // Vlastní tvar: shape 'path' + x, y, w, h (ohraničení) + path(ctx).
  function areaPath(ctx, A) {
    if (A.shape === 'circle') return circlePath(ctx, A.cx, A.cy, A.r);
    ctx.beginPath();
    if (A.shape === 'path') return A.path(ctx);
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

  // Pole bez klíče podle selektoru a nadpisu. Mají-li dvě pole stejný nadpis (např. dvakrát
  // "Text"), rozliší je nth = pořadí na stránce od 0.
  function candidates(spec) {
    var list = document.querySelectorAll(spec.selector || defaultSelector(spec)), out = [];
    for (var i = 0; i < list.length; i++) {
      if (!spec.label || fieldLabel(list[i]) === norm(spec.label)) out.push(list[i]);
    }
    return out;
  }

  function matchField(el, spec) {
    if (!el || !el.matches || !spec) return false;
    var key = el.getAttribute('data-config-key');
    if (key && spec.key) return key === spec.key;
    if (!el.matches(spec.selector || defaultSelector(spec))) return false;
    if (spec.nth != null) return candidates(spec)[spec.nth] === el;
    if (spec.label) return fieldLabel(el) === norm(spec.label);
    return true;
  }

  function findField(spec) {
    if (spec.key) {
      var byKey = document.querySelector('[data-config-key="' + spec.key + '"]');
      if (byKey) return byKey;
    }
    return candidates(spec)[spec.nth || 0] || null;
  }

  // Výběr ze čtverečků (např. barva produktu): obal pole + zvolená položka má třídu item-active.
  function findSwatchBox(spec) {
    if (spec.key) {
      var byKey = document.querySelector('[data-config-key="' + spec.key + '"]');
      if (byKey) return byKey;
    }
    var heads = document.querySelectorAll('strong, label, b');
    for (var i = 0; i < heads.length; i++) {
      if (norm(heads[i].textContent) === norm(spec.label)) return heads[i].parentElement;
    }
    return null;
  }

  function readSwatch(spec) {
    var box = findSwatchBox(spec);
    var active = box && box.querySelector(spec.activeSelector || '.item-active');
    if (!active) return '';
    // valueFrom 'index': pořadí zvolené položky od 1 (např. počet kusů)
    if (spec.valueFrom === 'index') {
      var items = Array.prototype.slice.call(box.querySelectorAll(spec.itemSelector || '.item-w'));
      return String(items.indexOf(active) + 1);
    }
    var fill = active.querySelector('[style*="background"]') || active;
    return getComputedStyle(fill).backgroundColor || '';
  }

  // ---------------------------------------------------------------------------
  // Instance náhledu
  // ---------------------------------------------------------------------------
  // Fotky zákazníka jsou "sloty": každý má obrázek a vlastní posun/přiblížení.
  // Šablona s jednou fotkou (type 'photo') má jeden slot, s více fotkami (type 'photos')
  // jich má tolik, kolik je nahraných fotek ve formuláři e-shopu.
  function newView() { return { x: 0, y: 0, zoom: 1 }; }

  function Preview(container, id, tpl) {
    this.id = id;
    this.tpl = tpl;
    this.container = container;
    this.values = {};
    this.slots = [];        // [{ key, img, view }]
    this.pending = [];      // lokální soubory, které e-shop ještě nahrává
    this.active = 0;        // slot, kterému patří posuvník přiblížení
    this.images = {};       // načtené podklady šablony podle cesty

    container.hidden = false;
    container.classList.add('ogp');
    container.innerHTML =
      '<canvas class="ogp-canvas" width="' + tpl.size + '" height="' + tpl.size + '"></canvas>' +
      '<div class="ogp-tools" hidden>' +
      '  <label><span class="ogp-zoom-label">Přiblížení</span> <input type="range" min="1" max="3" step="0.01" value="1"></label>' +
      '  <span class="ogp-hint">Fotku můžete posunout tažením</span>' +
      '</div>';
    this.canvas = container.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.tools = container.querySelector('.ogp-tools');
    this.zoomInput = this.tools.querySelector('input');
    this.zoomLabel = this.tools.querySelector('.ogp-zoom-label');

    this._bindPointer();
    this.zoomInput.addEventListener('input', this._onZoom.bind(this));
    this.readForm();
    this.syncPhotos();

    var self = this;
    this.render();
    if (document.fonts && document.fonts.load && tpl.fonts) {
      Promise.all((tpl.css || []).map(loadCss)).then(function () {
        return Promise.all(tpl.fonts.map(function (f) {
          return document.fonts.load(f, 'Léto ěščřžýáíé 0123').catch(function () {});
        }));
      }).then(function () { self.render(); });
    }
  }

  // Rozvržení: podklad, volitelný překryv a plochy pro fotky. Šablona ho může měnit
  // podle hodnot formuláře (např. počet baněk), jinak platí background + photoArea.
  Preview.prototype.layout = function () {
    var T = this.tpl;
    if (T.layout) return T.layout(this.texts());
    return { background: BASE ? T.background : (T.siteImage || T.background), areas: [T.photoArea] };
  };

  Preview.prototype.image = function (path) {
    if (!path) return null;
    var self = this, rec = this.images[path];
    if (!rec) {
      rec = this.images[path] = { img: null };
      loadImage(path).then(function (img) { rec.img = img; self.render(); }, console.warn);
    }
    return rec.img;
  };

  // Hodnoty pro vykreslení: co zákazník napsal / vybral → placeholder z e-shopu → záložní hodnota šablony.
  Preview.prototype.texts = function () {
    var out = {}, fields = this.tpl.fields;
    for (var name in fields) {
      var spec = fields[name];
      if (spec.type === 'photo' || spec.type === 'photos') continue;
      if (spec.type === 'swatch') { out[name] = this.values[name] || spec.fallback || ''; continue; }
      // usePlaceholder: false = nápověda pole je obecná ("Text"), místo ní ukázkový text šablony
      var el = this.values[name] || spec.usePlaceholder === false ? null : findField(spec);
      out[name] = this.values[name] || (el && el.placeholder) || spec.fallback || '';
    }
    return out;
  };

  Preview.prototype.render = function () {
    var L = this.layout(), bg = this.image(L.background);
    if (!bg) return;
    var ctx = this.ctx, T = this.tpl;
    var photos = this.slots.map(function (s) { return s.img; });
    var views = this.slots.map(function (s) { return s.view; });
    this.areas = L.areas;
    ctx.save();
    ctx.clearRect(0, 0, T.size, T.size);
    T.draw(ctx, {
      background: bg,
      overlay: this.image(L.overlay),
      photo: photos[0] || null,
      view: views[0] || newView(),
      area: L.areas[0],
      photos: photos,
      views: views,
      areas: L.areas,
      active: this.active,
      texts: this.texts(),
      size: T.size
    });
    ctx.restore();
    if (!this._exporting) this._drawActive(ctx, L.areas);
    this._updateTools();
  };

  // Více fotek: žlutá linka uvnitř okraje fotky, se kterou zákazník právě hýbe / přibližuje.
  // Do náhledu k objednávce se nekreslí.
  Preview.prototype._drawActive = function (ctx, areas) {
    var A = areas[this.active], s = this.slots[this.active];
    if (areas.length < 2 || !A || !s || !s.img) return;
    var w = this.tpl.size * 0.0065;
    ctx.save();
    areaPath(ctx, A);
    ctx.clip();
    areaPath(ctx, A);
    ctx.lineWidth = w * 2;  // polovina čáry leží mimo ořez, uvnitř zůstane w
    ctx.strokeStyle = 'rgba(245,197,66,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = w;
    ctx.stroke();
    ctx.restore();
  };

  Preview.prototype._updateTools = function () {
    var n = Math.min(this.slots.length, (this.areas || []).length);
    this.tools.hidden = !n;
    this.canvas.style.touchAction = n ? 'none' : 'pan-y';
    if (this.active >= n) this.active = Math.max(0, n - 1);
    var multi = (this.areas || []).length > 1;
    var label = multi ? 'Přiblížení fotky ' + (this.active + 1) : 'Přiblížení';
    // měnit jen při změně: zápis do DOM by znovu spustil hlídání stránky
    if (this.zoomLabel.textContent !== label) this.zoomLabel.textContent = label;
    var v = this.slots[this.active] && this.slots[this.active].view;
    if (v) this.zoomInput.value = v.zoom;
  };

  Preview.prototype.set = function (patch) {
    var fields = this.tpl.fields;
    for (var name in patch) {
      if (!fields[name]) continue;
      var t = fields[name].type;
      if (t === 'photo' || t === 'photos') {
        var files = [].concat(patch[name]).filter(function (f) { return f instanceof Blob; });
        if (t === 'photo') this.slots = [];
        files.forEach(this._addLocal, this);
        continue;
      }
      var max = fields[name].maxLength || 200;
      this.values[name] = String(patch[name] || '').slice(0, max);
    }
    this.render();
  };

  // Dřívější jméno (jedna fotka): nahradí fotku v prvním slotu.
  Preview.prototype.setPhoto = function (file) {
    var p = {};
    p[this._photoFieldName() || 'photo'] = file;
    this.set(p);
  };

  Preview.prototype._photoFieldName = function () {
    var f = this.tpl.fields;
    for (var n in f) if (f[n].type === 'photo' || f[n].type === 'photos') return n;
    return null;
  };

  // Lokální soubor zobrazíme hned; až ho e-shop nahraje a ukáže ve formuláři,
  // syncPhotos ho spáruje se serverovým jménem (to končí původním jménem souboru).
  Preview.prototype._addLocal = function (file) {
    if (!file || !/^image\//.test(file.type)) return;
    var self = this, url = URL.createObjectURL(file), img = new Image();
    var slot = { key: 'local:' + file.name, fileName: file.name, img: null, view: newView(), added: Date.now() };
    this.slots.push(slot);
    this.active = this.slots.length - 1;
    img.onload = function () { URL.revokeObjectURL(url); slot.img = img; self.render(); };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      console.warn('OnglazzPreview: fotku se nepodařilo načíst (formát ' + file.type + ')');
    };
    img.src = url;
  };

  // Pořadí a mazání fotek přebíráme z formuláře e-shopu (img.photo s ?name=…, křížek maže).
  // Platí pro jednu i více fotek. Dokud formulář žádnou nahranou fotku neukázal (např. ukázková
  // stránka bez e-shopu), lokální fotky necháváme, jak jsou.
  Preview.prototype.syncPhotos = function () {
    var name = this._photoFieldName(), spec = name && this.tpl.fields[name];
    if (!spec) return;
    var input = findField(spec), box = input && input.parentElement;
    if (!box) return;
    var names = Array.prototype.map.call(box.querySelectorAll('img.photo'), function (im) {
      var m = (im.getAttribute('src') || '').match(/[?&]name=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : (im.getAttribute('alt') || '');
    }).filter(Boolean);
    if (names.length) this._formPhotos = true;
    if (!this._formPhotos) return;
    var old = this.slots, used = [], self = this, now = Date.now();
    var next = names.map(function (n) {
      var s = old.filter(function (o) { return used.indexOf(o) < 0 && (o.key === n || (o.fileName && n.slice(-o.fileName.length) === o.fileName && o.key.indexOf('local:') === 0)); })[0];
      if (s) { used.push(s); s.key = n; return s; }
      var slot = { key: n, img: null, view: newView() };
      loadImage('/api/file?name=' + encodeURIComponent(n)).then(function (img) { slot.img = img; self.render(); }, console.warn);
      return slot;
    });
    // lokální fotky, které se ještě nahrávají (nejvýš minutu), necháme na konci
    var pending = old.filter(function (o) {
      return used.indexOf(o) < 0 && o.key.indexOf('local:') === 0 && now - o.added < 60000;
    });
    // jedna fotka: právě vybraná nová fotka má přednost před tou, kterou e-shop ještě ukazuje
    next = spec.type === 'photo' ? pending.concat(next).slice(0, 1) : next.concat(pending);
    var changed = next.length !== old.length || next.some(function (s, i) { return s !== old[i]; });
    this.slots = next;
    if (changed) this.render();
  };

  Preview.prototype.readForm = function () {
    var fields = this.tpl.fields;
    for (var name in fields) {
      var t = fields[name].type;
      if (t === 'photo' || t === 'photos') continue;
      if (t === 'swatch') { this.values[name] = readSwatch(fields[name]); continue; }
      var el = findField(fields[name]);
      if (el && el.value) this.values[name] = el.value;
    }
  };

  // Čtverečky nemají input/change, po každém kliknutí se zvolená položka přečte znovu.
  Preview.prototype.refreshSwatches = function () {
    var fields = this.tpl.fields, changed = false;
    for (var name in fields) {
      if (fields[name].type !== 'swatch') continue;
      var v = readSwatch(fields[name]);
      if (v && v !== this.values[name]) { this.values[name] = v; changed = true; }
    }
    if (changed) this.render();
  };

  Preview.prototype.onField = function (el) {
    var fields = this.tpl.fields;
    for (var name in fields) {
      var t = fields[name].type;
      if (t === 'swatch' || !matchField(el, fields[name])) continue;
      if (t === 'photo' || t === 'photos') {
        if (el.files && el.files[0]) { var p = {}; p[name] = Array.prototype.slice.call(el.files); this.set(p); }
      } else { var q = {}; q[name] = el.value; this.set(q); }
      return;
    }
  };

  Preview.prototype.toBlob = function (type, quality) {
    var c = this.canvas, self = this;
    this._exporting = true;
    this.render();
    return new Promise(function (resolve) {
      c.toBlob(function (b) { self._exporting = false; self.render(); resolve(b); }, type || 'image/jpeg', quality || 0.9);
    });
  };

  // Výřezy fotek, které jsou opravdu vidět (jen sloty, pro které má rozvržení plochu).
  Preview.prototype.getCrops = function () {
    var areas = this.layout().areas;
    return this.slots.slice(0, areas.length).map(function (s, i) {
      return s.img ? cropOf(areas[i], s.img, s.view) : null;
    });
  };

  Preview.prototype.getCrop = function () { return this.getCrops()[0] || null; };

  function cropBlob(img, crop, maxSize) {
    if (!img || !crop) return Promise.resolve(null);
    var k = Math.min(1, (maxSize || 3000) / Math.max(crop.width, crop.height));
    var c = document.createElement('canvas');
    c.width = Math.round(crop.width * k);
    c.height = Math.round(crop.height * k);
    c.getContext('2d').drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, c.width, c.height);
    return new Promise(function (resolve) { c.toBlob(resolve, 'image/jpeg', 0.92); });
  }

  // Oříznutá první fotka v plném rozlišení (nejvýš maxSize px na delší straně).
  Preview.prototype.croppedPhotoBlob = function (maxSize) {
    return cropBlob(this.slots[0] && this.slots[0].img, this.getCrop(), maxSize);
  };

  // Vše, co se posílá s objednávkou ke kontrole: náhled, oříznuté fotky, ořezy a texty.
  // photo/crop = první fotka (jednofotkové produkty), photos/crops = všechny.
  Preview.prototype.exportForOrder = function () {
    var self = this, crops = this.getCrops();
    var blobs = crops.map(function (c, i) { return cropBlob(self.slots[i].img, c); });
    return Promise.all([this.toBlob('image/jpeg', 0.9)].concat(blobs)).then(function (r) {
      var info = crops.map(function (c, i) {
        var s = self.slots[i];
        return c && {
          x: Math.round(c.x), y: Math.round(c.y), width: Math.round(c.width), height: Math.round(c.height),
          zoom: s.view.zoom, imageWidth: s.img.width, imageHeight: s.img.height
        };
      });
      return {
        template: self.id,
        preview: r[0],
        photo: r[1] || null,
        crop: info[0] || null,
        photos: r.slice(1),
        crops: info,
        texts: self.values
      };
    });
  };

  Preview.prototype._onZoom = function () {
    var s = this.slots[this.active];
    if (!s) return;
    s.view.zoom = parseFloat(this.zoomInput.value);
    this.render();
  };

  // Fotku lze posouvat jen tažením uvnitř její plochy, jinde se stránka normálně posouvá.
  Preview.prototype._bindPointer = function () {
    var self = this, start = null;
    this.canvas.style.touchAction = 'pan-y';
    this.canvas.addEventListener('pointerdown', function (e) {
      var rect = self.canvas.getBoundingClientRect(), k = self.tpl.size / rect.width;
      var x = (e.clientX - rect.left) * k, y = (e.clientY - rect.top) * k;
      var areas = self.areas || [], hit = -1;
      for (var i = 0; i < areas.length && i < self.slots.length; i++) {
        var b = areaBox(areas[i]);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && self.slots[i].img) { hit = i; break; }
      }
      if (hit < 0) return;
      self.active = hit;
      var v = self.slots[hit].view;
      start = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, k: k, view: v };
      self.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      self.render();
    });
    this.canvas.addEventListener('pointermove', function (e) {
      if (!start) return;
      start.view.x = start.vx + (e.clientX - start.x) * start.k;
      start.view.y = start.vy + (e.clientY - start.y) * start.k;
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
    // e-shop přidal nebo smazal nahranou fotku → přeneseme do náhledu
    instances.forEach(function (p) { p.syncPhotos(); });
  }

  function onFieldEvent(e) {
    if (!e.target || !e.target.matches) return;
    instances.forEach(function (p) { p.onField(e.target); });
  }

  document.addEventListener('input', onFieldEvent, true);
  document.addEventListener('change', onFieldEvent, true);
  // Čtverečky (barva apod.): e-shop přepne třídu item-active až po odpovědi serveru,
  // proto hlídáme změny tříd a zvolenou položku pak přečteme znovu.
  var swatchQueued = false;
  new MutationObserver(function () {
    if (swatchQueued || !instances.length) return;
    swatchQueued = true;
    setTimeout(function () {   // časovač, ne requestAnimationFrame: běží i ve skryté záložce
      swatchQueued = false;
      instances.forEach(function (p) { p.refreshSwatches(); });
    }, 0);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });

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

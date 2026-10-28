/*
 * OnGlazz živý náhled – šablony produktů
 *
 * Jedna šablona = jeden produkt. Klíčem je urlName produktu z adminu
 * (poslední část adresy produktu). Souřadnice jsou v pixelech produktové fotky.
 *
 * Každá šablona má:
 *   background  obrázek produktu ze složky images/
 *   siteImage   stejný obrázek na onglazz.cz (použije ho záložka bez hostingu)
 *   size        šířka = výška plátna (rozměr produktové fotky)
 *   photoArea   kam patří fotka zákazníka (circle: cx, cy, r / rect: x, y, w, h, radius)
 *   fields      pole formuláře: key = klíč z databáze, label = nadpis pole na webu,
 *               type = text | photo | swatch (výběr ze čtverečků, např. barva)
 *   fonts       písma, která se mají načíst před vykreslením
 *   draw        vlastní vykreslení – každý produkt může vypadat jinak
 */
(function (P) {
  'use strict';

  var H = P.helpers;

  // ---------------------------------------------------------------------------
  // Vinyl s vlastní fotkou – Skladba
  // ---------------------------------------------------------------------------
  var vinylSkladba = (function () {
    var FONT = '"Proxima Nova", "Montserrat", "Helvetica Neue", Arial, sans-serif';
    var L = { cx: 627, cy: 559.5, r: 231.5 };      // kruh s fotkou
    var HOLE = { cx: 625, cy: 555, r: 17.5 };      // středová dírka
    var POS = {
      title: { x: 450, y: 650, maxWidth: 315 },
      artist: { x: 450, y: 667, maxWidth: 315 },
      heart: { x: 792.5, y: 646, size: 23 },
      progress: { x1: 460, x2: 792.5, y: 680.5, knob: 568.5 },
      times: { left: '01:14', right: '03:57', xl: 465, xr: 787.5, y: 699 },
      controls: { y: 719, shuffle: 514, prev: 568.5, play: 626, next: 682.5, repeat: 736.5, playR: 24, icon: 20 }
    };

    function placeholder(ctx, b) {
      var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g.addColorStop(0, '#cfd6dc');
      g.addColorStop(1, '#8e969d');
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.font = '600 20px ' + FONT;
      ctx.fillText('Nahrajte fotku', b.x + b.w / 2, b.y + b.h / 2 - L.r * 0.35);
    }

    // jemné ztmavení spodní části štítku, aby byl text čitelný i na světlé fotce
    function shade(ctx) {
      ctx.save();
      H.circlePath(ctx, L.cx, L.cy, L.r);
      ctx.clip();
      var g = ctx.createLinearGradient(0, L.cy + L.r * 0.2, 0, L.cy + L.r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = g;
      ctx.fillRect(L.cx - L.r, L.cy, L.r * 2, L.r);
      ctx.restore();
    }

    function hole(ctx) {
      var ring = ctx.createLinearGradient(HOLE.cx - HOLE.r, HOLE.cy - HOLE.r, HOLE.cx + HOLE.r, HOLE.cy + HOLE.r);
      ring.addColorStop(0, '#c9c3b8');
      ring.addColorStop(1, '#8a857c');
      H.circlePath(ctx, HOLE.cx, HOLE.cy, HOLE.r);
      ctx.fillStyle = ring;
      ctx.fill();
      var inner = ctx.createRadialGradient(HOLE.cx - HOLE.r * 0.2, HOLE.cy - HOLE.r * 0.2, 0, HOLE.cx, HOLE.cy, HOLE.r * 0.76);
      inner.addColorStop(0, '#2a2b2c');
      inner.addColorStop(1, '#0c0d0e');
      H.circlePath(ctx, HOLE.cx, HOLE.cy, HOLE.r * 0.76);
      ctx.fillStyle = inner;
      ctx.fill();
    }

    function heart(ctx, x, y, s) {
      var k = s / 2;
      ctx.beginPath();
      ctx.moveTo(x, y + k * 0.85);
      ctx.bezierCurveTo(x - k * 1.25, y - k * 0.05, x - k * 0.75, y - k * 1.05, x, y - k * 0.45);
      ctx.bezierCurveTo(x + k * 0.75, y - k * 1.05, x + k * 1.25, y - k * 0.05, x, y + k * 0.85);
      ctx.stroke();
    }

    function arrowHead(ctx, x, y, angle, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-s, -s); ctx.lineTo(0, 0); ctx.lineTo(-s, s);
      ctx.stroke();
      ctx.restore();
    }

    function shuffle(ctx, x, y, s) {
      var w = s / 2, h = s * 0.32;
      ctx.beginPath();
      ctx.moveTo(x - w, y - h); ctx.bezierCurveTo(x - w * 0.2, y - h, x + w * 0.2, y + h, x + w, y + h);
      ctx.moveTo(x - w, y + h); ctx.bezierCurveTo(x - w * 0.2, y + h, x + w * 0.2, y - h, x + w, y - h);
      ctx.stroke();
      arrowHead(ctx, x + w, y - h, 0, s * 0.18);
      arrowHead(ctx, x + w, y + h, 0, s * 0.18);
    }

    function skip(ctx, x, y, s, dir) {
      var w = s * 0.42, h = s * 0.42, bar = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(x - dir * w * 0.7, y - h);
      ctx.lineTo(x + dir * w * 0.7, y);
      ctx.lineTo(x - dir * w * 0.7, y + h);
      ctx.closePath();
      ctx.fill();
      var bx = x + dir * w * 0.7;
      ctx.fillRect(dir > 0 ? bx : bx - bar, y - h, bar, h * 2);
    }

    function repeat(ctx, x, y, s) {
      var w = s / 2, h = s * 0.3, r = h;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.55, y - h);
      ctx.lineTo(x + w - r, y - h);
      ctx.arcTo(x + w, y - h, x + w, y, r);
      ctx.moveTo(x + w * 0.55, y + h);
      ctx.lineTo(x - w + r, y + h);
      ctx.arcTo(x - w, y + h, x - w, y, r);
      ctx.stroke();
      arrowHead(ctx, x - w * 0.55, y - h, Math.PI, s * 0.16);
      arrowHead(ctx, x + w * 0.55, y + h, 0, s * 0.16);
    }

    function player(ctx, texts) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';

      ctx.font = '700 20px ' + FONT;
      ctx.fillText(H.fitText(ctx, texts.title, POS.title.maxWidth), POS.title.x, POS.title.y);
      ctx.font = '400 14.5px ' + FONT;
      ctx.fillText(H.fitText(ctx, texts.artist, POS.artist.maxWidth), POS.artist.x, POS.artist.y);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.8;
      heart(ctx, POS.heart.x, POS.heart.y, POS.heart.size);

      var P1 = POS.progress;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(P1.x1, P1.y); ctx.lineTo(P1.x2, P1.y); ctx.stroke();
      H.circlePath(ctx, P1.knob, P1.y, 5.5);
      ctx.fill();

      ctx.font = '400 10.5px ' + FONT;
      ctx.fillText(POS.times.left, POS.times.xl, POS.times.y);
      ctx.textAlign = 'right';
      ctx.fillText(POS.times.right, POS.times.xr, POS.times.y);

      var C = POS.controls;
      ctx.lineWidth = 1.8;
      shuffle(ctx, C.shuffle, C.y, C.icon);
      repeat(ctx, C.repeat, C.y, C.icon);
      skip(ctx, C.prev, C.y, C.icon, -1);
      skip(ctx, C.next, C.y, C.icon, 1);

      H.circlePath(ctx, C.play, C.y, C.playR);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#1a1a1a';
      var s = C.playR * 0.42;
      ctx.beginPath();
      ctx.moveTo(C.play - s * 0.6, C.y - s); ctx.lineTo(C.play + s * 0.95, C.y); ctx.lineTo(C.play - s * 0.6, C.y + s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    return {
      background: 'images/vinylova-deska-skladba.webp',
      siteImage: '/api/public-images/922/data', // stejná fotka v e-shopu (pro test bez hostingu)
      size: 1254,
      photoArea: { shape: 'circle', cx: L.cx, cy: L.cy, r: L.r },
      fields: {
        title: { type: 'text', key: 'vinylova-deska-skladba-text-1-CZ', label: 'Název', fallback: 'Název skladby', maxLength: 45 },
        artist: { type: 'text', key: 'vinylova-deska-skladba-text-2-CZ', label: 'Interpret', fallback: 'Interpret', maxLength: 55 },
        photo: { type: 'photo', key: 'vinylova-deska-skladba-fotka-1-CZ' }
      },
      fonts: ['700 20px ' + FONT, '400 14.5px ' + FONT, '400 10.5px ' + FONT],
      draw: function (ctx, s) {
        ctx.drawImage(s.background, 0, 0, s.size, s.size);
        H.drawPhoto(ctx, s.area, s.photo, s.view, placeholder);
        shade(ctx);
        hole(ctx);
        player(ctx, s.texts);
      }
    };
  })();

  // ---------------------------------------------------------------------------
  // Vinyl s vlastní fotkou – Velvet
  // Barevný prstenec kolem kulaté fotky, jméno zahnuté do oblouku vlevo dole.
  // Barvu prstence kreslíme sami podle zvoleného čtverečku, fotka produktu je jen jedna (červená).
  // ---------------------------------------------------------------------------
  var vinylVelvet = (function () {
    var FONT = '"Century Schoolbook", Georgia, "Times New Roman", serif';
    var C = { cx: 624, cy: 559.5 };
    var RING = 240;                 // vnější okraj prstence, o kousek větší, aby nezůstal červený lem
    var PHOTO = 195;                // kruh s fotkou
    var HOLE = { cx: 624.5, cy: 557.5, r: 16 };
    // Hodnoty nalezené porovnáním s produktovou fotkou (Century Schoolbook Bold z onglazz.cz).
    var ARC = {
      weight: 700,
      baseline: 206,                // poloměr účaří textu (písmena míří vrcholy do středu)
      center: 130,                  // střed textu ve stupních (0 = vpravo, 90 = dole)
      size: 46,                     // velikost písma, zmenší se u dlouhých jmen
      tracking: 2,                  // mezera navíc mezi písmeny v px
      maxSpan: 150                  // nejdelší oblouk ve stupních
    };

    function placeholder(ctx, b) {
      var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g.addColorStop(0, '#cfd6dc');
      g.addColorStop(1, '#8e969d');
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.font = '600 22px "Proxima Nova", "Montserrat", sans-serif';
      ctx.fillText('Nahrajte fotku', b.x + b.w / 2, b.y + b.h * 0.3);
    }

    function ring(ctx, color) {
      H.circlePath(ctx, C.cx, C.cy, RING);
      ctx.fillStyle = color;
      ctx.fill();
      // na fotce je prstenec o kousek tmavší než barva čtverečku (světlo scény)
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fill();
    }

    function hole(ctx) {
      var ringG = ctx.createLinearGradient(HOLE.cx - HOLE.r, HOLE.cy - HOLE.r, HOLE.cx + HOLE.r, HOLE.cy + HOLE.r);
      ringG.addColorStop(0, '#c9c3b8');
      ringG.addColorStop(1, '#8a857c');
      H.circlePath(ctx, HOLE.cx, HOLE.cy, HOLE.r);
      ctx.fillStyle = ringG;
      ctx.fill();
      var inner = ctx.createRadialGradient(HOLE.cx - HOLE.r * 0.2, HOLE.cy - HOLE.r * 0.2, 0, HOLE.cx, HOLE.cy, HOLE.r * 0.76);
      inner.addColorStop(0, '#2a2b2c');
      inner.addColorStop(1, '#0c0d0e');
      H.circlePath(ctx, HOLE.cx, HOLE.cy, HOLE.r * 0.76);
      ctx.fillStyle = inner;
      ctx.fill();
    }

    // Text po oblouku zleva dolů; vrcholy písmen míří do středu desky.
    function arcText(ctx, text) {
      var chars = Array.from(text);
      var size = ARC.size, widths, total, rMid;
      for (;;) {
        ctx.font = ARC.weight + ' ' + size + 'px ' + FONT;
        widths = chars.map(function (ch) { return ctx.measureText(ch).width + ARC.tracking; });
        total = widths.reduce(function (a, b) { return a + b; }, 0) - ARC.tracking;
        rMid = ARC.baseline - size * 0.35;
        if (total / rMid <= ARC.maxSpan * Math.PI / 180 || size <= 24) break;
        size -= 2;
      }
      var start = ARC.center * Math.PI / 180 + total / rMid / 2;
      var pos = 0;
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      chars.forEach(function (ch, i) {
        var a = start - (pos + (widths[i] - ARC.tracking) / 2) / rMid;
        ctx.save();
        ctx.translate(C.cx + ARC.baseline * Math.cos(a), C.cy + ARC.baseline * Math.sin(a));
        ctx.rotate(a - Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        pos += widths[i];
      });
      ctx.restore();
    }

    return {
      background: 'images/vinylova-deska-velvet.webp',
      siteImage: '/api/public-images/924/data', // stejná fotka v e-shopu (pro test bez hostingu)
      size: 1254,
      photoArea: { shape: 'circle', cx: C.cx, cy: C.cy, r: PHOTO },
      fields: {
        name: { type: 'text', key: 'vinylova-deska-velvet-text-1-CZ', label: 'Text', fallback: 'Alex & Betty', maxLength: 35 },
        color: { type: 'swatch', key: 'vinylova-deska-velvet-barva-CZ', label: 'Barva produktu', fallback: '#a2141a' },
        photo: { type: 'photo', key: 'vinylova-deska-velvet-fotka-1-CZ' }
      },
      fonts: ['700 46px ' + FONT],
      arc: ARC, // umístění textu (lze doladit i za běhu přes OnglazzPreview.templates)
      draw: function (ctx, s) {
        ctx.drawImage(s.background, 0, 0, s.size, s.size);
        ring(ctx, s.texts.color);
        H.drawPhoto(ctx, s.area, s.photo, s.view, placeholder);
        hole(ctx);
        arcText(ctx, s.texts.name.replace(/ /g, ' '));
      }
    };
  })();

  // ---------------------------------------------------------------------------
  // Společné pro jednoduché vinyly (Klasická, Text)
  // ---------------------------------------------------------------------------
  function photoPlaceholder(ctx, b) {
    var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, '#cfd6dc');
    g.addColorStop(1, '#8e969d');
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'center';
    ctx.font = '600 22px "Proxima Nova", "Montserrat", sans-serif';
    ctx.fillText('Nahrajte fotku', b.x + b.w / 2, b.y + b.h * 0.3);
  }

  function vinylHole(ctx, h) {
    var ring = ctx.createLinearGradient(h.cx - h.r, h.cy - h.r, h.cx + h.r, h.cy + h.r);
    ring.addColorStop(0, '#c9c3b8');
    ring.addColorStop(1, '#8a857c');
    H.circlePath(ctx, h.cx, h.cy, h.r);
    ctx.fillStyle = ring;
    ctx.fill();
    var inner = ctx.createRadialGradient(h.cx - h.r * 0.2, h.cy - h.r * 0.2, 0, h.cx, h.cy, h.r * 0.76);
    inner.addColorStop(0, '#2a2b2c');
    inner.addColorStop(1, '#0c0d0e');
    H.circlePath(ctx, h.cx, h.cy, h.r * 0.76);
    ctx.fillStyle = inner;
    ctx.fill();
  }

  // ---------------------------------------------------------------------------
  // Vinyl s vlastní fotkou – Klasická (jen kulatá fotka)
  // ---------------------------------------------------------------------------
  var vinylKlasicka = {
    background: 'images/vinylova-deska-klasicka.webp',
    siteImage: '/api/public-images/925/data', // stejná fotka v e-shopu (pro test bez hostingu)
    size: 1254,
    photoArea: { shape: 'circle', cx: 627, cy: 560, r: 230.5 },
    fields: {
      photo: { type: 'photo', key: 'vinylova-deska-klasicka-fotka-1-CZ' }
    },
    fonts: ['600 22px "Proxima Nova", "Montserrat", sans-serif'],
    draw: function (ctx, s) {
      ctx.drawImage(s.background, 0, 0, s.size, s.size);
      H.drawPhoto(ctx, s.area, s.photo, s.view, photoPlaceholder);
      vinylHole(ctx, { cx: 625.8, cy: 557.5, r: 16 });
    }
  };

  // ---------------------------------------------------------------------------
  // Vinyl s vlastní fotkou – Text
  // Bílý text po vinylu nad fotkou, začíná nahoře a vede po směru hodinových ručiček.
  // Text se nezmenšuje, delší text prostě pokračuje dál dokola.
  // ---------------------------------------------------------------------------
  var vinylText = (function () {
    var FONT = '"Proxima Nova", "Montserrat", "Helvetica Neue", Arial, sans-serif';
    // Hodnoty nalezené porovnáním s produktovou fotkou. Kruh textu je o kousek
    // posunutý proti středu desky, stejně jako na fotce.
    var ARC = { cx: 633.3, cy: 567.5, baseline: 253, start: -88, size: 33, weight: 700, tracking: 1 };

    function arcText(ctx, text) {
      var chars = Array.from(text);
      ctx.save();
      ctx.font = ARC.weight + ' ' + ARC.size + 'px ' + FONT;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      var rMid = ARC.baseline + ARC.size * 0.35, pos = 0, start = ARC.start * Math.PI / 180;
      chars.forEach(function (ch) {
        var w = ctx.measureText(ch).width;
        var a = start + (pos + w / 2) / rMid;
        ctx.save();
        ctx.translate(ARC.cx + ARC.baseline * Math.cos(a), ARC.cy + ARC.baseline * Math.sin(a));
        ctx.rotate(a + Math.PI / 2); // vrcholy písmen ven od středu
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        pos += w + ARC.tracking;
      });
      ctx.restore();
    }

    return {
      // Fotka produktu Text má původní text natištěný na vinylu. Fotka Klasické je
      // mimo štítek stejná, jen bez textu, proto ji použijeme jako podklad.
      background: 'images/vinylova-deska-klasicka.webp',
      siteImage: '/api/public-images/925/data', // stejná fotka v e-shopu (pro test bez hostingu)
      size: 1254,
      photoArea: { shape: 'circle', cx: 627, cy: 560, r: 230.5 },
      fields: {
        text: { type: 'text', key: 'vinylova-deska-text-text-1-CZ', label: 'Text', fallback: 'S tebou je svět krásnější', maxLength: 35 },
        photo: { type: 'photo', key: 'vinylova-deska-text-fotka-1-CZ' }
      },
      fonts: ['700 33px ' + FONT],
      arc: ARC,
      draw: function (ctx, s) {
        ctx.drawImage(s.background, 0, 0, s.size, s.size);
        H.drawPhoto(ctx, s.area, s.photo, s.view, photoPlaceholder);
        vinylHole(ctx, { cx: 625.8, cy: 557.5, r: 16 });
        arcText(ctx, s.texts.text.replace(/ /g, ' '));
      }
    };
  })();

  // ---------------------------------------------------------------------------
  // Kostičkové fotky (Černá, Červená, Klasická)
  // Fotka je vytištěná přes kostičky, takže přes ni kreslíme vodorovné spáry.
  // Podklady Černé a Červené jsou upravené produktové fotky bez původních
  // iniciál a podpisu (images/kostickova-fotka-*.webp).
  // ---------------------------------------------------------------------------
  // Výšky vodorovných spár změřené v bílém okraji kostky (stejné na všech třech fotkách).
  var BRICK_SEAMS = [248, 310, 372, 437, 501, 564, 628, 691, 754, 819, 883, 949, 1014, 1078, 1139, 1203];

  function brickSeams(ctx, x0, x1) {
    ctx.save();
    BRICK_SEAMS.forEach(function (y) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x0, y - 2, x1 - x0, 2);          // stín nad spárou
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(x0, y, x1 - x0, 1.3);            // světlá hrana spáry
    });
    ctx.restore();
  }

  function cardPlaceholder(ctx, b) {
    var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, '#d9dde1');
    g.addColorStop(1, '#a3a9ae');
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'center';
    ctx.font = '600 26px "Proxima Nova", "Montserrat", sans-serif';
    ctx.fillText('Nahrajte fotku', b.x + b.w / 2, b.y + b.h * 0.42);
  }

  // Text se zmenší, jen když by se nevešel do maxWidth.
  function fitFont(ctx, text, family, size, maxWidth) {
    for (; size > 20; size -= 1) {
      ctx.font = '400 ' + size + 'px ' + family;
      if (ctx.measureText(text).width <= maxWidth) break;
    }
    return size;
  }

  var ALLURA = '"Allura", "Segoe Script", cursive';
  var INITIAL_FONT = '"Century Schoolbook", Georgia, "Times New Roman", serif';

  // Karta s fotkou, dvěma iniciálami a podpisem písmem Allura s bílým obrysem.
  function makeCard(o) {
    function initial(ctx, text, p, rotated) {
      ctx.save();
      var size = fitFont(ctx, text, INITIAL_FONT, o.initialSize, 46);
      ctx.font = '400 ' + size + 'px ' + INITIAL_FONT;
      ctx.fillStyle = o.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.translate(p.x, p.y);
      if (rotated) ctx.rotate(Math.PI); // spodní iniciála je vzhůru nohama jako na hrací kartě
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    function caption(ctx, text) {
      ctx.save();
      var size = fitFont(ctx, text, ALLURA, o.caption.size, o.caption.maxWidth);
      ctx.font = '400 ' + size + 'px ' + ALLURA;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      // pod textem stejný text s bílou výplní a širokým bílým okrajem
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 8;
      ctx.strokeText(text, o.caption.x, o.caption.y);
      ctx.fillText(text, o.caption.x, o.caption.y);
      // samotný text; tenký obrys stejné barvy ho zesílí jako na produktové fotce
      ctx.fillStyle = o.ink;
      ctx.strokeStyle = o.ink;
      ctx.lineWidth = 0.8;
      ctx.fillText(text, o.caption.x, o.caption.y);
      ctx.strokeText(text, o.caption.x, o.caption.y);
      ctx.restore();
    }

    var A = o.photo;
    return {
      background: o.background,
      siteImage: o.siteImage,
      size: 1254,
      photoArea: { shape: 'rect', x: A.x, y: A.y, w: A.w, h: A.h, radius: A.radius },
      fields: o.fields,
      css: ['https://fonts.googleapis.com/css2?family=Allura&display=swap'],
      fonts: ['400 80px ' + ALLURA, '400 57px ' + INITIAL_FONT],
      draw: function (ctx, s) {
        ctx.drawImage(s.background, 0, 0, s.size, s.size);
        H.drawPhoto(ctx, s.area, s.photo, s.view, cardPlaceholder);
        // spáry jen přes fotku, bílý okraj je má už na podkladu
        ctx.save();
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(A.x, A.y, A.w, A.h, A.radius) : ctx.rect(A.x, A.y, A.w, A.h);
        ctx.clip();
        brickSeams(ctx, A.x, A.x + A.w);
        ctx.restore();
        initial(ctx, s.texts.initial1, o.initial1, false);
        initial(ctx, s.texts.initial2, o.initial2, true);
        caption(ctx, s.texts.caption.replace(/ /g, ' '));
      }
    };
  }

  var kostickaCerna = makeCard({
    background: 'images/kostickova-fotka-cerna.webp',
    siteImage: '/api/public-images/902/data',
    photo: { x: 392, y: 261, w: 491, h: 819, radius: 24 },
    ink: 'rgb(20,20,20)',
    initialSize: 57,
    initial1: { x: 361, y: 285 },
    initial2: { x: 905, y: 1102 },
    caption: { x: 622.5, y: 1103.5, size: 80, maxWidth: 470 },
    fields: {
      caption: { type: 'text', key: 'kostickova-desticka-cerna-text-1-CZ', label: 'Text ve spodní části', fallback: 'Anička a Ondra', maxLength: 35 },
      initial1: { type: 'text', key: 'kostickova-desticka-cerna-inicial-1-CZ', label: 'První iniciál', fallback: 'A', maxLength: 2 },
      initial2: { type: 'text', key: 'kostickova-desticka-cerna-inicial-2-CZ', label: 'Druhý iniciál', fallback: 'O', maxLength: 2 },
      photo: { type: 'photo', key: 'kostickova-desticka-cerna-fotka-1-CZ' }
    }
  });

  var kostickaCervena = makeCard({
    background: 'images/kostickova-fotka-cervena.webp',
    siteImage: '/api/public-images/901/data',
    photo: { x: 398, y: 294, w: 484, h: 836, radius: 24 },
    ink: 'rgb(214,31,38)',
    initialSize: 58,
    initial1: { x: 367, y: 304 },
    initial2: { x: 905, y: 1118 },
    caption: { x: 628.5, y: 1124.5, size: 78.5, maxWidth: 470 },
    fields: {
      // klíč textu je v databázi sdílený s Klasickou, proto "klasicka"
      caption: { type: 'text', key: 'kostickova-desticka-klasicka-text-1-CZ', label: 'Text ve spodní části', fallback: 'Eliška a Patrik', maxLength: 35 },
      initial1: { type: 'text', key: 'kostickova-desticka-cervena-inicial-1-CZ', label: 'První iniciál', fallback: 'E', maxLength: 2 },
      initial2: { type: 'text', key: 'kostickova-desticka-cervena-inicial-2-CZ', label: 'Druhý iniciál', fallback: 'P', maxLength: 2 },
      photo: { type: 'photo', key: 'kostickova-desticka-cervena-fotka-1-CZ' }
    }
  });

  // Klasická: fotka přes celou přední stranu kostky, včetně schodovitého vršku
  // a kostičky, kterou drží ruka.
  var FACE = [
    [505, 98, 236, 76],    // kostička v ruce
    [306, 180, 210, 62],   // vršek vlevo
    [516, 226, 228, 16],   // vršek uprostřed (níž)
    [743, 188, 227, 54],   // vršek vpravo
    [305, 238, 664, 967]   // hlavní plocha
  ];
  var kostickaKlasicka = {
    background: 'images/kostickova-fotka-klasicka.webp',
    siteImage: '/api/public-images/903/data',
    size: 1254,
    photoArea: {
      shape: 'path', x: 305, y: 98, w: 665, h: 1107,
      path: function (ctx) { FACE.forEach(function (r) { ctx.rect(r[0], r[1], r[2], r[3]); }); }
    },
    fields: {
      photo: { type: 'photo', key: 'kostickova-desticka-klasicka-fotka-1-CZ' }
    },
    fonts: ['600 26px "Proxima Nova", "Montserrat", sans-serif'],
    draw: function (ctx, s) {
      ctx.drawImage(s.background, 0, 0, s.size, s.size);
      H.drawPhoto(ctx, s.area, s.photo, s.view, cardPlaceholder);
      ctx.save();
      ctx.beginPath();
      s.area.path(ctx);
      ctx.clip();
      brickSeams(ctx, 305, 970);
      // svislé spoje horních kostiček a obrys kostičky v ruce
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(420, 180, 1.3, 68);
      ctx.fillRect(815, 188, 1.3, 60);
      ctx.restore();
    }
  };

  P.register('kostickova-fotka-cerna', kostickaCerna);
  P.register('kostickova-fotka-cervena', kostickaCervena);
  P.register('kostickova-fotka-klasicka', kostickaKlasicka);
  P.register('vinylova-deska-skladba', vinylSkladba);
  P.register('vinylova-deska-velvet', vinylVelvet);
  P.register('vinylova-deska-klasicka', vinylKlasicka);
  P.register('vinylova-deska-text', vinylText);
})(window.OnglazzPreview);

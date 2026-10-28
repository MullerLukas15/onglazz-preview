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
 *   fields      pole formuláře: key = klíč z databáze, label = nadpis pole na webu
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

  P.register('vinylova-deska-skladba', vinylSkladba);
})(window.OnglazzPreview);

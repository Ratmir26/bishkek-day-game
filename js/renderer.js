/* ==========================================================================
   «Один день в Бишкеке» — процедурный Canvas 2D рендерер.
   Виртуальная сцена 1600×900, режим cover, 60 FPS, шесть локаций.
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const W = 1600;
  const H = 900;
  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (n, m) => ((n % m) + m) % m;
  const lerp = (a, b, t) => a + (b - a) * t;
  const T = (h, m = 0) => h * 60 + m;
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function vgrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  const PEAKS = [
    [0.00, 0.22], [0.055, 0.48], [0.11, 0.32], [0.17, 0.68], [0.235, 0.40],
    [0.30, 0.58], [0.355, 0.34], [0.415, 0.78], [0.475, 0.42], [0.53, 0.62],
    [0.585, 0.30], [0.64, 0.72], [0.695, 0.44], [0.755, 0.66], [0.81, 0.36],
    [0.865, 0.60], [0.925, 0.40], [1.00, 0.52]
  ];

  function drawRidge(ctx, baseY, height, color, snow, xoff) {
    ctx.beginPath();
    ctx.moveTo(-60, baseY + 20);
    for (let i = 0; i < PEAKS.length; i++) {
      const [px, py] = PEAKS[i];
      ctx.lineTo(px * W + (xoff || 0), baseY - py * height);
    }
    ctx.lineTo(W + 60, baseY + 20);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (snow > 0) {
      ctx.save();
      ctx.globalAlpha = snow;
      for (let i = 1; i < PEAKS.length - 1; i++) {
        const [px, py] = PEAKS[i];
        if (py < 0.45) continue;
        const x = px * W + (xoff || 0);
        const y = baseY - py * height;
        const spread = 26 + 34 * hash(i * 3.7);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - spread, y + 26 + 42 * hash(i + 9));
        ctx.lineTo(x - spread * 0.32, y + 18);
        ctx.lineTo(x + spread * 0.26, y + 34);
        ctx.lineTo(x + spread, y + 30 + 36 * hash(i + 2));
        ctx.closePath();
        ctx.fillStyle = 'rgba(242,246,255,.92)';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawMountains(ctx, baseY, height, mood) {
    const palettes = {
      dawn: ['#5d6b87', '#41506d', '#2f3c57', .92],
      day: ['#76859f', '#52647f', '#3a4b63', .85],
      dusk: ['#7a6478', '#4e4159', '#332a44', .55],
      night: ['#2d3554', '#1d243c', '#12182b', .28]
    };
    const p = palettes[mood] || palettes.day;
    drawRidge(ctx, baseY - 26, height * 0.72, p[0], 0, 26);
    drawRidge(ctx, baseY, height, p[1], p[3], 0);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(20,25,40,.18)';
    ctx.fillRect(0, baseY - height, W, height);
    ctx.restore();
  }

  function drawSkyline(ctx, baseY, minH, maxH, color, litColor, seed, t) {
    let x = -40;
    let i = 0;
    while (x < W + 40) {
      const w = 46 + hash(seed + i * 1.7) * 96;
      const h = minH + hash(seed + i * 3.1) * (maxH - minH);
      ctx.fillStyle = color;
      ctx.fillRect(x, baseY - h, w, h);
      if (hash(seed + i * 5.3) > 0.35) {
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.fillRect(x + 4, baseY - h + 4, w - 8, 3);
      }
      // грани, карниз, балконные плиты
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(x, baseY - h, 3, h);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(x + w - 6, baseY - h, 6, h);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.fillRect(x - 2, baseY - h - 3, w + 4, 4);
      for (let by = baseY - h + 36; by < baseY - 12; by += 54) {
        ctx.fillStyle = 'rgba(0,0,0,.14)';
        ctx.fillRect(x + 3, by, w - 6, 2);
      }
      // крыша: антенна, надстройка или бак
      const rr = hash(seed + i * 6.1);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (rr > 0.66) {
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + w * 0.3, baseY - h - 3); ctx.lineTo(x + w * 0.3, baseY - h - 26); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w * 0.3 - 7, baseY - h - 20); ctx.lineTo(x + w * 0.3 + 7, baseY - h - 20); ctx.stroke();
      } else if (rr > 0.33) {
        ctx.fillRect(x + w * 0.5, baseY - h - 11, 20, 9);
        ctx.fillRect(x + w * 0.5 + 4, baseY - h - 15, 6, 4);
      } else {
        ctx.fillRect(x + w * 0.55, baseY - h - 13, 14, 11);
        ctx.fillRect(x + w * 0.55 - 2, baseY - h - 15, 18, 3);
      }
      // окна: тёмные всегда, освещённые поверх
      for (let wy = baseY - h + 16; wy < baseY - 8; wy += 18) {
        for (let wx = x + 10; wx < x + w - 8; wx += 16) {
          const r = hash(seed + i * 13.7 + wx * 0.31 + wy * 0.17);
          if (litColor && r > 0.58) {
            const flick = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.4 + r * 9));
            ctx.fillStyle = litColor;
            ctx.globalAlpha = 0.28 + flick * 0.55;
            ctx.fillRect(wx, wy, 6, 8);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = 'rgba(0,0,0,.16)';
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      }
      x += w + 10 + hash(seed + i * 8.9) * 24;
      i++;
    }
  }

  /** Осветлить (k>0) или затемнить (k<0) цвет #rrggbb. */
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
    return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
  }

  const CAR_STATE = { night: false };

  function drawCar(ctx, x, y, scale, dir, color, kind, t) {
    const night = CAR_STATE.night;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * scale, scale);
    const long = kind === 'bus' ? 220 : kind === 'marshrutka' ? 176 : 132;
    const hgt = kind === 'car' ? 48 : 64;
    const bodyY = -hgt;
    // тень
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.beginPath();
    ctx.ellipse(0, 5, long * 0.58, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    [-long * 0.34, long * 0.34].forEach((wx) => {
      ctx.beginPath(); ctx.ellipse(wx, 4, 17, 4, 0, 0, TAU); ctx.fill();
    });
    // кузов
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.34)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 7;
    const bg = ctx.createLinearGradient(0, bodyY, 0, 0);
    bg.addColorStop(0, shade(color, 0.2));
    bg.addColorStop(0.45, color);
    bg.addColorStop(1, shade(color, -0.38));
    ctx.fillStyle = bg;
    rrect(ctx, -long / 2, bodyY, long, hgt, kind === 'car' ? 16 : 9);
    ctx.fill();
    ctx.restore();
    // крыша
    if (kind === 'car') {
      const rg = ctx.createLinearGradient(0, bodyY - 24, 0, bodyY);
      rg.addColorStop(0, shade(color, 0.28));
      rg.addColorStop(1, color);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(-long * 0.28, bodyY);
      ctx.lineTo(-long * 0.16, bodyY - 24);
      ctx.lineTo(long * 0.20, bodyY - 24);
      ctx.lineTo(long * 0.32, bodyY);
      ctx.closePath();
      ctx.fill();
      const gg = ctx.createLinearGradient(0, bodyY - 21, 0, bodyY - 2);
      if (night) { gg.addColorStop(0, '#2b3d52'); gg.addColorStop(1, '#101a26'); }
      else { gg.addColorStop(0, 'rgba(206,232,246,.92)'); gg.addColorStop(1, 'rgba(110,150,178,.82)'); }
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(-long * 0.23, bodyY - 3);
      ctx.lineTo(-long * 0.14, bodyY - 20);
      ctx.lineTo(-long * 0.02, bodyY - 20);
      ctx.lineTo(-long * 0.02, bodyY - 3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(long * 0.02, bodyY - 3);
      ctx.lineTo(long * 0.02, bodyY - 20);
      ctx.lineTo(long * 0.18, bodyY - 20);
      ctx.lineTo(long * 0.26, bodyY - 3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(195,225,240,.8)';
      const n = kind === 'bus' ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const wx = -long * 0.42 + i * (long * 0.8 / n);
        rrect(ctx, wx, bodyY + 10, long * 0.135, 20, 3);
        ctx.fill();
      }
      ctx.fillStyle = kind === 'marshrutka' ? '#f2b84b' : '#dfe8ef';
      ctx.fillRect(-long / 2 + 6, bodyY + hgt - 14, long - 12, 6);
    }
    // колёса: арка, шина, диск со спицами
    [-long * 0.34, long * 0.34].forEach((wx, wi) => {
      ctx.fillStyle = '#0c0e10';
      ctx.beginPath(); ctx.arc(wx, 0, 15, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#151515';
      ctx.beginPath(); ctx.arc(wx, 2, 11.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9097a0';
      ctx.beginPath(); ctx.arc(wx, 2, 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 1.6;
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * TAU + t * 5 + wi;
        ctx.beginPath(); ctx.moveTo(wx, 2); ctx.lineTo(wx + Math.cos(a) * 6.5, 2 + Math.sin(a) * 6.5); ctx.stroke();
      }
      ctx.fillStyle = '#2a2d31';
      ctx.beginPath(); ctx.arc(wx, 2, 2.2, 0, TAU); ctx.fill();
    });
    // детали кузова: блик плеча, порог, бамперы, ручки, зеркало, номер
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(-long / 2 + 10, bodyY + 4, long - 20, 2);
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.fillRect(-long / 2 + 10, bodyY + hgt - 8, long - 20, 4);
    ctx.fillStyle = '#1b1d20';
    rrect(ctx, long / 2 - 3, bodyY + hgt - 17, 8, 13, 3); ctx.fill();
    rrect(ctx, -long / 2 - 5, bodyY + hgt - 17, 8, 13, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.4;
    if (kind === 'car') {
      [-long * 0.02, long * 0.3].forEach((dx) => {
        ctx.beginPath(); ctx.moveTo(dx, bodyY + 3); ctx.lineTo(dx, bodyY + hgt - 9); ctx.stroke();
      });
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      rrect(ctx, -long * 0.1, bodyY + 12, 11, 3, 1.5); ctx.fill();
      rrect(ctx, long * 0.2, bodyY + 12, 11, 3, 1.5); ctx.fill();
      ctx.fillStyle = color;
      rrect(ctx, long * 0.27, bodyY - 6, 11, 7, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      rrect(ctx, long * 0.27, bodyY - 6, 11, 7, 3); ctx.fill();
      ctx.fillStyle = '#26292d';
      ctx.fillRect(long / 2 - 7, bodyY + 30, 6, 10);
    } else {
      ctx.beginPath(); ctx.moveTo(long * 0.34, bodyY + 4); ctx.lineTo(long * 0.34, bodyY + hgt - 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(long * 0.4, bodyY + 4); ctx.lineTo(long * 0.4, bodyY + hgt - 9); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      rrect(ctx, -long * 0.2, bodyY - 6, long * 0.3, 7, 3); ctx.fill();
      ctx.fillStyle = color;
      rrect(ctx, long / 2 - 2, bodyY + 22, 9, 6, 2); ctx.fill();
    }
    ctx.fillStyle = '#f3f1e6';
    rrect(ctx, -long / 2 + 9, bodyY + hgt - 19, 22, 9, 2); ctx.fill();
    ctx.fillStyle = 'rgba(30,40,70,.7)';
    ctx.fillRect(-long / 2 + 12, bodyY + hgt - 16, 16, 2);
    ctx.fillRect(-long / 2 + 12, bodyY + hgt - 13, 11, 2);
    // фары и стопы
    if (night) {
      // лучи фар вперёд и красное свечение стопов назад
      const beam = ctx.createLinearGradient(long / 2, 0, long / 2 + 150, 0);
      beam.addColorStop(0, 'rgba(255,238,180,.38)');
      beam.addColorStop(1, 'rgba(255,238,180,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(long / 2, bodyY + 20);
      ctx.lineTo(long / 2 + 150, bodyY + 4);
      ctx.lineTo(long / 2 + 150, bodyY + hgt + 6);
      ctx.lineTo(long / 2, bodyY + 28);
      ctx.closePath();
      ctx.fill();
      glow(ctx, -long / 2 + 4, bodyY + 22, 34, 'rgba(255,70,50,.9)', 0.5);
      glow(ctx, long / 2 - 4, bodyY + 22, 30, 'rgba(255,240,190,.95)', 0.55);
    }
    ctx.fillStyle = 'rgba(255,244,196,.98)';
    rrect(ctx, long / 2 - 9, bodyY + 17, 8, 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,72,52,.95)';
    rrect(ctx, -long / 2 + 1, bodyY + 17, 7, 10, 3); ctx.fill();
    if (kind !== 'car') {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.font = '700 22px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.scale(dir, 1);   // компенсируем отражение машины: номер читается в обе стороны
      ctx.fillText(kind === 'bus' ? '№ 7' : '№ 195', 0, bodyY + hgt - 22);
      ctx.restore();
    }
    ctx.restore();
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scene = 'traffic';
      this.sceneLabel = '';
      this.festive = false;
      this.district = 'south';
      this.fade = 1;
      this.t = 0;
      this.minutes = 450;
      this.weather = 'clear';
      this.dpr = 1;
      this.scale = 1;
      this.offX = 0;
      this.offY = 0;
      this.px = 0; this.py = 0; this.tx = 0; this.ty = 0;
      this.running = false;
      this.last = 0;
      this.raf = 0;

      this.steam = Array.from({ length: 16 }, (_, i) => ({
        phase: hash(i * 2.1) * TAU,
        dx: hash(i * 5.2) * 18 - 9,
        speed: 0.22 + hash(i * 7.7) * 0.32,
        r: 2 + hash(i * 3.3) * 5
      }));
      this.motes = Array.from({ length: 52 }, (_, i) => ({
        x: hash(i * 3.9) * W,
        y: hash(i * 8.1) * H,
        r: 0.7 + hash(i * 1.7) * 2.4,
        vx: 4 + hash(i * 5.1) * 14,
        vy: -2 - hash(i * 6.3) * 10,
        a: 0.08 + hash(i * 9.1) * 0.25
      }));
      this.stars = Array.from({ length: 84 }, (_, i) => ({
        x: hash(i * 4.4) * W,
        y: hash(i * 7.2) * 500,
        r: 0.6 + hash(i * 2.8) * 1.6,
        tw: 0.4 + hash(i * 6.6) * 2.2
      }));
      this.crowd = Array.from({ length: 34 }, (_, i) => ({
        x: hash(i * 4.7) * W,
        y: 600 + hash(i * 8.3) * 230,
        s: 0.62 + hash(i * 2.9) * 0.62,
        sp: 5 + hash(i * 6.1) * 18,
        ph: hash(i * 9.7) * TAU,
        coat: ['#2c3442', '#4a3b3a', '#39483f', '#3c3a52', '#5a4036'][i % 5],
        bag: hash(i * 11.3) > 0.63
      }));
      this.cars = [
        { lane: 0, off: 0, speed: 95, dir: 1, color: '#d7dde5', kind: 'car' },
        { lane: 0, off: 430, speed: 75, dir: 1, color: '#b54b4b', kind: 'car' },
        { lane: 0, off: 900, speed: 110, dir: 1, color: '#3e6b8a', kind: 'car' },
        { lane: 1, off: 220, speed: 60, dir: -1, color: '#e8e0cc', kind: 'marshrutka' },
        { lane: 1, off: 820, speed: 82, dir: -1, color: '#5e6c78', kind: 'car' },
        { lane: 1, off: 1300, speed: 58, dir: -1, color: '#c99c3f', kind: 'car' },
        { lane: 2, off: 120, speed: 130, dir: 1, color: '#45524c', kind: 'car' },
        { lane: 2, off: 700, speed: 100, dir: 1, color: '#d9d3c4', kind: 'bus' },
        { lane: 2, off: 1250, speed: 120, dir: 1, color: '#736060', kind: 'car' }
      ];
      this.leaves = Array.from({ length: 22 }, (_, i) => ({
        x: hash(i * 6.2) * W,
        y: hash(i * 3.4) * H,
        s: 2 + hash(i * 8.8) * 4,
        ph: hash(i * 4.9) * TAU,
        sp: 6 + hash(i * 7.7) * 14
      }));
      this.rain = Array.from({ length: 140 }, (_, i) => ({
        x: hash(i * 2.7) * (W + 200) - 100,
        y: hash(i * 5.9) * H,
        len: 12 + hash(i * 4.1) * 22,
        sp: 620 + hash(i * 8.3) * 520,
        drift: 30 + hash(i * 3.7) * 60
      }));

      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);
      window.addEventListener('resize', this.resize);
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(this.resize);
        this.ro.observe(canvas);
      }
      // Перенос окна на другой монитор меняет devicePixelRatio без события resize.
      this.watchDpr = () => {
        if (!window.matchMedia) return;
        const mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
        const onChange = () => { this.resize(); this.watchDpr(); };
        if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
      };
      this.watchDpr();
      this.gw = { dawn: 1, day: 0, sunset: 0, night: 0 };
      this.resize();
      this.start();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const cw = Math.max(1, rect.width || window.innerWidth);
      const ch = Math.max(1, rect.height || window.innerHeight);
      const raw = Math.min(window.devicePixelRatio || 1, 3);
      // потолок по площади только защищает память: 9 млн пикселей = 1920x1080 при DPR 2 без потерь
      const byArea = Math.sqrt(9000000 / (cw * ch));
      this.dpr = Math.max(1, Math.min(raw, byArea));
      this.canvas.width = Math.round(cw * this.dpr);
      this.canvas.height = Math.round(ch * this.dpr);
      this.cw = cw; this.ch = ch;
      this.scale = Math.max(cw / W, ch / H);
      this.offX = (cw - W * this.scale) / 2;
      this.offY = (ch - H * this.scale) / 2;
    }

    /** label — подпись места для сцен вроде 'mall' (ЦУМ «АЙЧУРЕК», «ФРУНЗЕ», «ГЛОБУС»). */
    setScene(name, district, label) {
      if (district) this.district = district === 'vostok' ? 'vostok5' : district;
      const nextLabel = label || '';
      if (!name || (name === this.scene && nextLabel === this.sceneLabel)) return;
      this.scene = name;
      this.sceneLabel = nextLabel;
      this.fade = 1;
    }

    /** Вывески сцен зависят от района: две строки текста. */
    sign(kind) {
      const d = this.district || 'south';
      const table = {
        traffic: {
          south: ['7 АПРЕЛЯ', 'АБДРАХМАНОВА →'],
          center: ['ЧУЙ ПРОСПЕКТ', 'ЦЕНТР →'],
          vostok5: ['ПР. ЧУЙ', 'ВОСТОК-5 · 7 АПРЕЛЯ →']
        },
        school: {
          south: ['СРЕДНЯЯ ШКОЛА', 'АСАНБАЙ · 7 АПРЕЛЯ'],
          center: ['СРЕДНЯЯ ШКОЛА', 'ЦЕНТР · ЧУЙ'],
          vostok5: ['ШКОЛА ВО ДВОРЕ', 'ВОСТОК-5 · МИКРОРАЙОН']
        },
        bazaar: {
          south: ['ОРТО-САЙ', 'РЫНОК · ЮЖНАЯ МАГИСТРАЛЬ'],
          center: ['ЦУМ «АЙЧУРЕК»', 'ЧУЙ · АБДРАХМАНОВА'],
          vostok5: ['РЫНОК «МАДИНА»', 'ТКАНИ · ФУРНИТУРА · ЧУЙ']
        }
      };
      return (table[kind] && (table[kind][d] || table[kind].south)) || ['', ''];
    }

    setTime(minutes) {
      this.minutes = minutes;
      if (typeof document !== 'undefined' && document.body) document.body.dataset.phase = this.phase;
    }

    setWeather(weather) { this.weather = weather || 'clear'; }

    setFestive(on) { this.festive = !!on; }

    get phase() {
      const m = this.minutes;
      if (m < T(9, 0)) return 'dawn';
      if (m < T(16, 30)) return 'day';
      if (m < T(19, 30)) return 'sunset';
      return 'night';
    }

    setPointer(nx, ny) {
      this.tx = clamp(nx, -1, 1);
      this.ty = clamp(ny, -1, 1);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }

    loop(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.t += dt;
      this.fade = Math.max(0, this.fade - dt * 1.8);
      this.updateGrade(dt);
      this.px += (this.tx - this.px) * Math.min(1, dt * 4);
      this.py += (this.ty - this.py) * Math.min(1, dt * 4);
      this.draw();
      this.raf = requestAnimationFrame(this.loop);
    }

    draw() {
      const ctx = this.ctx;
      const dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0a1014';
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.offX, dpr * this.offY);
      ctx.save();
      ctx.translate(W / 2 + this.px * 8, H / 2 + this.py * 6);
      ctx.scale(1.015, 1.015);
      ctx.translate(-W / 2, -H / 2);

      CAR_STATE.night = this.scene === 'evening' || this.scene === 'school_evening' ||
        this.scene === 'south_panorama' || this.phase === 'night';
      if (this.scene === 'home') this.drawHome(ctx);
      else if (this.scene === 'office') this.drawOffice(ctx);
      else if (this.scene === 'bazaar') this.drawBazaar(ctx);
      else if (this.scene === 'evening') this.drawEvening(ctx);
      else if (this.scene === 'school') this.drawSchool(ctx);
      else if (this.scene === 'school_evening') this.drawSchool(ctx);
      else if (this.scene === 'park') this.drawPark(ctx);
      else if (this.scene === 'courtyard') this.drawCourtyard(ctx);
      else if (this.scene === 'stairwell') this.drawStairwell(ctx);
      else if (this.scene === 'kitchen_night') this.drawKitchenNight(ctx);
      else if (this.scene === 'apa_kitchen') this.drawApaKitchen(ctx);
      else if (this.scene === 'south_panorama') this.drawSouthPanorama(ctx);
      else if (this.scene === 'mall') this.drawMall(ctx);
      else if (this.scene === 'parents_home') this.drawParentsHome(ctx);
      else this.drawTraffic(ctx);

      this.drawWeather(ctx);

      ctx.restore();
      this.drawGrade(ctx);
      if (this.fade > 0.001) {
        ctx.save();
        ctx.fillStyle = 'rgba(5,9,12,' + (this.fade * 0.78) + ')';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    /** Плавно ведёт веса фаз дня к текущей: утреннее золото -> дневной свет -> закат -> ночь. */
    updateGrade(dt) {
      const ph = this.phase;
      const k = Math.min(1, dt * 1.6);
      ['dawn', 'day', 'sunset', 'night'].forEach((n) => {
        this.gw[n] += ((n === ph ? 1 : 0) - this.gw[n]) * k;
      });
    }

    /** Атмосферный свет поверх сцены: золотое утро, яркий день, закатный градиент, ночное виньетирование. */
    drawGrade(ctx) {
      const g = this.gw;
      const X = -80, Y = -80, w = W + 160, h = H + 160;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      if (g.dawn > 0.01) {
        const r = ctx.createRadialGradient(1280, 330, 40, 1280, 330, 1150);
        r.addColorStop(0, 'rgba(255,198,118,' + (0.30 * g.dawn) + ')');
        r.addColorStop(0.55, 'rgba(255,170,110,' + (0.10 * g.dawn) + ')');
        r.addColorStop(1, 'rgba(255,170,110,0)');
        ctx.fillStyle = r; ctx.fillRect(X, Y, w, h);
      }
      if (g.day > 0.01) {
        const l = ctx.createLinearGradient(0, 0, 0, H);
        l.addColorStop(0, 'rgba(206,230,255,' + (0.18 * g.day) + ')');
        l.addColorStop(1, 'rgba(255,248,230,' + (0.06 * g.day) + ')');
        ctx.fillStyle = l; ctx.fillRect(X, Y, w, h);
        const b = ctx.createRadialGradient(1180, 150, 20, 1180, 150, 760);
        b.addColorStop(0, 'rgba(255,250,225,' + (0.24 * g.day) + ')');
        b.addColorStop(1, 'rgba(255,250,225,0)');
        ctx.fillStyle = b; ctx.fillRect(X, Y, w, h);
      }
      if (g.sunset > 0.01) {
        const l = ctx.createLinearGradient(0, H, 0, H * 0.25);
        l.addColorStop(0, 'rgba(255,128,76,' + (0.30 * g.sunset) + ')');
        l.addColorStop(1, 'rgba(255,128,76,0)');
        ctx.fillStyle = l; ctx.fillRect(X, Y, w, h);
        const r = ctx.createRadialGradient(1150, 520, 30, 1150, 520, 820);
        r.addColorStop(0, 'rgba(255,150,96,' + (0.32 * g.sunset) + ')');
        r.addColorStop(1, 'rgba(255,150,96,0)');
        ctx.fillStyle = r; ctx.fillRect(X, Y, w, h);
      }
      ctx.restore();
      if (g.night > 0.01) {
        const v = ctx.createRadialGradient(W * 0.6, H * 0.45, 200, W * 0.6, H * 0.45, 1100);
        v.addColorStop(0, 'rgba(8,12,30,0)');
        v.addColorStop(1, 'rgba(8,12,30,' + (0.38 * g.night) + ')');
        ctx.fillStyle = v; ctx.fillRect(X, Y, w, h);
      }
    }

    drawWeather(ctx) {
      if (this.weather !== 'rain') return;
      if (this.scene === 'office' || this.scene === 'home' || this.scene === 'parents_home' ||
        this.scene === 'kitchen_night' || this.scene === 'apa_kitchen' || this.scene === 'stairwell') return;
      const t = this.t;
      ctx.save();
      ctx.fillStyle = 'rgba(22,36,56,.17)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(196,224,245,.34)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      this.rain.forEach((r) => {
        const y = mod(r.y + t * r.sp, H + 90) - 45;
        const x = mod(r.x - t * r.drift, W + 220) - 110;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + r.len);
      });
      ctx.stroke();
      ctx.fillStyle = 'rgba(205,230,248,.22)';
      for (let i = 0; i < 26; i++) {
        const x = mod(i * 67 + t * 13, W);
        const y = 760 + (i % 7) * 18;
        ctx.beginPath();
        ctx.ellipse(x, y, 10 + (i % 3) * 4, 1.6, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    /* ------------------------------------------------------------------ */
    /** Табличка на фасаде: номер школы зависит от района (проверенные №61 и №13; для Востока-5 без номера). */
    schoolPlaque() {
      const d = this.district || 'south';
      if (d === 'center') return ['ШКОЛА № 13', 'СРЕДНЯЯ · ЦЕНТР'];
      if (d === 'vostok5') return ['ШКОЛА', 'МКР. ВОСТОК-5'];
      return ['ШКОЛА № 61', 'СРЕДНЯЯ · АСАНБАЙ'];
    }

    drawYardSports(ctx) {
      const t = this.t;
      const steel = '#55708c', steelHi = '#8fa9c2';
      // турники: две стойки, верхняя и нижняя перекладины, тень на земле
      const tx = 928, ty = 706;
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(tx + 50, ty + 4, 76, 8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = steel; ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      [tx, tx + 100].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x, ty - 112); ctx.stroke(); });
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(tx - 4, ty - 112); ctx.lineTo(tx + 104, ty - 112); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(tx - 4, ty - 74); ctx.lineTo(tx + 104, ty - 74); ctx.stroke();
      ctx.strokeStyle = steelHi; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx - 4, ty - 114); ctx.lineTo(tx + 104, ty - 114); ctx.stroke();
      ctx.fillStyle = steel;
      [tx, tx + 100].forEach((x) => { ctx.fillRect(x - 9, ty - 4, 18, 6); });
      ctx.lineCap = 'butt';

      // баскетбольное кольцо у забора справа: стойка, щит, обруч и сетка
      const bx = 1548, by = 704;
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(bx, by + 3, 40, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a5560';
      ctx.fillRect(bx - 5, by - 190, 10, 190);
      ctx.fillRect(bx - 22, by - 8, 44, 8);
      ctx.fillStyle = '#4a5560';
      ctx.fillRect(bx - 44, by - 196, 44, 7);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      ctx.fillStyle = 'rgba(236,240,244,.94)';
      rrect(ctx, bx - 100, by - 250, 78, 56, 4); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#d9483f'; ctx.lineWidth = 3;
      ctx.strokeRect(bx - 82, by - 226, 42, 30);
      ctx.strokeStyle = '#e8772e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(bx - 61, by - 186, 22, 6, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(245,245,240,.85)'; ctx.lineWidth = 1.5;
      const sw = Math.sin(t * 1.2) * 1.2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(bx - 61 + i * 6.5, by - 184); ctx.lineTo(bx - 61 + i * 3.2 + sw, by - 156); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(bx - 76, by - 172); ctx.lineTo(bx - 46, by - 172); ctx.stroke();
    }

    drawSchool(ctx) {
      const t = this.t;
      const phase = this.phase;
      const evening = this.scene === 'school_evening';
      const sky = evening
        ? [[0, '#1b2138'], [0.34, '#54415f'], [0.62, '#b96b62'], [0.84, '#eda173'], [1, '#f8ce9c']]
        : phase === 'day'
          ? [[0, '#3d6f9c'], [0.45, '#8db8cf'], [0.78, '#d9e8e8'], [1, '#f2e9cf']]
          : phase === 'sunset'
            ? [[0, '#2c2a4f'], [0.4, '#7a5068'], [0.72, '#d98567'], [1, '#f4bd7f']]
            : [[0, '#6f8fb8'], [0.42, '#c99c8d'], [0.72, '#f0c49a'], [1, '#f8e2bd']];
      ctx.fillStyle = vgrad(ctx, 0, 650, sky);
      ctx.fillRect(-30, -30, W + 60, 700);
      const sunX = evening ? 1230 : phase === 'day' ? 1280 : 1180;
      const sunY = evening ? 430 : phase === 'day' ? 190 : 300;
      glow(ctx, sunX, sunY, evening ? 320 : 230, 'rgba(255,206,150,.9)', evening ? 0.5 : 0.42);
      ctx.fillStyle = evening ? 'rgba(255,214,168,.92)' : 'rgba(255,240,205,.9)';
      ctx.beginPath(); ctx.arc(sunX, sunY, evening ? 52 : 40, 0, TAU); ctx.fill();
      if (evening) {
        // тонкая розовая дымка над хребтом
        ctx.fillStyle = 'rgba(255,164,140,.16)';
        ctx.fillRect(-30, 330, W + 60, 260);
      }

      ctx.fillStyle = evening ? 'rgba(255,196,170,.2)' : 'rgba(255,240,220,.18)';
      for (let i = 0; i < 4; i++) {
        const x = mod(i * 420 + t * 1.6, W + 300) - 150;
        ctx.beginPath();
        ctx.ellipse(x, 150 + (i % 2) * 54, 112, 15, 0, 0, TAU);
        ctx.fill();
      }

      drawMountains(ctx, 590, 300, evening ? 'dusk' : phase === 'day' ? 'day' : 'dawn');
      if (evening) {
        // снег вершин ловит последний свет и становится розовым
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255,142,132,.2)';
        ctx.beginPath();
        ctx.moveTo(-40, 520);
        for (let i = 0; i < PEAKS.length; i++) {
          ctx.lineTo(PEAKS[i][0] * W, 590 - PEAKS[i][1] * 300 * 0.9);
        }
        ctx.lineTo(W + 40, 520);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      drawSkyline(ctx, 620, 42, 120, evening ? '#4c3f4c' : '#8b7768', evening ? 'rgba(255,201,120,.9)' : null, 17, t);

      // земля и школьный двор
      ctx.fillStyle = vgrad(ctx, 600, 900, evening
        ? [[0, '#4c4147'], [0.5, '#38313a'], [1, '#211c26']]
        : [[0, '#5b625f'], [0.5, '#464d4b'], [1, '#2c3332']]);
      ctx.fillRect(-30, 600, W + 60, 330);
      ctx.fillStyle = evening ? 'rgba(255,190,140,.14)' : 'rgba(255,255,255,.06)';
      ctx.fillRect(0, 600, W, 4);

      // школьное здание
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.32)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 16;
      ctx.fillStyle = evening ? '#b8a48b' : '#d8cbb4';
      rrect(ctx, 150, 236, 760, 406, 6);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = evening ? '#a58f76' : '#c2b39a';
      ctx.fillRect(150, 236, 760, 18);
      ctx.fillStyle = evening ? '#8f7a63' : '#b0a087';
      ctx.fillRect(150, 254, 760, 6);

      // окна: вечером часть горит тёплым, часть уже погасла
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
          const wx = 188 + col * 88;
          const wy = 286 + row * 104;
          const lit = !evening || hash(row * 9.1 + col * 4.7) > 0.34;
          if (evening && lit) {
            const wg = ctx.createLinearGradient(wx, wy, wx, wy + 66);
            wg.addColorStop(0, 'rgba(255,214,146,.92)');
            wg.addColorStop(1, 'rgba(238,168,98,.78)');
            ctx.fillStyle = wg;
          } else {
            ctx.fillStyle = evening
              ? 'rgba(36,38,58,.72)'
              : phase === 'sunset' ? 'rgba(255,190,120,.55)' : 'rgba(112,154,178,.8)';
          }
          rrect(ctx, wx, wy, 56, 66, 4);
          ctx.fill();
          if (evening && lit) {
            ctx.fillStyle = 'rgba(80,58,46,.28)';
            ctx.fillRect(wx + 8, wy + 40, 40, 26);
          }
          ctx.fillStyle = 'rgba(255,255,255,.22)';
          ctx.fillRect(wx + 5, wy + 6, 16, 2);
          ctx.fillStyle = evening ? 'rgba(40,36,46,.45)' : 'rgba(40,50,55,.28)';
          ctx.fillRect(wx + 27, wy, 3, 66);
          ctx.fillRect(wx, wy + 31, 56, 3);
        }
      }

      // вход
      ctx.fillStyle = evening ? '#57452f' : '#6d5a45';
      rrect(ctx, 760, 520, 112, 122, 4);
      ctx.fill();
      ctx.fillStyle = '#3b3028';
      rrect(ctx, 776, 540, 80, 102, 3);
      ctx.fill();
      ctx.fillStyle = evening ? 'rgba(255,206,132,.88)' : 'rgba(255,220,150,.55)';
      ctx.fillRect(792, 556, 48, 58);
      if (evening) {
        glow(ctx, 816, 584, 190, 'rgba(255,198,120,.9)', 0.42);
        ctx.fillStyle = '#2d2520';
        ctx.fillRect(760, 512, 112, 12);
        ctx.fillStyle = 'rgba(255,222,158,.9)';
        ctx.beginPath(); ctx.arc(760, 516, 8, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#2d2520';
        ctx.fillRect(760, 512, 112, 12);
      }

      // синяя адресная табличка на фасаде над входом (номер школы по району)
      {
        const pl = this.schoolPlaque();
        const px = 744, py = 452, pw = 160, ph = 50;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#1f4f93';
        rrect(ctx, px, py, pw, ph, 5); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#f2f4f6'; ctx.lineWidth = 2.5;
        rrect(ctx, px + 4, py + 4, pw - 8, ph - 8, 3); ctx.stroke();
        ctx.fillStyle = '#c6d4e6';
        [[px + 8, py + 8], [px + pw - 8, py + 8], [px + 8, py + ph - 8], [px + pw - 8, py + ph - 8]].forEach((q) => {
          ctx.beginPath(); ctx.arc(q[0], q[1], 1.8, 0, TAU); ctx.fill();
        });
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f2f4f6';
        this.fitText(ctx, pl[0], 800, 22, pw - 24, px + pw / 2, py + 25);
        ctx.fillStyle = 'rgba(242,244,246,.85)';
        this.fitText(ctx, pl[1], 600, 11, pw - 24, px + pw / 2, py + 40);
      }

      // вывеска стоит на крыше, правее блока выбора
      ctx.fillStyle = '#2d2520';
      ctx.fillRect(620, 228, 8, 10); ctx.fillRect(852, 228, 8, 10);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#2f6051';
      rrect(ctx, 590, 168, 300, 66, 10);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,240,200,.5)';
      ctx.lineWidth = 3;
      rrect(ctx, 590, 168, 300, 66, 10);
      ctx.stroke();
      ctx.fillStyle = '#f6efdc';
      const ssign = this.sign('school');
      ctx.textAlign = 'center';
      this.fitText(ctx, ssign[0], 800, 30, 276, 740, 201);
      ctx.fillStyle = 'rgba(246,239,220,.72)';
      this.fitText(ctx, ssign[1], 600, 14, 276, 740, 222);

      // флагшток
      ctx.strokeStyle = '#7b7f7c';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(1050, 250); ctx.lineTo(1050, 642); ctx.stroke();
      ctx.fillStyle = '#d9483f';
      ctx.beginPath();
      ctx.moveTo(1052, 258);
      ctx.quadraticCurveTo(1110, 272, 1150, 252);
      ctx.lineTo(1150, 302);
      ctx.quadraticCurveTo(1104, 320, 1052, 306);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,238,160,.9)';
      ctx.beginPath(); ctx.arc(1100, 284, 10, 0, TAU); ctx.fill();

      // забор
      ctx.strokeStyle = evening ? '#5f5a5e' : '#7d837e';
      ctx.lineWidth = 3;
      for (let x = 980; x < 1600; x += 34) {
        ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x, 690); ctx.stroke();
      }
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(980, 586); ctx.lineTo(1600, 586); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(980, 672); ctx.lineTo(1600, 672); ctx.stroke();

      // деревья: вечером почти силуэты
      for (let i = 0; i < 4; i++) {
        this.drawTree(ctx, 1084 + i * 126, 632, 0.66, i * 2.3 + 1, evening
          ? (i % 2 ? ['#1e3128', '#284036'] : ['#24382d', '#2e4638'])
          : (i % 2 ? ['#2d533f', '#3a6a50'] : ['#345c45', '#40724f']));
      }

      // длинные вечерние тени от турников и деревьев
      if (evening) {
        ctx.fillStyle = 'rgba(20,16,28,.24)';
        ctx.beginPath(); ctx.ellipse(1150, 742, 210, 16, -0.12, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(1350, 756, 250, 18, -0.1, 0, TAU); ctx.fill();
      }

      // спортплощадка во дворе: турники и баскетбольное кольцо
      this.drawYardSports(ctx);

      // зебра и асфальт
      ctx.fillStyle = evening ? '#302a35' : '#3d4343';
      ctx.fillRect(980, 730, 620, 170);
      ctx.fillStyle = evening ? 'rgba(255,206,150,.5)' : 'rgba(240,240,230,.72)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(1020 + i * 88, 760, 52, 104);
      }

      if (evening) {
        // пустой двор: только голуби и длинный свет из окон
        ctx.fillStyle = 'rgba(255,196,132,.12)';
        ctx.beginPath();
        ctx.moveTo(900, 620); ctx.lineTo(1600, 620); ctx.lineTo(1600, 760); ctx.lineTo(760, 760);
        ctx.closePath(); ctx.fill();
        [[1188, 748], [1218, 758], [1264, 744]].forEach(([bx, by], i) => {
          const bob = Math.sin(t * 2.2 + i * 1.7) * 2;
          ctx.fillStyle = 'rgba(46,42,52,.85)';
          ctx.beginPath(); ctx.ellipse(bx, by + bob, 7, 4.6, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(bx + 6, by - 4 + bob, 3, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,180,120,.7)';
          ctx.fillRect(bx + 8, by - 4 + bob, 2, 1);
        });
      } else {
        // люди
        this.drawWalker(ctx, 1120, 714, 0.56, t, '#252c33');
        this.drawWalker(ctx, 1180, 724, 0.48, t + 1.1, '#3a2e2c');
        this.drawWalker(ctx, 1280, 736, 0.44, t + 2.3, '#2d3a33');
      }

      // листья
      this.leaves.forEach((l) => {
        const x = mod(l.x + t * l.sp * 0.6, W + 80) - 40;
        const y = mod(l.y + t * 6 + Math.sin(t * 0.8 + l.ph) * 18, H + 60) - 30;
        ctx.globalAlpha = evening ? 0.18 : 0.22;
        ctx.fillStyle = evening ? '#f2b07a' : '#f0c98a';
        ctx.beginPath();
        ctx.ellipse(x, y, l.s, l.s * 0.45, l.ph + t, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (evening) {
        // фонарь у ворот: тёплое пятно на асфальте
        const lx2 = 1004, ly2 = 548;
        ctx.strokeStyle = '#4a4148'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(lx2, 690); ctx.lineTo(lx2, ly2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx2, ly2); ctx.lineTo(lx2 + 34, ly2 - 14); ctx.stroke();
        glow(ctx, lx2 + 34, ly2 - 10, 120, 'rgba(255,206,132,.9)', 0.45);
        ctx.fillStyle = '#ffe0a8';
        ctx.beginPath(); ctx.ellipse(lx2 + 34, ly2 - 8, 11, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,196,132,.1)';
        ctx.beginPath(); ctx.ellipse(lx2 + 44, 782, 130, 20, 0, 0, TAU); ctx.fill();

        // тёплая дымка поверх всей сцены
        const dusk = ctx.createLinearGradient(0, 0, 0, H);
        dusk.addColorStop(0, 'rgba(80,54,96,.2)');
        dusk.addColorStop(0.55, 'rgba(196,104,92,.1)');
        dusk.addColorStop(1, 'rgba(26,18,30,.28)');
        ctx.fillStyle = dusk; ctx.fillRect(0, 0, W, H);
      }

      const vig = ctx.createLinearGradient(0, 720, 0, 900);
      vig.addColorStop(0, 'rgba(5,8,12,0)');
      vig.addColorStop(1, evening ? 'rgba(10,6,14,.56)' : 'rgba(5,8,12,.5)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 720, W, 180);
    }

    /* ------------------------------------------------------------------ */
    drawHome(ctx) {
      const t = this.t;
      const night = this.minutes >= 18 * 60;
      const g = ctx.createLinearGradient(0, 0, W, H);
      if (night) {
        g.addColorStop(0, '#151820');
        g.addColorStop(0.55, '#1e1c22');
        g.addColorStop(1, '#2c211c');
      } else {
        g.addColorStop(0, '#4a3328');
        g.addColorStop(0.5, '#6b4630');
        g.addColorStop(1, '#8a5c3b');
      }
      ctx.fillStyle = g;
      ctx.fillRect(-30, -30, W + 60, H + 60);

      // окно
      const wx = 870, wy = 70, ww = 570, wh = 440;
      ctx.save();
      rrect(ctx, wx, wy, ww, wh, 8);
      ctx.clip();
      if (night) {
        ctx.fillStyle = vgrad(ctx, wy, wy + wh, [[0, '#0b1220'], [0.55, '#1a2238'], [1, '#3b2d38']]);
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = 'rgba(245,240,220,.9)';
        ctx.beginPath();
        ctx.arc(wx + 408, wy + 104, 40, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(25,32,52,.95)';
        ctx.beginPath();
        ctx.arc(wx + 390, wy + 92, 40, 0, TAU);
        ctx.fill();
        this.stars.forEach((s, i) => {
          if (i % 2) return;
          ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 0.8 + s.tw));
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(wx + mod(s.x, ww), wy + mod(s.y * 0.55, wh * 0.7), s.r, 0, TAU);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        drawMountains(ctx, wy + wh - 30, 190, 'night');
        drawSkyline(ctx, wy + wh - 18, 38, 90, '#131a28', 'rgba(255,201,120,.9)', 42, t);
      } else {
        ctx.fillStyle = vgrad(ctx, wy, wy + wh, [
          [0, '#7f9bbd'], [0.45, '#e6b48c'], [0.72, '#f4cf9f'], [1, '#f9e3bc']
        ]);
        ctx.fillRect(wx, wy, ww, wh);
        glow(ctx, wx + 430, wy + 168, 190, 'rgba(255,226,160,.95)', 0.8);
        ctx.fillStyle = 'rgba(255,243,205,.95)';
        ctx.beginPath();
        ctx.arc(wx + 430, wy + 168, 36, 0, TAU);
        ctx.fill();
        drawMountains(ctx, wy + wh - 30, 260, 'dawn');
        drawSkyline(ctx, wy + wh - 14, 26, 74, '#6b574b', null, 13, t);
        // облака
        ctx.fillStyle = 'rgba(255,245,230,.28)';
        for (let i = 0; i < 4; i++) {
          const cx = wx + mod(night ? 0 : t * 3 + i * 190, ww + 200) - 100;
          const cy = wy + 70 + i * 52;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 50, 12, 0, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();

      // рама окна
      ctx.strokeStyle = night ? '#3f3a34' : '#f1dfc2';
      ctx.lineWidth = 16;
      rrect(ctx, wx, wy, ww, wh, 8);
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();

      // шторы
      ctx.fillStyle = night ? 'rgba(56,45,46,.9)' : 'rgba(196,128,84,.72)';
      ctx.beginPath();
      ctx.moveTo(wx - 74, wy - 26);
      ctx.quadraticCurveTo(wx - 6, wy + 60, wx - 34, wy + wh + 26);
      ctx.lineTo(wx - 90, wy + wh + 26);
      ctx.lineTo(wx - 90, wy - 26);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(wx + ww + 74, wy - 26);
      ctx.quadraticCurveTo(wx + ww + 6, wy + 70, wx + ww + 36, wy + wh + 26);
      ctx.lineTo(wx + ww + 92, wy + wh + 26);
      ctx.lineTo(wx + ww + 92, wy - 26);
      ctx.closePath();
      ctx.fill();

      // световой луч
      if (!night) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const beam = ctx.createLinearGradient(wx, wy, 700, 800);
        beam.addColorStop(0, 'rgba(255,221,158,.22)');
        beam.addColorStop(1, 'rgba(255,221,158,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(wx + 30, wy + 10);
        ctx.lineTo(wx + ww - 20, wy + 40);
        ctx.lineTo(700, 860);
        ctx.lineTo(300, 900);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // часы
      ctx.save();
      ctx.translate(190, 205);
      ctx.fillStyle = night ? '#29272a' : '#fff6e3';
      ctx.beginPath(); ctx.arc(0, 0, 74, 0, TAU); ctx.fill();
      ctx.strokeStyle = night ? '#51464a' : '#6b4b32';
      ctx.lineWidth = 7; ctx.stroke();
      ctx.fillStyle = night ? '#c9bfb4' : '#4e3a2b';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 56, Math.sin(a) * 56, 2.4, 0, TAU);
        ctx.fill();
      }
      const hr = (this.minutes / 60) % 12 / 12 * TAU - Math.PI / 2;
      const mn = (this.minutes % 60) / 60 * TAU - Math.PI / 2;
      ctx.strokeStyle = night ? '#e6ddd0' : '#2f241d';
      ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hr) * 34, Math.sin(hr) * 34); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(mn) * 52, Math.sin(mn) * 52); ctx.stroke();
      ctx.fillStyle = '#e2574c';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
      ctx.restore();

      // полки и банки
      ctx.fillStyle = night ? '#2b2420' : '#5a3c29';
      ctx.fillRect(80, 330, 320, 15);
      const jars = ['#c8823f', '#9b4b3a', '#d7b06a', '#78906a'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = jars[i];
        rrect(ctx, 105 + i * 66, 274, 42, 56, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(112 + i * 66, 282, 5, 40);
      }

      // нижние шкафы
      ctx.fillStyle = night ? '#2c241f' : '#5f412d';
      ctx.fillRect(0, 690, W, 230);
      ctx.fillStyle = night ? '#3a302a' : '#795437';
      for (let i = 0; i < 6; i++) {
        rrect(ctx, 30 + i * 262, 722, 230, 160, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.fillRect(46 + i * 262, 736, 198, 2);
        ctx.fillStyle = night ? '#3a302a' : '#795437';
      }

      // столешница
      ctx.fillStyle = night ? '#57453a' : '#a9754b';
      ctx.fillRect(0, 650, W, 46);
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.fillRect(0, 650, W, 3);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(0, 692, W, 5);

      // плита и чайник
      ctx.fillStyle = night ? '#313436' : '#d8d1c2';
      rrect(ctx, 520, 612, 270, 42, 12);
      ctx.fill();
      ctx.fillStyle = '#22282a';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(566 + i * 62, 634, 15, 0, TAU); ctx.fill();
      }
      this.drawKettle(ctx, 655, 612, night);

      // кружка с паром
      this.drawMug(ctx, 1085, 664, night, 0.25);

      // доска и хлеб
      ctx.save();
      ctx.translate(860, 640);
      ctx.rotate(-0.05);
      ctx.fillStyle = '#b9844f';
      rrect(ctx, -70, -18, 170, 34, 8); ctx.fill();
      ctx.fillStyle = '#e3bb7a';
      rrect(ctx, -40, -34, 96, 30, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,30,.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, -30); ctx.lineTo(-6, -10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -30); ctx.lineTo(24, -12); ctx.stroke();
      ctx.restore();

      // растение
      this.drawPlant(ctx, 1516, 600, night ? 0.75 : 1);

      // лампа
      ctx.strokeStyle = '#2a2520';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(360, 0); ctx.lineTo(360, 92); ctx.stroke();
      ctx.fillStyle = night ? '#e9b55b' : '#c58a3f';
      ctx.beginPath();
      ctx.moveTo(300, 150);
      ctx.quadraticCurveTo(360, 92, 420, 150);
      ctx.closePath();
      ctx.fill();
      glow(ctx, 360, 160, night ? 260 : 150, 'rgba(255,200,120,.75)', night ? 0.55 : 0.28);

      // пылинки в свете
      this.motes.forEach((m) => {
        const x = mod(m.x + t * m.vx, W + 80) - 40;
        const y = mod(m.y + t * m.vy, H + 80) - 40;
        ctx.globalAlpha = m.a * (night ? 0.45 : 0.9);
        ctx.fillStyle = '#ffe7b8';
        ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // тень виньетки
      ctx.fillStyle = 'rgba(10,8,8,.16)';
      ctx.fillRect(0, 0, W, 70);
    }

    drawKettle(ctx, x, y, night) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(0, 3, 62, 7, 0, 0, TAU); ctx.fill();
      // носик и пластиковая ручка
      ctx.fillStyle = night ? '#6f7478' : '#c9ced0';
      ctx.beginPath(); ctx.moveTo(-46, -30); ctx.lineTo(-72, -64); ctx.lineTo(-64, -68); ctx.lineTo(-40, -50); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2f3336'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(48, -66); ctx.quadraticCurveTo(86, -60, 50, -12); ctx.stroke();
      // корпус с металлическим градиентом
      const g = ctx.createLinearGradient(-52, 0, 52, 0);
      g.addColorStop(0, night ? '#565b60' : '#aeb5b8');
      g.addColorStop(0.3, night ? '#8b9094' : '#eef1f1');
      g.addColorStop(1, night ? '#565b60' : '#a3aaad');
      ctx.fillStyle = g;
      rrect(ctx, -52, -78, 104, 82, 26); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(-52, -14, 104, 5);
      ctx.fillStyle = night ? '#565b60' : '#aeb5b8';
      ctx.beginPath(); ctx.ellipse(0, -76, 52, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath(); ctx.ellipse(0, -77, 40, 7, 0, 0, TAU); ctx.fill();
      // шкала воды и кнопка
      ctx.fillStyle = 'rgba(80,140,200,.55)';
      rrect(ctx, 30, -60, 6, 40, 3); ctx.fill();
      ctx.strokeStyle = night ? '#8b9094' : '#e8ecec';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, -80, 34, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = '#3b3f42';
      ctx.beginPath(); ctx.arc(0, -104, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e2574c';
      ctx.beginPath(); ctx.arc(-24, -6, 3, 0, TAU); ctx.fill();
      ctx.restore();
    }

    /** Кружка с ручкой, кофе и паром. Пар идёт строго из центра горловины кружки. */
    drawMug(ctx, x, y, night, steamAlpha) {
      const t = this.t;
      const body = night ? '#c9b79a' : '#f1e6d2';
      const shade = night ? '#9d8c72' : '#d3c2a4';
      const light = night ? '#e0d2b8' : '#fff8ea';
      ctx.save();
      ctx.translate(x, y);
      // тень на столе и блюдце
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.beginPath(); ctx.ellipse(6, 3, 58, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = night ? '#8f826c' : '#d9c9ab';
      ctx.beginPath(); ctx.ellipse(0, 1, 52, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.ellipse(0, -1, 44, 4, 0, 0, TAU); ctx.fill();
      // ручка: кольцо уходит концами внутрь корпуса, поэтому щели нет
      ctx.strokeStyle = shade;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(28, -30, 17, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.strokeStyle = body;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(28, -30, 17, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      // корпус с объёмом
      const g = ctx.createLinearGradient(-36, 0, 36, 0);
      g.addColorStop(0, shade); g.addColorStop(0.28, light); g.addColorStop(0.6, body); g.addColorStop(1, shade);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-36, -58); ctx.lineTo(36, -58); ctx.lineTo(33, -9);
      ctx.quadraticCurveTo(32, 1, 21, 1); ctx.lineTo(-21, 1);
      ctx.quadraticCurveTo(-32, 1, -33, -9); ctx.closePath(); ctx.fill();
      // узор: полоска и мелкие горошины
      ctx.fillStyle = night ? 'rgba(160,70,55,.8)' : '#c8614d';
      ctx.fillRect(-35, -40, 70, 5);
      ctx.fillStyle = night ? 'rgba(90,120,100,.8)' : '#6f9a84';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-24 + i * 12, -24, 2.4, 0, TAU); ctx.fill(); }
      // горловина, кофе и пенка
      ctx.fillStyle = shade;
      ctx.beginPath(); ctx.ellipse(0, -58, 36, 8.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4b2b1a';
      ctx.beginPath(); ctx.ellipse(0, -58, 32, 6.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(214,164,112,.55)';
      ctx.beginPath(); ctx.ellipse(-4, -58.5, 17, 3.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(-13, -61, 7, 1.4, -0.15, 0, TAU); ctx.fill();
      // пар: всегда из центра горловины (x = 0), лёгкое покачивание
      if (steamAlpha) {
        for (let i = 0; i < this.steam.length; i++) {
          const s = this.steam[i];
          const life = mod(t * s.speed + s.phase, 1);
          const sx = s.dx * 0.9 * (0.4 + life) + Math.sin(t * 1.3 + s.phase + life * 5) * (4 + life * 9);
          ctx.globalAlpha = Math.sin(life * Math.PI) * steamAlpha;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(sx, -64 - life * 140, s.r * (0.7 + life * 1.1), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    /** Комнатное растение: листья веером ВВЕРХ, прожилки, горшок с ободком и землёй. */
    drawPlant(ctx, x, y, alpha) {
      const t = this.t;
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      // тень
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(x, y + 82, 54, 8, 0, 0, TAU); ctx.fill();
      // листья (задние боковые рисуются первыми)
      const tones = ['#2b5240', '#356148', '#3f7050', '#2f5a42'];
      const order = [0, 8, 1, 7, 2, 6, 3, 5, 4];
      order.forEach((i, n) => {
        const k = i - 4;
        const ang = k * 0.27 + Math.sin(t * 0.9 + i) * 0.025;
        const len = 132 - Math.abs(k) * 15 + (i % 2) * 8;
        const wid = 17 + (4 - Math.abs(k)) * 1.2;
        ctx.save();
        ctx.translate(x + k * 3, y + 4);
        ctx.rotate(ang);
        const lg = ctx.createLinearGradient(-wid, 0, wid, 0);
        lg.addColorStop(0, '#244a38'); lg.addColorStop(0.5, tones[n % 4]); lg.addColorStop(1, '#4b8160');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(wid * 1.5, -len * 0.45, 0, -len);
        ctx.quadraticCurveTo(-wid * 1.5, -len * 0.45, 0, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -len * 0.9); ctx.stroke();
        ctx.lineWidth = 1;
        for (let v = 1; v < 5; v++) {
          const fr = 0.15 + v * 0.17;
          const hw = wid * 1.05 * Math.sin(fr * Math.PI) * 0.8;
          const vy = -len * fr;
          ctx.beginPath(); ctx.moveTo(0, vy); ctx.lineTo(hw, vy - 9);
          ctx.moveTo(0, vy); ctx.lineTo(-hw, vy - 9); ctx.stroke();
        }
        ctx.restore();
      });
      // горшок
      const pg = ctx.createLinearGradient(x - 44, 0, x + 44, 0);
      pg.addColorStop(0, '#80482c'); pg.addColorStop(0.35, '#b06b44'); pg.addColorStop(1, '#7a4429');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(x - 38, y + 14); ctx.lineTo(x + 38, y + 14);
      ctx.lineTo(x + 28, y + 80); ctx.lineTo(x - 28, y + 80);
      ctx.closePath(); ctx.fill();
      // ободок и земля
      ctx.fillStyle = '#c47b50';
      rrect(ctx, x - 46, y - 2, 92, 18, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(x - 40, y + 1, 80, 3);
      ctx.fillStyle = '#2f2118';
      ctx.beginPath(); ctx.ellipse(x, y + 1, 40, 4, 0, 0, TAU); ctx.fill();
      // орнамент на горшке
      ctx.fillStyle = 'rgba(255,230,200,.28)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 24 + i * 16, y + 38); ctx.lineTo(x - 16 + i * 16, y + 50); ctx.lineTo(x - 32 + i * 16, y + 50);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    /** Дерево: конус ствола, ветви, многослойная крона с подсветкой и лёгким покачиванием. */
    drawTree(ctx, x, baseY, s, seed, tone) {
      const sway = Math.sin(this.t * 0.7 + seed) * 2.2;
      ctx.save();
      ctx.translate(x, baseY);
      ctx.scale(s, s);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(0, 2, 38, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2d24';
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.lineTo(4 + sway * 0.3, -80); ctx.lineTo(-4 + sway * 0.3, -80);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2d24'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(-24 + sway * 0.5, -78);
      ctx.moveTo(1, -56); ctx.lineTo(26 + sway * 0.5, -86); ctx.stroke();
      const blobs = [[0, -108, 50], [-34, -88, 36], [36, -90, 38], [-12, -140, 34], [22, -128, 30]];
      blobs.forEach((b, i) => {
        ctx.fillStyle = i % 2 ? tone[1] : tone[0];
        ctx.beginPath(); ctx.arc(b[0] + sway * (1 + i * 0.15), b[1], b[2], 0, TAU); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.beginPath(); ctx.arc(-16 + sway, -120, 24, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.beginPath(); ctx.arc(20 + sway, -78, 26, 0, Math.PI); ctx.fill();
      ctx.restore();
    }

    /** Светофор стоит на тротуаре: основание у бордюра, опора, корпус с козырьками и ободками линз. */
    drawTrafficLight(ctx, x, baseY, t) {
      const topY = baseY - 262;
      ctx.save();
      // тень и фланец основания
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(x, baseY, 30, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2d3237';
      rrect(ctx, x - 17, baseY - 12, 34, 12, 3); ctx.fill();
      ctx.fillStyle = '#6a7177';
      ctx.fillRect(x - 12, baseY - 9, 3, 3); ctx.fillRect(x + 9, baseY - 9, 3, 3);
      // опора
      const pg = ctx.createLinearGradient(x - 7, 0, x + 7, 0);
      pg.addColorStop(0, '#1d2125'); pg.addColorStop(0.4, '#4a5259'); pg.addColorStop(1, '#1b1f23');
      ctx.fillStyle = pg;
      ctx.fillRect(x - 7, topY + 150, 14, baseY - topY - 158);
      // корпус и задник
      ctx.fillStyle = '#101417';
      rrect(ctx, x - 44, topY - 4, 88, 186, 18); ctx.fill();
      ctx.fillStyle = '#1b2125';
      rrect(ctx, x - 37, topY + 3, 74, 172, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
      rrect(ctx, x - 44, topY - 4, 88, 186, 18); ctx.stroke();
      const phase = Math.floor(t / 3) % 3;
      const cols = ['#ff5a4f', '#f2c14b', '#43d17b'];
      [0, 1, 2].forEach((i) => {
        const cy = topY + 38 + i * 54;
        const lit = i === phase;
        // козырёк
        ctx.fillStyle = '#0b0e10';
        ctx.beginPath(); ctx.arc(x, cy, 25, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(x + 22, cy - 6); ctx.lineTo(x - 22, cy - 6); ctx.closePath(); ctx.fill();
        // ободок линзы и сама линза
        ctx.fillStyle = '#272e33';
        ctx.beginPath(); ctx.arc(x, cy, 21, 0, TAU); ctx.fill();
        ctx.fillStyle = lit ? cols[i] : 'rgba(255,255,255,.10)';
        ctx.beginPath(); ctx.arc(x, cy, 18, 0, TAU); ctx.fill();
        if (lit) {
          glow(ctx, x, cy, 64, cols[i], 0.3);
          ctx.fillStyle = 'rgba(255,255,255,.4)';
          ctx.beginPath(); ctx.arc(x - 6, cy - 6, 5, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(255,255,255,.07)';
          ctx.beginPath(); ctx.arc(x - 6, cy - 6, 4, 0, TAU); ctx.fill();
        }
      });
      // пешеходная секция на опоре
      ctx.fillStyle = '#101417';
      rrect(ctx, x + 7, topY + 196, 30, 38, 6); ctx.fill();
      ctx.fillStyle = phase === 0 ? '#ff5a4f' : '#43d17b';
      ctx.beginPath(); ctx.arc(x + 22, topY + 215, 8, 0, TAU); ctx.fill();
      ctx.restore();
    }

    /* ------------------------------------------------------------------ */
    drawTraffic(ctx) {
      const t = this.t;
      const phase = this.phase;
      const sky = phase === 'day'
        ? [[0, '#1f3f63'], [0.36, '#4f7fa1'], [0.66, '#9fc3d4'], [0.86, '#d9e7e6'], [1, '#f2e6c9']]
        : phase === 'sunset'
          ? [[0, '#2b2446'], [0.36, '#6d4b6b'], [0.66, '#d07868'], [0.86, '#f0a868'], [1, '#f8ce92']]
          : phase === 'night'
            ? [[0, '#10172b'], [0.4, '#1d2540'], [0.7, '#33334d'], [0.88, '#59455a'], [1, '#8b665a']]
            : [[0, '#17253d'], [0.38, '#4f607c'], [0.66, '#c98a6b'], [0.86, '#f2b47d'], [1, '#f8d6a4']];
      ctx.fillStyle = vgrad(ctx, 0, 610, sky);
      ctx.fillRect(-30, -30, W + 60, 660);
      const sunX = phase === 'day' ? 1260 : phase === 'sunset' ? 1120 : 1280;
      const sunY = phase === 'day' ? 230 : phase === 'sunset' ? 470 : 430;
      const sunGlow = phase === 'night' ? 'rgba(255,210,150,.35)' : 'rgba(255,196,118,.9)';
      glow(ctx, sunX, sunY, 260, sunGlow, phase === 'night' ? 0.35 : 0.55);
      ctx.fillStyle = phase === 'night' ? 'rgba(255,230,195,.7)' : 'rgba(255,236,190,.92)';
      ctx.beginPath(); ctx.arc(sunX, sunY, phase === 'day' ? 44 : 53, 0, TAU); ctx.fill();

      // облака
      ctx.fillStyle = phase === 'sunset' ? 'rgba(255,205,185,.22)' : 'rgba(255,225,200,.18)';
      for (let i = 0; i < 5; i++) {
        const x = mod(i * 390 + t * 2.2, W + 300) - 150;
        ctx.beginPath();
        ctx.ellipse(x, 150 + (i % 3) * 58, 120, 16, 0, 0, TAU);
        ctx.fill();
      }

      drawMountains(ctx, 560, 330, phase === 'day' ? 'day' : phase === 'sunset' ? 'dusk' : phase === 'night' ? 'night' : 'dawn');

      // город
      drawSkyline(ctx, 606, 54, 148, phase === 'night' ? '#1b2030' : '#2d3444',
        phase === 'night' ? 'rgba(255,214,140,.8)' : 'rgba(255,214,140,.55)', 7, t);
      ctx.fillStyle = 'rgba(255,215,165,.16)';
      ctx.fillRect(0, 470, W, 145);

      // дорога
      ctx.fillStyle = vgrad(ctx, 600, 900, [[0, '#31363c'], [1, '#171b20']]);
      ctx.fillRect(-30, 600, W + 60, 330);
      ctx.fillStyle = '#5a5e63';
      ctx.fillRect(0, 598, W, 12);
      ctx.fillStyle = '#8a8b87';
      ctx.fillRect(0, 610, W, 4);
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (let i = 0; i < 14; i++) {
        ctx.globalAlpha = 0.16;
        ctx.fillRect(i * 130 + 20, 604, 60, 3);
      }
      ctx.globalAlpha = 1;

      // разметка
      for (let lane = 1; lane <= 2; lane++) {
        const y = 600 + lane * 96;
        for (let x = -100; x < W + 100; x += 190) {
          ctx.fillStyle = 'rgba(245,238,210,.62)';
          ctx.fillRect(x + mod(t * 60 * (lane === 1 ? -1 : 1), 190), y, 92, 6);
        }
      }

      // машины
      const laneY = [690, 792, 882];
      const laneScale = [0.72, 0.92, 1.12];
      this.cars.forEach((c, i) => {
        const range = W + 520;
        const x = mod(c.off + t * c.speed * (c.dir > 0 ? 1 : 1), range) - 260;
        const px = c.dir > 0 ? x : W - x;
        // выхлоп
        ctx.globalAlpha = 0.08;
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = '#cfd4d8';
          ctx.beginPath();
          ctx.arc(px - c.dir * (90 + k * 28), laneY[c.lane] - 20 - k * 6, 9 + k * 3, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        drawCar(ctx, px, laneY[c.lane], laneScale[c.lane] * (c.lane === 2 ? 1.08 : 1), c.dir, c.color, c.kind, t);
      });

      // указатель на двух стойках (на тротуаре, не на проезжей части)
      ctx.fillStyle = '#2a2f33';
      ctx.fillRect(1166, 330, 9, 266);
      ctx.fillRect(1356, 330, 9, 266);
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.beginPath(); ctx.ellipse(1170, 597, 16, 4, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1360, 597, 16, 4, 0, 0, TAU); ctx.fill();
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
      ctx.fillStyle = '#245c48';
      rrect(ctx, 1110, 262, 310, 84, 10); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 3;
      rrect(ctx, 1117, 269, 296, 70, 7); ctx.stroke();
      ctx.fillStyle = '#f7f4ea';
      const tsign = this.sign('traffic');
      ctx.textAlign = 'center';
      this.fitText(ctx, tsign[0], 700, 27, 280, 1265, 305);
      this.fitText(ctx, tsign[1], 500, 18, 280, 1265, 328);

      // светофор: основание на тротуаре у бордюра
      this.drawTrafficLight(ctx, 1500, 596, t);

      // деревья и люди на тротуаре
      const treeTone = phase === 'night' ? ['#233a31', '#2b4638'] : ['#2f4a3d', '#3a5c49'];
      for (let i = 0; i < 4; i++) this.drawTree(ctx, 140 + i * 290, 604, 0.78, i * 1.7, treeTone);
      this.drawWalker(ctx, 1040, 590, 0.52, t, '#202730');

      // пыль
      this.motes.forEach((m) => {
        const x = mod(m.x + t * m.vx * 0.7, W);
        const y = mod(m.y + t * m.vy * 0.5, 620);
        ctx.globalAlpha = m.a * 0.45;
        ctx.fillStyle = '#ffe0b0';
        ctx.beginPath(); ctx.arc(x, y, m.r * 0.8, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // виньетка
      const vig = ctx.createLinearGradient(0, 500, 0, 900);
      vig.addColorStop(0, 'rgba(5,8,12,0)');
      vig.addColorStop(1, 'rgba(5,8,12,.58)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 500, W, 400);
    }

    drawWalker(ctx, x, y, s, t, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      const ph = t * 4 + x;
      const sw = Math.sin(ph);
      const bob = Math.abs(Math.cos(ph)) * -2.5;
      const skin = '#b98363';
      ctx.fillStyle = 'rgba(0,0,0,.26)';
      ctx.beginPath(); ctx.ellipse(0, 3, 26, 6, 0, 0, TAU); ctx.fill();
      // дальняя рука и ноги (с шагом от бедра)
      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(side * 5, -12 + bob);
        ctx.rotate(sw * 0.3 * side);
        ctx.fillStyle = color;
        rrect(ctx, -4.5, 0, 9, 40, 4); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        rrect(ctx, -4.5, 0, 9, 40, 4); ctx.fill();
        ctx.fillStyle = '#111316';
        rrect(ctx, -5, 36, 14, 6, 3); ctx.fill();
        ctx.restore();
      });
      // торс, воротник, ремень
      ctx.fillStyle = color;
      rrect(ctx, -14, -60 + bob, 28, 52, 11); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      rrect(ctx, -14, -60 + bob, 9, 52, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(-14, -18 + bob, 28, 3);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath();
      ctx.moveTo(-8, -60 + bob); ctx.lineTo(8, -60 + bob); ctx.lineTo(0, -48 + bob); ctx.closePath(); ctx.fill();
      // рука впереди с кистью
      ctx.save();
      ctx.translate(-14, -54 + bob);
      ctx.rotate(-sw * 0.3);
      ctx.fillStyle = color;
      rrect(ctx, -4.5, 0, 9, 34, 4); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, 36, 4.5, 0, TAU); ctx.fill();
      ctx.restore();
      // шея, голова, волосы
      ctx.fillStyle = skin;
      ctx.fillRect(-4, -66 + bob, 8, 8);
      ctx.beginPath(); ctx.arc(0, -73 + bob, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1e1b1a';
      ctx.beginPath(); ctx.arc(0, -76 + bob, 12.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.restore();
    }

    /* ------------------------------------------------------------------ */
    drawOffice(ctx) {
      const t = this.t;
      ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#1d2930'], [0.5, '#23333b'], [1, '#172228']]);
      ctx.fillRect(-30, -30, W + 60, H + 60);

      // окно
      const wx = 760, wy = 74, ww = 770, wh = 436;
      ctx.save();
      rrect(ctx, wx, wy, ww, wh, 6);
      ctx.clip();
      ctx.fillStyle = vgrad(ctx, wy, wy + wh, [
        [0, '#5f8db0'], [0.45, '#a8c6d2'], [0.72, '#e7d3b2'], [1, '#f4d9af']
      ]);
      ctx.fillRect(wx, wy, ww, wh);
      glow(ctx, wx + 590, wy + 120, 200, 'rgba(255,241,198,.8)', 0.4);
      drawMountains(ctx, wy + wh - 30, 220, 'day');
      drawSkyline(ctx, wy + wh - 20, 50, 160, '#4f6270', 'rgba(235,232,205,.35)', 21, t);
      // движение внизу
      ctx.fillStyle = '#3d4b55';
      ctx.fillRect(wx, wy + wh - 30, ww, 30);
      for (let i = 0; i < 4; i++) {
        const cx = wx + mod(t * 24 + i * 210, ww + 80) - 40;
        ctx.fillStyle = i % 2 ? '#d8e0e4' : '#c46a5a';
        rrect(ctx, cx, wy + wh - 20, 40, 12, 3);
        ctx.fill();
      }
      ctx.restore();

      // рама
      ctx.strokeStyle = '#38474f';
      ctx.lineWidth = 12;
      rrect(ctx, wx, wy, ww, wh, 6);
      ctx.stroke();
      ctx.lineWidth = 6;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(wx + i * ww / 3, wy);
        ctx.lineTo(wx + i * ww / 3, wy + wh);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh / 2);
      ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();

      // стена слева: графики и часы
      ctx.fillStyle = '#2b3a41';
      rrect(ctx, 70, 150, 300, 190, 12); ctx.fill();
      ctx.strokeStyle = '#455c65'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = '#5fd1b7'; ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const x = 96 + i * 29;
        const y = 298 - (30 + hash(i * 2.3) * 80 + Math.sin(t * 0.8 + i) * 8);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(95,209,183,.2)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(90, 190 + i * 34); ctx.lineTo(348, 190 + i * 34); ctx.stroke();
      }

      // часы
      ctx.save();
      ctx.translate(560, 190);
      ctx.fillStyle = '#e8e4d8';
      ctx.beginPath(); ctx.arc(0, 0, 62, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#46555c'; ctx.lineWidth = 6; ctx.stroke();
      const hr = (this.minutes / 60) % 12 / 12 * TAU - Math.PI / 2;
      const mn = (this.minutes % 60) / 60 * TAU - Math.PI / 2;
      ctx.strokeStyle = '#223037'; ctx.lineCap = 'round';
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hr) * 28, Math.sin(hr) * 28); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(mn) * 44, Math.sin(mn) * 44); ctx.stroke();
      ctx.restore();

      // растения
      this.drawPlant(ctx, 700, 590, 1.1);

      // стол
      ctx.fillStyle = '#2b2724';
      ctx.fillRect(0, 700, W, 200);
      ctx.fillStyle = '#8b684c';
      ctx.fillRect(0, 686, W, 22);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(0, 686, W, 3);

      // ноутбук
      this.drawLaptop(ctx, 470, 690);

      // монитор
      ctx.fillStyle = '#101719';
      rrect(ctx, 940, 380, 380, 235, 12); ctx.fill();
      ctx.fillStyle = '#16262b';
      rrect(ctx, 952, 392, 356, 205, 6); ctx.fill();
      ctx.fillStyle = 'rgba(80,220,190,.13)';
      ctx.fillRect(952, 392, 356, 205);
      ctx.fillStyle = '#59d4bc';
      ctx.font = '700 16px Inter, system-ui, sans-serif';
      ctx.fillText('Q4 · ПРЕЗЕНТАЦИЯ', 976, 428);
      ctx.fillStyle = 'rgba(235,240,235,.85)';
      for (let i = 0; i < 5; i++) {
        rrect(ctx, 976, 452 + i * 24, 120 + hash(i * 3.1) * 160, 9, 4);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(95,209,183,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const x = 1000 + i * 36;
        const y = 570 - (i * 6 + Math.sin(t * 1.4 + i) * 10 + 20);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#1a2326';
      ctx.fillRect(1090, 615, 80, 46);
      ctx.fillStyle = '#0f1517';
      rrect(ctx, 1060, 655, 140, 14, 7); ctx.fill();

      // второй монитор / клавиатура
      ctx.fillStyle = '#151c1f';
      rrect(ctx, 760, 570, 260, 120, 8); ctx.fill();
      ctx.fillStyle = 'rgba(245,200,120,.16)';
      ctx.fillRect(772, 582, 236, 96);
      ctx.fillStyle = '#c8b38c';
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.fillText('СЧЁТ · 850 сом', 786, 610);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      for (let i = 0; i < 3; i++) ctx.fillRect(786, 628 + i * 16, 150 - i * 26, 5);

      // клавиатура и мышь
      ctx.fillStyle = '#20282b';
      rrect(ctx, 720, 744, 300, 26, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      for (let i = 0; i < 12; i++) ctx.fillRect(730 + i * 23, 750, 14, 12);
      ctx.fillStyle = '#20282b';
      ctx.beginPath(); ctx.ellipse(1070, 756, 16, 24, 0, 0, TAU); ctx.fill();

      // кружка
      this.drawMug(ctx, 1240, 696, false, 0.2);

      // бумаги
      ctx.save();
      ctx.translate(1370, 726);
      ctx.rotate(-0.09);
      ctx.fillStyle = '#efe9d9';
      ctx.fillRect(-58, -80, 140, 170);
      ctx.fillStyle = 'rgba(80,100,105,.5)';
      for (let i = 0; i < 7; i++) ctx.fillRect(-42, -56 + i * 20, 100 - (i % 3) * 18, 5);
      ctx.restore();

      // лёгкая пыль / блики
      this.motes.forEach((m) => {
        const x = mod(m.x + t * m.vx * 0.4, W);
        const y = mod(m.y + t * m.vy * 0.4, 600);
        ctx.globalAlpha = m.a * 0.3;
        ctx.fillStyle = '#d9f4ec';
        ctx.beginPath(); ctx.arc(x, y, m.r * 0.8, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // виньетка
      const vig = ctx.createLinearGradient(0, 0, 0, 900);
      vig.addColorStop(0, 'rgba(4,8,10,.08)');
      vig.addColorStop(1, 'rgba(4,8,10,.45)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    drawLaptop(ctx, x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#2b3537';
      rrect(ctx, -140, -190, 280, 188, 12); ctx.fill();
      ctx.fillStyle = '#0e1b1d';
      rrect(ctx, -126, -176, 252, 160, 6); ctx.fill();
      ctx.fillStyle = 'rgba(80,220,190,.12)';
      ctx.fillRect(-126, -176, 252, 160);
      ctx.fillStyle = '#5bd9c1';
      ctx.font = '700 14px Inter, system-ui, sans-serif';
      ctx.fillText('ЗАДАЧИ НА ДЕНЬ', -108, -148);
      ctx.fillStyle = 'rgba(235,245,240,.7)';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-108, -124 + i * 22, 80 + hash(i * 4.2) * 100, 6);
        ctx.strokeStyle = 'rgba(90,220,190,.5)';
        ctx.strokeRect(-120, -128 + i * 22, 8, 8);
      }
      ctx.fillStyle = '#232d2f';
      rrect(ctx, -165, -8, 330, 18, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.fillRect(-130, 1, 260, 2);
      glow(ctx, 0, -80, 220, 'rgba(80,220,190,.45)', 0.16);
      ctx.restore();
    }

    /** Текст, который сам уменьшает кегль, чтобы поместиться в вывеску. */
    fitText(ctx, text, weight, size, maxWidth, x, y) {
      let px = size;
      ctx.font = weight + ' ' + px + 'px Inter, system-ui, sans-serif';
      while (px > 10 && ctx.measureText(text).width > maxWidth) {
        px -= 1;
        ctx.font = weight + ' ' + px + 'px Inter, system-ui, sans-serif';
      }
      ctx.fillText(text, x, y);
    }

    skyFor(ctx, h) {
      const phase = this.phase;
      const sky = phase === 'day'
        ? [[0, '#3f6f9c'], [0.45, '#7fb0cc'], [0.8, '#d3e6e6'], [1, '#f2e6c9']]
        : phase === 'sunset'
          ? [[0, '#2b2446'], [0.4, '#6d4b6b'], [0.72, '#d07868'], [1, '#f8ce92']]
          : phase === 'night'
            ? [[0, '#0e1428'], [0.5, '#1d2540'], [0.85, '#35334d'], [1, '#59455a']]
            : [[0, '#2b4266'], [0.42, '#7b7f9a'], [0.72, '#e0a37c'], [1, '#f8d6a4']];
      ctx.fillStyle = vgrad(ctx, 0, h, sky);
      ctx.fillRect(-30, -30, W + 60, h + 40);
      const sx = phase === 'day' ? 1380 : phase === 'sunset' ? 1260 : 1450;
      const sy = phase === 'day' ? 200 : phase === 'sunset' ? 430 : phase === 'night' ? 170 : 400;
      glow(ctx, sx, sy, 240, phase === 'night' ? 'rgba(200,215,255,.5)' : 'rgba(255,205,130,.9)', 0.45);
      ctx.fillStyle = phase === 'night' ? 'rgba(235,240,255,.85)' : 'rgba(255,238,195,.92)';
      ctx.beginPath(); ctx.arc(sx, sy, phase === 'night' ? 30 : 44, 0, TAU); ctx.fill();
      if (phase === 'night') {
        this.stars.forEach((st) => {
          ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(this.t * st.tw));
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(st.x, st.y * 0.8, st.r, 0, TAU); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Дубовый парк и бульвар Эркиндик: центр, прогулки, гитарист у фонтана */
    drawPark(ctx) {
      const t = this.t;
      const phase = this.phase;
      this.skyFor(ctx, 600);
      drawMountains(ctx, 560, 300, phase === 'day' ? 'day' : phase === 'sunset' ? 'dusk' : phase === 'night' ? 'night' : 'dawn');
      drawSkyline(ctx, 600, 40, 120, phase === 'night' ? '#1b2030' : '#4a5468',
        phase === 'night' ? 'rgba(255,214,140,.8)' : 'rgba(255,214,140,.4)', 11, t);

      // газон и дорожка
      ctx.fillStyle = vgrad(ctx, 590, 900, [[0, phase === 'night' ? '#1f3328' : '#4a6a4a'], [1, phase === 'night' ? '#101c16' : '#2c4433']]);
      ctx.fillRect(-30, 590, W + 60, 330);
      ctx.fillStyle = phase === 'night' ? '#4a463f' : '#c9b99a';
      ctx.beginPath();
      ctx.moveTo(760, 600); ctx.lineTo(980, 600); ctx.lineTo(1300, 900); ctx.lineTo(520, 900);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.1)';
      ctx.beginPath(); ctx.moveTo(880, 600); ctx.lineTo(980, 600); ctx.lineTo(1300, 900); ctx.lineTo(1180, 900); ctx.closePath(); ctx.fill();

      // дубы
      const tone = phase === 'night' ? ['#1f3a2c', '#284636'] : ['#2f5a3d', '#3c6e4a'];
      [[80, 1.5], [300, 1.25], [560, 1.0], [1520, 1.4], [1340, 1.0]].forEach((p, i) => {
        this.drawTree(ctx, p[0], 612, p[1], i * 1.9 + 2, tone);
      });

      // вывеска на двух стойках
      ctx.fillStyle = '#2a2f33';
      ctx.fillRect(1030, 330, 8, 262); ctx.fillRect(1250, 330, 8, 262);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
      ctx.fillStyle = '#245c48';
      rrect(ctx, 980, 250, 320, 90, 10); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
      rrect(ctx, 987, 257, 306, 76, 7); ctx.stroke();
      ctx.fillStyle = '#f7f4ea'; ctx.textAlign = 'center';
      this.fitText(ctx, 'ДУБОВЫЙ ПАРК', 800, 30, 280, 1140, 295);
      this.fitText(ctx, 'БУЛЬВАР ЭРКИНДИК →', 500, 17, 280, 1140, 320);

      // фонтан
      const fx = 1160, fy = 720;
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(fx, fy + 26, 118, 20, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9a9a96';
      ctx.beginPath(); ctx.ellipse(fx, fy + 16, 108, 22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5d9ab4';
      ctx.beginPath(); ctx.ellipse(fx, fy + 12, 96, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8b8b2'; ctx.fillRect(fx - 9, fy - 50, 18, 62);
      ctx.fillStyle = '#a4a4a0'; ctx.beginPath(); ctx.ellipse(fx, fy - 50, 40, 8, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 14; i++) {
        const life = mod(t * 0.9 + i / 14, 1);
        const a = (i / 14 - 0.5) * 1.8;
        ctx.globalAlpha = (1 - life) * 0.8;
        ctx.fillStyle = '#e8f6ff';
        ctx.beginPath();
        ctx.arc(fx + Math.sin(a) * life * 70, fy - 56 - Math.sin(life * Math.PI) * 54 + life * life * 62, 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // лавочка и гитарист
      const bx = 1430, by = 760;
      ctx.fillStyle = '#5a3d2a';
      rrect(ctx, bx - 70, by - 34, 140, 10, 3); ctx.fill();
      rrect(ctx, bx - 70, by - 4, 140, 10, 3); ctx.fill();
      ctx.fillRect(bx - 62, by + 6, 8, 26); ctx.fillRect(bx + 54, by + 6, 8, 26);
      ctx.fillStyle = '#3a4650';
      rrect(ctx, bx - 20, by - 62, 36, 58, 10); ctx.fill();
      ctx.fillStyle = '#b98363'; ctx.beginPath(); ctx.arc(bx - 2, by - 78, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1e1b1a'; ctx.beginPath(); ctx.arc(bx - 2, by - 81, 12.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.fillStyle = '#3a4650'; rrect(ctx, bx - 20, by - 8, 56, 12, 5); ctx.fill();
      ctx.save();
      ctx.translate(bx - 14, by - 34);
      ctx.rotate(-0.5 + Math.sin(t * 3) * 0.02);
      ctx.fillStyle = '#b77438'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 18, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8f5a2a'; ctx.fillRect(18, -3, 56, 6);
      ctx.restore();
      ctx.fillStyle = '#2a2018';
      ctx.beginPath(); ctx.ellipse(bx - 100, by + 30, 26, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e2b25a';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(bx - 112 + i * 8, by + 27, 3, 0, TAU); ctx.fill(); }
      // ноты
      for (let i = 0; i < 3; i++) {
        const life = mod(t * 0.35 + i / 3, 1);
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.7;
        ctx.fillStyle = '#fff4d6';
        ctx.beginPath(); ctx.arc(bx - 90 + life * 40, by - 80 - life * 90, 5, 0, TAU); ctx.fill();
        ctx.fillRect(bx - 86 + life * 40, by - 106 - life * 90, 2, 26);
      }
      ctx.globalAlpha = 1;

      // фонари
      [700, 1380].forEach((lx) => {
        ctx.fillStyle = '#242a2e';
        ctx.fillRect(lx - 4, 470, 8, 140);
        ctx.fillStyle = '#e9d9a8';
        rrect(ctx, lx - 14, 450, 28, 30, 8); ctx.fill();
        glow(ctx, lx, 465, phase === 'night' ? 150 : 70, 'rgba(255,220,150,.9)', phase === 'night' || phase === 'sunset' ? 0.5 : 0.12);
      });

      this.drawWalker(ctx, 880, 700, 0.62, t, '#2b3340');
      this.drawWalker(ctx, 930, 712, 0.56, t + 1.7, '#4a3b3a');

      // листья и пыль
      this.leaves.forEach((l) => {
        const x = mod(l.x + t * l.sp * 0.7, W + 80) - 40;
        const y = mod(l.y + t * 9 + Math.sin(t * 0.8 + l.ph) * 20, H + 60) - 30;
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = l.ph > 3 ? '#d99c3a' : '#9bb04a';
        ctx.beginPath(); ctx.ellipse(x, y, l.s, l.s * 0.5, l.ph + t, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const vig = ctx.createLinearGradient(0, 520, 0, 900);
      vig.addColorStop(0, 'rgba(5,8,12,0)'); vig.addColorStop(1, 'rgba(5,8,12,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 520, W, 380);
    }

    /* ------------------------------------------------------------------ */
    /* Двор Востока-5: панельные дома, «Народный», чайхана, «Фит» Бакыта */
    drawCourtyard(ctx) {
      const t = this.t;
      const phase = this.phase;
      const dark = phase === 'night' || phase === 'sunset';
      this.skyFor(ctx, 560);
      drawMountains(ctx, 540, 250, phase === 'day' ? 'day' : phase === 'sunset' ? 'dusk' : phase === 'night' ? 'night' : 'dawn');

      // панельные дома
      const blocks = [{ x: 20, w: 600, h: 360, c: '#b8aea0' }, { x: 660, w: 560, h: 420, c: '#aaa396' }, { x: 1260, w: 420, h: 340, c: '#b5a99a' }];
      blocks.forEach((b, bi) => {
        const top = 600 - b.h;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        ctx.fillStyle = b.c; ctx.fillRect(b.x, top, b.w, b.h);
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(b.x, top, b.w, 10);
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        for (let sx = b.x + 70; sx < b.x + b.w; sx += 70) ctx.fillRect(sx, top, 2, b.h);
        for (let fy = top + 70; fy < 590; fy += 70) ctx.fillRect(b.x, fy, b.w, 2);
        for (let row = 0; row < Math.floor(b.h / 70); row++) {
          for (let col = 0; col < Math.floor(b.w / 70); col++) {
            const wx = b.x + 14 + col * 70;
            const wy = top + 16 + row * 70;
            const r = hash(bi * 31 + row * 7 + col * 3.1);
            ctx.fillStyle = dark && r > 0.45 ? 'rgba(255,214,140,.85)' : 'rgba(95,130,150,.8)';
            rrect(ctx, wx, wy, 34, 42, 3); ctx.fill();
            ctx.fillStyle = 'rgba(40,50,55,.35)';
            ctx.fillRect(wx + 16, wy, 2, 42); ctx.fillRect(wx, wy + 20, 34, 2);
            if (r > 0.7) { ctx.fillStyle = 'rgba(40,40,40,.4)'; ctx.fillRect(wx - 3, wy + 44, 40, 5); }
            if (r < 0.15) { ctx.fillStyle = '#c9c9c4'; ctx.beginPath(); ctx.arc(wx + 40, wy + 6, 7, 0, TAU); ctx.fill(); }
          }
        }
        // подъезд с козырьком
        ctx.fillStyle = '#4a4540'; rrect(ctx, b.x + b.w * 0.45, 530, 46, 70, 3); ctx.fill();
        ctx.fillStyle = '#6d5a45'; ctx.fillRect(b.x + b.w * 0.45 - 8, 522, 62, 8);
      });

      // двор
      ctx.fillStyle = vgrad(ctx, 596, 900, [[0, dark ? '#2f332f' : '#6a6b60'], [1, '#2a2d28']]);
      ctx.fillRect(-30, 596, W + 60, 330);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, 596, W, 4);

      // «Народный» и чайхана (справа, правее блока выбора)
      const kx = 1030, ky = 470;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#d9cfba'; ctx.fillRect(kx, ky + 60, 330, 130);
      ctx.restore();
      ctx.fillStyle = '#2f6a4d';
      ctx.fillRect(kx - 10, ky + 40, 350, 30);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#f3efe2' : '#2f6a4d'; ctx.fillRect(kx - 10 + i * 39, ky + 70, 39, 18); }
      ctx.fillStyle = 'rgba(100,150,170,.85)'; rrect(ctx, kx + 24, ky + 100, 170, 70, 4); ctx.fill();
      ctx.fillStyle = dark ? 'rgba(255,225,160,.55)' : 'rgba(255,255,255,.14)'; ctx.fillRect(kx + 24, ky + 100, 170, 70);
      ctx.fillStyle = '#6d5a45'; rrect(ctx, kx + 230, ky + 100, 64, 90, 4); ctx.fill();
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
      ctx.fillStyle = '#245c48'; rrect(ctx, kx + 20, ky - 40, 290, 70, 10); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; rrect(ctx, kx + 27, ky - 33, 276, 56, 6); ctx.stroke();
      ctx.fillStyle = '#f7f4ea'; ctx.textAlign = 'center';
      this.fitText(ctx, '«НАРОДНЫЙ»', 800, 34, 250, kx + 165, ky + 3);
      // чайхана: вывеска и тапчан под ней
      ctx.fillStyle = '#f7f4ea'; rrect(ctx, 1400, 540, 150, 34, 6); ctx.fill();
      ctx.fillStyle = '#245c48';
      this.fitText(ctx, 'ЧАЙХАНА', 700, 17, 130, 1475, 563);

      // гирлянда через двор: тусклая днём, тёплая к вечеру и на ашаре
      const lit = dark || this.festive;
      const strands = [[-20, 368, 520, 436], [520, 436, 1010, 388], [1010, 388, 1620, 448]];
      ctx.save();
      ctx.strokeStyle = 'rgba(24,26,24,.42)'; ctx.lineWidth = 2;
      strands.forEach(([x1, y1, x2, y2], si) => {
        const cx = (x1 + x2) / 2;
        const cy = Math.max(y1, y2) + 72;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
        if (!lit) return;
        const n = 8;
        for (let i = 1; i < n; i++) {
          const p = i / n;
          const bx = (1 - p) * (1 - p) * x1 + 2 * (1 - p) * p * cx + p * p * x2;
          const by = (1 - p) * (1 - p) * y1 + 2 * (1 - p) * p * cy + p * p * y2;
          const flick = 0.72 + 0.28 * Math.sin(t * 2.4 + si * 1.7 + i * 1.3);
          glow(ctx, bx, by + 5, 26, 'rgba(255,206,120,.9)', 0.42 * flick);
          ctx.fillStyle = 'rgba(255,240,196,' + (0.72 + 0.24 * flick).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(bx, by + 5, 3.4, 0, TAU); ctx.fill();
        }
      });
      ctx.restore();

      // абрикосовое дерево у первого подъезда
      const ax = 336, ay = 664;
      const sway = Math.sin(t * 0.55) * 2;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(0, 2, 48, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a3728';
      ctx.beginPath();
      ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(5, -96); ctx.lineTo(-5, -96);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4a3728'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -70); ctx.quadraticCurveTo(-28 + sway, -96, -44 + sway, -118);
      ctx.moveTo(2, -80); ctx.quadraticCurveTo(26 + sway, -104, 40 + sway, -128);
      ctx.stroke();
      const blobs = [[0, -132, 56], [-44, -114, 40], [44, -120, 42], [-16, -168, 40], [24, -160, 36]];
      blobs.forEach(([bx, by, br]) => {
        const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.4, br * 0.15, bx, by, br);
        g.addColorStop(0, dark ? '#37603f' : '#4d8a4a');
        g.addColorStop(1, dark ? '#1f3a2a' : '#2e5c37');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      });
      const fruits = [[-30, -150], [-4, -128], [26, -142], [-52, -112], [48, -118], [10, -168], [-20, -186], [36, -166], [-58, -136], [62, -140]];
      fruits.forEach(([fx, fy], i) => {
        const r = 5.2 + hash(i * 4.3) * 2.4;
        glow(ctx, fx, fy, r * 4.6, 'rgba(255,178,84,.55)', 0.26);
        ctx.fillStyle = i % 3 ? '#f2a33c' : '#f7bd5a';
        ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.beginPath(); ctx.arc(fx - r * 0.3, fy - r * 0.35, r * 0.32, 0, TAU); ctx.fill();
      });
      ctx.restore();

      // казан на треноге: дым, огонь, чугун
      const kzx = 214, kzy = 726;
      ctx.save();
      ctx.translate(kzx, kzy);
      ctx.strokeStyle = '#3a3632'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-42, 80); ctx.lineTo(-8, 18);
      ctx.moveTo(42, 80); ctx.lineTo(8, 18);
      ctx.moveTo(2, 84); ctx.lineTo(0, 16);
      ctx.stroke();
      const fl = 0.76 + 0.24 * Math.sin(t * 6.1);
      glow(ctx, 0, 62, 96, 'rgba(255,146,54,.95)', 0.38 * fl);
      ctx.fillStyle = 'rgba(255,157,58,.9)';
      ctx.beginPath();
      ctx.moveTo(-22, 72); ctx.quadraticCurveTo(-6, 30 - 10 * fl, 2, 68);
      ctx.quadraticCurveTo(14, 34 + 8 * fl, 26, 72);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,226,150,.9)';
      ctx.beginPath(); ctx.moveTo(-8, 70); ctx.quadraticCurveTo(0, 46, 8, 70); ctx.closePath(); ctx.fill();
      const kg = ctx.createLinearGradient(-66, 0, 66, 0);
      kg.addColorStop(0, '#1d1f1c'); kg.addColorStop(0.45, '#4a4d48'); kg.addColorStop(1, '#212420');
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.moveTo(-66, -26);
      ctx.quadraticCurveTo(-70, 26, 0, 34);
      ctx.quadraticCurveTo(70, 26, 66, -26);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a6d66'; rrect(ctx, -70, -35, 140, 12, 6); ctx.fill();
      ctx.fillStyle = '#2b2d29';
      ctx.beginPath(); ctx.ellipse(0, -29, 60, 8, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.32 + i * 0.25) % 1;
        ctx.globalAlpha = 0.2 * (1 - ph);
        ctx.fillStyle = '#f4ede0';
        ctx.beginPath(); ctx.arc(-14 + i * 12 + Math.sin(t + i) * 6, -46 - ph * 68, 9 + ph * 20, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // тапчан под чайханой: курпача, подушки, чайник и пиалы
      const px0 = 1322, pw = 272, py0 = 726;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(px0 + pw / 2, py0 + 78, pw * 0.54, 15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a3520';
      [px0 + 12, px0 + pw - 30].forEach((x) => { ctx.fillRect(x, py0 + 26, 18, 50); });
      ctx.fillStyle = '#7a5230'; rrect(ctx, px0, py0, pw, 28, 5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(px0, py0 + 20, pw, 8);
      ctx.fillStyle = '#8f3f38'; rrect(ctx, px0 + 6, py0 - 10, pw - 12, 22, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,208,140,.45)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const dx = px0 + 26 + i * 52;
        ctx.beginPath(); ctx.moveTo(dx, py0 - 5); ctx.lineTo(dx + 12, py0 - 1); ctx.lineTo(dx + 24, py0 - 5); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(240,214,164,.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const dx = px0 + 14 + i * 19;
        ctx.beginPath(); ctx.moveTo(dx, py0 + 11); ctx.lineTo(dx, py0 + 18); ctx.stroke();
      }
      const pillows = [
        [px0 + 16, py0 - 30, 42, 24, '#d9c39a'],
        [px0 + pw - 62, py0 - 30, 46, 24, '#b9544a'],
        [px0 + pw - 122, py0 - 26, 38, 20, '#c7a86f']
      ];
      pillows.forEach(([x, y, w, h, c]) => {
        ctx.fillStyle = c; rrect(ctx, x, y, w, h, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 1.5;
        rrect(ctx, x + 1, y + 1, w - 2, h - 2, 7); ctx.stroke();
      });
      const tx2 = px0 + pw / 2 - 40, ty2 = py0 - 10;
      ctx.fillStyle = '#e8dcc2';
      ctx.beginPath();
      ctx.moveTo(tx2 - 16, ty2);
      ctx.quadraticCurveTo(tx2 - 20, ty2 - 24, tx2 - 6, ty2 - 26);
      ctx.lineTo(tx2 + 10, ty2 - 26);
      ctx.quadraticCurveTo(tx2 + 22, ty2 - 22, tx2 + 16, ty2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e8dcc2'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tx2 + 14, ty2 - 20); ctx.quadraticCurveTo(tx2 + 26, ty2 - 16, tx2 + 18, ty2 - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx2 - 16, ty2 - 20); ctx.lineTo(tx2 - 28, ty2 - 30); ctx.stroke();
      ctx.fillStyle = '#c9b48c';
      ctx.beginPath(); ctx.ellipse(tx2 - 2, ty2 - 27, 10, 3.4, 0, 0, TAU); ctx.fill();
      [0, 1, 2].forEach((i) => {
        const bx = tx2 + 36 + i * 22;
        ctx.fillStyle = i === 1 ? '#d9b06a' : '#efe4cc';
        ctx.beginPath(); ctx.ellipse(bx, ty2 - 4, 9, 4.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(80,50,25,.45)';
        ctx.beginPath(); ctx.ellipse(bx, ty2 - 6, 6, 2.4, 0, 0, TAU); ctx.fill();
      });
      if (lit) {
        glow(ctx, px0 + pw / 2, py0 - 20, 120, 'rgba(255,198,112,.8)', 0.3);
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.26 + i * 0.33) % 1;
          ctx.globalAlpha = 0.2 * (1 - ph);
          ctx.fillStyle = '#fdf6e8';
          ctx.beginPath(); ctx.arc(tx2 + i * 8 - 4, ty2 - 34 - ph * 46, 7 + ph * 14, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();

      // деревья, детская площадка, лавочка
      this.drawTree(ctx, 700, 640, 0.9, 3.1, dark ? ['#233a31', '#2b4638'] : ['#35623f', '#43754b']);
      this.drawTree(ctx, 40, 640, 1.1, 5.2, dark ? ['#233a31', '#2b4638'] : ['#35623f', '#43754b']);
      ctx.strokeStyle = '#a24a3d'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(800, 780); ctx.lineTo(820, 690); ctx.lineTo(880, 690); ctx.lineTo(900, 780); ctx.stroke();
      const sw = Math.sin(t * 1.6) * 0.3;
      ctx.save(); ctx.translate(850, 690); ctx.rotate(sw);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, 52); ctx.moveTo(8, 0); ctx.lineTo(8, 52); ctx.stroke();
      ctx.fillStyle = '#2f5d8a'; ctx.fillRect(-14, 50, 28, 6);
      ctx.restore();

      // «Фит» Бакыта: днём у подъезда, вечером отогнан в сторону
      drawCar(ctx, this.festive ? 1092 : 990, this.festive ? 736 : 722, 1.1, 1, '#98a6b4', 'car', t);

      this.drawWalker(ctx, 600, 748, 0.66, t, '#2d3a33');
      this.drawWalker(ctx, 1200, 772, 0.7, t + 1.4, '#3c3a52');

      this.leaves.forEach((l) => {
        const x = mod(l.x + t * l.sp * 0.5, W + 80) - 40;
        const y = mod(l.y + t * 6 + Math.sin(t * 0.8 + l.ph) * 18, H + 60) - 30;
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#f0c98a';
        ctx.beginPath(); ctx.ellipse(x, y, l.s, l.s * 0.45, l.ph + t, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const vig = ctx.createLinearGradient(0, 560, 0, 900);
      vig.addColorStop(0, 'rgba(5,8,12,0)'); vig.addColorStop(1, 'rgba(5,8,12,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 560, W, 340);
    }

    /* ------------------------------------------------------------------ */
    /* Лестница Востока-5: крашеная стена, окно, перила, дверь Апы Гули */
    drawStairwell(ctx) {
      const t = this.t;

      // стены
      ctx.fillStyle = vgrad(ctx, 0, 720, [[0, '#c0b7a4'], [0.6, '#a89f8c'], [1, '#8e8674']]);
      ctx.fillRect(-30, -30, W + 60, 760);
      ctx.fillStyle = vgrad(ctx, 468, 730, [[0, '#5f7059'], [1, '#45533f']]);
      ctx.fillRect(-30, 468, W + 60, 280);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-30, 468, W + 60, 6);
      ctx.strokeStyle = 'rgba(60,55,45,.16)'; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const x = 60 + i * 158 + hash(i * 2.3) * 44;
        ctx.beginPath();
        ctx.moveTo(x, 30 + hash(i) * 90);
        ctx.quadraticCurveTo(x + 10, 240, x - 4, 420 + hash(i * 7) * 200);
        ctx.stroke();
      }

      // пол
      ctx.fillStyle = vgrad(ctx, 724, 900, [[0, '#8d8474'], [1, '#5c5549']]);
      ctx.fillRect(-30, 724, W + 60, 210);
      ctx.strokeStyle = 'rgba(50,45,38,.25)'; ctx.lineWidth = 2;
      for (let x = -40; x < W + 40; x += 96) { ctx.beginPath(); ctx.moveTo(x, 724); ctx.lineTo(x - 26, 900); ctx.stroke(); }
      for (let y = 744; y < 900; y += 44) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }

      // дверь Апы Гули с тёплым светом из щели
      const dx = 86, dy = 244, dw = 236, dh = 480;
      ctx.fillStyle = '#4e3f2e'; ctx.fillRect(dx - 16, dy - 16, dw + 32, dh + 16);
      const dg = ctx.createLinearGradient(dx, dy, dx + dw, dy);
      dg.addColorStop(0, '#7b5939'); dg.addColorStop(0.48, '#916c47'); dg.addColorStop(1, '#684a30');
      ctx.fillStyle = dg; ctx.fillRect(dx, dy, dw, dh);
      ctx.strokeStyle = 'rgba(42,28,16,.4)'; ctx.lineWidth = 5;
      rrect(ctx, dx + 24, dy + 26, dw - 48, 158, 6); ctx.stroke();
      rrect(ctx, dx + 24, dy + 210, dw - 48, 226, 6); ctx.stroke();
      ctx.fillStyle = '#d9b06a';
      ctx.beginPath(); ctx.arc(dx + dw - 34, dy + 224, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8dfc9'; rrect(ctx, dx + dw / 2 - 30, dy - 54, 60, 32, 5); ctx.fill();
      ctx.fillStyle = '#4a3a26'; ctx.textAlign = 'center';
      this.fitText(ctx, '12', 700, 20, 48, dx + dw / 2, dy - 31);
      glow(ctx, dx + dw / 2, dy + dh, 220, 'rgba(255,196,112,.9)', 0.4);
      ctx.fillStyle = 'rgba(255,208,132,.9)'; ctx.fillRect(dx, dy + dh - 7, dw, 7);
      ctx.fillStyle = '#8a3f38'; rrect(ctx, dx + 34, dy + dh + 10, dw - 60, 22, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,150,.4)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const mx = dx + 48 + i * 24;
        ctx.beginPath(); ctx.moveTo(mx, dy + dh + 13); ctx.lineTo(mx, dy + dh + 29); ctx.stroke();
      }
      ctx.fillStyle = '#b9544a';
      [[dx + 22, dy + dh + 44], [dx + 64, dy + dh + 48]].forEach(([sx, sy]) => {
        ctx.beginPath(); ctx.ellipse(sx, sy, 17, 10, -0.2, 0, TAU); ctx.fill();
      });

      // окно на площадке
      const wx = 470, wy = 168, ww = 246, wh = 292;
      ctx.fillStyle = '#39342b'; ctx.fillRect(wx - 18, wy - 18, ww + 36, wh + 36);
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#202a44'); sky.addColorStop(0.55, '#4b4d68'); sky.addColorStop(1, '#b87a5c');
      ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#1c232b';
      ctx.fillRect(wx + 8, wy + wh - 92, 66, 92);
      ctx.fillRect(wx + 158, wy + wh - 70, 78, 70);
      ctx.fillStyle = 'rgba(255,214,140,.55)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(wx + 16 + (i % 3) * 20, wy + wh - 82 + Math.floor(i / 3) * 24, 8, 10);
      }
      ctx.fillStyle = '#141a20';
      ctx.beginPath(); ctx.arc(wx + 118, wy + wh - 92, 44, Math.PI, 0); ctx.fill();
      ctx.fillRect(wx + 113, wy + wh - 92, 10, 92);
      ctx.strokeStyle = '#5a5346'; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(wx + 18, wy + 12); ctx.lineTo(wx + 92, wy + wh - 16); ctx.stroke();
      // подоконник, компот, герань
      ctx.fillStyle = '#9a9181'; ctx.fillRect(wx - 26, wy + wh + 14, ww + 52, 16);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(wx - 26, wy + wh + 30, ww + 52, 6);
      ctx.fillStyle = 'rgba(196,86,66,.85)'; rrect(ctx, wx + 44, wy + wh - 40, 26, 54, 5); ctx.fill();
      ctx.fillStyle = '#e8dcc2'; rrect(ctx, wx + 47, wy + wh - 56, 20, 8, 3); ctx.fill();
      ctx.fillStyle = '#5c3f2c'; rrect(ctx, wx + 196, wy + wh - 24, 38, 26, 4); ctx.fill();
      ctx.fillStyle = '#3f6b3f';
      [[196, -46], [214, -54], [230, -42]].forEach(([ox, oy]) => {
        ctx.beginPath(); ctx.ellipse(wx + ox, wy + wh + oy, 16, 11, -0.4, 0, TAU); ctx.fill();
      });

      // лампа на стене
      glow(ctx, 850, 236, 240, 'rgba(255,204,130,.95)', 0.34);
      ctx.strokeStyle = '#2f2b24'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(850, -20); ctx.lineTo(850, 214); ctx.stroke();
      ctx.fillStyle = '#3a352c';
      ctx.beginPath(); ctx.moveTo(806, 218); ctx.quadraticCurveTo(850, 176, 894, 218); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe3a6';
      ctx.beginPath(); ctx.arc(850, 224, 16, 0, TAU); ctx.fill();
      glow(ctx, 850, 224, 120, 'rgba(255,226,160,.9)', 0.5);

      // номер подъезда
      ctx.fillStyle = 'rgba(74,58,38,.45)'; ctx.textAlign = 'center';
      this.fitText(ctx, '5', 800, 96, 90, 790, 352);

      // лестница вверх
      const stepW = 64, stepH = 32, steps = 12, bx = 880, by = 806;
      ctx.fillStyle = '#6d6656';
      ctx.beginPath();
      ctx.moveTo(bx - 8, by + 46);
      ctx.lineTo(bx + steps * stepW, by - steps * stepH + 46);
      ctx.lineTo(W + 30, by - steps * stepH + 46);
      ctx.lineTo(W + 30, by + 46);
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < steps; i++) {
        const sx = bx + i * stepW;
        const syTop = by - (i + 1) * stepH;
        ctx.fillStyle = i % 2 ? '#7c7566' : '#887f70';
        ctx.fillRect(sx, syTop, stepW, stepH);
        ctx.fillStyle = '#aca393';
        ctx.fillRect(sx - 6, syTop, stepW + 10, 9);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.fillRect(sx, syTop + stepH - 7, stepW, 7);
      }
      const rx1 = bx - 4, ry1 = by - 128;
      const rx2 = bx + steps * stepW, ry2 = by - steps * stepH - 128;
      const railAt = (x) => ry1 + (ry2 - ry1) * ((x - rx1) / (rx2 - rx1));
      ctx.strokeStyle = '#3d3a33'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.lineTo(rx2, ry2); ctx.stroke();
      ctx.lineWidth = 4;
      for (let i = 0; i < steps; i += 2) {
        const x = bx + i * stepW + stepW / 2;
        const yTop = by - (i + 1) * stepH;
        ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, railAt(x)); ctx.stroke();
      }
      ctx.strokeStyle = '#3d3a33'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, ry1); ctx.stroke();

      // герань у двери и метла
      const plx = 410, ply = 812;
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(plx, ply, 42, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a9613c';
      ctx.beginPath();
      ctx.moveTo(plx - 28, ply - 62); ctx.lineTo(plx + 28, ply - 62);
      ctx.lineTo(plx + 20, ply); ctx.lineTo(plx - 20, ply);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c2764b';
      ctx.beginPath(); ctx.ellipse(plx, ply - 62, 28, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3f6b3f';
      [[-26, -96], [0, -108], [26, -94], [-14, -128], [16, -132], [0, -150]].forEach(([ox, oy]) => {
        ctx.beginPath(); ctx.ellipse(plx + ox, ply + oy, 20, 13, ox * 0.02, 0, TAU); ctx.fill();
      });
      ctx.fillStyle = '#c0503f';
      [[-18, -120], [12, -126], [0, -142]].forEach(([ox, oy]) => {
        ctx.beginPath(); ctx.arc(plx + ox, ply + oy, 6, 0, TAU); ctx.fill();
      });

      ctx.save();
      ctx.translate(796, 812);
      ctx.rotate(-0.16);
      ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -170); ctx.lineTo(0, 20); ctx.stroke();
      ctx.fillStyle = '#c9a35a';
      ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(20, 6); ctx.lineTo(26, 66); ctx.lineTo(-14, 66); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,60,25,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(-8 + i * 7, 14); ctx.lineTo(-10 + i * 8, 64); ctx.stroke();
      }
      ctx.restore();

      const vig = ctx.createRadialGradient(800, 380, 180, 800, 500, 900);
      vig.addColorStop(0, 'rgba(8,8,10,0)'); vig.addColorStop(1, 'rgba(8,8,10,.55)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------ */
    /* Ночная кухня родителей: чай, лампа, разговоры до полуночи */
    drawKitchenNight(ctx) {
      const t = this.t;

      // обои
      ctx.fillStyle = vgrad(ctx, 0, 724, [[0, '#c7a878'], [0.55, '#b3925f'], [1, '#9c7c4e']]);
      ctx.fillRect(-30, -30, W + 60, 760);
      ctx.fillStyle = 'rgba(120,78,42,.1)';
      for (let x = 0; x < W; x += 84) ctx.fillRect(x, 0, 26, 474);
      ctx.fillStyle = 'rgba(255,242,214,.16)';
      for (let y = 30; y < 470; y += 88) {
        for (let x = (Math.floor(y / 88) % 2 ? 20 : -22); x < W; x += 84) {
          ctx.beginPath(); ctx.arc(x + 30, y, 4.5, 0, TAU); ctx.fill();
        }
      }

      // фартук-кафель
      ctx.fillStyle = '#e7d9bd'; ctx.fillRect(-30, 470, W + 60, 260);
      ctx.strokeStyle = 'rgba(150,128,96,.32)'; ctx.lineWidth = 2;
      for (let x = -30; x < W + 40; x += 76) { ctx.beginPath(); ctx.moveTo(x, 470); ctx.lineTo(x, 730); ctx.stroke(); }
      for (let y = 470; y < 740; y += 62) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-30, 470, W + 60, 6);

      // пол
      ctx.fillStyle = vgrad(ctx, 724, 900, [[0, '#7c5837'], [1, '#4a3220']]);
      ctx.fillRect(-30, 724, W + 60, 200);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
      for (let x = -40; x < W + 40; x += 120) { ctx.beginPath(); ctx.moveTo(x, 724); ctx.lineTo(x - 60, 900); ctx.stroke(); }
      for (let y = 748; y < 900; y += 38) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }

      // окно: ночь, луна, крыши
      const wx = 1200, wy = 108, ww = 300, wh = 270;
      ctx.fillStyle = '#6b5137'; ctx.fillRect(wx - 20, wy - 20, ww + 40, wh + 40);
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#0d1526'); sky.addColorStop(0.6, '#1c2740'); sky.addColorStop(1, '#3a3a52');
      ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
      glow(ctx, wx + 214, wy + 62, 100, 'rgba(226,232,255,.7)', 0.4);
      ctx.fillStyle = '#eef1ff';
      ctx.beginPath(); ctx.arc(wx + 214, wy + 62, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#dfe5ff';
      for (let i = 0; i < 14; i++) {
        const sx = wx + 14 + hash(i * 3.1) * (ww - 28);
        const sy = wy + 12 + hash(i * 6.7) * 130;
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 1.3 + i));
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#111a24';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx, wy + wh - 54);
      ctx.lineTo(wx + 54, wy + wh - 76);
      ctx.lineTo(wx + 108, wy + wh - 46);
      ctx.lineTo(wx + 174, wy + wh - 86);
      ctx.lineTo(wx + 244, wy + wh - 40);
      ctx.lineTo(wx + ww, wy + wh - 62);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,140,.75)';
      for (let i = 0; i < 9; i++) ctx.fillRect(wx + 16 + i * 31, wy + wh - 44 + (i % 2) * 14, 7, 9);
      ctx.strokeStyle = '#6b5137'; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
      // шторы
      [[wx - 30, '#b7834f'], [wx + ww - 44, '#c08f5e']].forEach(([cx, c]) => {
        ctx.fillStyle = c;
        rrect(ctx, cx, wy - 26, 74, wh + 56, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(90,55,28,.28)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const sx = cx + 14 + i * 22;
          ctx.beginPath(); ctx.moveTo(sx, wy - 20); ctx.lineTo(sx, wy + wh + 24); ctx.stroke();
        }
      });
      ctx.fillStyle = '#9a9181'; ctx.fillRect(wx - 30, wy + wh + 18, ww + 60, 14);

      // холодильник
      const fx = 70, fy = 300, fw = 210, fh = 424;
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      rrect(ctx, fx + 16, fy + 12, fw, fh, 14); ctx.fill();
      ctx.fillStyle = '#e7e0cf'; rrect(ctx, fx, fy, fw, fh, 12); ctx.fill();
      ctx.fillStyle = '#d4cbb7'; ctx.fillRect(fx + 2, fy + 148, fw - 4, 8);
      ctx.strokeStyle = 'rgba(90,80,64,.4)'; ctx.lineWidth = 3; rrect(ctx, fx, fy, fw, fh, 12); ctx.stroke();
      ctx.fillStyle = '#9aa0a2';
      ctx.fillRect(fx + fw - 30, fy + 70, 8, 54);
      ctx.fillRect(fx + fw - 30, fy + 176, 8, 54);
      [[fx + 40, fy + 60, '#c0503f'], [fx + 76, fy + 96, '#3f8a6a'], [fx + 52, fy + 214, '#e2b24d'], [fx + 98, fy + 262, '#4a6f9a']].forEach(([mx, my, mc]) => {
        ctx.fillStyle = mc; rrect(ctx, mx, my, 22, 18, 3); ctx.fill();
      });

      // плита с кастрюлей
      ctx.fillStyle = '#d6cdb9'; rrect(ctx, 320, 512, 236, 212, 6); ctx.fill();
      ctx.fillStyle = '#3a3a37'; ctx.fillRect(320, 500, 236, 26);
      [372, 466].forEach((bxc) => {
        ctx.strokeStyle = '#6a6a63'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(bxc, 508, 30, 8, 0, 0, TAU); ctx.stroke();
      });
      ctx.fillStyle = '#4a4a45'; rrect(ctx, 336, 556, 204, 130, 6); ctx.fill();
      ctx.fillStyle = '#6b6a62'; rrect(ctx, 356, 576, 164, 68, 4); ctx.fill();
      ctx.fillStyle = '#8a887e'; ctx.fillRect(340, 548, 196, 8);
      [360, 410, 460, 510].forEach((hx) => {
        ctx.fillStyle = '#2c2c28'; ctx.beginPath(); ctx.arc(hx, 536, 8, 0, TAU); ctx.fill();
      });
      ctx.fillStyle = '#a9adb0'; rrect(ctx, 352, 446, 108, 58, 10); ctx.fill();
      ctx.fillStyle = '#8e9295'; ctx.fillRect(352, 446, 108, 8);
      ctx.fillStyle = '#6f7376'; ctx.fillRect(302, 468, 50, 8);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(362, 456); ctx.lineTo(362, 494); ctx.stroke();

      // полка с банками
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(1160, 470, 350, 12);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(1160, 482, 350, 5);
      [['#c0503f', 1192, 40, 62], ['#d9a43c', 1248, 44, 54], ['#7fa04a', 1310, 38, 68], ['#b06a8a', 1364, 42, 50], ['#c98a3c', 1424, 36, 58]].forEach(([c, jx, jw, jh]) => {
        ctx.fillStyle = c; rrect(ctx, jx, 470 - jh, jw, jh, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(jx + 5, 470 - jh + 6, jw * 0.26, jh - 16);
        ctx.fillStyle = '#e8dfc9'; rrect(ctx, jx - 3, 470 - jh - 8, jw + 6, 12, 4); ctx.fill();
      });

      // лампа над столом
      const lx = 812, ly = 214;
      ctx.strokeStyle = '#3a2f22'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx, -20); ctx.lineTo(lx, ly - 60); ctx.stroke();
      glow(ctx, lx, ly + 60, 380, 'rgba(255,206,132,.75)', 0.36);
      ctx.fillStyle = '#2f6a4d';
      ctx.beginPath(); ctx.moveTo(lx - 92, ly); ctx.quadraticCurveTo(lx, ly - 88, lx + 92, ly); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,228,168,.95)';
      ctx.beginPath(); ctx.ellipse(lx, ly + 3, 84, 12, 0, 0, TAU); ctx.fill();
      const cone = ctx.createLinearGradient(0, ly, 0, 660);
      cone.addColorStop(0, 'rgba(255,220,150,.2)');
      cone.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(lx - 84, ly + 8); ctx.lineTo(lx - 280, 660);
      ctx.lineTo(lx + 280, 660); ctx.lineTo(lx + 84, ly + 8);
      ctx.closePath(); ctx.fill();

      // стол со скатертью
      const tx0 = 622, tw = 480, ty0 = 646;
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.beginPath(); ctx.ellipse(tx0 + tw / 2, 880, tw * 0.54, 18, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b4a2c';
      [tx0 + 30, tx0 + tw - 58].forEach((x) => { ctx.fillRect(x, ty0 + 40, 28, 196); });
      ctx.fillStyle = '#8a3f38'; rrect(ctx, tx0, ty0 + 34, tw, 24, 4); ctx.fill();
      ctx.fillStyle = '#e8d8b8'; rrect(ctx, tx0 - 10, ty0 - 10, tw + 20, 58, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(170,90,66,.32)'; ctx.lineWidth = 2;
      for (let x = tx0 - 2; x < tx0 + tw + 6; x += 42) {
        ctx.beginPath(); ctx.moveTo(x, ty0 - 8); ctx.lineTo(x + 6, ty0 + 46); ctx.stroke();
      }
      for (let y = ty0 + 6; y < ty0 + 46; y += 15) {
        ctx.beginPath(); ctx.moveTo(tx0 - 8, y); ctx.lineTo(tx0 + tw + 8, y); ctx.stroke();
      }

      // чайник, пиалы, хлеб, курут, абрикосы
      const kx2 = 862, ky2 = 638;
      ctx.fillStyle = '#efe4cc';
      ctx.beginPath();
      ctx.moveTo(kx2 - 34, ky2);
      ctx.quadraticCurveTo(kx2 - 40, ky2 - 50, kx2 - 10, ky2 - 54);
      ctx.lineTo(kx2 + 18, ky2 - 54);
      ctx.quadraticCurveTo(kx2 + 44, ky2 - 46, kx2 + 34, ky2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#efe4cc'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(kx2 + 30, ky2 - 42); ctx.quadraticCurveTo(kx2 + 56, ky2 - 34, kx2 + 40, ky2 - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(kx2 - 34, ky2 - 44); ctx.lineTo(kx2 - 58, ky2 - 60); ctx.stroke();
      ctx.fillStyle = '#c9b48c';
      ctx.beginPath(); ctx.ellipse(kx2 - 4, ky2 - 56, 20, 6, 0, 0, TAU); ctx.fill();
      [0, 1, 2].forEach((i) => {
        const bx = kx2 + 74 + i * 34;
        ctx.fillStyle = i === 1 ? '#d9b06a' : '#f3ead2';
        ctx.beginPath(); ctx.ellipse(bx, ky2 + 2, 15, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(90,55,25,.4)';
        ctx.beginPath(); ctx.ellipse(bx, ky2 - 1, 10, 4.4, 0, 0, TAU); ctx.fill();
      });
      // лепёшка на доске
      ctx.fillStyle = '#b98a55'; rrect(ctx, 700, 632, 96, 14, 5); ctx.fill();
      ctx.fillStyle = '#e8c98a';
      ctx.beginPath(); ctx.ellipse(748, 628, 42, 18, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(140,92,40,.42)';
      [[734, 626], [754, 632], [766, 620], [742, 618]].forEach(([dx2, dy2]) => {
        ctx.beginPath(); ctx.arc(dx2, dy2, 2.4, 0, TAU); ctx.fill();
      });
      // курут в пиале
      ctx.fillStyle = '#efe4cc';
      ctx.beginPath(); ctx.ellipse(990, 640, 34, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fdf8ec';
      for (let i = 0; i < 9; i++) {
        const bx = 966 + (i % 5) * 13 + (i > 4 ? 6 : 0);
        const by = 632 - Math.floor(i / 5) * 8;
        ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU); ctx.fill();
      }
      // абрикосы
      ctx.fillStyle = '#c9a35a';
      ctx.beginPath(); ctx.ellipse(1066, 640, 30, 11, 0, 0, TAU); ctx.fill();
      [[1056, 632], [1072, 634], [1064, 624], [1080, 626]].forEach(([ax2, ay2], i) => {
        glow(ctx, ax2, ay2, 16, 'rgba(255,178,84,.5)', 0.3);
        ctx.fillStyle = i % 2 ? '#f2a33c' : '#f7bd5a';
        ctx.beginPath(); ctx.arc(ax2, ay2, 8, 0, TAU); ctx.fill();
      });

      // пар над чайником
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.24 + i * 0.25) % 1;
        ctx.globalAlpha = 0.2 * (1 - ph);
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath();
        ctx.arc(kx2 - 4 + Math.sin(t * 0.9 + i * 1.4) * 8, ky2 - 66 - ph * 76, 8 + ph * 18, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // стулья
      [[548, 700, -1], [1120, 700, 1]].forEach(([cx, cy, dir]) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(dir, 1);
        ctx.fillStyle = '#6b4a2c';
        ctx.fillRect(-8, 0, 16, 150);
        ctx.fillRect(72, 0, 16, 150);
        ctx.fillStyle = '#8a5f38'; rrect(ctx, -10, -18, 100, 20, 4); ctx.fill();
        ctx.fillStyle = '#7a5330';
        rrect(ctx, 50, -168, 20, 150, 6); ctx.fill();
        [0, 1, 2].forEach((i) => {
          ctx.fillStyle = '#8a5f38';
          rrect(ctx, 66 + i * 16, -150, 10, 118, 3); ctx.fill();
        });
        ctx.restore();
      });

      const warm = ctx.createRadialGradient(812, 300, 120, 812, 520, 860);
      warm.addColorStop(0, 'rgba(255,190,110,.1)');
      warm.addColorStop(1, 'rgba(10,8,12,.45)');
      ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------ */
    /* Кухня апы: үбөлүк, тесто, казан и старое радио */
    drawApaKitchen(ctx) {
      const t = this.t;

      // стена и обои
      ctx.fillStyle = vgrad(ctx, 0, 730, [[0, '#cfae7c'], [0.55, '#bb9561'], [1, '#9b784a']]);
      ctx.fillRect(-30, -30, W + 60, 770);
      ctx.fillStyle = 'rgba(120,78,42,.08)';
      for (let x = -10; x < W; x += 96) ctx.fillRect(x, 0, 32, 470);
      ctx.fillStyle = 'rgba(255,242,214,.13)';
      for (let y = 40; y < 460; y += 74) {
        for (let x = (Math.floor(y / 74) % 2 ? 18 : -30); x < W; x += 96) {
          ctx.beginPath();
          ctx.moveTo(x + 16, y); ctx.lineTo(x + 30, y + 14); ctx.lineTo(x + 16, y + 28); ctx.lineTo(x + 2, y + 14);
          ctx.closePath(); ctx.fill();
        }
      }

      // кафельный фартук
      ctx.fillStyle = '#e6d5b4';
      ctx.fillRect(-30, 470, W + 60, 260);
      ctx.strokeStyle = 'rgba(150,128,96,.3)';
      ctx.lineWidth = 2;
      for (let x = -30; x < W + 40; x += 78) { ctx.beginPath(); ctx.moveTo(x, 470); ctx.lineTo(x, 730); ctx.stroke(); }
      for (let y = 470; y < 740; y += 64) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-30, 470, W + 60, 6);

      // пол
      ctx.fillStyle = vgrad(ctx, 724, 900, [[0, '#7c5837'], [1, '#4a3220']]);
      ctx.fillRect(-30, 724, W + 60, 200);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
      for (let x = -40; x < W + 40; x += 120) { ctx.beginPath(); ctx.moveTo(x, 724); ctx.lineTo(x - 60, 900); ctx.stroke(); }
      for (let y = 748; y < 900; y += 38) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }

      // окно: сумерки и горы
      const wx = 120, wy = 112, ww = 372, wh = 292;
      ctx.fillStyle = '#6b5137'; ctx.fillRect(wx - 20, wy - 20, ww + 40, wh + 40);
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#20233c'); sky.addColorStop(0.45, '#6a4a62');
      sky.addColorStop(0.8, '#cf7d68'); sky.addColorStop(1, '#f2b57c');
      ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
      glow(ctx, wx + 286, wy + 218, 120, 'rgba(255,206,140,.75)', 0.42);
      ctx.fillStyle = 'rgba(255,224,168,.85)';
      ctx.beginPath(); ctx.arc(wx + 286, wy + 218, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b3048';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx, wy + wh - 96);
      ctx.lineTo(wx + 58, wy + wh - 148);
      ctx.lineTo(wx + 118, wy + wh - 88);
      ctx.lineTo(wx + 186, wy + wh - 150);
      ctx.lineTo(wx + 262, wy + wh - 82);
      ctx.lineTo(wx + ww, wy + wh - 128);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b2438';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx, wy + wh - 48);
      ctx.lineTo(wx + 82, wy + wh - 66);
      ctx.lineTo(wx + 158, wy + wh - 42);
      ctx.lineTo(wx + 248, wy + wh - 72);
      ctx.lineTo(wx + ww, wy + wh - 50);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,140,.8)';
      for (let i = 0; i < 10; i++) ctx.fillRect(wx + 20 + i * 34, wy + wh - 40 + (i % 2) * 13, 6, 7);
      ctx.strokeStyle = '#6b5137'; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
      [[wx - 30, '#b7834f'], [wx + ww - 44, '#c08f5e']].forEach(([cx, c]) => {
        ctx.fillStyle = c;
        rrect(ctx, cx, wy - 26, 74, wh + 56, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(90,55,28,.28)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const sx = cx + 14 + i * 22;
          ctx.beginPath(); ctx.moveTo(sx, wy - 20); ctx.lineTo(sx, wy + wh + 24); ctx.stroke();
        }
      });
      ctx.fillStyle = '#9a9181'; ctx.fillRect(wx - 30, wy + wh + 18, ww + 60, 14);

      // полка справа: банки и специи
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(1010, 330, 500, 14);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(1010, 344, 500, 5);
      [['#c0503f', 1044, 40, 64], ['#d9a43c', 1098, 44, 52], ['#7fa04a', 1154, 38, 70], ['#b06a8a', 1208, 42, 48]].forEach(([c, jx, jw, jh]) => {
        ctx.fillStyle = c; rrect(ctx, jx, 330 - jh, jw, jh, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(jx + 5, 330 - jh + 6, jw * 0.24, jh - 16);
        ctx.fillStyle = '#e8dfc9'; rrect(ctx, jx - 3, 330 - jh - 8, jw + 6, 12, 4); ctx.fill();
      });
      // банка курута
      {
        const jx = 1280, jy = 330, jw = 74, jh = 96;
        ctx.fillStyle = 'rgba(220,235,240,.24)';
        rrect(ctx, jx, jy - jh, jw, jh, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(245,250,250,.4)'; ctx.lineWidth = 2;
        rrect(ctx, jx, jy - jh, jw, jh, 10); ctx.stroke();
        ctx.fillStyle = '#fdf8ec';
        for (let i = 0; i < 18; i++) {
          const bx = jx + 10 + (i % 6) * 10;
          const by = jy - 12 - Math.floor(i / 6) * 17;
          ctx.beginPath(); ctx.arc(bx, by, 5.2, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#c9a35a'; rrect(ctx, jx - 4, jy - jh - 10, jw + 8, 14, 4); ctx.fill();
      }
      // старое радио на верхней полке
      {
        const rx = 1200, ry = 176, rw = 224, rh = 120;
        ctx.fillStyle = '#6b4a2c'; ctx.fillRect(rx - 10, ry + rh, rw + 20, 10);
        ctx.fillStyle = '#8a5a30'; rrect(ctx, rx, ry, rw, rh, 8); ctx.fill();
        ctx.fillStyle = '#5a3a22'; rrect(ctx, rx + 8, ry + 8, rw - 16, rh - 16, 6); ctx.fill();
        ctx.fillStyle = '#c9a86e'; rrect(ctx, rx + 16, ry + 16, 104, rh - 32, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(80,50,26,.5)'; ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath(); ctx.moveTo(rx + 24, ry + 26 + i * 10); ctx.lineTo(rx + 112, ry + 26 + i * 10); ctx.stroke();
        }
        ctx.fillStyle = '#2f2a24'; ctx.beginPath(); ctx.arc(rx + 170, ry + 46, 26, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#e8d8b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rx + 170, ry + 46, 26, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rx + 170, ry + 46); ctx.lineTo(rx + 186, ry + 30); ctx.stroke();
        ctx.fillStyle = '#e2574c'; ctx.beginPath(); ctx.arc(rx + 156, ry + 88, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c9a86e'; ctx.fillRect(rx + 184, ry + 74, 26, 8);
        ctx.fillRect(rx + 184, ry + 92, 26, 8);
        ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(rx + 40, ry); ctx.lineTo(rx + 96, ry - 54); ctx.stroke();
        glow(ctx, rx + 156, ry + 88, 40, 'rgba(255,120,90,.7)', 0.35);
      }

      // плита справа и казан с кипящим маслом
      ctx.fillStyle = '#d6cdb9'; rrect(ctx, 1050, 520, 430, 208, 6); ctx.fill();
      ctx.fillStyle = '#3a3a37'; ctx.fillRect(1050, 506, 430, 28);
      ctx.fillStyle = '#4a4a45'; rrect(ctx, 1068, 566, 394, 130, 6); ctx.fill();
      ctx.fillStyle = '#6b6a62'; rrect(ctx, 1092, 588, 346, 66, 4); ctx.fill();
      ctx.fillStyle = '#8a887e'; ctx.fillRect(1064, 554, 402, 8);
      [1090, 1150, 1210, 1270, 1330, 1390, 1450].forEach((hx) => {
        ctx.fillStyle = '#2c2c28'; ctx.beginPath(); ctx.arc(hx, 546, 8, 0, TAU); ctx.fill();
      });
      // казан
      const kx = 1276, ky = 512;
      glow(ctx, kx, ky + 30, 200, 'rgba(255,150,70,.65)', 0.4);
      ctx.fillStyle = '#3a3632';
      ctx.beginPath(); ctx.ellipse(kx, ky, 118, 42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5b5349';
      ctx.beginPath(); ctx.ellipse(kx, ky - 6, 112, 38, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e0a03c';
      ctx.beginPath(); ctx.ellipse(kx, ky - 8, 96, 30, 0, 0, TAU); ctx.fill();
      // боорсок в масле
      for (let i = 0; i < 9; i++) {
        const bx = kx - 62 + (i % 5) * 30 + (i > 4 ? 14 : 0);
        const by = ky - 16 - Math.floor(i / 5) * 10 + Math.sin(t * 2.4 + i * 1.3) * 2;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(0.5 + i * 0.4);
        ctx.fillStyle = i % 3 ? '#e8b45c' : '#f2c877';
        rrect(ctx, -11, -7, 22, 14, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,244,214,.5)';
        ctx.fillRect(-7, -5, 7, 2);
        ctx.restore();
      }
      // пузырьки масла
      ctx.fillStyle = 'rgba(255,232,170,.75)';
      for (let i = 0; i < 12; i++) {
        const ph = (t * 0.7 + i * 0.37) % 1;
        const bx = kx - 70 + hash(i * 4.3) * 140;
        const by = ky - 4 - ph * 12;
        ctx.globalAlpha = 0.5 * (1 - ph);
        ctx.beginPath(); ctx.arc(bx, by, 2 + ph * 2.4, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // ручки казана
      ctx.strokeStyle = '#2e2b28'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(kx - 116, ky - 12); ctx.quadraticCurveTo(kx - 150, ky - 22, kx - 142, ky + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(kx + 116, ky - 12); ctx.quadraticCurveTo(kx + 150, ky - 22, kx + 142, ky + 8); ctx.stroke();
      ctx.lineCap = 'butt';

      // стол на переднем плане
      const tx0 = 690, tw = 690, ty0 = 646;
      ctx.fillStyle = 'rgba(0,0,0,.26)';
      ctx.beginPath(); ctx.ellipse(tx0 + tw / 2, 884, tw * 0.54, 18, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b4a2c';
      [tx0 + 46, tx0 + tw - 74].forEach((x) => { ctx.fillRect(x, ty0 + 44, 30, 200); });
      ctx.fillStyle = '#7a5330'; rrect(ctx, tx0, ty0 + 36, tw, 26, 4); ctx.fill();
      ctx.fillStyle = '#c9a36a'; rrect(ctx, tx0 - 12, ty0 - 12, tw + 24, 60, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,244,220,.18)'; ctx.fillRect(tx0 - 12, ty0 - 12, tw + 24, 3);
      // мука на столе
      ctx.fillStyle = 'rgba(255,250,238,.4)';
      ctx.beginPath(); ctx.ellipse(902, 664, 156, 22, -0.04, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,250,.26)';
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(tx0 + 90 + hash(i * 7.1) * 360, ty0 - 4 + hash(i * 3.3) * 36, 1.4 + hash(i) * 1.6, 0, TAU);
        ctx.fill();
      }

      // доска, тесто и үбөлүк
      ctx.fillStyle = '#b98a55'; rrect(ctx, 768, 626, 300, 18, 5); ctx.fill();
      ctx.fillStyle = '#a97845'; ctx.fillRect(774, 642, 288, 5);
      [0, 1, 2, 3].forEach((i) => {
        const dx = 802 + i * 66;
        const dy = 626 - (i % 2) * 3;
        ctx.fillStyle = i % 2 ? '#f1e2c2' : '#f7ead0';
        ctx.beginPath(); ctx.ellipse(dx, dy, 27, 12, -0.06, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(190,150,100,.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(dx, dy - 2, 19, 8, -0.06, 0, TAU); ctx.stroke();
      });
      // үбөлүк (скалка)
      ctx.save();
      ctx.translate(930, 606);
      ctx.rotate(-0.13);
      ctx.fillStyle = '#8a5a30';
      rrect(ctx, -104, -9, 208, 18, 9); ctx.fill();
      ctx.fillStyle = '#a9743f';
      rrect(ctx, -96, -9, 192, 8, 4); ctx.fill();
      ctx.fillStyle = '#6d4526';
      rrect(ctx, -124, -6, 24, 12, 6); ctx.fill();
      rrect(ctx, 100, -6, 24, 12, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(60,36,16,.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-84, -2); ctx.lineTo(84, -2); ctx.stroke();
      ctx.restore();

      // миска с готовым боорсоком
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.ellipse(1116, 618, 62, 18, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d6c4a2';
      ctx.beginPath(); ctx.ellipse(1116, 622, 62, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#efe4cc';
      ctx.beginPath(); ctx.ellipse(1116, 614, 54, 13, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 12; i++) {
        const bx = 1082 + (i % 5) * 17 + (i > 4 ? 8 : 0);
        const by = 606 - Math.floor(i / 5) * 9;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(i * 0.7);
        ctx.fillStyle = i % 3 ? '#e0ac56' : '#efc478';
        rrect(ctx, -8, -5, 16, 10, 2); ctx.fill();
        ctx.restore();
      }

      // чайник
      const kx2 = 1240, ky2 = 636;
      ctx.fillStyle = '#efe4cc';
      ctx.beginPath();
      ctx.moveTo(kx2 - 36, ky2);
      ctx.quadraticCurveTo(kx2 - 42, ky2 - 54, kx2 - 10, ky2 - 58);
      ctx.lineTo(kx2 + 18, ky2 - 58);
      ctx.quadraticCurveTo(kx2 + 46, ky2 - 50, kx2 + 36, ky2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#efe4cc'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(kx2 + 32, ky2 - 46); ctx.quadraticCurveTo(kx2 + 62, ky2 - 36, kx2 + 44, ky2 - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(kx2 - 36, ky2 - 48); ctx.lineTo(kx2 - 62, ky2 - 64); ctx.stroke();
      ctx.fillStyle = '#c9b48c';
      ctx.beginPath(); ctx.ellipse(kx2 - 4, ky2 - 60, 22, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b7834f';
      ctx.beginPath(); ctx.arc(kx2 - 4, ky2 - 66, 6, 0, TAU); ctx.fill();
      // пар над чайником
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.22 + i * 0.3) % 1;
        ctx.globalAlpha = 0.18 * (1 - ph);
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath();
        ctx.arc(kx2 - 4 + Math.sin(t * 0.8 + i * 1.6) * 7, ky2 - 74 - ph * 70, 7 + ph * 16, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // мешочек курута и пиалы
      ctx.fillStyle = '#c9b48c';
      ctx.beginPath();
      ctx.moveTo(1342, 640);
      ctx.quadraticCurveTo(1326, 600, 1352, 584);
      ctx.quadraticCurveTo(1380, 598, 1370, 640);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(1348, 592); ctx.lineTo(1368, 588); ctx.stroke();
      ctx.fillStyle = '#fdf8ec';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(1348 + i * 8, 644, 3.4, 0, TAU); ctx.fill();
      }
      [1006, 1052].forEach((px, i) => {
        ctx.fillStyle = '#efe4cc';
        ctx.beginPath(); ctx.ellipse(px, 648, 18, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = i ? '#c98a3c' : '#8a5a30';
        ctx.beginPath(); ctx.ellipse(px, 644, 12, 4.4, 0, 0, TAU); ctx.fill();
      });

      // лампа над столом
      const lx = 980, ly = 120;
      ctx.strokeStyle = '#3a2f22'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx, -20); ctx.lineTo(lx, ly - 54); ctx.stroke();
      glow(ctx, lx, ly + 60, 420, 'rgba(255,206,132,.75)', 0.4);
      ctx.fillStyle = '#2f6a4d';
      ctx.beginPath(); ctx.moveTo(lx - 84, ly); ctx.quadraticCurveTo(lx, ly - 82, lx + 84, ly); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,228,168,.95)';
      ctx.beginPath(); ctx.ellipse(lx, ly + 3, 76, 11, 0, 0, TAU); ctx.fill();
      const cone = ctx.createLinearGradient(0, ly, 0, 700);
      cone.addColorStop(0, 'rgba(255,220,150,.22)');
      cone.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(lx - 78, ly + 8); ctx.lineTo(lx - 320, 700);
      ctx.lineTo(lx + 320, 700); ctx.lineTo(lx + 78, ly + 8);
      ctx.closePath(); ctx.fill();

      // мучная пыль в воздухе
      ctx.fillStyle = 'rgba(255,248,232,.5)';
      for (let i = 0; i < 22; i++) {
        const px = mod(760 + hash(i * 2.9) * 620 + t * (4 + (i % 4)), 1500);
        const py = 420 + hash(i * 5.7) * 260 + Math.sin(t * 0.7 + i) * 12;
        ctx.globalAlpha = 0.1 + 0.25 * Math.abs(Math.sin(t * 0.6 + i * 1.1));
        ctx.beginPath(); ctx.arc(px, py, 1 + hash(i) * 2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      const warm = ctx.createRadialGradient(1020, 300, 140, 1020, 520, 900);
      warm.addColorStop(0, 'rgba(255,190,110,.12)');
      warm.addColorStop(1, 'rgba(12,8,10,.5)');
      ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------ */
    /* Панорама над Асанбаем: закат, огни города и деревянная скамейка */
    drawSouthPanorama(ctx) {
      const t = this.t;

      // небо
      ctx.fillStyle = vgrad(ctx, 0, 660, [
        [0, '#141a34'], [0.28, '#332a4c'], [0.55, '#7a4658'],
        [0.76, '#c76e5e'], [0.9, '#eea06f'], [1, '#f8cf9a']
      ]);
      ctx.fillRect(-30, -30, W + 60, 720);

      // первые звёзды
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 22; i++) {
        ctx.globalAlpha = (0.16 + 0.4 * Math.abs(Math.sin(t * 0.7 + i))) * (1 - i / 30);
        ctx.fillRect(60 + hash(i * 3.7) * 1480, 30 + hash(i * 6.1) * 220, 2, 2);
      }
      ctx.globalAlpha = 1;

      // солнце у горизонта
      glow(ctx, 1180, 472, 320, 'rgba(255,196,132,.9)', 0.55);
      ctx.fillStyle = 'rgba(255,226,178,.92)';
      ctx.beginPath(); ctx.arc(1180, 472, 54, 0, TAU); ctx.fill();

      // облачные полосы
      ctx.fillStyle = 'rgba(255,196,160,.16)';
      for (let i = 0; i < 5; i++) {
        const cx = mod(i * 380 + t * 2.2, W + 400) - 200;
        ctx.beginPath();
        ctx.ellipse(cx, 250 + (i % 3) * 58, 150 + i * 14, 11, 0, 0, TAU);
        ctx.fill();
      }

      // хребет Ала-Тоо
      drawMountains(ctx, 596, 360, 'dusk');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,146,132,.22)';
      ctx.beginPath();
      ctx.moveTo(-40, 520);
      for (let i = 0; i < PEAKS.length; i++) ctx.lineTo(PEAKS[i][0] * W, 596 - PEAKS[i][1] * 360 * 0.92);
      ctx.lineTo(W + 40, 520);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // город внизу: Асанбай и Южная магистраль
      drawSkyline(ctx, 720, 34, 118, '#2c2438', 'rgba(255,205,130,.92)', 71, t);
      ctx.fillStyle = 'rgba(255,214,150,.9)';
      for (let i = 0; i < 16; i++) {
        const lx = 120 + i * 92;
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.8 + i * 0.9));
        ctx.fillRect(lx, 704 + (i % 3) * 6, 5, 3);
      }
      ctx.globalAlpha = 1;

      // средний холм
      ctx.fillStyle = '#3a2f3c';
      ctx.beginPath();
      ctx.moveTo(-40, 760);
      ctx.quadraticCurveTo(300, 690, 700, 724);
      ctx.quadraticCurveTo(1080, 754, 1640, 700);
      ctx.lineTo(1640, 920);
      ctx.lineTo(-40, 920);
      ctx.closePath(); ctx.fill();

      // передний холм
      ctx.fillStyle = vgrad(ctx, 760, 900, [[0, '#2b2430'], [1, '#17141d']]);
      ctx.beginPath();
      ctx.moveTo(-40, 850);
      ctx.quadraticCurveTo(420, 764, 860, 802);
      ctx.quadraticCurveTo(1240, 836, 1640, 778);
      ctx.lineTo(1640, 920);
      ctx.lineTo(-40, 920);
      ctx.closePath(); ctx.fill();

      // трава на переднем плане
      ctx.strokeStyle = 'rgba(96,88,80,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const gx = 720 + hash(i * 4.1) * 860;
        const gy = 820 + hash(i * 7.3) * 70;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 4 + hash(i) * 5, gy - 10 - hash(i * 2) * 12); ctx.stroke();
      }

      // деревянная ограда
      const ry = 706;
      for (let x = 760; x < 1610; x += 112) {
        ctx.fillStyle = '#4b3a38';
        ctx.fillRect(x, ry, 10, 92);
        ctx.fillStyle = 'rgba(255,190,140,.16)';
        ctx.fillRect(x + 6, ry, 2, 92);
      }
      ctx.fillStyle = '#5a4640';
      ctx.fillRect(748, ry, 872, 12);
      ctx.fillRect(748, ry + 34, 872, 8);
      ctx.fillStyle = 'rgba(255,198,150,.2)';
      ctx.fillRect(748, ry, 872, 2);

      // фонарь справа
      {
        const lx = 1500, ly = 560;
        ctx.strokeStyle = '#3d3434'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(lx, 790); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 46, ly - 26); ctx.stroke();
        glow(ctx, lx - 46, ly - 24, 130, 'rgba(255,206,140,.9)', 0.5);
        ctx.fillStyle = '#ffe0a8';
        ctx.beginPath(); ctx.ellipse(lx - 46, ly - 22, 12, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3d3434';
        ctx.beginPath(); ctx.ellipse(lx - 46, ly - 30, 18, 6, 0, 0, TAU); ctx.fill();
      }

      // деревянная скамейка
      const bx = 960, by = 792;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(bx + 180, by + 76, 220, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4f3722';
      [bx + 40, bx + 292].forEach((x) => { ctx.fillRect(x, by + 24, 18, 58); });
      ctx.fillRect(bx + 54, by + 62, 240, 8);
      [0, 1, 2].forEach((i) => {
        ctx.fillStyle = i % 2 ? '#8a5a34' : '#96653c';
        rrect(ctx, bx, by + i * 11, 348, 9, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,206,150,.22)';
        ctx.fillRect(bx + 4, by + i * 11 + 1, 340, 2);
      });
      [0, 1, 2, 3].forEach((i) => {
        ctx.fillStyle = i % 2 ? '#7d4f2d' : '#8a5a34';
        rrect(ctx, bx + 12, by - 92 + i * 22, 324, 13, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,206,150,.2)';
        ctx.fillRect(bx + 16, by - 91 + i * 22, 316, 2);
      });
      ctx.fillStyle = '#5f3f26';
      [bx + 18, bx + 326].forEach((x) => { ctx.fillRect(x, by - 96, 16, 132); });
      [bx + 18, bx + 326].forEach((x) => {
        ctx.fillStyle = '#6b4629';
        rrect(ctx, x - 6, by + 16, 28, 9, 4); ctx.fill();
      });
      glow(ctx, bx + 170, by + 20, 190, 'rgba(255,180,120,.25)', 0.4);

      // термос и две пиалы на скамейке
      {
        const tx = bx + 250, ty = by - 2;
        ctx.fillStyle = '#b04a3e'; rrect(ctx, tx, ty - 54, 30, 54, 8); ctx.fill();
        ctx.fillStyle = '#d9c7a4'; ctx.fillRect(tx + 6, ty - 46, 18, 5);
        ctx.fillStyle = '#8a3a32'; rrect(ctx, tx + 3, ty - 60, 24, 9, 4); ctx.fill();
        ctx.fillStyle = '#c9b48c'; ctx.fillRect(tx + 11, ty - 64, 8, 6);
        [tx - 46, tx - 18].forEach((px, i) => {
          ctx.fillStyle = '#efe4cc';
          ctx.beginPath(); ctx.ellipse(px, ty - 4, 12, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = i ? '#c98a3c' : '#8a5a30';
          ctx.beginPath(); ctx.ellipse(px, ty - 6, 8, 3.2, 0, 0, TAU); ctx.fill();
        });
      }

      // тополь слева, почти силуэт
      this.drawTree(ctx, 760, 790, 0.8, 4.2, ['#221d28', '#2c2532']);

      // тёплый ветер: пыльца и листья
      ctx.fillStyle = 'rgba(255,214,160,.7)';
      for (let i = 0; i < 18; i++) {
        const px = mod(i * 107 + t * (12 + (i % 5) * 4), W + 120) - 60;
        const py = 560 + hash(i * 3.3) * 260 + Math.sin(t * 0.8 + i * 1.3) * 18;
        ctx.globalAlpha = 0.18 + 0.34 * Math.abs(Math.sin(t * 0.7 + i));
        ctx.beginPath(); ctx.arc(px, py, 1.4 + hash(i) * 2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // тёплая дымка и виньетка
      const haze = ctx.createLinearGradient(0, 420, 0, H);
      haze.addColorStop(0, 'rgba(255,168,120,.08)');
      haze.addColorStop(1, 'rgba(12,10,20,.4)');
      ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H);
      const vig = ctx.createRadialGradient(1000, 470, 260, 1000, 500, 1000);
      vig.addColorStop(0, 'rgba(10,8,16,0)');
      vig.addColorStop(1, 'rgba(10,8,16,.52)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------ */
    drawBazaar(ctx) {
      const t = this.t;
      ctx.fillStyle = vgrad(ctx, 0, 700, [
        [0, '#5d7f9e'], [0.42, '#b9a58b'], [0.68, '#eab77b'], [1, '#f6d19b']
      ]);
      ctx.fillRect(-30, -30, W + 60, 760);
      glow(ctx, 1420, 370, 250, 'rgba(255,201,118,.8)', 0.45);
      ctx.fillStyle = 'rgba(255,236,190,.9)';
      ctx.beginPath(); ctx.arc(1420, 370, 46, 0, TAU); ctx.fill();
      drawMountains(ctx, 610, 300, 'dusk');
      drawSkyline(ctx, 630, 30, 90, '#9d7a63', null, 31, t);

      // земля
      ctx.fillStyle = vgrad(ctx, 610, 900, [[0, '#8b735a'], [1, '#54443a']]);
      ctx.fillRect(-30, 610, W + 60, 320);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(0, 610, W, 4);

      // гирлянды
      ctx.strokeStyle = 'rgba(40,35,30,.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 90); ctx.quadraticCurveTo(400, 180, 820, 110);
      ctx.quadraticCurveTo(1200, 40, 1600, 130);
      ctx.stroke();
      for (let i = 0; i < 18; i++) {
        const x = 50 + i * 88;
        const y = 116 + Math.sin(i * 0.9) * 26;
        const c = ['#ffd27a', '#ff8a66', '#7fe3c9'][i % 3];
        glow(ctx, x, y, 26, c, 0.35);
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
      }

      // вывеска подвешена к гирлянде правее блока выбора
      ctx.strokeStyle = 'rgba(40,35,30,.7)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(920, 262); ctx.lineTo(920, 112); ctx.moveTo(1230, 262); ctx.lineTo(1230, 80); ctx.stroke();
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7;
      ctx.fillStyle = '#315d4d';
      rrect(ctx, 880, 262, 390, 118, 14); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,236,190,.55)';
      ctx.lineWidth = 4;
      rrect(ctx, 880, 262, 390, 118, 14); ctx.stroke();
      ctx.fillStyle = '#f6e8c8';
      const bsign = this.sign('bazaar');
      ctx.textAlign = 'center';
      this.fitText(ctx, bsign[0], 800, 46, 350, 1075, 318);
      ctx.fillStyle = 'rgba(246,232,200,.75)';
      this.fitText(ctx, bsign[1], 600, 22, 350, 1075, 354);

      // прилавки
      const stalls = [
        { x: 590, w: 320, c: '#b94f43' },
        { x: 960, w: 330, c: '#3f7d6b' },
        { x: 1340, w: 260, c: '#c08a3d' }
      ];
      stalls.forEach((st, si) => {
        // навес
        const y = 410;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(st.x, y + 90);
        ctx.lineTo(st.x + 30, y);
        ctx.lineTo(st.x + st.w - 30, y);
        ctx.lineTo(st.x + st.w, y + 90);
        ctx.closePath();
        ctx.fillStyle = st.c;
        ctx.fill();
        // полосы
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = i % 2 ? 'rgba(255,246,224,.72)' : 'rgba(0,0,0,.12)';
          ctx.beginPath();
          const x0 = st.x + 30 + i * ((st.w - 60) / 7);
          const x1 = x0 + (st.w - 60) / 14;
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.lineTo(x1 + 14, y + 90);
          ctx.lineTo(x0 + 14, y + 90);
          ctx.closePath();
          ctx.fill();
        }
        // фестоны
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = st.c;
          ctx.beginPath();
          ctx.arc(st.x + 30 + i * (st.w - 60) / 7.4, y + 90, 14, 0, Math.PI);
          ctx.fill();
        }
        // стойки
        ctx.fillStyle = '#5a4638';
        ctx.fillRect(st.x + 20, y + 90, 10, 240);
        ctx.fillRect(st.x + st.w - 30, y + 90, 10, 240);
        // прилавок
        ctx.fillStyle = '#7b5940';
        ctx.fillRect(st.x + 10, y + 285, st.w - 20, 34);
        ctx.fillStyle = '#97704f';
        ctx.fillRect(st.x + 10, y + 285, st.w - 20, 8);
        if (this.district === 'vostok5') {
          // «Мадина»: рулоны ткани на прилавке и коробочки с фурнитурой на стойках
          const cols = [['#b83b4a', '#e8c25a'], ['#2f5f9a', '#d9e4f2'], ['#3f8a6a', '#f0e3b0'], ['#7a3f86', '#e9b8d8'], ['#d98a3a', '#fff0c8']];
          for (let i = 0; i < 5; i++) {
            const rx = st.x + 36 + i * 52, c = cols[(i + si) % 5];
            ctx.fillStyle = c[0]; rrect(ctx, rx, y + 214, 40, 66, 6); ctx.fill();
            ctx.fillStyle = c[1]; ctx.fillRect(rx + 4, y + 226, 32, 5); ctx.fillRect(rx + 4, y + 244, 32, 5);
            ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(rx + 20, y + 214, 20, 5, 0, 0, TAU); ctx.fill();
          }
          for (let i = 0; i < 3; i++) {
            const hx = st.x + 40 + i * 84;
            ctx.fillStyle = 'rgba(255,246,224,.9)'; rrect(ctx, hx, y + 112, 62, 46, 5); ctx.fill();
            for (let j = 0; j < 6; j++) {
              ctx.fillStyle = cols[(i + j) % 5][0];
              ctx.beginPath(); ctx.arc(hx + 12 + (j % 3) * 19, y + 126 + Math.floor(j / 3) * 18, 6, 0, TAU); ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(hx + 10 + (j % 3) * 19, y + 125 + Math.floor(j / 3) * 18, 4, 1.5);
            }
          }
          ctx.restore();
          return;
        }
        // ящики
        const fruits = [['#cf4f43', 42], ['#e2a23b', 42], ['#6e9c5b', 42]];
        for (let i = 0; i < 3; i++) {
          const bx = st.x + 38 + i * 86;
          ctx.fillStyle = '#6b4a33';
          rrect(ctx, bx, y + 236, 72, 42, 5); ctx.fill();
          for (let j = 0; j < 7; j++) {
            ctx.fillStyle = fruits[(i + si) % 3][0];
            ctx.beginPath();
            ctx.arc(bx + 12 + (j % 4) * 16, y + 244 + Math.floor(j / 4) * 16, 7, 0, TAU);
            ctx.fill();
          }
        }
        // сумки
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = ['#e7d6b0', '#c76a52', '#5f8c7a'][i];
          rrect(ctx, st.x + 34 + i * 72, y + 120, 38, 70, 10);
          ctx.fill();
          ctx.strokeStyle = 'rgba(60,45,35,.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(st.x + 53 + i * 72, y + 120, 12, Math.PI, TAU);
          ctx.stroke();
        }
        ctx.restore();
      });

      // коробки и мешки
      ctx.fillStyle = '#8a6548';
      rrect(ctx, 90, 700, 130, 90, 6); ctx.fill();
      ctx.fillStyle = '#a47a56';
      rrect(ctx, 220, 726, 90, 64, 6); ctx.fill();
      ctx.fillStyle = '#d1b07a';
      ctx.beginPath(); ctx.ellipse(1490, 770, 64, 80, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.ellipse(1472, 742, 22, 32, -0.4, 0, TAU); ctx.fill();

      // толпа
      this.crowd.forEach((p, i) => {
        const dir = i % 2 ? 1 : -1;
        const x = mod(p.x + t * p.sp * dir, W + 160) - 80;
        const bob = Math.sin(t * 4.2 + p.ph) * 2.2;
        const y = p.y;
        ctx.save();
        ctx.translate(x, y + bob);
        ctx.scale(p.s * dir, p.s);
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.beginPath(); ctx.ellipse(0, 28, 24, 6, 0, 0, TAU); ctx.fill();
        const swing = Math.sin(t * 4.2 + p.ph) * 7;
        // ноги с обувью
        ctx.fillStyle = p.coat;
        rrect(ctx, -13 + swing, -16, 9, 42, 5); ctx.fill();
        rrect(ctx, 4 - swing, -16, 9, 42, 5); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        rrect(ctx, -13 + swing, -16, 9, 42, 5); ctx.fill();
        rrect(ctx, 4 - swing, -16, 9, 42, 5); ctx.fill();
        ctx.fillStyle = '#141416';
        rrect(ctx, -14 + swing, 23, 13, 6, 3); ctx.fill();
        rrect(ctx, 3 - swing, 23, 13, 6, 3); ctx.fill();
        // пальто, воротник, пуговицы
        ctx.fillStyle = p.coat;
        rrect(ctx, -15, -76, 30, 62, 11); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.1)';
        rrect(ctx, -15, -76, 10, 62, 8); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fillRect(-1, -70, 2, 54);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.moveTo(-9, -76); ctx.lineTo(9, -76); ctx.lineTo(0, -62); ctx.closePath(); ctx.fill();
        // руки и кисти
        ctx.fillStyle = p.coat;
        rrect(ctx, 9, -70, 8, 36, 4); ctx.fill();
        ctx.fillStyle = '#b98363';
        ctx.beginPath(); ctx.arc(13, -32, 4.5, 0, TAU); ctx.fill();
        // голова: шея, лицо, глаз, волосы
        ctx.fillRect(-4, -84, 8, 8);
        ctx.beginPath(); ctx.arc(0, -92, 14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a1d17';
        ctx.beginPath(); ctx.arc(6, -92, 1.5, 0, TAU); ctx.fill();
        if (i % 4 === 0) {
          // белый калпак с чёрной окантовкой
          ctx.fillStyle = '#f2eee2';
          ctx.beginPath(); ctx.moveTo(-14, -98); ctx.quadraticCurveTo(0, -130, 14, -98); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(-15, -102, 30, 5);
        } else {
          ctx.fillStyle = ['#2a2522', '#4d3327', '#1e1e22'][i % 3];
          ctx.beginPath(); ctx.arc(0, -98, 15, Math.PI, TAU); ctx.fill();
        }
        if (p.bag) {
          ctx.strokeStyle = 'rgba(40,30,25,.7)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(13, -34); ctx.lineTo(24, -40); ctx.stroke();
          ctx.fillStyle = '#e4d4b0';
          rrect(ctx, 16, -40, 24, 34, 6); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.14)';
          rrect(ctx, 16, -18, 24, 12, 6); ctx.fill();
        }
        ctx.restore();
      });

      // листья / пыль
      this.leaves.forEach((l) => {
        const x = mod(l.x + t * l.sp, W + 80) - 40;
        const y = mod(l.y + t * 7 + Math.sin(t * 0.8 + l.ph) * 20, H + 60) - 30;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#f0c98a';
        ctx.beginPath();
        ctx.ellipse(x, y, l.s, l.s * 0.45, l.ph + t, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // виньетка
      const vig = ctx.createLinearGradient(0, 0, 0, H);
      vig.addColorStop(0, 'rgba(10,8,6,.05)');
      vig.addColorStop(1, 'rgba(10,8,6,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------ */
    drawEvening(ctx) {
      const t = this.t;
      // небо, луна, горы, огни города
      ctx.fillStyle = vgrad(ctx, 0, 620, [
        [0, '#13162e'], [0.35, '#2f2a4d'], [0.62, '#8c5860'], [0.82, '#e88a5a'], [1, '#f6b36c']
      ]);
      ctx.fillRect(-30, -30, W + 60, 660);
      this.stars.forEach((s) => {
        ctx.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(t * 0.25 * s.tw + s.tw));
        ctx.fillStyle = '#fff8e6';
        ctx.beginPath(); ctx.arc(s.x, s.y * 0.7, s.r * 0.8, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,244,214,.9)';
      ctx.beginPath(); ctx.arc(1240, 150, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(30,31,58,.95)';
      ctx.beginPath(); ctx.arc(1222, 138, 44, 0, TAU); ctx.fill();
      glow(ctx, 1120, 540, 380, 'rgba(255,150,85,.75)', 0.42);
      drawMountains(ctx, 560, 300, 'dusk');
      drawSkyline(ctx, 626, 50, 170, '#1e2036', 'rgba(255,207,130,.95)', 55, t);

      // дальний тротуар: бордюр, плитка, деревья и фонари на заднем плане
      ctx.fillStyle = '#2a2a38';
      ctx.fillRect(-30, 626, W + 60, 46);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      for (let x = -20; x < W; x += 64) ctx.fillRect(x, 628, 2, 42);
      ctx.fillStyle = '#5b5c6c'; ctx.fillRect(-30, 668, W + 60, 4);
      ctx.fillStyle = '#17171f'; ctx.fillRect(-30, 672, W + 60, 6);
      for (let i = 0; i < 5; i++) {
        const x = 140 + i * 340;
        this.drawTree(ctx, x, 662, 0.42, i * 1.7, ['#1b2b2a', '#223633']);
      }
      for (let i = 0; i < 4; i++) {
        const x = 300 + i * 400;
        ctx.fillStyle = '#15151c'; ctx.fillRect(x - 2, 560, 4, 106);
        ctx.fillStyle = 'rgba(255,222,160,.95)'; ctx.beginPath(); ctx.arc(x + 6, 558, 5, 0, TAU); ctx.fill();
        glow(ctx, x + 6, 558, 70, 'rgba(255,204,125,.9)', 0.4);
      }
      // дальние пешеходы на дальнем тротуаре
      this.drawWalker(ctx, mod(380 + t * 9, W + 200) - 100, 662 - 28 * 0.36, 0.36, t, '#2b2f3d');
      this.drawWalker(ctx, mod(1190 - t * 7, W + 200) - 100, 662 - 28 * 0.34, 0.34, t + 2, '#3c3446');

      // проезжая часть: асфальт, разметка, свет фонарей на покрытии
      ctx.fillStyle = vgrad(ctx, 678, 792, [[0, '#2a2b38'], [0.5, '#1d1e29'], [1, '#14151d']]);
      ctx.fillRect(-30, 678, W + 60, 114);
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillRect(-30, 683, W + 60, 2);
      ctx.fillRect(-30, 786, W + 60, 2);
      ctx.fillStyle = 'rgba(255,214,120,.62)';
      for (let x = -((t * 40) % 120); x < W; x += 120) ctx.fillRect(x, 734, 64, 3);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      for (let x = 60; x < W; x += 260) {
        ctx.beginPath(); ctx.ellipse(x, 700, 80, 8, 0, 0, TAU); ctx.fill();
      }
      // зебра у перекрёстка на правой стороне
      ctx.fillStyle = 'rgba(235,235,235,.34)';
      for (let i = 0; i < 7; i++) ctx.fillRect(1380 + i * 22, 684, 12, 102);

      // машины по полосам: дальняя встречная, ближняя попутная
      const cars = [
        { lane: 0, off: 160, sp: 64, c: '#b54b4b', k: 'car' },
        { lane: 0, off: 820, sp: 52, c: '#5e6c78', k: 'marshrutka' },
        { lane: 0, off: 1280, sp: 76, c: '#d7dde5', k: 'car' },
        { lane: 1, off: 40, sp: 88, c: '#3e6b8a', k: 'car' },
        { lane: 1, off: 640, sp: 70, c: '#e8e0cc', k: 'bus' },
        { lane: 1, off: 1220, sp: 104, c: '#c99c3f', k: 'car' }
      ];
      cars.forEach((c) => {
        const far = c.lane === 0;
        const dir = far ? -1 : 1;
        const span = W + 520;
        const x = dir > 0 ? mod(c.off + t * c.sp, span) - 260 : mod(c.off - t * c.sp, span) - 260;
        drawCar(ctx, x, far ? 722 : 774, far ? 0.78 : 0.96, dir, c.c, c.k, t);
      });

      // ближний тротуар: бордюр, плитка в перспективе
      ctx.fillStyle = '#6a6b7a'; ctx.fillRect(-30, 792, W + 60, 6);
      ctx.fillStyle = '#17171f'; ctx.fillRect(-30, 798, W + 60, 8);
      ctx.fillStyle = vgrad(ctx, 806, 900, [[0, '#3a3a4a'], [1, '#2a2a37']]);
      ctx.fillRect(-30, 806, W + 60, 100);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 2;
      for (let y = 826; y < 900; y += 24) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }
      for (let x = -40; x < W + 60; x += 92) { ctx.beginPath(); ctx.moveTo(x, 806); ctx.lineTo(x - 30, 900); ctx.stroke(); }

      // фонари на ближнем тротуаре: основание у бордюра, свет вниз на тротуар и проезжую часть
      [150, 560, 980, 1400].forEach((x, i) => {
        const baseY = 824; const topY = 470;
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath(); ctx.ellipse(x, baseY + 2, 22, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#14141b';
        ctx.fillRect(x - 6, topY, 12, baseY - topY);
        rrect(ctx, x - 12, baseY - 14, 24, 14, 3); ctx.fill();
        ctx.fillRect(x, topY - 6, 52, 6);
        const lx = x + 52; const sway = Math.sin(t * 0.8 + i) * 1.5;
        ctx.fillStyle = 'rgba(255,230,170,.98)';
        rrect(ctx, lx - 14, topY - 4, 28, 10, 4); ctx.fill();
        glow(ctx, lx + sway, topY + 4, 170, 'rgba(255,204,125,.9)', 0.46);
        const cone = ctx.createLinearGradient(0, topY, 0, 880);
        cone.addColorStop(0, 'rgba(255,214,150,.2)');
        cone.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(lx - 12, topY + 8); ctx.lineTo(lx + 12, topY + 8);
        ctx.lineTo(lx + 120, 880); ctx.lineTo(lx - 120, 880);
        ctx.closePath(); ctx.fill();
      });

      // деревья на ближнем тротуаре
      this.drawTree(ctx, 360, 846, 0.74, 3.1, ['#1a2a29', '#233a35']);
      this.drawTree(ctx, 1190, 846, 0.74, 5.4, ['#1a2a29', '#233a35']);

      // пешеходы строго на тротуаре (ступни на плитке, y > 830)
      const feet = (y, s) => y - 28 * s;
      this.drawWalker(ctx, mod(700 + t * 14, W + 240) - 120, feet(812, 0.78), 0.78, t, '#3b4256');
      this.drawWalker(ctx, mod(760 + t * 14, W + 240) - 120, feet(816, 0.72), 0.72, t + 1.2, '#5a4036');
      this.drawWalker(ctx, mod(1500 - t * 11, W + 240) - 120, feet(810, 0.76), 0.76, t + 2.4, '#34423b');

      // тёплые пылинки у фонарей
      this.motes.forEach((m) => {
        const x = mod(m.x + t * m.vx * 0.4, W);
        const y = mod(m.y + t * m.vy * 0.3, 700);
        ctx.globalAlpha = m.a * 0.5;
        ctx.fillStyle = '#ffd699';
        ctx.beginPath(); ctx.arc(x, y, m.r * 0.8, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;

      const vig = ctx.createLinearGradient(0, 0, 0, H);
      vig.addColorStop(0, 'rgba(4,6,14,.28)');
      vig.addColorStop(0.6, 'rgba(4,6,14,0)');
      vig.addColorStop(1, 'rgba(4,6,14,.45)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------ */
    /* ЦУМ «Айчурек» / ГУМ на Чуй и районные супермаркеты: своя фасадная сцена */
    drawMall(ctx) {
      const t = this.t;
      const label = this.sceneLabel || 'ЦУМ «АЙЧУРЕК»';
      const dept = /ЦУМ|ГУМ/.test(label);
      const phase = this.phase;
      const g = this.gw;
      const lit = clamp(g.night + g.sunset * 0.7 + g.dawn * 0.25, 0, 1);
      this.skyFor(ctx, 560);
      drawMountains(ctx, 500, 250, phase === 'night' ? 'night' : phase === 'sunset' ? 'dusk' : phase === 'dawn' ? 'dawn' : 'day');

      // сосед слева: советский фасад с пилястрами
      ctx.fillStyle = '#c4bca8'; ctx.fillRect(-30, 330, 560, 330);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-30, 330, 560, 14);
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(i * 80 - 10, 344, 14, 316);
        for (let r = 0; r < 4; r++) {
          const lw = hash(i * 7 + r * 3) > 0.5 ? lit : 0;
          ctx.fillStyle = lw > 0.5 ? 'rgba(255,214,140,.9)' : 'rgba(30,48,66,.78)';
          ctx.fillRect(i * 80 + 22, 366 + r * 66, 36, 44);
        }
      }

      if (dept) {
        const X0 = 520, X1 = 1580;
        // стеклянный объём
        const gl = ctx.createLinearGradient(0, 210, 0, 650);
        gl.addColorStop(0, phase === 'day' ? '#5d86a8' : '#27405c');
        gl.addColorStop(1, phase === 'day' ? '#2d4d6b' : '#142235');
        ctx.fillStyle = gl; ctx.fillRect(X0, 214, X1 - X0, 436);
        // освещённые этажи
        for (let r = 0; r < 5; r++) for (let c = 0; c < 20; c++) {
          const on = hash(r * 31 + c * 7) > 0.45 ? lit : 0;
          if (on > 0.1) { ctx.fillStyle = 'rgba(255,220,150,' + (0.5 * on) + ')'; ctx.fillRect(X0 + c * 53 + 3, 270 + r * 74 + 3, 47, 68); }
        }
        // блики и переплёты
        ctx.save();
        ctx.beginPath(); ctx.rect(X0, 214, X1 - X0, 436); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.beginPath(); ctx.moveTo(X0 + 140, 214); ctx.lineTo(X0 + 300, 214); ctx.lineTo(X0 + 80, 650); ctx.lineTo(X0 - 80, 650); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(X0 + 620, 214); ctx.lineTo(X0 + 700, 214); ctx.lineTo(X0 + 480, 650); ctx.lineTo(X0 + 400, 650); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(10,18,28,.7)';
        for (let c = 0; c <= 20; c++) ctx.fillRect(X0 + c * 53, 214, 3, 436);
        for (let r = 0; r <= 6; r++) ctx.fillRect(X0, 266 + r * 74, X1 - X0, 3);
        // парапет и вывеска
        ctx.fillStyle = '#1a232e'; ctx.fillRect(X0 - 14, 196, X1 - X0 + 28, 68);
        ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(X0 - 14, 196, X1 - X0 + 28, 4);
        ctx.fillStyle = '#e9edf2'; ctx.textAlign = 'left';
        const brand = /ГУМ/.test(label) ? 'ГУМ' : 'ЦУМ';
        const sub = /ГУМ/.test(label) ? 'ПР. ЧУЙ · ЦЕНТР' : '«АЙЧУРЕК»  ·  ПР. ЧУЙ';
        ctx.font = '800 46px Inter, system-ui, sans-serif'; ctx.fillText(brand, 846, 250);
        ctx.font = '600 20px Inter, system-ui, sans-serif'; ctx.fillStyle = '#9fd0e8'; ctx.fillText(sub, 970, 248);
        glow(ctx, 960, 232, 220, 'rgba(160,215,255,.8)', 0.18 + lit * 0.25);
        // цоколь, козырёк, входная группа
        ctx.fillStyle = '#d9dde2'; ctx.fillRect(X0 - 40, 556, X1 - X0 + 60, 94);
        ctx.fillStyle = '#8c939b'; ctx.fillRect(X0 - 40, 556, X1 - X0 + 60, 8);
        const wg = ctx.createLinearGradient(0, 580, 0, 650);
        wg.addColorStop(0, 'rgba(255,226,170,' + (0.5 + lit * 0.45) + ')');
        wg.addColorStop(1, 'rgba(255,200,130,' + (0.35 + lit * 0.4) + ')');
        ctx.fillStyle = wg; ctx.fillRect(900, 578, 340, 72);
        ctx.fillStyle = 'rgba(20,28,38,.6)'; [900, 1013, 1126, 1237].forEach((x) => ctx.fillRect(x, 578, 3, 72));
        ctx.fillStyle = '#eef1f4'; ctx.fillRect(860, 540, 420, 20);
        ctx.fillStyle = 'rgba(255,240,200,.9)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(884 + i * 52, 566, 4, 0, TAU); ctx.fill(); }
        // баннеры по бокам
        [['#c7473f', 640], ['#2f7d75', 730], ['#e0a93d', 1360], ['#5b69c4', 1450]].forEach(([c, x]) => {
          ctx.fillStyle = c; rrect(ctx, x, 330, 62, 160, 4); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x + 8, 340, 46, 6);
        });
      } else {
        // супермаркет: низкий объём с фризом-вывеской и стеклянной витриной
        const X0 = 560, X1 = 1560;
        ctx.fillStyle = '#b9b2a3'; ctx.fillRect(X0, 400, X1 - X0, 250);
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(X0, 400, X1 - X0, 10);
        ctx.fillStyle = '#255c4f'; ctx.fillRect(X0 - 10, 410, X1 - X0 + 20, 80);
        ctx.fillStyle = '#f2f4ef'; ctx.textAlign = 'center';
        this.fitText(ctx, label.replace(/«|»/g, ''), 800, 56, 520, 1060, 470);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(X0 + 40, 480, X1 - X0 - 80, 4);
        const wg = ctx.createLinearGradient(0, 500, 0, 650);
        wg.addColorStop(0, 'rgba(255,230,170,' + (0.55 + lit * 0.4) + ')');
        wg.addColorStop(1, 'rgba(255,205,140,' + (0.4 + lit * 0.4) + ')');
        ctx.fillStyle = wg; ctx.fillRect(X0 + 40, 502, X1 - X0 - 80, 148);
        ctx.fillStyle = 'rgba(30,34,38,.55)';
        for (let x = X0 + 40; x <= X1 - 40; x += 125) ctx.fillRect(x, 502, 4, 148);
        for (let s = 0; s < 8; s++) {
          ctx.fillStyle = ['#c7473f', '#e0a93d', '#4f9a54', '#d9d3c0'][s % 4];
          ctx.fillRect(X0 + 70 + s * 118, 580, 70, 10);
          ctx.fillRect(X0 + 70 + s * 118, 612, 70, 10);
        }
        ctx.fillStyle = 'rgba(20,28,32,.65)'; ctx.fillRect(1020, 520, 90, 130); ctx.fillRect(1118, 520, 90, 130);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(1024, 524, 82, 6); ctx.fillRect(1122, 524, 82, 6);
        ctx.fillStyle = '#e9e6dd'; ctx.fillRect(X0 - 30, 396, X1 - X0 + 60, 8);
        glow(ctx, 1060, 470, 260, 'rgba(255,225,160,.8)', 0.12 + lit * 0.25);
      }
      ctx.textAlign = 'left';

      // площадь перед входом: плитка, фонтан, деревья, фонари
      ctx.fillStyle = vgrad(ctx, 650, 790, [[0, '#b7b4ab'], [1, '#8f8c85']]);
      ctx.fillRect(-30, 650, W + 60, 142);
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 2;
      for (let y = 676; y < 790; y += 24) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }
      for (let x = -40; x < W + 60; x += 96) { ctx.beginPath(); ctx.moveTo(x, 650); ctx.lineTo(x - 36, 792); ctx.stroke(); }
      if (dept) {
        // фонтан у ЦУМа
        const cx = 1100, cy = 742;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 12, 190, 34, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8b8f96'; ctx.beginPath(); ctx.ellipse(cx, cy + 4, 176, 32, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6fa6c4'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, 160, 25, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(cx - 30, cy - 6, 90, 9, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(225,244,255,.8)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        for (let k = 0; k < 9; k++) {
          const a = (k / 8 - 0.5) * 2;
          const hgt = 62 + (k % 3) * 18 + Math.sin(t * 2 + k) * 5;
          ctx.beginPath();
          for (let u = 0; u <= 1.001; u += 0.1) {
            const px = cx + a * 110 * u;
            const py = cy - 6 - 4 * hgt * u * (1 - u);
            if (u === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(235,248,255,.75)';
        for (let i = 0; i < 30; i++) {
          const ph = mod(t * 0.9 + i * 0.37, 1);
          const a = (hash(i * 3.1) - 0.5) * 2;
          ctx.beginPath(); ctx.arc(cx + a * 118 * ph, cy - 6 - 4 * 70 * ph * (1 - ph), 1.8, 0, TAU); ctx.fill();
        }
      } else {
        // парковка перед магазином
        drawCar(ctx, 760, 760, 0.9, 1, '#98a6b4', 'car', t);
        drawCar(ctx, 1290, 764, 0.9, -1, '#b54b4b', 'car', t);
      }
      this.drawTree(ctx, 600, 760, 0.62, 1.4, phase === 'night' ? ['#1b2b2a', '#223633'] : ['#4f7d4c', '#3f6b45']);
      this.drawTree(ctx, 1500, 764, 0.62, 4.1, phase === 'night' ? ['#1b2b2a', '#223633'] : ['#4f7d4c', '#3f6b45']);
      [830, 1380].forEach((x, i) => {
        ctx.fillStyle = '#1b1d22'; ctx.fillRect(x - 3, 540, 6, 236);
        ctx.fillStyle = lit > 0.3 ? 'rgba(255,230,170,.98)' : '#c9ccd0';
        ctx.beginPath(); ctx.arc(x, 536, 9, 0, TAU); ctx.fill();
        if (lit > 0.2) glow(ctx, x, 536, 130, 'rgba(255,204,125,.9)', 0.4 * lit);
      });
      const feet = (y, s) => y - 28 * s;
      this.drawWalker(ctx, mod(700 + t * 12, W + 240) - 120, feet(758, 0.56), 0.56, t, '#4a3b3a');
      this.drawWalker(ctx, mod(1450 - t * 10, W + 240) - 120, feet(772, 0.6), 0.6, t + 1.3, '#39483f');
      this.drawWalker(ctx, mod(980 + t * 8, W + 240) - 120, feet(780, 0.62), 0.62, t + 2.6, '#3c3a52');

      // проспект Чуй: проезжая часть с машинами и линией фонарей
      ctx.fillStyle = '#6a6b72'; ctx.fillRect(-30, 790, W + 60, 8);
      ctx.fillStyle = '#17171f'; ctx.fillRect(-30, 798, W + 60, 6);
      ctx.fillStyle = vgrad(ctx, 804, 900, [[0, '#2b2c35'], [1, '#1b1c24']]);
      ctx.fillRect(-30, 804, W + 60, 100);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let x = -((t * 40) % 140); x < W; x += 140) ctx.fillRect(x, 852, 70, 3);
      const aves = [
        { off: 80, sp: 80, c: '#d7dde5', k: 'car', d: 1 }, { off: 760, sp: 60, c: '#e8e0cc', k: 'bus', d: 1 },
        { off: 300, sp: 90, c: '#3e6b8a', k: 'car', d: -1 }, { off: 1010, sp: 70, c: '#b54b4b', k: 'car', d: -1 }
      ];
      aves.forEach((c) => {
        const x = c.d > 0 ? mod(c.off + t * c.sp, W + 520) - 260 : mod(c.off - t * c.sp, W + 520) - 260;
        drawCar(ctx, x, c.d > 0 ? 842 : 892, c.d > 0 ? 0.86 : 1.02, c.d, c.c, c.k, t);
      });
      const vig = ctx.createLinearGradient(0, 0, 0, H);
      vig.addColorStop(0, 'rgba(10,14,24,.08)'); vig.addColorStop(1, 'rgba(10,8,6,.34)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    /* ------------------------------------------------------------------ */
    /* Квартира родителей: тёплый свет, ковёр на стене, чай, сервант, саркыт */
    /** Спираль «кочкор мүйүз» (бараний рог): dir=1 закручивается вправо, dir=-1 влево. */
    hornSpiral(ctx, cx, cy, r, dir, col, lw) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 4.2; a += 0.14) {
        const rr = r * (1 - a / (Math.PI * 4.7));
        const x = cx + dir * rr * Math.cos(a + Math.PI), y = cy + rr * Math.sin(a + Math.PI);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.lineCap = 'butt';
    }

    /** Парный узор «кочкор мүйүз»: две спирали с общим стеблем. */
    hornPair(ctx, cx, cy, s, col, lw, flip) {
      const f = flip ? -1 : 1;
      this.hornSpiral(ctx, cx - s, cy, s * 0.9, 1 * f, col, lw);
      this.hornSpiral(ctx, cx + s, cy, s * 0.9, -1 * f, col, lw);
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(cx - s * 0.1, cy + f * s * 0.2); ctx.quadraticCurveTo(cx, cy + f * s * 0.9, cx + s * 0.1, cy + f * s * 0.2); ctx.stroke();
    }

    drawParentsHome(ctx) {
      const t = this.t;
      // стены и панель
      ctx.fillStyle = vgrad(ctx, 0, 650, [[0, '#e6cfa6'], [1, '#cfa774']]);
      ctx.fillRect(-30, -30, W + 60, 690);
      ctx.fillStyle = 'rgba(120,70,40,.07)';
      for (let x = 0; x < W; x += 56) ctx.fillRect(x, 0, 20, 650);
      ctx.fillStyle = '#7e4f30'; ctx.fillRect(-30, 566, W + 60, 90);
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-30, 566, W + 60, 5);
      // пол
      ctx.fillStyle = vgrad(ctx, 650, 900, [[0, '#7d4c2d'], [1, '#432615']]);
      ctx.fillRect(-30, 650, W + 60, 260);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
      for (let y = 680; y < 900; y += 34) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }
      for (let x = -40; x < W + 60; x += 130) { ctx.beginPath(); ctx.moveTo(x, 650); ctx.lineTo(x - 50 + (x / W) * 100, 900); ctx.stroke(); }

      // окно справа, за ним вечерний двор
      const wx = 1476, wy = 112, ww = 92, wh = 270;
      ctx.fillStyle = '#f1ebe0'; rrect(ctx, wx - 10, wy - 10, ww + 20, wh + 20, 5); ctx.fill();
      ctx.fillStyle = vgrad(ctx, wy, wy + wh, [[0, '#2b2e58'], [0.55, '#8c5a68'], [1, '#e89a68']]);
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#1c1d34';
      [[wx, 110, 40], [wx + 36, 80, 56]].forEach(([x, h, w]) => ctx.fillRect(x, wy + wh - h, w, h));
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,214,140,.9)'; ctx.fillRect(wx + 8 + (i % 3) * 26, wy + wh - 80 + Math.floor(i / 3) * 28, 5, 7); }
      ctx.fillStyle = '#f1ebe0'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + wh / 2 - 3, ww, 6);
      ctx.fillStyle = '#9d2630'; rrect(ctx, wx - 26, wy - 16, 30, wh + 34, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 3; i++) ctx.fillRect(wx - 22 + i * 9, wy - 16, 3, wh + 34);
      ctx.fillStyle = '#d9d3c2'; ctx.fillRect(wx - 16, wy + wh + 10, ww + 32, 9);

      // туш-кийиз над диваном: треугольный купол сверху, бахрома снизу
      const tkX = 960, tkY = 172, tkW = 400, tkH = 248;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#a3232f'; rrect(ctx, tkX, tkY, tkW, tkH, 4); ctx.fill();
      ctx.fillStyle = '#1b2c5e';
      ctx.beginPath(); ctx.moveTo(tkX, tkY); ctx.lineTo(tkX + tkW, tkY); ctx.lineTo(tkX + tkW / 2, tkY - 66); ctx.closePath(); ctx.fill();
      ctx.restore();
      // золотая кайма купола и малиновый ромб в нём
      ctx.strokeStyle = '#e6b84a'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(tkX + 8, tkY - 2); ctx.lineTo(tkX + tkW / 2, tkY - 58); ctx.lineTo(tkX + tkW - 8, tkY - 2); ctx.stroke();
      ctx.fillStyle = '#a3232f';
      ctx.beginPath(); ctx.moveTo(tkX + tkW / 2, tkY - 46); ctx.lineTo(tkX + tkW / 2 + 22, tkY - 22); ctx.lineTo(tkX + tkW / 2, tkY - 4); ctx.lineTo(tkX + tkW / 2 - 22, tkY - 22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e6b84a';
      for (let i = 0; i < 9; i++) { const px = tkX + 70 + i * 32, py = tkY - 6 - Math.min(i, 8 - i) * 6.5; ctx.beginPath(); ctx.moveTo(px - 5, py + 4); ctx.lineTo(px + 5, py + 4); ctx.lineTo(px, py - 6); ctx.closePath(); ctx.fill(); }
      // каймы: золото, тёмно-синий, бордовое поле
      ctx.strokeStyle = '#e6b84a'; ctx.lineWidth = 8; rrect(ctx, tkX + 12, tkY + 12, tkW - 24, tkH - 24, 2); ctx.stroke();
      ctx.strokeStyle = '#1b2c5e'; ctx.lineWidth = 10; rrect(ctx, tkX + 24, tkY + 24, tkW - 48, tkH - 48, 2); ctx.stroke();
      ctx.fillStyle = '#6a1424'; ctx.fillRect(tkX + 30, tkY + 30, tkW - 60, tkH - 60);
      // центральный ромб и парные «кочкор мүйүз»
      const mx = tkX + tkW / 2, my = tkY + tkH / 2;
      const dia = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(mx, my - r); ctx.lineTo(mx + r, my); ctx.lineTo(mx, my + r); ctx.lineTo(mx - r, my); ctx.closePath(); ctx.fill(); };
      dia(66, '#e6b84a'); dia(52, '#1b2c5e'); dia(34, '#a3232f'); dia(14, '#e6b84a');
      this.hornPair(ctx, mx - 112, my - 34, 17, '#e6b84a', 4, false);
      this.hornPair(ctx, mx - 112, my + 40, 17, '#2d4a8f', 4.5, true);
      this.hornPair(ctx, mx + 112, my - 34, 17, '#e6b84a', 4, false);
      this.hornPair(ctx, mx + 112, my + 40, 17, '#2d4a8f', 4.5, true);
      for (let i = 0; i < 5; i++) {
        const sx = mx - 100 + i * 50;
        this.hornSpiral(ctx, sx, tkY + 56, 12, i % 2 ? -1 : 1, i % 2 ? '#2d4a8f' : '#e6b84a', 3.5);
        this.hornSpiral(ctx, sx, tkY + tkH - 56, 12, i % 2 ? 1 : -1, i % 2 ? '#e6b84a' : '#2d4a8f', 3.5);
      }
      // бахрома
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = i % 2 ? '#e6b84a' : '#a3232f';
        ctx.fillRect(tkX + 6 + i * 15, tkY + tkH, 5, 22 + (i % 3) * 3);
      }
      // шнурок и гвоздь
      ctx.strokeStyle = '#4a2f1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tkX + 40, tkY + 2); ctx.lineTo(mx, tkY - 78); ctx.lineTo(tkX + tkW - 40, tkY + 2); ctx.stroke();

      // сандык с жүком: резной сундук и стопка тёшөков с яркими краями и подушками
      const jx = 748, jb = 668, jw = 150;
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(jx + jw / 2, jb + 4, jw * 0.62, 11, 0, 0, TAU); ctx.fill();
      const quilts = [['#b8323c', '#e6b84a'], ['#2f5f9a', '#f2e6c4'], ['#3f8a6a', '#f2e6c4'], ['#8a3f86', '#e9c0dc'], ['#d98a3a', '#fff0c8'], ['#2b3f7a', '#e6b84a'], ['#a8242b', '#f2e6c4']];
      quilts.forEach((q, i) => {
        const qy = jb - 78 - (i + 1) * 28, inset = i * 1.2;
        ctx.fillStyle = q[0]; rrect(ctx, jx + 4 + inset, qy, jw - 8 - inset * 2, 28, 7); ctx.fill();
        ctx.fillStyle = q[1];
        for (let k = 0; k < 9; k++) ctx.fillRect(jx + 14 + inset + k * 15, qy + 10, 8, 3);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(jx + 10 + inset, qy + 3, jw - 20 - inset * 2, 3);
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(jx + 10 + inset, qy + 23, jw - 20 - inset * 2, 4);
      });
      const topY = jb - 78 - quilts.length * 28;
      [[jx + 38, '#b8323c', '#e6b84a'], [jx + 104, '#2f5f9a', '#f2e6c4']].forEach(([px, c1, c2], i) => {
        ctx.fillStyle = c1; rrect(ctx, px - 32, topY - 30, 64, 34, 14); ctx.fill();
        ctx.fillStyle = c2; ctx.fillRect(px - 22, topY - 17, 44, 4);
        this.hornSpiral(ctx, px, topY - 11, 7, i ? -1 : 1, c2, 2.2);
      });
      // сандык
      ctx.fillStyle = '#4e2e19'; rrect(ctx, jx - 6, jb - 78, jw + 12, 78, 5); ctx.fill();
      ctx.fillStyle = '#6a3f22'; rrect(ctx, jx, jb - 70, jw, 62, 4); ctx.fill();
      ctx.strokeStyle = '#d9a843'; ctx.lineWidth = 2;
      rrect(ctx, jx + 8, jb - 62, jw - 16, 46, 3); ctx.stroke();
      this.hornPair(ctx, jx + jw / 2, jb - 40, 12, '#d9a843', 2.4, false);
      ctx.fillStyle = '#d9a843'; ctx.fillRect(jx + jw / 2 - 6, jb - 52, 12, 14);
      ctx.fillStyle = '#4e2e19'; ctx.fillRect(jx + jw / 2 - 2, jb - 48, 4, 6);
      ctx.fillStyle = '#4e2e19'; ctx.fillRect(jx - 2, jb - 8, 14, 8); ctx.fillRect(jx + jw - 12, jb - 8, 14, 8);

      // диван
      const sfx = 940, sfw = 440;
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(sfx + sfw / 2, 664, sfw * 0.56, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5b3520'; rrect(ctx, sfx - 12, 424, sfw + 24, 148, 20); ctx.fill();
      ctx.fillStyle = '#2c5e63'; rrect(ctx, sfx, 434, sfw, 132, 16); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 5; i++) ctx.fillRect(sfx + 16 + i * 86, 444, 3, 112);
      ctx.fillStyle = '#5b3520';
      rrect(ctx, sfx - 30, 476, 40, 180, 12); ctx.fill();
      rrect(ctx, sfx + sfw - 10, 476, 40, 180, 12); ctx.fill();
      ctx.fillStyle = '#1f4549'; rrect(ctx, sfx - 22, 486, 24, 54, 8); ctx.fill(); rrect(ctx, sfx + sfw - 2, 486, 24, 54, 8); ctx.fill();

      // мама: белый жоолук и вышитый кемсел поверх платья
      const mxm = 1050;
      ctx.fillStyle = '#6b3f5e'; rrect(ctx, mxm - 40, 440, 80, 172, 22); ctx.fill();
      ctx.fillStyle = '#c28f6c'; ctx.beginPath(); ctx.ellipse(mxm, 413, 21, 24, 0, 0, TAU); ctx.fill();
      // кемсел
      ctx.fillStyle = '#1e2a4a';
      ctx.beginPath(); ctx.moveTo(mxm - 30, 452); ctx.lineTo(mxm - 8, 448); ctx.lineTo(mxm - 5, 600); ctx.lineTo(mxm - 34, 600); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(mxm + 30, 452); ctx.lineTo(mxm + 8, 448); ctx.lineTo(mxm + 5, 600); ctx.lineTo(mxm + 34, 600); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e6b84a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(mxm - 8, 450); ctx.lineTo(mxm - 5, 600); ctx.moveTo(mxm + 8, 450); ctx.lineTo(mxm + 5, 600); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mxm - 33, 598); ctx.lineTo(mxm - 5, 598); ctx.moveTo(mxm + 5, 598); ctx.lineTo(mxm + 33, 598); ctx.stroke();
      ctx.fillStyle = '#c93c3c';
      for (let i = 0; i < 5; i++) { const yy = 466 + i * 28; [mxm - 20, mxm + 20].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, yy - 6); ctx.lineTo(x + 5, yy); ctx.lineTo(x, yy + 6); ctx.lineTo(x - 5, yy); ctx.closePath(); ctx.fill(); }); }
      // жоолук: чистый белый платок, повязан под подбородком
      ctx.fillStyle = '#f7f4ec';
      ctx.beginPath(); ctx.arc(mxm, 408, 33, Math.PI * 0.82, Math.PI * 2.18); ctx.lineTo(mxm + 29, 450); ctx.lineTo(mxm + 14, 462); ctx.lineTo(mxm - 14, 462); ctx.lineTo(mxm - 29, 450); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c28f6c'; ctx.beginPath(); ctx.ellipse(mxm, 417, 19, 22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f7f4ec';
      ctx.beginPath(); ctx.moveTo(mxm - 17, 438); ctx.lineTo(mxm + 17, 438); ctx.lineTo(mxm + 8, 470); ctx.lineTo(mxm, 478); ctx.lineTo(mxm - 8, 470); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,150,130,.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(mxm - 30, 424); ctx.quadraticCurveTo(mxm - 24, 444, mxm - 12, 460); ctx.moveTo(mxm + 30, 424); ctx.quadraticCurveTo(mxm + 24, 444, mxm + 12, 460); ctx.stroke();
      ctx.fillStyle = '#2b1c12'; ctx.beginPath(); ctx.arc(mxm - 8, 415, 2.4, 0, TAU); ctx.arc(mxm + 8, 415, 2.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2b1c12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mxm, 421, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

      // папа: ак калпак с тёмной отделкой и узорчатый чапан
      const dxm = 1290;
      ctx.fillStyle = '#35508a'; rrect(ctx, dxm - 42, 440, 84, 172, 22); ctx.fill();
      ctx.fillStyle = '#e6b84a'; ctx.beginPath(); ctx.moveTo(dxm - 22, 448); ctx.lineTo(dxm, 486); ctx.lineTo(dxm + 22, 448); ctx.lineTo(dxm + 14, 446); ctx.lineTo(dxm, 470); ctx.lineTo(dxm - 14, 446); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a2230'; ctx.fillRect(dxm - 42, 566, 84, 14);
      ctx.fillStyle = '#e6b84a';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); const x = dxm - 34 + i * 14; ctx.moveTo(x, 573); ctx.lineTo(x + 5, 568); ctx.lineTo(x + 10, 573); ctx.lineTo(x + 5, 578); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#d9a843';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(dxm + 1, 494 + i * 20, 3.2, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(230,184,74,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(dxm - 40, 600); ctx.lineTo(dxm + 40, 600); ctx.stroke();
      ctx.fillStyle = '#c28f6c'; ctx.beginPath(); ctx.ellipse(dxm, 413, 22, 25, 0, 0, TAU); ctx.fill();
      // ак калпак: белый войлок, четыре клина, чёрная окантовка
      ctx.fillStyle = '#f6f2e8';
      ctx.beginPath();
      ctx.moveTo(dxm - 30, 408); ctx.quadraticCurveTo(dxm - 32, 372, dxm - 14, 360); ctx.lineTo(dxm - 5, 354);
      ctx.lineTo(dxm, 358); ctx.lineTo(dxm + 5, 354); ctx.lineTo(dxm + 14, 360);
      ctx.quadraticCurveTo(dxm + 32, 372, dxm + 30, 408); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(150,140,120,.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(dxm, 358); ctx.lineTo(dxm, 404); ctx.moveTo(dxm - 15, 364); ctx.quadraticCurveTo(dxm - 20, 384, dxm - 18, 404); ctx.moveTo(dxm + 15, 364); ctx.quadraticCurveTo(dxm + 20, 384, dxm + 18, 404); ctx.stroke();
      ctx.fillStyle = '#17171b'; rrect(ctx, dxm - 34, 400, 68, 14, 5); ctx.fill();
      ctx.strokeStyle = '#e6b84a'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(dxm - 30, 407); ctx.lineTo(dxm + 30, 407); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#2b1c12'; ctx.beginPath(); ctx.arc(dxm - 9, 421, 2.4, 0, TAU); ctx.arc(dxm + 9, 421, 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8d6d0'; ctx.beginPath(); ctx.ellipse(dxm, 431, 10, 3, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2b1c12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dxm, 433, 7, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();

      // сиденье дивана поверх колен и декоративные подушки
      ctx.fillStyle = '#245259'; rrect(ctx, sfx, 608, sfw, 46, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(sfx + 6, 612, sfw - 12, 3);
      ctx.fillStyle = '#b8323c'; rrect(ctx, sfx + 20, 560, 58, 52, 12); ctx.fill();
      ctx.fillStyle = '#e6b84a'; ctx.fillRect(sfx + 30, 580, 38, 4);
      this.hornSpiral(ctx, sfx + 49, 594, 6, 1, '#e6b84a', 2);
      ctx.fillStyle = '#2f5f9a'; rrect(ctx, sfx + sfw - 78, 560, 58, 52, 12); ctx.fill();
      ctx.fillStyle = '#f2e6c4'; ctx.fillRect(sfx + sfw - 68, 580, 38, 4);
      this.hornSpiral(ctx, sfx + sfw - 49, 594, 6, -1, '#f2e6c4', 2);

      // шырдак: контрастный войлочный ковёр, чёрная обводка и стежка зигзагом по краю
      const rx = 790, ry = 708, rw = 720, rh = 160;
      ctx.fillStyle = 'rgba(0,0,0,.28)'; rrect(ctx, rx + 4, ry + 8, rw, rh, 12); ctx.fill();
      ctx.fillStyle = '#12121a'; rrect(ctx, rx, ry, rw, rh, 12); ctx.fill();
      ctx.fillStyle = '#b3262d'; rrect(ctx, rx + 8, ry + 8, rw - 16, rh - 16, 8); ctx.fill();
      ctx.fillStyle = '#12121a'; rrect(ctx, rx + 30, ry + 26, rw - 60, rh - 52, 6); ctx.fill();
      ctx.fillStyle = '#1d3c7a'; rrect(ctx, rx + 36, ry + 32, rw - 72, rh - 64, 4); ctx.fill();
      ctx.strokeStyle = '#f3eee2'; ctx.lineWidth = 2.2; ctx.lineJoin = 'miter';
      [ry + 17, ry + rh - 17].forEach((zy) => {
        ctx.beginPath();
        for (let x = rx + 22, k = 0; x <= rx + rw - 22; x += 9, k++) { const yy = zy + (k % 2 ? 4 : -4); if (k === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
        ctx.stroke();
      });
      const rmx = rx + rw / 2, rmy = ry + rh / 2;
      const rdia = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(rmx, rmy - r); ctx.lineTo(rmx + r * 1.5, rmy); ctx.lineTo(rmx, rmy + r); ctx.lineTo(rmx - r * 1.5, rmy); ctx.closePath(); ctx.fill(); };
      rdia(44, '#12121a'); rdia(38, '#f3eee2'); rdia(26, '#12121a'); rdia(21, '#b3262d');
      [-1, 1].forEach((sd) => {
        [-150, -255].forEach((off) => {
          this.hornPair(ctx, rmx + sd * -off, rmy - 12, 16, '#12121a', 8, sd > 0);
          this.hornPair(ctx, rmx + sd * -off, rmy - 12, 16, '#f3eee2', 3.6, sd > 0);
          this.hornPair(ctx, rmx + sd * -off, rmy + 24, 16, '#12121a', 8, sd < 0);
          this.hornPair(ctx, rmx + sd * -off, rmy + 24, 16, '#f3eee2', 3.6, sd < 0);
        });
      });

      // дасторкон: низкий резной стол и скатерть-дорожка
      const tbx = 960, tbw = 420, ty = 690;
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(tbx + tbw / 2, 786, tbw * 0.55, 16, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a2c18'; rrect(ctx, tbx + 14, ty + 30, 20, 62, 5); ctx.fill(); rrect(ctx, tbx + tbw - 34, ty + 30, 20, 62, 5); ctx.fill();
      ctx.fillStyle = '#5a3720'; ctx.fillRect(tbx + 6, ty + 14, tbw - 12, 24);
      ctx.fillStyle = '#d9a843';
      for (let i = 0; i < 9; i++) { const dx = tbx + 28 + i * 45; ctx.beginPath(); ctx.moveTo(dx, ty + 18); ctx.lineTo(dx + 8, ty + 26); ctx.lineTo(dx, ty + 34); ctx.lineTo(dx - 8, ty + 26); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#8a5a35'; rrect(ctx, tbx, ty, tbw, 18, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(tbx + 4, ty + 1, tbw - 8, 3);
      ctx.fillStyle = '#efe0bd'; ctx.fillRect(tbx + 20, ty - 2, tbw - 40, 8);
      ctx.fillStyle = '#b3262d'; for (let x = tbx + 26; x < tbx + tbw - 30; x += 22) ctx.fillRect(x, ty, 10, 4);

      // чайник с паром
      const tx = 1010;
      ctx.fillStyle = '#e4e2da'; ctx.beginPath(); ctx.ellipse(tx, ty - 28, 36, 30, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b9392f'; ctx.fillRect(tx - 30, ty - 34, 60, 8);
      ctx.fillStyle = '#2f5d8a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(tx - 24 + i * 12, ty - 16, 3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#e4e2da'; ctx.beginPath(); ctx.moveTo(tx + 28, ty - 36); ctx.quadraticCurveTo(tx + 62, ty - 52, tx + 52, ty - 66); ctx.lineTo(tx + 44, ty - 62); ctx.quadraticCurveTo(tx + 50, ty - 48, tx + 24, ty - 28); ctx.fill();
      ctx.strokeStyle = '#e4e2da'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(tx - 36, ty - 30, 17, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
      ctx.fillStyle = '#cfcdc4'; rrect(ctx, tx - 14, ty - 66, 28, 8, 4); ctx.fill();
      this.steam.slice(0, 7).forEach((p, i) => {
        const ph = mod(t * p.speed + p.phase, 1);
        ctx.globalAlpha = (1 - ph) * 0.35;
        ctx.fillStyle = '#fff6e6';
        ctx.beginPath(); ctx.arc(tx + 52 + Math.sin(ph * 6 + i) * 8, ty - 70 - ph * 90, 5 + p.r * ph, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // пиалы (чыны): узорчатые, без ручек, с чаем
      [1082, 1126].forEach((x) => {
        ctx.fillStyle = '#f6f1e4'; ctx.beginPath(); ctx.moveTo(x - 21, ty - 22); ctx.lineTo(x + 21, ty - 22); ctx.quadraticCurveTo(x + 19, ty, x, ty); ctx.quadraticCurveTo(x - 19, ty, x - 21, ty - 22); ctx.fill();
        ctx.fillStyle = '#9a4a2c'; ctx.beginPath(); ctx.ellipse(x, ty - 22, 19, 4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2f5d8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 18, ty - 15); ctx.lineTo(x + 18, ty - 15); ctx.stroke();
        ctx.fillStyle = '#b3262d'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(x + k * 7, ty - 9, 1.8, 0, TAU); ctx.fill(); }
      });
      // лепёшки (нан) с насечкой
      [[1196, ty - 6, '#c59a58'], [1196, ty - 15, '#dcb26e']].forEach(([x, y, c]) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 38, 10, 0, 0, TAU); ctx.fill();
      });
      ctx.fillStyle = 'rgba(120,80,30,.55)'; for (let k = -4; k <= 4; k++) ctx.fillRect(1196 + k * 6, ty - 18, 2, 4);
      ctx.beginPath(); ctx.ellipse(1196, ty - 15, 12, 3.4, 0, 0, TAU); ctx.fill();
      // миска с горкой боорсоков
      const bx2 = 1272;
      ctx.fillStyle = '#f6f1e4'; ctx.beginPath(); ctx.moveTo(bx2 - 34, ty - 24); ctx.lineTo(bx2 + 34, ty - 24); ctx.quadraticCurveTo(bx2 + 30, ty, bx2, ty); ctx.quadraticCurveTo(bx2 - 30, ty, bx2 - 34, ty - 24); ctx.fill();
      ctx.strokeStyle = '#2f5d8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx2 - 30, ty - 15); ctx.lineTo(bx2 + 30, ty - 15); ctx.stroke();
      const bo = [[-22, -26], [-7, -26], [8, -26], [23, -26], [-15, -40], [0, -40], [15, -40], [-7, -53], [8, -53], [0, -64]];
      bo.forEach(([dx, dy], i) => {
        ctx.fillStyle = i % 2 ? '#e4a53f' : '#eab04a'; ctx.beginPath(); ctx.arc(bx2 + dx, ty + dy + 2, 10.5, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,190,.45)'; ctx.beginPath(); ctx.arc(bx2 + dx - 3, ty + dy - 1, 3.2, 0, TAU); ctx.fill();
      });
      // саркыт: стопка контейнеров на краю стола
      [0, 1, 2].forEach((i) => {
        const x = 1352, y = ty - 4 - i * 22;
        ctx.fillStyle = 'rgba(230,240,246,.92)'; rrect(ctx, x - 24, y - 20, 48, 20, 4); ctx.fill();
        ctx.fillStyle = ['#3f7fb0', '#c7473f', '#4f9a54'][i]; rrect(ctx, x - 26, y - 24, 52, 7, 3); ctx.fill();
      });

      // тёплый свет: абажур слева от туш-кийиза
      ctx.strokeStyle = '#2b1c12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(925, -10); ctx.lineTo(925, 112); ctx.stroke();
      ctx.fillStyle = '#d99a3c'; ctx.beginPath(); ctx.moveTo(885, 150); ctx.lineTo(965, 150); ctx.lineTo(949, 112); ctx.lineTo(901, 112); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,.95)'; ctx.beginPath(); ctx.ellipse(925, 152, 40, 6, 0, 0, TAU); ctx.fill();
      const flick = 0.9 + Math.sin(t * 3.1) * 0.03;
      glow(ctx, 925, 160, 620, 'rgba(255,200,120,.9)', 0.46 * flick);
      const beam = ctx.createLinearGradient(0, 154, 0, 700);
      beam.addColorStop(0, 'rgba(255,225,160,.3)'); beam.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(887, 154); ctx.lineTo(963, 154); ctx.lineTo(1200, 700); ctx.lineTo(700, 700); ctx.closePath(); ctx.fill();

      // тёплая виньетка
      const vig = ctx.createLinearGradient(0, 0, 0, H);
      vig.addColorStop(0, 'rgba(60,30,10,.2)'); vig.addColorStop(1, 'rgba(30,14,6,.42)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }
  }

  BD.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);

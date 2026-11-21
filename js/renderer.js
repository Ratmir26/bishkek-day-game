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

    get phase() {
      if (this._forcePhase) return this._forcePhase;
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

      CAR_STATE.night = this.scene === 'evening' || this.phase === 'night';
      if (this.scene === 'home') this.drawHome(ctx);
      else if (this.scene === 'office') this.drawOffice(ctx);
      else if (this.scene === 'bazaar') this.drawBazaar(ctx);
      else if (this.scene === 'evening') this.drawEvening(ctx);
      else if (this.scene === 'school') this.drawSchool(ctx);
      else if (this.scene === 'park') this.drawPark(ctx);
      else if (this.scene === 'courtyard' && /^(dusk|ashar|surprise|sleep)$/.test(this.sceneLabel)) this.drawYardMambetova(ctx, this.sceneLabel);
      else if (this.scene === 'courtyard') this.drawCourtyard(ctx);
      else if (this.scene === 'stairwell') this.drawStairwell(ctx);
      else if (this.scene === 'school_evening') this.drawSchoolEvening(ctx);
      else if (this.scene === 'apa_kitchen') this.drawApaKitchen(ctx, this.sceneLabel);
      else if (this.scene === 'south_panorama') this.drawSouthPanorama(ctx);
      else if (this.scene === 'old_center_courtyard') this.drawOldCenterCourtyard(ctx, this.sceneLabel);
      else if (this.scene === 'memory_corner') this.drawMemoryCorner(ctx);
      else if (this.scene === 'alatoo_twilight') this.drawAlaTooTwilight(ctx, this.sceneLabel);
      else if (this.scene === 'kitchen_night') this.drawKitchenNight(ctx, this.sceneLabel);
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
      if (['office', 'home', 'parents_home', 'stairwell', 'kitchen_night', 'mall', 'apa_kitchen', 'south_panorama', 'memory_corner'].indexOf(this.scene) >= 0) return;
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
      const sky = phase === 'day'
        ? [[0, '#3d6f9c'], [0.45, '#8db8cf'], [0.78, '#d9e8e8'], [1, '#f2e9cf']]
        : phase === 'sunset'
          ? [[0, '#2c2a4f'], [0.4, '#7a5068'], [0.72, '#d98567'], [1, '#f4bd7f']]
          : [[0, '#6f8fb8'], [0.42, '#c99c8d'], [0.72, '#f0c49a'], [1, '#f8e2bd']];
      ctx.fillStyle = vgrad(ctx, 0, 650, sky);
      ctx.fillRect(-30, -30, W + 60, 700);
      const sunX = phase === 'day' ? 1280 : 1180;
      const sunY = phase === 'day' ? 190 : 300;
      glow(ctx, sunX, sunY, 230, 'rgba(255,226,160,.9)', 0.42);
      ctx.fillStyle = 'rgba(255,240,205,.9)';
      ctx.beginPath(); ctx.arc(sunX, sunY, 40, 0, TAU); ctx.fill();

      ctx.fillStyle = 'rgba(255,240,220,.18)';
      for (let i = 0; i < 4; i++) {
        const x = mod(i * 420 + t * 1.6, W + 300) - 150;
        ctx.beginPath();
        ctx.ellipse(x, 150 + (i % 2) * 54, 112, 15, 0, 0, TAU);
        ctx.fill();
      }

      drawMountains(ctx, 590, 300, phase === 'day' ? 'day' : 'dawn');
      drawSkyline(ctx, 620, 42, 120, '#8b7768', null, 17, t);

      // земля и школьный двор
      ctx.fillStyle = vgrad(ctx, 600, 900, [[0, '#5b625f'], [0.5, '#464d4b'], [1, '#2c3332']]);
      ctx.fillRect(-30, 600, W + 60, 330);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(0, 600, W, 4);

      // школьное здание
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.32)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 16;
      ctx.fillStyle = '#d8cbb4';
      rrect(ctx, 150, 236, 760, 406, 6);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#c2b39a';
      ctx.fillRect(150, 236, 760, 18);
      ctx.fillStyle = '#b0a087';
      ctx.fillRect(150, 254, 760, 6);

      // окна
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
          const wx = 188 + col * 88;
          const wy = 286 + row * 104;
          ctx.fillStyle = phase === 'sunset' ? 'rgba(255,190,120,.55)' : 'rgba(112,154,178,.8)';
          rrect(ctx, wx, wy, 56, 66, 4);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.22)';
          ctx.fillRect(wx + 5, wy + 6, 16, 2);
          ctx.fillStyle = 'rgba(40,50,55,.28)';
          ctx.fillRect(wx + 27, wy, 3, 66);
          ctx.fillRect(wx, wy + 31, 56, 3);
        }
      }

      // вход
      ctx.fillStyle = '#6d5a45';
      rrect(ctx, 760, 520, 112, 122, 4);
      ctx.fill();
      ctx.fillStyle = '#3b3028';
      rrect(ctx, 776, 540, 80, 102, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,150,.55)';
      ctx.fillRect(792, 556, 48, 58);
      ctx.fillStyle = '#2d2520';
      ctx.fillRect(760, 512, 112, 12);

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
      ctx.strokeStyle = '#7d837e';
      ctx.lineWidth = 3;
      for (let x = 980; x < 1600; x += 34) {
        ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x, 690); ctx.stroke();
      }
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(980, 586); ctx.lineTo(1600, 586); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(980, 672); ctx.lineTo(1600, 672); ctx.stroke();

      // деревья
      for (let i = 0; i < 4; i++) this.drawTree(ctx, 1084 + i * 126, 632, 0.66, i * 2.3 + 1, i % 2 ? ['#2d533f', '#3a6a50'] : ['#345c45', '#40724f']);

      // спортплощадка во дворе: турники и баскетбольное кольцо
      this.drawYardSports(ctx);

      // зебра и асфальт
      ctx.fillStyle = '#3d4343';
      ctx.fillRect(980, 730, 620, 170);
      ctx.fillStyle = 'rgba(240,240,230,.72)';
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(1020 + i * 88, 760, 52, 104);
      }

      // люди
      this.drawWalker(ctx, 1120, 714, 0.56, t, '#252c33');
      this.drawWalker(ctx, 1180, 724, 0.48, t + 1.1, '#3a2e2c');
      this.drawWalker(ctx, 1280, 736, 0.44, t + 2.3, '#2d3a33');

      // листья
      this.leaves.forEach((l) => {
        const x = mod(l.x + t * l.sp * 0.6, W + 80) - 40;
        const y = mod(l.y + t * 6 + Math.sin(t * 0.8 + l.ph) * 18, H + 60) - 30;
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#f0c98a';
        ctx.beginPath();
        ctx.ellipse(x, y, l.s, l.s * 0.45, l.ph + t, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      const vig = ctx.createLinearGradient(0, 720, 0, 900);
      vig.addColorStop(0, 'rgba(5,8,12,0)');
      vig.addColorStop(1, 'rgba(5,8,12,.5)');
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
      // чайхана: столики под зонтами
      [1390, 1500].forEach((ux, i) => {
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(ux, 640, 5, 70);
        ctx.fillStyle = i ? '#c0503f' : '#e2b24d';
        ctx.beginPath(); ctx.moveTo(ux - 56, 645); ctx.quadraticCurveTo(ux + 2, 590, ux + 62, 645); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e6dfd0'; ctx.beginPath(); ctx.ellipse(ux + 2, 720, 40, 9, 0, 0, TAU); ctx.fill();
      });
      ctx.fillStyle = '#f7f4ea'; rrect(ctx, 1400, 540, 150, 34, 6); ctx.fill();
      ctx.fillStyle = '#245c48';
      this.fitText(ctx, 'ЧАЙХАНА', 700, 17, 130, 1475, 563);

      // «Фит» Бакыта
      drawCar(ctx, 990, 722, 1.1, 1, '#98a6b4', 'car', t);

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

      this.drawWalker(ctx, 600, 740, 0.66, t, '#2d3a33');
      this.drawWalker(ctx, 1250, 760, 0.7, t + 1.4, '#3c3a52');

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
    /* Люди-силуэты для сюжетных сцен: (x, y) — ноги. kind: stand | sit | sleep | wave */
    drawFolk(ctx, x, y, s, o) {
      o = o || {};
      const t = this.t, bob = Math.sin(t * 2 + (o.ph || 0)) * (o.pose === 'sleep' ? 0.6 : 1.2);
      const coat = o.coat || '#4a5f78', skin = o.skin || '#d9a984';
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s * (o.flip ? -1 : 1), s);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(0, 2, 30, 7, 0, 0, TAU); ctx.fill();
      if (o.pose === 'sleep') {
        // лежит на тапчане, накрыт курпачой в полоску
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-46, -34, 15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2d2a28'; ctx.beginPath(); ctx.arc(-48, -40, 15, Math.PI, TAU * 0.95); ctx.fill();
        const cols = ['#b5483c', '#e2b24d', '#2f6a7a', '#efe4cc'];
        for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i]; rrect(ctx, -34 + i * 24, -50 - Math.sin(i) * 1.5, 26, 40, 8); ctx.fill(); }
        ctx.fillStyle = 'rgba(0,0,0,.16)'; rrect(ctx, -34, -22, 96, 12, 6); ctx.fill();
        ctx.restore();
        return;
      }
      const sit = o.pose === 'sit';
      const by = sit ? -34 : -4;
      // ноги
      ctx.fillStyle = o.pants || '#2b2f3a';
      if (sit) { rrect(ctx, -16, -36, 40, 14, 6); ctx.fill(); rrect(ctx, 14, -36, 12, 36, 5); ctx.fill(); }
      else { rrect(ctx, -14, -58, 12, 56, 5); ctx.fill(); rrect(ctx, 3, -58, 12, 56, 5); ctx.fill(); }
      // туловище
      const th = sit ? 66 : 84, ty = by - th - (sit ? 0 : 20) + bob * 0.4;
      ctx.fillStyle = coat; rrect(ctx, -22, ty, 44, th, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.1)'; rrect(ctx, -22, ty, 12, th, 8); ctx.fill();
      if (o.pose === 'wave') {
        ctx.strokeStyle = coat; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(18, ty + 14); ctx.lineTo(36, ty - 14 + Math.sin(t * 5) * 8); ctx.stroke();
      }
      // голова
      const hy = ty - 14;
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, 15, 0, TAU); ctx.fill();
      if (o.hat === 'kalpak') {            // ак калпак: белый колпак с чёрной отделкой
        ctx.fillStyle = '#f5f2ea'; ctx.beginPath(); ctx.moveTo(-15, hy - 4); ctx.lineTo(-10, hy - 30); ctx.quadraticCurveTo(0, hy - 38, 10, hy - 30); ctx.lineTo(15, hy - 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1f1f22'; ctx.fillRect(-15, hy - 8, 30, 6);
      } else if (o.hat === 'scarf') {      // жоолук
        ctx.fillStyle = o.scarf || '#b5483c'; ctx.beginPath(); ctx.arc(0, hy - 3, 17, Math.PI, TAU); ctx.fill();
        ctx.fillRect(-17, hy - 3, 6, 22); ctx.fillRect(11, hy - 3, 6, 22);
      } else if (o.hat === 'cap') {
        ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.arc(0, hy - 4, 15, Math.PI, TAU); ctx.fill(); ctx.fillRect(-4, hy - 6, 24, 4);
      } else {
        ctx.fillStyle = o.hair || '#2a2220'; ctx.beginPath(); ctx.arc(0, hy - 3, 15, Math.PI * 1.05, TAU * 0.99); ctx.fill();
      }
      ctx.restore();
    }

    /** Гирлянда: провод с провисом и лампочками. lit — доля зажжённых (0..1). */
    drawStringLights(ctx, pts, lit, dim) {
      const t = this.t;
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        const sag = 34 + Math.abs(x1 - x0) * 0.05;
        ctx.strokeStyle = 'rgba(20,20,20,.75)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); ctx.stroke();
        const n = Math.max(4, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 34));
        for (let i = 1; i < n; i++) {
          const u = i / n, x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * ((x0 + x1) / 2) + u * u * x1;
          const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * ((y0 + y1) / 2 + sag * 2) + u * u * y1;
          const on = (i + k * 7) / (n + 7) <= lit + 0.001 || lit >= 1;
          const cols = ['#ffd27a', '#ff9d6b', '#ffe8a8', '#9fe3d0'];
          const c = cols[(i + k) % 4];
          if (on) {
            const fl = 0.8 + 0.2 * Math.sin(t * 3 + i * 1.7 + k);
            glow(ctx, x, y + 6, (dim ? 22 : 34) * fl, c, dim ? 0.35 : 0.55);
            ctx.fillStyle = c;
          } else ctx.fillStyle = '#4a4540';
          ctx.beginPath(); ctx.ellipse(x, y + 5, 4, 6, 0, 0, TAU); ctx.fill();
        }
      }
    }

    /** Двор на Мамбетова: тапчан, урюк, бетонный арык, гирлянды. variant: dusk | ashar | surprise | sleep. */
    drawYardMambetova(ctx, variant) {
      const t = this.t, phase = this.phase;
      const dark = phase === 'night' || phase === 'sunset' || variant === 'sleep';
      this.skyFor(ctx, 540);
      drawMountains(ctx, 530, 240, phase === 'night' ? 'night' : 'dusk');

      // дома: слева общий (под карточкой), справа — с освещёнными окнами
      [{ x: -20, w: 640, h: 400, c: '#b4aa9c' }, { x: 860, w: 780, h: 470, c: '#a59e92' }].forEach((b, bi) => {
        const top = 600 - b.h;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
        ctx.fillStyle = b.c; ctx.fillRect(b.x, top, b.w, b.h); ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(b.x, top, b.w, 10);
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        for (let sx = b.x + 70; sx < b.x + b.w; sx += 70) ctx.fillRect(sx, top, 2, b.h);
        for (let fy = top + 70; fy < 590; fy += 70) ctx.fillRect(b.x, fy, b.w, 2);
        for (let row = 0; row < Math.floor(b.h / 70); row++) for (let col = 0; col < Math.floor(b.w / 70); col++) {
          const wx = b.x + 14 + col * 70, wy = top + 16 + row * 70, r = hash(bi * 31 + row * 7 + col * 3.1);
          const lit = dark && r > 0.4;
          ctx.fillStyle = lit ? 'rgba(255,214,140,.9)' : 'rgba(95,130,150,.8)';
          rrect(ctx, wx, wy, 34, 42, 3); ctx.fill();
          ctx.fillStyle = 'rgba(40,50,55,.35)'; ctx.fillRect(wx + 16, wy, 2, 42); ctx.fillRect(wx, wy + 20, 34, 2);
        }
      });
      // окно родителей (четвёртый этаж справа): в сюрпризе в нём стоит папа
      const pwx = 1182, pwy = 600 - 470 + 16 + 3 * 70;
      if (variant === 'surprise') {
        glow(ctx, pwx + 17, pwy + 20, 70, '#ffd27a', 0.55);
        ctx.fillStyle = '#ffe2a0'; rrect(ctx, pwx, pwy, 34, 42, 3); ctx.fill();
        ctx.fillStyle = '#4a3b30'; ctx.beginPath(); ctx.arc(pwx + 17, pwy + 20, 8, 0, TAU); ctx.fill();
        ctx.fillRect(pwx + 8, pwy + 28, 18, 14);
      }

      // двор: земля + дорожка
      ctx.fillStyle = vgrad(ctx, 596, 900, [[0, dark ? '#34362f' : '#6f6b5d'], [1, '#232622']]);
      ctx.fillRect(-30, 596, W + 60, 330);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 596, W, 4);

      // бетонный арык: лоток вдоль двора, вода блестит
      ctx.fillStyle = '#7a776e'; ctx.fillRect(-30, 770, W + 60, 44);
      ctx.fillStyle = '#5d5b55'; ctx.fillRect(-30, 770, W + 60, 8); ctx.fillRect(-30, 806, W + 60, 8);
      ctx.fillStyle = dark ? '#1f3a4a' : '#4f8aa1'; ctx.fillRect(-30, 779, W + 60, 26);
      ctx.strokeStyle = 'rgba(190,225,240,.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 24; i++) {
        const x = mod(i * 78 - t * 46, W + 100) - 40, y = 784 + (i % 4) * 5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.stroke();
      }
      ctx.fillStyle = '#8a867c'; rrect(ctx, 1230, 760, 110, 14, 4); ctx.fill();   // бетонная плита-мостик
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(1230, 772, 110, 4);

      // урюк
      const tx = 1080, tb = 706;
      this.drawTree(ctx, tx, tb, 1.65, 8.3, dark ? ['#2e4a33', '#38573c'] : ['#476a3e', '#58814a']);
      for (let i = 0; i < 12; i++) {
        const a = hash(i * 3.3) * TAU, r = 20 + hash(i * 1.7) * 105;
        ctx.fillStyle = '#e8a042'; ctx.beginPath(); ctx.arc(tx + Math.cos(a) * r * 1.15, tb - 215 + Math.sin(a) * r * 0.62, 4.5, 0, TAU); ctx.fill();
      }

      // тапчан под деревом: помост, курпача, дастархан
      const px = 1010, py = 700;
      ctx.fillStyle = '#4a3322';
      [px + 8, px + 268].forEach((lx) => ctx.fillRect(lx, py, 12, 42));
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#9a6a3c'; rrect(ctx, px - 10, py - 18, 308, 28, 4); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      for (let i = 1; i < 6; i++) ctx.fillRect(px - 10 + i * 51, py - 18, 2, 28);
      ctx.fillStyle = '#a8402f'; rrect(ctx, px + 4, py - 28, 280, 14, 6); ctx.fill();            // курпача поверх досок
      ctx.fillStyle = '#e2b24d'; for (let i = 0; i < 7; i++) ctx.fillRect(px + 14 + i * 38, py - 28, 12, 14);
      // дастархан: блюда, чайник, пиалы
      if (variant !== 'sleep') {
        ctx.fillStyle = '#efe6d2'; rrect(ctx, px + 70, py - 36, 150, 10, 4); ctx.fill();
        [[96, '#e8b04a'], [128, '#c0503f'], [160, '#f3efe2'], [192, '#7ea66a']].forEach(([dx, c]) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(px + dx, py - 39, 13, 5, 0, 0, TAU); ctx.fill();
        });
        ctx.fillStyle = '#2f6a7a'; rrect(ctx, px + 222, py - 54, 24, 20, 6); ctx.fill();            // чайник
        ctx.fillRect(px + 244, py - 50, 12, 4);
      }

      // люди
      const kass = { coat: '#6b4f3a', pants: '#3a3a40', hat: 'kalpak' };
      if (variant === 'sleep') {
        this.drawFolk(ctx, px + 110, py - 28, 1.05, { pose: 'sleep' });
        this.drawFolk(ctx, px - 40, 740, 1.12, { coat: '#7a4a6a', hat: 'scarf', scarf: '#7e3b4a', pose: 'stand', ph: 1 });
        this.drawFolk(ctx, px + 330, 740, 1.05, Object.assign({ ph: 2, flip: true, pose: 'stand' }, kass));
      } else {
        this.drawFolk(ctx, px + 250, py - 18, 1.0, Object.assign({ pose: 'sit', flip: true }, kass));              // Касым-ата
        this.drawFolk(ctx, px + 60, py - 18, 0.95, { pose: 'sit', coat: '#7a4a6a', hat: 'scarf', scarf: '#b5483c', ph: 1.4 }); // Апа Гуля
        this.drawFolk(ctx, 1420, 742, 1.05, { coat: '#4a6a56', hat: 'cap', pose: variant === 'dusk' ? 'wave' : 'stand', ph: 2.1 }); // Бакыт
        if (variant === 'ashar' || variant === 'surprise') {
          this.drawFolk(ctx, 1300, 748, 0.95, { coat: '#9a6a3c', ph: 0.6 });
          this.drawFolk(ctx, 1520, 756, 1.0, { coat: '#3c3a52', hat: 'scarf', scarf: '#2f6a7a', ph: 3, flip: true });
          this.drawFolk(ctx, 940, 752, 0.9, { coat: '#6a4a4a', ph: 1.2 });
          this.drawFolk(ctx, 1170, 776, 0.62, { coat: '#d1693f', ph: 0.2 });   // дети
          this.drawFolk(ctx, 1210, 780, 0.56, { coat: '#3f8fd1', ph: 1.9 });
        }
      }

      // казан на огне — во время ашара
      if (variant === 'ashar' || variant === 'surprise') {
        const kx = 1470, ky = 700;
        glow(ctx, kx, ky - 10, 90, '#ff8c3a', 0.5);
        ctx.fillStyle = '#26282a'; ctx.beginPath(); ctx.ellipse(kx, ky - 34, 40, 14, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(kx - 40, ky - 34); ctx.quadraticCurveTo(kx - 44, ky + 6, kx, ky + 8); ctx.quadraticCurveTo(kx + 44, ky + 6, kx + 40, ky - 34); ctx.fill();
        ctx.fillStyle = '#ffb04a';
        for (let i = 0; i < 5; i++) { const fl = Math.sin(t * 8 + i * 2) * 4; ctx.beginPath(); ctx.moveTo(kx - 24 + i * 12, ky + 10); ctx.quadraticCurveTo(kx - 28 + i * 12 + fl, ky - 12, kx - 22 + i * 12, ky - 22 + fl); ctx.quadraticCurveTo(kx - 14 + i * 12, ky - 8, kx - 12 + i * 12, ky + 10); ctx.fill(); }
        ctx.strokeStyle = 'rgba(235,235,235,.2)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const sy = mod(t * 24 + i * 40, 120); ctx.globalAlpha = 0.28 * (1 - sy / 120); ctx.beginPath(); ctx.moveTo(kx - 8 + i * 8, ky - 50 - sy); ctx.lineTo(kx - 4 + i * 8 + Math.sin(t + i) * 6, ky - 66 - sy); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      // «Фит» Бакыта у подъезда (слева, виден за карточкой лишь частично)
      drawCar(ctx, 760, 760, 1.05, 1, '#98a6b4', 'car', t);

      // гирлянды: в dusk зажжена лишь половина, в sleep тускло
      const lit = variant === 'dusk' ? 0.5 : 1;
      this.drawStringLights(ctx, [[880, 330], [1080, 470], [1330, 430], [1560, 360]], variant === 'sleep' ? 0.4 : lit, variant === 'sleep');
      this.drawStringLights(ctx, [[1080, 470], [1010, 640], [1300, 650]], variant === 'sleep' ? 0.3 : lit, variant === 'sleep');

      if (variant === 'surprise') {
        const cols = ['#ff6f5e', '#f2b64b', '#3fd0b6', '#8fc9e8'];
        for (let i = 0; i < 34; i++) {
          const x = 880 + hash(i * 2.1) * 700, y = mod(hash(i * 3.7) * 700 + t * (30 + (i % 5) * 9), 700) + 40;
          ctx.fillStyle = cols[i % 4]; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + i);
          ctx.fillRect(-3, -2, 7, 4); ctx.restore();
        }
        [[1150, 380, '#ff6f5e'], [1260, 340, '#f2b64b'], [1400, 390, '#3fd0b6']].forEach(([bx, by, c], i) => {
          const bob = Math.sin(t * 1.3 + i) * 8;
          ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by + bob + 22); ctx.lineTo(bx - 4, by + bob + 90); ctx.stroke();
          ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(bx, by + bob, 17, 22, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(bx - 6, by + bob - 8, 4, 7, 0, 0, TAU); ctx.fill();
        });
      }
      if (variant === 'sleep') {
        ctx.fillStyle = 'rgba(235,240,255,.75)'; ctx.font = '700 26px Inter, sans-serif'; ctx.textAlign = 'center';
        ['z', 'Z', 'Z'].forEach((z, i) => { const u = mod(t * 0.5 + i * 0.33, 1); ctx.globalAlpha = 0.8 * (1 - u); ctx.fillText(z, px + 62 + i * 14 + u * 20, py - 90 - u * 70); });
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(10,14,36,.28)'; ctx.fillRect(0, 0, W, H);
      }
      this.leaves.forEach((l) => {
        const x = mod(l.x + t * l.sp * 0.5, W + 80) - 40, y = mod(l.y + t * 6 + Math.sin(t * 0.8 + l.ph) * 18, H + 60) - 30;
        ctx.globalAlpha = 0.22; ctx.fillStyle = '#f0c98a';
        ctx.beginPath(); ctx.ellipse(x, y, l.s, l.s * 0.45, l.ph + t, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const vig = ctx.createLinearGradient(0, 560, 0, 900);
      vig.addColorStop(0, 'rgba(5,8,12,0)'); vig.addColorStop(1, 'rgba(5,8,12,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 560, W, 340);
    }

    /** Подъезд: окрашенная панель, лестница, почтовые ящики, неработающий лифт и Апа Гуля с клетчатым баулом. */
    drawStairwell(ctx) {
      const t = this.t;
      ctx.fillStyle = vgrad(ctx, 0, 640, [[0, '#e9e4d6'], [1, '#d8d0bc']]);
      ctx.fillRect(-30, -30, W + 60, 700);
      ctx.fillStyle = '#5f8a7a'; ctx.fillRect(-30, 420, W + 60, 250);                    // зелёная панель
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-30, 418, W + 60, 4);
      ctx.fillStyle = vgrad(ctx, 660, 900, [[0, '#8d8a82'], [1, '#4a4944']]);
      ctx.fillRect(-30, 660, W + 60, 260);
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      for (let x = -20; x < W + 40; x += 70) ctx.fillRect(x, 660, 2, 240);
      // окно на площадке: дневной свет и лучи
      const wx = 1030, wy = 90, ww = 300, wh = 300;
      ctx.fillStyle = '#f4f1e8'; rrect(ctx, wx - 14, wy - 14, ww + 28, wh + 28, 6); ctx.fill();
      ctx.fillStyle = vgrad(ctx, wy, wy + wh, [[0, '#7fb4d6'], [1, '#eaf2e8']]);
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#7a8a6a'; ctx.beginPath(); ctx.arc(wx + 80, wy + 250, 60, 0, TAU); ctx.fill();      // крона урюка за стеклом
      ctx.fillStyle = '#5d7a52'; ctx.beginPath(); ctx.arc(wx + 140, wy + 270, 70, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(70,80,80,.5)'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + wh / 2 - 3, ww, 6);
      ctx.fillStyle = '#e8e2d2'; ctx.fillRect(wx - 20, wy + wh + 14, ww + 40, 10);      // подоконник с горшками
      [[wx + 40, '#b5483c'], [wx + 130, '#c9833c'], [wx + 230, '#a24a3d']].forEach(([px, c], i) => {
        ctx.fillStyle = c; rrect(ctx, px - 16, wy + wh - 6, 32, 24, 4); ctx.fill();
        ctx.fillStyle = '#3f8a4a'; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(px + k * 8, wy + wh - 18 - Math.abs(k) * 2, 7, 14, k * 0.4 + Math.sin(t + i) * 0.04, 0, TAU); ctx.fill(); }
      });
      const ray = ctx.createLinearGradient(wx, wy, wx - 260, wy + 520);
      ray.addColorStop(0, 'rgba(255,240,200,.28)'); ray.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(wx, wy + 40); ctx.lineTo(wx + ww, wy + 40); ctx.lineTo(wx + ww - 220, 760); ctx.lineTo(wx - 360, 760); ctx.closePath(); ctx.fill();

      // лестница (марш вверх вправо) и перила
      ctx.fillStyle = '#9a968c';
      for (let i = 0; i < 7; i++) { ctx.fillRect(1330 + i * 40, 660 - i * 26, 300, 22); ctx.fillStyle = i % 2 ? '#9a968c' : '#a7a398'; }
      ctx.strokeStyle = '#2a2a2c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(1330, 560); ctx.lineTo(1620, 400); ctx.stroke();
      for (let i = 0; i < 8; i++) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(1330 + i * 40, 560 - i * 22); ctx.lineTo(1330 + i * 40, 660 - i * 26); ctx.stroke(); }

      // почтовые ящики и объявление «ЛИФТ НЕ РАБОТАЕТ»
      ctx.fillStyle = '#6f7a86'; ctx.fillRect(760, 470, 190, 120);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = '#8795a3'; rrect(ctx, 768 + c * 45, 478 + r * 56, 38, 48, 3); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(776 + c * 45, 486 + r * 56, 22, 3); }
      ctx.fillStyle = '#aeb4b8'; ctx.fillRect(1010, 440, 150, 220);                       // дверь лифта
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(1084, 440, 3, 220);
      ctx.save(); ctx.translate(1085, 520); ctx.rotate(-0.04);
      ctx.fillStyle = '#fff6c9'; ctx.fillRect(-48, -22, 96, 44);
      ctx.fillStyle = '#b5301f'; ctx.font = '800 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ЛИФТ', 0, -4); ctx.fillText('НЕ РАБОТАЕТ', 0, 11);
      ctx.restore();

      // Апа Гуля на ступеньке с баулом
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(1180, 722, 120, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(1090, 690, 200, 24);
      this.drawFolk(ctx, 1160, 696, 1.35, { pose: 'sit', coat: '#7a4a6a', hat: 'scarf', scarf: '#2f6a7a', ph: 0.7 });
      // клетчатый баул (красно-синяя клетка)
      const bx = 1250, by = 640;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#f4efe2'; rrect(ctx, bx, by, 150, 96, 14); ctx.fill(); ctx.restore();
      ctx.save(); rrect(ctx, bx, by, 150, 96, 14); ctx.clip();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(198,52,42,.85)'; ctx.fillRect(bx + 6 + i * 26, by, 10, 96); }
      for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(42,96,168,.85)'; ctx.fillRect(bx, by + 8 + i * 26, 150, 8); }
      ctx.restore();
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(bx + 75, by + 4, 34, Math.PI, TAU); ctx.stroke();
      // лампочка и пыль в луче
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 18; i++) { const x = 780 + hash(i * 1.9) * 560 + Math.sin(t * 0.4 + i) * 12, y = mod(hash(i * 2.9) * 500 + t * 6, 480) + 150; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.5, 0, TAU); ctx.fill(); }
      const vig = ctx.createLinearGradient(0, 600, 0, 900);
      vig.addColorStop(0, 'rgba(5,8,12,0)'); vig.addColorStop(1, 'rgba(5,8,12,.45)');
      ctx.fillStyle = vig; ctx.fillRect(0, 600, W, 300);
    }

    /** Ночная кухня родителей на Мамбетова. label: tea (по умолчанию) | window (папа у окна, двор готов). */
    drawKitchenNight(ctx, label) {
      const t = this.t, win = label === 'window';
      ctx.fillStyle = vgrad(ctx, 0, 640, [[0, '#3a3a3f'], [1, '#2a2a30']]);
      ctx.fillRect(-30, -30, W + 60, 690);
      ctx.fillStyle = '#4b6a73'; ctx.fillRect(-30, 380, W + 60, 280);                     // плитка
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 380); ctx.lineTo(x, 660); ctx.stroke(); }
      for (let y = 380; y < 660; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = vgrad(ctx, 660, 900, [[0, '#6b4a33'], [1, '#2e1d12']]); ctx.fillRect(-30, 660, W + 60, 260);

      // окно на двор (справа): в нём гирлянды и огоньки двора
      const wx = 1130, wy = 70, ww = 330, wh = 330;
      ctx.fillStyle = '#d9d2c2'; rrect(ctx, wx - 16, wy - 16, ww + 32, wh + 32, 8); ctx.fill();
      ctx.fillStyle = vgrad(ctx, wy, wy + wh, [[0, '#0c1226'], [1, win ? '#5a3f4e' : '#2b2c44']]);
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#10121e'; ctx.fillRect(wx, wy + 230, 120, 100); ctx.fillRect(wx + 190, wy + 200, 140, 130);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = hash(i * 4.1) > 0.4 ? 'rgba(255,214,140,.9)' : 'rgba(255,214,140,.3)'; ctx.fillRect(wx + 12 + (i % 3) * 36, wy + 246 + Math.floor(i / 3) * 26, 9, 12); }
      const cols = ['#ffd27a', '#ff9d6b', '#ffe8a8', '#9fe3d0'];
      for (let i = 0; i < 12; i++) {
        const x = wx + 10 + i * 27, y = wy + 190 + Math.sin(i * 0.9) * 10 + (i > 6 ? 14 : 0);
        glow(ctx, x, y, win ? 24 : 14, cols[i % 4], win ? 0.7 : 0.35);
        ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(70,70,70,.6)'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh);
      ctx.fillStyle = '#b5483c'; rrect(ctx, wx - 20, wy - 4, 56, wh + 8, 4); ctx.fill();      // штора
      ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 4; i++) ctx.fillRect(wx - 16 + i * 12, wy, 3, wh);
      if (win) {
        this.drawFolk(ctx, wx + 250, wy + wh + 8, 1.3, { pose: 'stand', coat: '#c9c0b0', pants: '#35373e', hat: 'none', ph: 0.3, flip: true });
        ctx.fillStyle = 'rgba(20,20,26,.35)'; ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = 'rgba(255,214,140,.14)'; ctx.fillRect(wx, wy, ww, wh);
      }

      // полки, часы, холодильник с магнитами (правый край)
      ctx.fillStyle = '#d6cdbb'; rrect(ctx, 1500, 360, 130, 300, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(1500, 480, 130, 3);
      ['#e84a4a', '#3fd0b6', '#f2b64b', '#8fc9e8'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(1518 + (i % 2) * 40, 400 + Math.floor(i / 2) * 34, 22, 14); });
      ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.arc(960, 190, 36, 0, TAU); ctx.fill();   // часы
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(960, 190, 36, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(960, 190); ctx.lineTo(960, 166); ctx.moveTo(960, 190); ctx.lineTo(978, 198); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(960, 190); ctx.lineTo(960 + Math.cos(t - 1.57) * 30, 190 + Math.sin(t - 1.57) * 30); ctx.stroke();
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(780, 250, 200, 8);                             // полка с банками
      ['#e8a042', '#a24a3d', '#7ea66a', '#d9c36a'].forEach((c, i) => { ctx.fillStyle = c; rrect(ctx, 792 + i * 46, 214, 32, 36, 5); ctx.fill(); ctx.fillStyle = '#e6e0d0'; ctx.fillRect(794 + i * 46, 210, 28, 6); });

      // стол с клеёнкой, лампа сверху, чайник, пиалы, боорсоки
      const lx = 1010;
      ctx.fillStyle = '#26262a'; ctx.fillRect(lx - 2, 0, 4, 280);
      ctx.fillStyle = '#e8c37a'; ctx.beginPath(); ctx.moveTo(lx - 46, 330); ctx.lineTo(lx - 20, 270); ctx.lineTo(lx + 20, 270); ctx.lineTo(lx + 46, 330); ctx.closePath(); ctx.fill();
      glow(ctx, lx, 360, 380, 'rgba(255,214,140,1)', 0.38 + 0.02 * Math.sin(t * 2));
      const cone = ctx.createLinearGradient(0, 330, 0, 740);
      cone.addColorStop(0, 'rgba(255,225,160,.22)'); cone.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(lx - 40, 330); ctx.lineTo(lx + 40, 330); ctx.lineTo(lx + 280, 740); ctx.lineTo(lx - 280, 740); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a3322'; ctx.fillRect(760, 690, 14, 140); ctx.fillRect(1250, 690, 14, 140);
      ctx.fillStyle = '#c0503f'; rrect(ctx, 720, 650, 580, 46, 8); ctx.fill();               // клеёнка в клетку
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let x = 735; x < 1290; x += 40) ctx.fillRect(x, 650, 8, 46);
      for (let i = 0; i < 2; i++) ctx.fillRect(720, 662 + i * 20, 580, 7);
      // чайник, пиалы, боорсоки
      ctx.fillStyle = '#2f6a7a'; rrect(ctx, 1090, 590, 60, 56, 14); ctx.fill(); ctx.fillRect(1146, 606, 26, 6); ctx.fillRect(1074, 596, 18, 6);
      ctx.strokeStyle = '#2f6a7a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(1120, 590, 18, Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,240,240,.25)'; ctx.lineWidth = 5;
      for (let i = 0; i < 2; i++) { const u = mod(t * 0.5 + i * 0.5, 1); ctx.globalAlpha = 0.3 * (1 - u); ctx.beginPath(); ctx.moveTo(1170 + i * 4, 604 - u * 50); ctx.lineTo(1176 + Math.sin(t * 2 + i) * 6 + i * 4, 580 - u * 56); ctx.stroke(); }
      ctx.globalAlpha = 1;
      [[860, '#f2efe6'], [940, '#e2b24d'], [1220, '#f2efe6']].forEach(([px, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(px - 18, 628); ctx.lineTo(px + 18, 628); ctx.quadraticCurveTo(px + 16, 650, px, 652); ctx.quadraticCurveTo(px - 16, 650, px - 18, 628); ctx.fill(); });
      ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.ellipse(1010, 640, 46, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8b04a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(985 + i * 13, 632 - (i % 2) * 5, 9, 7, 0, 0, TAU); ctx.fill(); }

      // мама за столом
      this.drawFolk(ctx, 1210, 724, 1.25, { pose: 'sit', coat: '#7a4a6a', hat: 'scarf', scarf: '#c9833c', ph: 0.5, flip: true });
      const vig = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 900);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }


    /** Школа № 61 в золотой час: пустой двор, турники, кольцо, табличка и розовеющие вершины Ала-Тоо. */
    drawSchoolEvening(ctx) {
      this._forcePhase = 'sunset';
      this.drawSchool(ctx);
      this._forcePhase = null;
      const g = ctx.createLinearGradient(0, 0, 0, 640);
      g.addColorStop(0, 'rgba(255,140,120,.10)'); g.addColorStop(1, 'rgba(255,175,90,.26)');
      ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, 700);
      // вершины ловят закат
      const m = ctx.createLinearGradient(0, 260, 0, 590);
      m.addColorStop(0, 'rgba(255,120,150,.30)'); m.addColorStop(1, 'rgba(255,120,150,0)');
      ctx.fillStyle = m; ctx.fillRect(-30, 260, W + 60, 330);
      // длинные тени от турников и кольца
      const t = this.t;
      ctx.fillStyle = 'rgba(30,20,40,.16)';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(740 + i * 120, 770); ctx.lineTo(1010 + i * 120, 835); ctx.lineTo(1030 + i * 120, 842); ctx.lineTo(760 + i * 120, 775); ctx.fill(); }
      // воробьи на турнике
      ctx.fillStyle = '#4a3f38';
      [[1040, 640], [1110, 640]].forEach(([x, y], i) => { const hop = Math.max(0, Math.sin(t * 3 + i * 2)) * 4; ctx.beginPath(); ctx.ellipse(x, y - 8 - hop, 9, 6, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x + 8, y - 12 - hop, 4, 0, TAU); ctx.fill(); });
      // тёплые пылинки в луче
      ctx.fillStyle = 'rgba(255,225,170,.5)';
      for (let i = 0; i < 20; i++) { const x = mod(hash(i * 3.1) * W + t * 10, W), y = 300 + hash(i * 1.3) * 420 + Math.sin(t + i) * 8; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
    }

    /** Кухня Апы: скалка, круги теста, казан с маслом, банка курута, чайник и старое радио. label: set | tea | '' */
    drawApaKitchen(ctx, label) {
      const t = this.t, set = label === 'set', tea = label === 'tea';
      ctx.fillStyle = vgrad(ctx, 0, 650, [[0, '#e8d3a9'], [1, '#d4aa72']]);
      ctx.fillRect(-30, -30, W + 60, 690);
      ctx.fillStyle = 'rgba(120,70,40,.07)'; for (let x = 0; x < W; x += 52) ctx.fillRect(x, 0, 18, 650);
      ctx.fillStyle = '#5f8a7a'; ctx.fillRect(-30, 420, W + 60, 240);                         // панель
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-30, 418, W + 60, 4);
      ctx.fillStyle = vgrad(ctx, 660, 900, [[0, '#8a5a38'], [1, '#412717']]); ctx.fillRect(-30, 660, W + 60, 260);
      ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 2;
      for (let y = 690; y < 900; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // окно: вечерний двор
      const wx = 1280, wy = 90, ww = 230, wh = 250;
      ctx.fillStyle = '#f2ebdb'; rrect(ctx, wx - 12, wy - 12, ww + 24, wh + 24, 6); ctx.fill();
      ctx.fillStyle = vgrad(ctx, wy, wy + wh, [[0, '#3a3a6a'], [0.55, '#c27a6a'], [1, '#f2b07a']]); ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(wx, wy + 170, 90, 80); ctx.fillRect(wx + 130, wy + 150, 100, 100);
      ctx.fillStyle = 'rgba(70,60,60,.6)'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh);
      ctx.fillStyle = '#b5483c'; rrect(ctx, wx - 18, wy - 4, 40, wh + 8, 4); ctx.fill();       // штора

      // полка: старое радио + часы
      ctx.fillStyle = '#6f4a2c'; ctx.fillRect(780, 290, 300, 10);
      ctx.fillStyle = '#7a4d2c'; rrect(ctx, 810, 214, 130, 78, 8); ctx.fill();                  // радио
      ctx.fillStyle = '#e8d9a8'; rrect(ctx, 822, 226, 70, 38, 4); ctx.fill();
      ctx.fillStyle = '#b5483c'; ctx.fillRect(840, 234, 2, 22);
      ctx.fillStyle = '#2a1d14'; ctx.beginPath(); ctx.arc(916, 238, 10, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(916, 266, 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(930, 214); ctx.lineTo(980, 160); ctx.stroke();   // антенна
      ctx.strokeStyle = 'rgba(255,230,160,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const u = mod(t * 0.6 + i * 0.33, 1); ctx.globalAlpha = 0.6 * (1 - u); ctx.beginPath(); ctx.arc(875, 245, 20 + u * 36, -0.9, 0.9); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.arc(1130, 220, 32, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(1130, 220, 32, 0, TAU); ctx.moveTo(1130, 220); ctx.lineTo(1130, 196); ctx.moveTo(1130, 220); ctx.lineTo(1146, 228); ctx.stroke();

      // плита с казаном: масло шипит
      ctx.fillStyle = '#d6d2c8'; rrect(ctx, 1130, 430, 300, 230, 10); ctx.fill();
      ctx.fillStyle = '#2a2a2c'; rrect(ctx, 1150, 440, 260, 14, 4); ctx.fill();
      const kx = 1280, ky = 440;
      ctx.fillStyle = '#1f2022'; ctx.beginPath(); ctx.ellipse(kx, ky - 44, 78, 24, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(kx - 78, ky - 44); ctx.quadraticCurveTo(kx - 84, ky + 6, kx, ky + 8); ctx.quadraticCurveTo(kx + 84, ky + 6, kx + 78, ky - 44); ctx.fill();
      ctx.fillStyle = '#d99a32'; ctx.beginPath(); ctx.ellipse(kx, ky - 44, 66, 17, 0, 0, TAU); ctx.fill();   // масло
      ctx.fillStyle = 'rgba(255,240,180,.7)';
      for (let i = 0; i < 9; i++) { const bx = kx - 50 + hash(i * 2.2) * 100, by = ky - 46 + Math.sin(t * 6 + i * 1.7) * 3; ctx.beginPath(); ctx.arc(bx, by, 2 + (i % 3), 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#e8a042'; [[-24, -4], [18, 0], [0, 8]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(kx + dx, ky - 46 + dy * 0.4, 18, 8, 0.3, 0, TAU); ctx.fill(); });   // боорсоки в масле
      glow(ctx, kx, ky + 10, 90, '#ff8c3a', set ? 0.1 : 0.32);
      ctx.strokeStyle = 'rgba(240,240,240,.22)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const u = mod(t * 0.4 + i * 0.33, 1); ctx.globalAlpha = 0.3 * (1 - u); ctx.beginPath(); ctx.moveTo(kx - 30 + i * 30, ky - 70 - u * 90); ctx.lineTo(kx - 26 + i * 30 + Math.sin(t + i) * 8, ky - 100 - u * 100); ctx.stroke(); }
      ctx.globalAlpha = 1;

      // стол: клеёнка, тесто, скалка, курут, чайник, пиалы
      const ty = 660;
      ctx.fillStyle = '#4a3322'; ctx.fillRect(740, ty + 30, 14, 150); ctx.fillRect(1080, ty + 30, 14, 150);
      ctx.fillStyle = '#9a6a3c'; rrect(ctx, 700, ty - 6, 420, 40, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(700, ty + 22, 420, 6);
      if (set) {
        ctx.fillStyle = '#efe6d2'; rrect(ctx, 690, ty - 12, 440, 12, 4); ctx.fill();               // скатерть
        [[740, '#e8b04a'], [800, '#c0503f'], [860, '#f3efe2'], [920, '#7ea66a'], [980, '#e8b04a']].forEach(([x, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, ty - 16, 24, 8, 0, 0, TAU); ctx.fill(); });
      } else {
        ctx.fillStyle = '#efe2c2';                                                                    // круги теста
        [[760, 14], [840, 16], [925, 14]].forEach(([x, rr]) => { ctx.beginPath(); ctx.ellipse(x, ty - 12, 38, rr, 0, 0, TAU); ctx.fill(); });
        ctx.fillStyle = 'rgba(0,0,0,.08)'; [[760, 14], [840, 16], [925, 14]].forEach(([x, rr]) => { ctx.beginPath(); ctx.ellipse(x, ty - 8, 38, rr * 0.6, 0, 0, TAU); ctx.fill(); });
        ctx.fillStyle = '#c69456'; rrect(ctx, 960, ty - 22, 130, 14, 7); ctx.fill();              // скалка
        ctx.fillStyle = '#a77838'; ctx.fillRect(950, ty - 18, 12, 6); ctx.fillRect(1086, ty - 18, 12, 6);
        ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(780 + hash(i * 2.7) * 280, ty - 24 + hash(i * 1.9) * 10, 1.8, 0, TAU); ctx.fill(); }  // мука
      }
      // банка белого курута
      ctx.fillStyle = 'rgba(210,235,240,.5)'; rrect(ctx, 1010, ty - 98, 62, 80, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; rrect(ctx, 1010, ty - 98, 62, 80, 10); ctx.stroke();
      ctx.fillStyle = '#f4efe2'; [[1024, -30], [1040, -34], [1056, -30], [1032, -52], [1050, -50], [1040, -70], [1058, -64], [1028, -70]].forEach(([x, dy]) => { ctx.beginPath(); ctx.arc(x + 4, ty + dy, 8, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#b5483c'; rrect(ctx, 1006, ty - 106, 70, 12, 4); ctx.fill();
      // чайник с паром
      ctx.fillStyle = '#2f6a7a'; rrect(ctx, 740, ty - 76, 64, 58, 16); ctx.fill(); ctx.fillRect(798, ty - 58, 28, 6); ctx.fillRect(722, ty - 68, 20, 6);
      ctx.strokeStyle = '#2f6a7a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(772, ty - 76, 20, Math.PI, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,240,240,.25)'; ctx.lineWidth = 5;
      for (let i = 0; i < 2; i++) { const u = mod(t * 0.5 + i * 0.5, 1); ctx.globalAlpha = 0.35 * (1 - u); ctx.beginPath(); ctx.moveTo(828 + i * 4, ty - 66 - u * 50); ctx.lineTo(834 + Math.sin(t * 2 + i) * 6, ty - 92 - u * 58); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (tea) { ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.moveTo(870, ty - 36); ctx.lineTo(912, ty - 36); ctx.quadraticCurveTo(908, ty - 10, 891, ty - 8); ctx.quadraticCurveTo(874, ty - 10, 870, ty - 36); ctx.fill(); }

      // Апа у стола
      this.drawFolk(ctx, 1030, 700, 1.28, { pose: 'stand', coat: '#7a4a6a', hat: 'scarf', scarf: '#c9833c', ph: 0.5, flip: true });
      const vig = ctx.createRadialGradient(W / 2, H / 2, 320, W / 2, H / 2, 920);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.4)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    /** Панорама: холмы над Асанбаем, внизу вечерний город, над ним силуэт Ала-Тоо. Скамейка и двое на ней. */
    drawSouthPanorama(ctx) {
      const t = this.t;
      const sky = ctx.createLinearGradient(0, 0, 0, 560);
      sky.addColorStop(0, '#2b2650'); sky.addColorStop(0.4, '#85507a'); sky.addColorStop(0.72, '#e0806a'); sky.addColorStop(1, '#f9c78a');
      ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, 600);
      glow(ctx, 1250, 470, 300, 'rgba(255,190,120,.9)', 0.45);
      this.stars.forEach((st) => { if (st.y * 0.8 < 250) { ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * st.tw)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.x, st.y * 0.8, st.r, 0, TAU); ctx.fill(); } });
      ctx.globalAlpha = 1;
      drawMountains(ctx, 540, 340, 'dusk');
      const rim = ctx.createLinearGradient(0, 200, 0, 540);
      rim.addColorStop(0, 'rgba(255,130,160,.28)'); rim.addColorStop(1, 'rgba(255,130,160,0)');
      ctx.fillStyle = rim; ctx.fillRect(-30, 200, W + 60, 340);
      // дымка над городом
      const haze = ctx.createLinearGradient(0, 500, 0, 640); haze.addColorStop(0, 'rgba(255,170,130,0)'); haze.addColorStop(1, 'rgba(255,170,130,.35)');
      ctx.fillStyle = haze; ctx.fillRect(-30, 500, W + 60, 140);

      // город внизу: тёмная равнина и огни, Южная магистраль светится линией
      ctx.fillStyle = '#1b1a30'; ctx.fillRect(-30, 600, W + 60, 140);
      for (let i = 0; i < 280; i++) {
        const x = hash(i * 1.37) * W, y = 606 + hash(i * 2.91) * 120;
        const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + hash(i) * 2) + i);
        ctx.fillStyle = (i % 5 === 0 ? 'rgba(255,200,120,' : 'rgba(255,240,200,') + (0.55 * tw + 0.45) + ')';
        ctx.fillRect(x, y, 3 + (i % 3 === 0 ? 2 : 0), 3);
        if (i % 7 === 0) glow(ctx, x + 1, y + 1, 14, 'rgba(255,200,120,1)', 0.35 * tw);
      }
      ctx.strokeStyle = 'rgba(255,205,130,.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, 690); ctx.bezierCurveTo(400, 650, 900, 720, 1620, 640); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,160,110,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(300, 740); ctx.lineTo(560, 610); ctx.moveTo(1000, 740); ctx.lineTo(1180, 612); ctx.stroke();

      // склон переднего плана
      ctx.fillStyle = '#1e1b2a';
      ctx.beginPath(); ctx.moveTo(-30, 900); ctx.lineTo(-30, 760); ctx.quadraticCurveTo(500, 700, 900, 780); ctx.quadraticCurveTo(1300, 840, 1630, 780); ctx.lineTo(1630, 900); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#292437';
      ctx.beginPath(); ctx.moveTo(900, 900); ctx.quadraticCurveTo(1250, 800, 1630, 760); ctx.lineTo(1630, 900); ctx.closePath(); ctx.fill();
      // трава качается на ветру
      ctx.strokeStyle = '#3b3a45'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 90; i++) {
        const x = 900 + hash(i * 3.3) * 760, y = 800 + hash(i * 1.1) * 90 - (x - 900) * 0.04, sw = Math.sin(t * 1.6 + i * 0.7) * 5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw * 0.5, y - 14, x + sw, y - 26 - hash(i) * 10); ctx.stroke();
      }
      // скамейка (правее карточки) и двое
      const bx = 1160, by = 790;
      ctx.fillStyle = '#4a3322'; ctx.fillRect(bx + 10, by - 40, 10, 50); ctx.fillRect(bx + 250, by - 40, 10, 50);
      ctx.fillStyle = '#9a6a3c';
      for (let i = 0; i < 3; i++) rrect(ctx, bx - 6, by - 52 + i * 10, 282, 8, 3), ctx.fill();         // сиденье
      for (let i = 0; i < 3; i++) rrect(ctx, bx, by - 120 + i * 18, 270, 10, 3), ctx.fill();           // спинка
      ctx.fillRect(bx + 10, by - 124, 8, 76); ctx.fillRect(bx + 252, by - 124, 8, 76);
      this.drawFolk(ctx, bx + 80, by - 12, 1.05, { pose: 'sit', coat: '#3a566e', hair: '#1f1a1a', ph: 0.2 });
      this.drawFolk(ctx, bx + 190, by - 12, 1.05, { pose: 'sit', coat: '#6e4a3a', flip: true, ph: 1.1 });
      ctx.fillStyle = '#7a5a3a'; rrect(ctx, bx + 120, by - 66, 20, 30, 6); ctx.fill();                  // рюкзак Эрлана
      // тёплый ветер: лёгкие частицы
      this.leaves.forEach((l, i) => {
        const x = mod(l.x + t * l.sp * 1.4, W + 80) - 40, y = mod(l.y * 0.5 + 520 + Math.sin(t * 0.8 + l.ph) * 20, 380) + 420;
        ctx.globalAlpha = 0.28; ctx.fillStyle = '#f7d9a8'; ctx.beginPath(); ctx.ellipse(x, y, l.s * 0.8, l.s * 0.35, l.ph + t, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const vig = ctx.createLinearGradient(0, 640, 0, 900);
      vig.addColorStop(0, 'rgba(5,6,14,0)'); vig.addColorStop(1, 'rgba(5,6,14,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 640, W, 260);
    }

    /** Старый двор частного сектора: арык в каменной обшивке, корявый урюк, тапчан с курпачами, самовар. variant: dusk | live | tape | sleep. */
    drawOldCenterCourtyard(ctx, variant) {
      const t = this.t;
      const sleep = variant === 'sleep';
      // вечернее небо
      const sky = ctx.createLinearGradient(0, 0, 0, 560);
      sky.addColorStop(0, '#2d2a55'); sky.addColorStop(0.45, '#8a5576'); sky.addColorStop(0.8, '#e58a6a'); sky.addColorStop(1, '#f7c286');
      ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, 600);
      glow(ctx, 1300, 470, 280, 'rgba(255,190,120,.85)', 0.4);
      this.stars.forEach((st) => { if (st.y * 0.8 < 220) { ctx.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(t * st.tw)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.x, st.y * 0.8, st.r, 0, TAU); ctx.fill(); } });
      ctx.globalAlpha = 1;
      drawMountains(ctx, 520, 240, 'dusk');

      // глинобитный дом с деревянным окном (справа) и забор (слева)
      ctx.fillStyle = '#d9c7a4'; ctx.fillRect(1040, 250, 600, 360);
      ctx.fillStyle = '#7a4a2c'; ctx.fillRect(1030, 236, 620, 24);                                  // крыша
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 14; i++) ctx.fillRect(1030 + i * 44, 236, 3, 24);
      ctx.fillStyle = '#4a3322'; ctx.fillRect(1260, 330, 120, 150);                                   // окно
      ctx.fillStyle = sleep ? 'rgba(255,214,140,.35)' : 'rgba(255,214,140,.9)'; ctx.fillRect(1270, 340, 100, 130);
      ctx.fillStyle = '#4a3322'; ctx.fillRect(1316, 340, 8, 130); ctx.fillRect(1270, 400, 100, 8);
      ctx.fillStyle = '#b5483c'; ctx.fillRect(1262, 332, 26, 146);                                    // занавеска
      glow(ctx, 1320, 410, 130, 'rgba(255,200,120,1)', sleep ? 0.12 : 0.35);
      ctx.fillStyle = '#6a4a2c'; ctx.fillRect(1500, 400, 90, 210); ctx.fillStyle = '#3a281a'; ctx.fillRect(1510, 410, 70, 200);   // дверь
      ctx.fillStyle = '#9a8a74'; ctx.fillRect(-30, 480, 1070, 130);                                   // каменный забор
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 22; c++) ctx.fillRect(c * 52 + (r % 2) * 26, 486 + r * 30, 48, 26);
      ctx.fillStyle = '#7a6a54'; ctx.fillRect(-30, 474, 1070, 10);

      // земля двора
      ctx.fillStyle = vgrad(ctx, 600, 900, [[0, '#6a5a44'], [1, '#2c2620']]); ctx.fillRect(-30, 600, W + 60, 320);

      // арык в каменной обшивке вдоль двора
      ctx.fillStyle = '#8f8a7e'; ctx.fillRect(-30, 770, W + 60, 52);
      ctx.fillStyle = '#6a665c'; for (let c = 0; c < 36; c++) ctx.fillRect(c * 46, 770 + (c % 2) * 3, 40, 10);
      ctx.fillStyle = '#1f3a4a'; ctx.fillRect(-30, 782, W + 60, 28);
      ctx.strokeStyle = 'rgba(200,230,245,.6)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 26; i++) { const x = mod(i * 70 - t * 52, W + 100) - 40, y = 788 + (i % 4) * 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 28, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,200,130,.18)'; ctx.fillRect(900, 782, 260, 28);                       // блик заката на воде

      // корявый урюк
      const tx = 1000, tb = 740;
      ctx.save(); ctx.translate(tx, tb);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 4, 90, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a2d24'; ctx.lineCap = 'round';
      ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-26, -90, 14, -170); ctx.stroke();
      ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(10, -150); ctx.quadraticCurveTo(80, -200, 130, -250); ctx.stroke();
      ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(6, -140); ctx.quadraticCurveTo(-70, -190, -120, -230); ctx.stroke();
      const sway = Math.sin(t * 0.7) * 2;
      [[-110, -260, 70], [-30, -300, 80], [70, -300, 76], [140, -270, 64], [10, -240, 70]].forEach((b, i) => {
        ctx.fillStyle = i % 2 ? '#4f6f45' : '#5d7f4e'; ctx.beginPath(); ctx.arc(b[0] + sway * (1 + i * 0.12), b[1], b[2], 0, TAU); ctx.fill();
      });
      ctx.fillStyle = '#e8a042';
      for (let i = 0; i < 14; i++) { const a = hash(i * 3.3) * TAU, r = 30 + hash(i * 1.7) * 100; ctx.beginPath(); ctx.arc(10 + Math.cos(a) * r * 1.3, -270 + Math.sin(a) * r * 0.7, 5, 0, TAU); ctx.fill(); }
      ctx.restore();

      // тапчан с курпачами и самовар
      const px = 1060, py = 760;
      ctx.fillStyle = '#4a3322'; [px + 6, px + 300].forEach((lx) => ctx.fillRect(lx, py, 12, 44));
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#9a6a3c'; rrect(ctx, px - 14, py - 20, 340, 28, 4); ctx.fill(); ctx.restore();
      const kc = ['#b5483c', '#e2b24d', '#2f6a7a', '#7a4a6a', '#c9833c'];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = kc[i]; rrect(ctx, px - 6 + i * 64, py - 38, 64, 22, 8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(px - 2 + i * 64, py - 34, 56, 3); }
      ctx.fillStyle = '#d4a53a'; rrect(ctx, px + 232, py - 92, 42, 56, 12); ctx.fill();               // латунный самовар
      ctx.fillStyle = '#b9892a'; ctx.fillRect(px + 238, py - 100, 30, 10); ctx.fillRect(px + 218, py - 74, 18, 6);
      ctx.fillStyle = '#a6761f'; ctx.fillRect(px + 246, py - 108, 14, 10);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(px + 238, py - 88, 6, 40);
      ctx.strokeStyle = 'rgba(240,240,240,.25)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) { const u = mod(t * 0.45 + i * 0.5, 1); ctx.globalAlpha = 0.32 * (1 - u); ctx.beginPath(); ctx.moveTo(px + 254 + i * 4, py - 112 - u * 40); ctx.lineTo(px + 260 + Math.sin(t * 2 + i) * 5, py - 138 - u * 44); ctx.stroke(); }
      ctx.globalAlpha = 1;
      [[px + 160, '#f2efe6'], [px + 196, '#e2b24d']].forEach(([x, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 10, py - 52); ctx.lineTo(x + 10, py - 52); ctx.quadraticCurveTo(x + 9, py - 38, x, py - 37); ctx.quadraticCurveTo(x - 9, py - 38, x - 10, py - 52); ctx.fill(); });

      // люди и предметы по варианту
      if (sleep) {
        this.drawFolk(ctx, px + 100, py - 36, 1.05, { pose: 'sleep' });
      } else if (variant === 'live') {
        this.drawFolk(ctx, px + 120, py - 20, 1.1, { pose: 'sit', coat: '#3a566e', ph: 0.4 });
        ctx.strokeStyle = '#7a4a2c'; ctx.lineWidth = 9; ctx.lineCap = 'round';                          // комуз
        ctx.beginPath(); ctx.moveTo(px + 150, py - 78); ctx.lineTo(px + 230, py - 120 + Math.sin(t * 6) * 1.5); ctx.stroke();
        ctx.fillStyle = '#7a4a2c'; ctx.beginPath(); ctx.ellipse(px + 146, py - 70, 20, 14, -0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,230,170,.8)'; ['♪', '♫', '♪'].forEach((n, i) => { const u = mod(t * 0.5 + i * 0.33, 1); ctx.globalAlpha = 0.8 * (1 - u); ctx.font = '700 26px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(n, px + 230 + i * 20 + Math.sin(t + i) * 10, py - 140 - u * 100); });
        ctx.globalAlpha = 1;
        this.drawFolk(ctx, px + 20, 740, 1.0, { pose: 'stand', coat: '#7a4a6a', hat: 'scarf', scarf: '#c9833c', ph: 2 });
      } else if (variant === 'tape') {
        ctx.fillStyle = '#2a2a2e'; rrect(ctx, px + 40, py - 66, 96, 40, 6); ctx.fill();              // магнитофон
        ctx.fillStyle = '#8a8a90'; ctx.beginPath(); ctx.arc(px + 66, py - 46, 12, 0, TAU); ctx.arc(px + 108, py - 46, 12, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a1a1c'; ctx.beginPath(); ctx.arc(px + 66 + Math.cos(t * 2) * 3, py - 46 + Math.sin(t * 2) * 3, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff6c9'; ctx.save(); ctx.translate(px + 60, py - 28); ctx.rotate(-0.08); ctx.fillRect(0, 0, 56, 22); ctx.restore();   // записка
      }
      if (variant === 'dusk') this.drawFolk(ctx, px + 240, py - 20, 1.05, { pose: 'sit', coat: '#6b4f3a', hat: 'kalpak', flip: true, ph: 1.2 });

      // гирлянда от дома к дереву
      if (!sleep) this.drawStringLights(ctx, [[1040, 280], [1000, 440], [1090, 520]], 1, true);
      // листья и дымка
      this.leaves.forEach((l) => {
        const x = mod(l.x + t * l.sp * 0.5, W + 80) - 40, y = mod(l.y + t * 6 + Math.sin(t * 0.8 + l.ph) * 18, H + 60) - 30;
        ctx.globalAlpha = 0.22; ctx.fillStyle = '#f0c98a'; ctx.beginPath(); ctx.ellipse(x, y, l.s, l.s * 0.45, l.ph + t, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (sleep) { ctx.fillStyle = 'rgba(10,14,36,.3)'; ctx.fillRect(0, 0, W, H); }
      const vig = ctx.createLinearGradient(0, 600, 0, 900); vig.addColorStop(0, 'rgba(5,6,12,0)'); vig.addColorStop(1, 'rgba(5,6,12,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 600, W, 300);
    }

    /** Уголок памяти: магнитофон, кассеты, комуз на стене, рамка со снимком из ателье «Фрунзе», пыль в луче света. */
    drawMemoryCorner(ctx) {
      const t = this.t;
      ctx.fillStyle = vgrad(ctx, 0, 650, [[0, '#d9bf92'], [1, '#c29a66']]); ctx.fillRect(-30, -30, W + 60, 690);
      ctx.fillStyle = 'rgba(120,70,40,.08)'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, 0, 22, 650);
      ctx.fillStyle = '#6a4228'; ctx.fillRect(-30, 590, W + 60, 70);
      ctx.fillStyle = vgrad(ctx, 660, 900, [[0, '#7a4a2c'], [1, '#3a2214']]); ctx.fillRect(-30, 660, W + 60, 260);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (let y = 690; y < 900; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // ковёр на полу
      ctx.fillStyle = '#8c2f2a'; rrect(ctx, 760, 760, 640, 110, 10); ctx.fill();
      ctx.strokeStyle = '#e2b24d'; ctx.lineWidth = 4; rrect(ctx, 774, 772, 612, 86, 6); ctx.stroke();
      ctx.fillStyle = '#1f3a5a'; for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(850 + i * 100, 815); ctx.rotate(Math.PI / 4); ctx.fillRect(-14, -14, 28, 28); ctx.restore(); }

      // окно слева-направо: луч света
      const wx = 1180, wy = 70, ww = 260, wh = 300;
      ctx.fillStyle = '#f2ebdb'; rrect(ctx, wx - 12, wy - 12, ww + 24, wh + 24, 6); ctx.fill();
      ctx.fillStyle = vgrad(ctx, wy, wy + wh, [[0, '#ffe2a8'], [1, '#ffd08a']]); ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(120,90,60,.6)'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + wh / 2 - 3, ww, 6);
      const ray = ctx.createLinearGradient(wx + 100, wy, wx - 360, 760);
      ray.addColorStop(0, 'rgba(255,225,160,.5)'); ray.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(wx, wy + 20); ctx.lineTo(wx + ww, wy + 20); ctx.lineTo(wx + 40, 780); ctx.lineTo(wx - 520, 780); ctx.closePath(); ctx.fill();

      // комуз на стене
      ctx.save(); ctx.translate(900, 220); ctx.rotate(-0.2);
      ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.ellipse(0, 70, 44, 66, 0, 0, TAU); ctx.fill();
      ctx.fillRect(-10, -150, 20, 160);
      ctx.fillStyle = '#6a4222'; ctx.fillRect(-14, -170, 28, 30);
      ctx.strokeStyle = '#efe4cc'; ctx.lineWidth = 1.5; [-4, 0, 4].forEach((dx) => { ctx.beginPath(); ctx.moveTo(dx, -150); ctx.lineTo(dx * 3, 120); ctx.stroke(); });
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 40, 14, 18, 0, 0, TAU); ctx.fill();
      ctx.restore();
      // рамка со снимком «Фрунзе»
      ctx.fillStyle = '#5a3a22'; rrect(ctx, 1010, 120, 120, 150, 4); ctx.fill();
      ctx.fillStyle = '#d9cdb0'; ctx.fillRect(1020, 130, 100, 130);
      ctx.fillStyle = '#9a8a70'; ctx.fillRect(1030, 140, 80, 74);
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.arc(1056, 176, 9, 0, TAU); ctx.arc(1086, 178, 9, 0, TAU); ctx.fill(); ctx.fillRect(1048, 186, 16, 28); ctx.fillRect(1078, 188, 16, 26);
      ctx.fillStyle = '#7a6a54'; ctx.font = '700 9px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ФРУНЗЕ', 1070, 240);

      // тумба с магнитофоном и кассетами
      ctx.fillStyle = '#6f4a2c'; rrect(ctx, 880, 530, 420, 90, 6); ctx.fill(); ctx.fillRect(890, 620, 14, 60); ctx.fillRect(1276, 620, 14, 60);
      ctx.fillStyle = '#2a2a2e'; rrect(ctx, 930, 440, 220, 90, 8); ctx.fill();
      ctx.fillStyle = '#9a9aa0'; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(990 + i * 100, 482, 24, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a1a1c'; ctx.beginPath(); ctx.arc(990 + i * 100 + Math.cos(t * 2 + i) * 4, 482 + Math.sin(t * 2 + i) * 4, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#9a9aa0'; }
      ctx.fillStyle = '#c0c0c8'; ['#e84a4a', '#3fd0b6', '#f2b64b'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(950 + i * 24, 515, 18, 8); });
      // россыпь кассет на тумбе и на полу
      [[1180, 510, 0.2, '#b5483c'], [1220, 516, -0.15, '#2f6a7a'], [1160, 534, 0.08, '#e2b24d']].forEach(([x, y, r, c]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.fillStyle = c; ctx.fillRect(-30, -19, 60, 38); ctx.fillStyle = '#efe4cc'; ctx.fillRect(-22, -10, 44, 14); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-10, -3, 4, 0, TAU); ctx.arc(10, -3, 4, 0, TAU); ctx.fill(); ctx.restore(); });
      [[1000, 790, 0.3, '#e2b24d'], [1090, 820, -0.2, '#2f6a7a'], [1250, 800, 0.15, '#b5483c']].forEach(([x, y, r, c]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.fillStyle = c; ctx.fillRect(-28, -18, 56, 36); ctx.fillStyle = '#efe4cc'; ctx.fillRect(-20, -9, 40, 13); ctx.restore(); });
      // полка с коробками кассет
      ctx.fillStyle = '#6a4228'; ctx.fillRect(1320, 470, 280, 10);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#b5483c', '#2f6a7a', '#e2b24d', '#7a4a6a', '#3f7a4a'][i % 5]; ctx.fillRect(1330 + i * 28, 410 + (i % 3) * 4, 22, 60 - (i % 3) * 4); }

      // пылинки в луче
      ctx.fillStyle = 'rgba(255,240,200,.75)';
      for (let i = 0; i < 36; i++) { const u = hash(i * 2.3), x = 700 + u * 640 + Math.sin(t * 0.5 + i) * 14, y = mod(hash(i * 1.1) * 600 + t * (6 + (i % 5) * 2), 560) + 120; ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t + i)); ctx.beginPath(); ctx.arc(x, y, 1.4 + (i % 3) * 0.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      const vig = ctx.createRadialGradient(W / 2, H / 2, 320, W / 2, H / 2, 920); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.4)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }

    /** Площадь Ала-Тоо в сумерках: фонтаны у ЦУМа, огни, голуби и тёмные Ала-Тоо. label «alone» — фонтаны тише и проезжает машина. */
    drawAlaTooTwilight(ctx, label) {
      const t = this.t, alone = label === 'alone';
      const sky = ctx.createLinearGradient(0, 0, 0, 560);
      sky.addColorStop(0, '#120f2e'); sky.addColorStop(0.4, '#3a2a5a'); sky.addColorStop(0.75, '#9a5a78'); sky.addColorStop(1, '#e0906e');
      ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, 600);
      this.stars.forEach((st) => { ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * st.tw)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(st.x, st.y * 0.55, st.r, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
      glow(ctx, 1250, 520, 320, 'rgba(255,150,110,.8)', 0.3);
      drawMountains(ctx, 560, 330, 'night');
      // фасад ЦУМа
      const bx = 880, bw = 640, by = 270;
      ctx.fillStyle = '#cdbfa6'; ctx.fillRect(bx, by, bw, 340);
      ctx.fillStyle = '#8a7a64'; ctx.fillRect(bx - 12, by - 14, bw + 24, 18);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
        const lit = hash(r * 7 + c * 3.1) > 0.3;
        ctx.fillStyle = lit ? 'rgba(255,214,140,.92)' : 'rgba(70,80,110,.9)'; rrect(ctx, bx + 22 + c * 62, by + 30 + r * 70, 38, 48, 3); ctx.fill();
      }
      ctx.fillStyle = '#243a5a'; rrect(ctx, bx + 130, by + 252, 380, 58, 8); ctx.fill();
      ctx.fillStyle = '#f7f4ea'; ctx.textAlign = 'center'; this.fitText(ctx, 'ЦУМ · АЙЧУРЕК', 800, 34, 340, bx + 320, by + 292);
      glow(ctx, bx + 320, by + 282, 160, 'rgba(255,230,170,1)', 0.18);
      // площадь и плитка
      ctx.fillStyle = vgrad(ctx, 600, 900, [[0, '#4a4658'], [1, '#1f1d28']]); ctx.fillRect(-30, 600, W + 60, 320);
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2;
      for (let y = 640; y < 900; y += 44) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let x = -40; x < W + 60; x += 120) { ctx.beginPath(); ctx.moveTo(x, 600); ctx.lineTo(x - 90 + (x / W) * 180, 900); ctx.stroke(); }
      // фонтаны: чаши и струи с подсветкой
      [[1000, 700, 1], [1260, 720, 1.1], [1500, 700, 0.95]].forEach(([fx, fy, s], k) => {
        ctx.fillStyle = '#7c7a8a'; ctx.beginPath(); ctx.ellipse(fx, fy + 20, 110 * s, 26 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = alone ? '#3a4a6a' : '#4f78a8'; ctx.beginPath(); ctx.ellipse(fx, fy + 12, 98 * s, 20 * s, 0, 0, TAU); ctx.fill();
        const h = (alone ? 40 : 90) * s;
        for (let j = -2; j <= 2; j++) {
          const sway = Math.sin(t * 2 + j + k) * 3;
          ctx.strokeStyle = 'rgba(210,235,255,' + (alone ? 0.4 : 0.7) + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(fx + j * 12 * s, fy + 8); ctx.quadraticCurveTo(fx + j * 24 * s + sway, fy - h - Math.abs(j) * 6, fx + j * 38 * s, fy + 10); ctx.stroke();
        }
        const col = ['#8fc9e8', '#f2b64b', '#ff9d8f'][k];
        glow(ctx, fx, fy + 10, 110 * s, col, alone ? 0.18 : 0.38);
      });
      // фонари
      [[900, 640], [1130, 646], [1390, 640], [1600, 650]].forEach(([lx, ly]) => { ctx.fillStyle = '#2a2a32'; ctx.fillRect(lx - 3, ly - 150, 6, 150); glow(ctx, lx, ly - 156, 60, 'rgba(255,214,150,1)', 0.55); ctx.fillStyle = '#ffe2a8'; ctx.beginPath(); ctx.arc(lx, ly - 156, 8, 0, TAU); ctx.fill(); });
      // голуби
      [[960, 790, 0], [1030, 810, 1], [1330, 800, 2], [1450, 815, 3], [1230, 830, 4]].forEach(([x, y, i]) => {
        const peck = Math.max(0, Math.sin(t * 2.2 + i * 1.7)) * 6, px = x + Math.sin(t * 0.4 + i) * 10;
        ctx.fillStyle = '#8a8a96'; ctx.beginPath(); ctx.ellipse(px, y - peck * 0.3, 13, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6a6a78'; ctx.beginPath(); ctx.arc(px + 12, y - 8 + peck, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d9a040'; ctx.fillRect(px + 16, y - 8 + peck, 4, 2);
      });
      if (alone) {                                                       // проезжает машина с открытым окном
        const cx = mod(t * 90, W + 700) - 350;
        drawCar(ctx, cx, 880, 1.15, 1, '#5a6a88', 'car', t);
        ctx.fillStyle = 'rgba(255,230,170,.7)'; ['♪', '♫'].forEach((n, i) => { ctx.font = '700 24px Inter, sans-serif'; ctx.globalAlpha = 0.6; ctx.fillText(n, cx + 20 + i * 24, 820 - Math.sin(t * 3 + i) * 8); });
        ctx.globalAlpha = 1;
      }
      const vig = ctx.createLinearGradient(0, 640, 0, 900); vig.addColorStop(0, 'rgba(5,6,14,0)'); vig.addColorStop(1, 'rgba(5,6,14,.5)');
      ctx.fillStyle = vig; ctx.fillRect(0, 640, W, 260);
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

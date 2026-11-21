/* ==========================================================================
   «Один день в Бишкеке» — процедурные звуки Web Audio API.
   Ни одного обязательного внешнего файла: всё синтезируется на лету.
   Фоновые слои: двор, лестница, дом, улица, рынок, дождь.
   Комуз — синтез Карплуса-Стронга; для живой записи см. BD.KOMUZ_URL.
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* Настроение фона: громкость шумовой подложки, тембр и живой комуз. */
  const AMBIENCE = {
    home: { gain: 0.042, freq: 380, q: 0.7, komuz: false },
    courtyard: { gain: 0.052, freq: 880, q: 0.5, komuz: true },
    stairwell: { gain: 0.030, freq: 460, q: 0.9, komuz: true },
    market: { gain: 0.060, freq: 1150, q: 0.42, komuz: false },
    street: { gain: 0.056, freq: 700, q: 0.36, komuz: false },
    breeze: { gain: 0.050, freq: 560, q: 0.3, komuz: true },
    day: { gain: 0.034, freq: 980, q: 0.45, komuz: false }
  };

  class AudioFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuf = null;
      this.muted = false;
      this.lastHover = 0;
      this.volume = 0.7;
      this.ambienceName = null;
      this.rainOn = false;
      this.amb = null;
      this.rainGain = null;
      this.komuzTimer = 0;
      this.komuzBuffers = {};
      this.komuzFile = null;
      try { this.muted = root.localStorage.getItem('bd_muted') === '1'; } catch (e) { /* ignore */ }
      try {
        const v = parseFloat(root.localStorage.getItem('bd_volume') || '0.7');
        this.volume = clamp(isFinite(v) ? v : 0.7, 0, 1);
      } catch (e) { this.volume = 0.7; }
      if (BD.KOMUZ_URL) this.useKomuzFile(BD.KOMUZ_URL);
    }

    ensure() {
      if (!this.ctx) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return false;
        try {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : this.volume * 0.7;
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.value = -18;
          comp.knee.value = 20;
          comp.ratio.value = 4;
          this.master.connect(comp);
          comp.connect(this.ctx.destination);
        } catch (e) { this.ctx = null; return false; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }

    /* ------------------------------ громкость ------------------------------ */

    setVolume(v) {
      this.volume = clamp(Number(v) || 0, 0, 1);
      try { root.localStorage.setItem('bd_volume', String(this.volume)); } catch (e) { /* ignore */ }
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.7, this.ctx.currentTime, 0.05);
      }
      this.syncKomuzFile();
    }

    setMuted(m) {
      this.muted = !!m;
      try { root.localStorage.setItem('bd_muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.7, this.ctx.currentTime, 0.02);
      }
      this.syncKomuzFile();
    }

    toggle() {
      this.setMuted(!this.muted);
      if (!this.muted) this.play('click');
      return this.muted;
    }

    /* --------------------------- короткие звуки ---------------------------- */

    tone(o) {
      if (!this.ensure()) return;
      const c = this.ctx;
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.15;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, o.freq), t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol || 0.15), t0 + (o.attack || 0.008));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let node = osc;
      if (o.lp) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.lp;
        osc.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.06);
    }

    noise(o) {
      if (!this.ensure()) return;
      const c = this.ctx;
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.35;
      if (!this.noiseBuf) {
        const len = Math.floor(c.sampleRate * 1.2);
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = o.q || 1.1;
      f.frequency.setValueAtTime(o.from || 500, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to || 2400), t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol || 0.06), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + dur + 0.05);
    }

    play(name) {
      if (this.muted || !name) return;
      if (!this.ensure()) return;
      const now = performance.now();
      if (name === 'hover') {
        if (now - this.lastHover < 75) return;
        this.lastHover = now;
      }
      switch (name) {
        case 'hover':
          this.tone({ freq: 1180, to: 1420, type: 'sine', dur: 0.055, vol: 0.028, attack: 0.003 });
          break;
        case 'click':
          this.tone({ freq: 520, to: 700, type: 'triangle', dur: 0.08, vol: 0.09, attack: 0.004 });
          this.tone({ freq: 1040, type: 'sine', dur: 0.06, vol: 0.035, delay: 0.025 });
          break;
        case 'next':
          this.tone({ freq: 380, to: 620, type: 'sine', dur: 0.14, vol: 0.08 });
          this.tone({ freq: 760, to: 980, type: 'triangle', dur: 0.12, vol: 0.05, delay: 0.06 });
          break;
        case 'coin':
          [0, 0.07, 0.14].forEach((d, i) => {
            this.tone({ freq: 880 * Math.pow(1.5, i), type: 'triangle', dur: 0.18, vol: 0.11, delay: d });
          });
          this.tone({ freq: 2640, type: 'sine', dur: 0.22, vol: 0.03, delay: 0.14 });
          break;
        case 'alert':
          this.tone({ freq: 196, to: 160, type: 'sine', dur: 0.32, vol: 0.12 });
          this.tone({ freq: 392, to: 330, type: 'sine', dur: 0.22, vol: 0.05, delay: 0.06 });
          break;
        case 'success':
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this.tone({ freq: f, type: 'triangle', dur: 0.45, vol: 0.09, delay: i * 0.085 });
          });
          this.noise({ dur: 0.35, vol: 0.025, from: 2400, to: 800 });
          break;
        case 'fail':
          this.tone({ freq: 220, to: 110, type: 'sawtooth', dur: 0.55, vol: 0.07, lp: 700 });
          this.tone({ freq: 164, to: 82, type: 'sine', dur: 0.7, vol: 0.1, delay: 0.08 });
          this.noise({ dur: 0.5, vol: 0.03, from: 900, to: 140 });
          break;
        case 'soft':
          this.tone({ freq: 392, to: 330, type: 'sine', dur: 0.7, vol: 0.065 });
          this.tone({ freq: 261.63, type: 'triangle', dur: 0.95, vol: 0.045, delay: 0.12 });
          this.tone({ freq: 523.25, type: 'sine', dur: 1.2, vol: 0.022, delay: 0.28 });
          break;
        case 'whoosh':
          this.noise({ dur: 0.45, vol: 0.045, from: 320, to: 2200, q: 0.8 });
          break;
        case 'badge':
          this.tone({ freq: 1046.5, type: 'sine', dur: 0.28, vol: 0.07 });
          this.tone({ freq: 1568, type: 'sine', dur: 0.3, vol: 0.045, delay: 0.09 });
          this.tone({ freq: 2093, type: 'sine', dur: 0.35, vol: 0.03, delay: 0.17 });
          break;
        default:
          break;
      }
    }

    /* ------------------------------ фоновые слои --------------------------- */

    buildAmbience() {
      if (!this.ctx || this.amb) return;
      const c = this.ctx;
      const len = Math.floor(c.sampleRate * 4);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700;
      f.Q.value = 0.45;
      const g = c.createGain();
      g.gain.value = 0.0001;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      this.amb = { src, filter: f, gain: g };
    }

    buildRain() {
      if (!this.ctx || this.rainGain) return;
      const c = this.ctx;
      const len = Math.floor(c.sampleRate * 2);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1400;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 6200;
      const g = c.createGain();
      g.gain.value = 0.0001;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.master);
      src.start();
      this.rainGain = g;
    }

    setRain(on) {
      this.rainOn = !!on;
      if (!this.ctx) return;
      if (this.rainOn) this.buildRain();
      if (this.rainGain) {
        this.rainGain.gain.setTargetAtTime(this.rainOn ? 0.035 : 0.0001, this.ctx.currentTime, 0.8);
      }
    }

    setAmbience(name, opts) {
      opts = opts || {};
      const rain = !!opts.rain;
      if (name === this.ambienceName && rain === this.rainOn) return;
      this.ambienceName = name;
      this.rainOn = rain;
      if (!this.ensure()) return;
      this.buildAmbience();
      if (this.rainOn) this.buildRain();
      const cfg = name ? AMBIENCE[name] : null;
      const t0 = this.ctx.currentTime;
      if (this.amb) {
        this.amb.gain.gain.cancelScheduledValues(t0);
        this.amb.gain.gain.setTargetAtTime(cfg ? cfg.gain : 0.0001, t0, 0.9);
        if (cfg) {
          this.amb.filter.frequency.setTargetAtTime(cfg.freq, t0, 1.2);
          this.amb.filter.Q.setTargetAtTime(cfg.q, t0, 1.2);
        }
      }
      if (this.rainGain) {
        this.rainGain.gain.setTargetAtTime(this.rainOn ? 0.035 : 0.0001, t0, 0.8);
      }
      this.scheduleKomuz(!!(cfg && cfg.komuz));
    }

    /* ------------------------- комуз: щипковая струна ---------------------- */

    komuzBuffer(freq) {
      const key = Math.round(freq * 100);
      if (this.komuzBuffers[key]) return this.komuzBuffers[key];
      const c = this.ctx;
      const sr = c.sampleRate;
      const len = Math.floor(sr * 1.5);
      const buf = c.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const N = Math.max(2, Math.round(sr / freq));
      const ring = new Float32Array(N);
      for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
      let idx = 0;
      let prev = 0;
      for (let i = 0; i < len; i++) {
        const cur = ring[idx];
        const nxt = 0.9965 * 0.5 * (cur + prev);
        ring[idx] = nxt;
        prev = cur;
        d[i] = cur * 0.55;
        idx = (idx + 1) % N;
      }
      this.komuzBuffers[key] = buf;
      return buf;
    }

    pluck(freq, delay, vol) {
      if (!this.ctx || !this.master) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.komuzBuffer(freq);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2600;
      const g = c.createGain();
      g.gain.value = vol || 0.06;
      src.connect(f); f.connect(g); g.connect(this.master);
      const t0 = c.currentTime + (delay || 0);
      src.start(t0);
      src.stop(t0 + 1.55);
    }

    /* Пентатоника: спокойный мотив, который не спорит с текстом. */
    scheduleKomuz(on) {
      if (this.komuzFile) {
        this.syncKomuzFile(on);
        return;
      }
      if (!on) {
        clearTimeout(this.komuzTimer);
        this.komuzTimer = 0;
        return;
      }
      if (this.komuzTimer) return;
      const notes = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
      const motif = [0, 2, 3, 2, 1, 0, 2, 4, 3, 2];
      const tick = () => {
        this.komuzTimer = 0;
        const cfg = this.ambienceName && AMBIENCE[this.ambienceName];
        if (!cfg || !cfg.komuz) return;
        if (!this.muted) {
          const start = Math.floor(Math.random() * motif.length);
          const count = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            this.pluck(notes[motif[(start + i) % motif.length]], 0.06 + i * 0.44, 0.05);
          }
        }
        this.komuzTimer = setTimeout(tick, 2800 + Math.random() * 3000);
      };
      this.komuzTimer = setTimeout(tick, 1200);
    }

    /* Замена синтеза на настоящую запись: BD.KOMUZ_URL = 'audio/komuz.ogg'. */
    useKomuzFile(url) {
      if (!url) return;
      try {
        this.komuzFile = new root.Audio(url);
        this.komuzFile.loop = true;
        this.komuzFile.preload = 'auto';
        this.komuzFile.volume = 0;
      } catch (e) { this.komuzFile = null; }
    }

    syncKomuzFile(want) {
      if (!this.komuzFile) return;
      const on = want === undefined
        ? !!(this.ambienceName && AMBIENCE[this.ambienceName] && AMBIENCE[this.ambienceName].komuz)
        : !!want;
      this.komuzFile.volume = this.muted ? 0 : this.volume * 0.32;
      if (on && !this.muted) {
        const p = this.komuzFile.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        this.komuzFile.pause();
      }
    }
  }

  BD.AudioFX = AudioFX;
})(typeof window !== 'undefined' ? window : globalThis);

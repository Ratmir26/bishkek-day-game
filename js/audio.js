/* ==========================================================================
   «Один день в Бишкеке» — процедурные звуки Web Audio API.
   Ни одного внешнего файла: всё синтезируется на лету.
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});

  class AudioFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuf = null;
      this.muted = false;
      this.lastHover = 0;
      try { this.muted = root.localStorage.getItem('bd_muted') === '1'; } catch (e) { /* ignore */ }
      // Настройки: общая громкость, атмосфера и музыкальный мотив включаются отдельно.
      this.settings = { volume: 0.8, ambient: true, music: true };
      try {
        const saved = JSON.parse(root.localStorage.getItem('bd_audio') || 'null');
        if (saved && typeof saved === 'object') {
          if (typeof saved.volume === 'number') this.settings.volume = Math.min(1, Math.max(0, saved.volume));
          if (typeof saved.ambient === 'boolean') this.settings.ambient = saved.ambient;
          if (typeof saved.music === 'boolean') this.settings.music = saved.music;
        }
      } catch (e) { /* ignore */ }
      this.amb = null;            // граф атмосферы создаётся лениво
      this.profile = 'off';
      this.rain = false;
      this.sched = null;
      this.pluckCache = {};
      this.tracks = Object.assign({}, BD.AUDIO_TRACKS || {});
      this.trackEl = null;
      this.drone = null;
    }

    level() { return this.muted ? 0 : 0.5 * this.settings.volume / 0.8; }

    ensure() {
      if (!this.ctx) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return false;
        try {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.level();
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

    setMuted(m) {
      this.muted = !!m;
      try { root.localStorage.setItem('bd_muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.02);
      }
    }

    toggle() {
      this.setMuted(!this.muted);
      if (this.amb || this.ctx) this.applyAmbient();
      if (this.muted) { this.stopTrack(); this.stopDrone(); }
      if (!this.muted) this.play('click');
      return this.muted;
    }

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

    /* ------------------------------------------------------------------ */
    /* Настройки                                                            */
    /* ------------------------------------------------------------------ */
    saveSettings() {
      try { root.localStorage.setItem('bd_audio', JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
    }

    setVolume(v) {
      this.settings.volume = Math.min(1, Math.max(0, v));
      this.saveSettings();
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.03);
    }

    setAmbientOn(on) {
      this.settings.ambient = !!on;
      this.saveSettings();
      this.applyAmbient();
    }

    setMusicOn(on) {
      this.settings.music = !!on;
      if (!on) this.stopDrone();
      this.saveSettings();
      if (!on) this.stopTrack();
    }

    /* ------------------------------------------------------------------ */
    /* Атмосфера: слои шума + редкие события (сверчки, птицы, часы)         */
    /* ------------------------------------------------------------------ */
    buildAmbient() {
      if (this.amb || !this.ensure()) return;
      const c = this.ctx;
      const len = Math.floor(c.sampleRate * 4);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {            // коричневый шум: мягкий, без «шипения»
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
      const wbuf = c.createBuffer(1, len, c.sampleRate);
      const wd = wbuf.getChannelData(0);
      for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;

      const bus = c.createGain();
      bus.gain.value = 0;
      bus.connect(this.master);
      const layer = (buffer, filters, lfo) => {
        const src = c.createBufferSource();
        src.buffer = buffer; src.loop = true;
        let node = src;
        filters.forEach((f) => {
          const b = c.createBiquadFilter();
          b.type = f[0]; b.frequency.value = f[1]; if (f[2]) b.Q.value = f[2];
          node.connect(b); node = b;
        });
        const g = c.createGain();
        g.gain.value = 0;
        node.connect(g); g.connect(bus);
        if (lfo) {                                // медленная «дышащая» модуляция громкости слоя
          const o = c.createOscillator(); o.frequency.value = lfo[0];
          const og = c.createGain(); og.gain.value = lfo[1];
          o.connect(og); og.connect(g.gain); o.start();
        }
        src.start(0, Math.random() * 3);
        return g;
      };
      this.amb = {
        bus,
        layers: {
          hum: layer(buf, [['lowpass', 180]]),
          city: layer(buf, [['lowpass', 520]], [0.07, 0.01]),
          wind: layer(buf, [['lowpass', 900], ['highpass', 90]], [0.11, 0.012]),
          rain: layer(wbuf, [['highpass', 1500], ['lowpass', 7500]], [0.05, 0.01]),
          murmur: layer(buf, [['bandpass', 520, 0.9]], [3.6, 0.012]),
          water: layer(wbuf, [['bandpass', 2600, 1.6]], [9, 0.006]),
          muffled: layer(buf, [['bandpass', 340, 0.8]], [2.4, 0.007])
        }
      };
    }

    ambientTargets() {
      const P = {
        off: {},
        room: { hum: 0.05 },
        city: { city: 0.15, hum: 0.04 },
        courtyard: { wind: 0.06, murmur: 0.055, water: 0.02, hum: 0.02, crickets: 1 },
        kitchen: { hum: 0.05, muffled: 0.03, clock: 1 },
        stairwell: { hum: 0.05, muffled: 0.035 },
        park: { wind: 0.07, hum: 0.015, birds: 1 },
        aryk: { water: 0.07, wind: 0.035, hum: 0.01, crickets: 1 },
        hill: { wind: 0.1, hum: 0.01, crickets: 1 },
        market: { murmur: 0.08, city: 0.06, hum: 0.02 }
      };
      const t = Object.assign({}, P[this.profile] || {});
      if (this.rain) t.rain = (t.rain || 0) + 0.07;
      return t;
    }

    applyAmbient() {
      if (!this.settings.ambient || this.muted) { if (this.amb) this.amb.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); this.stopSched(); return; }
      if (!this.ensure()) return;
      this.buildAmbient();
      if (!this.amb) return;
      const c = this.ctx, tg = this.ambientTargets();
      this.amb.bus.gain.setTargetAtTime(0.9, c.currentTime, 0.4);
      Object.keys(this.amb.layers).forEach((k) => {
        this.amb.layers[k].gain.setTargetAtTime(tg[k] || 0, c.currentTime, 0.9);
      });
      if (tg.crickets || tg.birds || tg.clock) this.startSched(tg); else this.stopSched();
    }

    /** profile: room | city | courtyard | kitchen | stairwell | park | market | off; rain: добавляет дождь поверх. */
    setAmbient(profile, rain) {
      if (profile === this.profile && !!rain === this.rain) return;
      this.profile = profile || 'off';
      this.rain = !!rain;
      if (this.ctx || this.settings.ambient) this.applyAmbient();
    }

    startSched(tg) {
      this.stopSched();
      let tick = 0;
      this.sched = root.setInterval(() => {
        if (this.muted || !this.settings.ambient || !this.ctx) return;
        tick++;
        const c = this.ctx;
        if (tg.crickets && tick % 2 === 0) {        // сверчки: быстрые пачки тонких писков
          const f = 4300 + Math.random() * 500, base = c.currentTime + Math.random() * 0.2;
          for (let i = 0; i < 3; i++) this.cue({ freq: f, dur: 0.05, vol: 0.011, delay: base - c.currentTime + i * 0.09, type: 'sine' });
        }
        if (tg.birds && tick % 5 === 0 && Math.random() < 0.7) {
          const f0 = 2300 + Math.random() * 1400;
          this.cue({ freq: f0, to: f0 * 1.4, dur: 0.12, vol: 0.016, type: 'sine' });
          this.cue({ freq: f0 * 1.3, to: f0 * 0.9, dur: 0.1, vol: 0.013, delay: 0.14, type: 'sine' });
        }
        if (tg.clock && tick % 4 === 0) {            // часы на кухне
          this.cue({ freq: 1500, dur: 0.03, vol: 0.016, type: 'square', lp: 2200 });
        }
      }, 250);
    }

    stopSched() {
      if (this.sched) { root.clearInterval(this.sched); this.sched = null; }
    }

    /** Тихий звук для атмосферы: идёт мимо SFX-ограничений hover и не требует включённого play(). */
    cue(o) { this.tone(o); }

    /* ------------------------------------------------------------------ */
    /* Мотив «щипковая струна» (Karplus–Strong) и хук для реального трека  */
    /* ------------------------------------------------------------------ */
    pluckBuffer(freq) {
      const key = Math.round(freq * 10);
      if (this.pluckCache[key]) return this.pluckCache[key];
      const c = this.ctx, sr = c.sampleRate, n = Math.floor(sr * 2.4);
      const period = Math.max(2, Math.round(sr / freq));
      const buf = c.createBuffer(1, n, sr);
      const d = buf.getChannelData(0);
      const ring = new Float32Array(period);
      for (let i = 0; i < period; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / period * Math.PI));
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const next = (idx + 1) % period;
        const v = ring[idx];
        d[i] = v;
        ring[idx] = (v + ring[next]) * 0.4985;   // усреднение даёт затухание «струны»
        idx = next;
      }
      this.pluckCache[key] = buf;
      return buf;
    }

    pluck(freq, delay, vol) {
      if (!this.ensure()) return;
      const c = this.ctx, t0 = c.currentTime + (delay || 0);
      const src = c.createBufferSource();
      src.buffer = this.pluckBuffer(freq);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const g = c.createGain();
      g.gain.setValueAtTime(vol || 0.22, t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 2.3);
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start(t0);
    }

    /** Мотив: nostalgia (грустно-светлый), warm (короткий), bata (тихий бурдон), lullaby (колыбельная). */
    playMotif(name) {
      if (this.muted || !this.settings.music) return;
      if (this.tracks[name]) { this.playTrack(name); return; }
      if (!this.ensure()) return;
      // Минорная пентатоника от ре: D F G A C
      const N = { D3: 146.8, F3: 174.6, G3: 196, A3: 220, C4: 261.6, D4: 293.7, F4: 349.2, G4: 392, A4: 440 };
      const M = {
        nostalgia: [['D4', 0], ['F4', 0.7], ['A3', 1.5], ['G3', 2.4], ['A3', 3.1], ['C4', 3.9], ['D4', 4.9], ['A3', 6.2]],
        warm: [['A3', 0], ['D4', 0.55], ['F4', 1.1], ['D4', 1.9]],
        bata: [['D3', 0], ['A3', 0.9], ['D4', 2.2]],
        lullaby: [['F4', 0], ['D4', 0.9], ['C4', 1.8], ['A3', 2.8], ['G3', 4.0], ['D3', 5.5]]
      };
      (M[name] || M.warm).forEach((n, i) => this.pluck(N[n[0]], n[1], 0.2 - Math.min(i, 5) * 0.01));
      if (name === 'bata') {                        // низкий тянущийся тон под бату
        this.tone({ freq: 73.4, dur: 5.5, vol: 0.05, attack: 1.2, lp: 400 });
      }
    }

    /** Тёплый дрон под мотивом на экране открытки: ре-минорная квинта с октавой, медленное «дыхание», плавный вход и выход. */
    startDrone() {
      if (this.drone || this.muted || !this.settings.music || !this.ensure()) return;
      const c = this.ctx, t0 = c.currentTime;
      const out = c.createGain(); out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(0.085, t0 + 3.5);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2.2;   // резонанс «пустого» корпуса
      lp.connect(out); out.connect(this.master);
      const lfo = c.createOscillator(), lfoG = c.createGain();
      lfo.frequency.value = 0.11; lfoG.gain.value = 140; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(t0);
      const oscs = [lfo];
      [[73.4, 'sine', 0.55], [110, 'sine', 0.38], [146.8, 'triangle', 0.22], [174.6, 'sine', 0.12], [220.4, 'sine', 0.09], [73.9, 'triangle', 0.2]].forEach(([f, type, v]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = f; g.gain.value = v;
        o.connect(g); g.connect(lp); o.start(t0); oscs.push(o);
      });
      this.drone = { out, oscs };
    }

    stopDrone() {
      const d = this.drone;
      if (!d) return;
      this.drone = null;
      const c = this.ctx, t = c.currentTime;
      d.out.gain.cancelScheduledValues(t);
      d.out.gain.setValueAtTime(Math.max(0.0001, d.out.gain.value), t);
      d.out.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      d.oscs.forEach((o) => { try { o.stop(t + 1.8); } catch (e) { /* ignore */ } });
    }

    /** Подключить реальную запись комуза: BD.AUDIO_TRACKS = { nostalgia: 'audio/komuz.mp3' } до загрузки audio.js. */
    registerTrack(name, url) { this.tracks[name] = url; }

    playTrack(name) {
      this.stopTrack();
      try {
        const el = new root.Audio(this.tracks[name]);
        el.volume = Math.min(1, this.settings.volume * 0.8);
        el.addEventListener('error', () => { delete this.tracks[name]; this.playMotif(name); });
        this.trackEl = el;
        const r = el.play();
        if (r && r.catch) r.catch(() => { delete this.tracks[name]; this.playMotif(name); });
      } catch (e) { delete this.tracks[name]; }
    }

    stopTrack() {
      if (this.trackEl) { try { this.trackEl.pause(); } catch (e) { /* ignore */ } this.trackEl = null; }
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
  }

  BD.AudioFX = AudioFX;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==========================================================================
   «Один день в Бишкеке» — машина состояний и контроллер интерфейса.
   Часть 1 — Engine (без DOM). Часть 2 — UI (только в браузере).
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const { CONFIG, EVENTS, BADGES, VERDICTS, ENDINGS, STATUS, DISTRICTS } = BD;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const val = (v, ...args) => (typeof v === 'function' ? v(...args) : v);
  const TAU = Math.PI * 2;

  function fmtTime(m) {
    m = Math.round(m);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  function fmtMoney(n) {
    const x = Math.round(Math.abs(n));
    return (n < 0 ? '−' : '') + x.toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  }
  function fmtSigned(n) {
    return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  }

  /* ====================================================================== */
  /*  СОСТОЯНИЕ                                                             */
  /* ====================================================================== */

  /* Флаги можно писать и как camelCase, и как snake_case: helped_neighbor == helpedNeighbor. */
  const FLAG_ALIAS = { stuck_in_chuy_traffic: 'stuckInTraffic' };
  function flagKey(f) {
    if (typeof f !== 'string') return f;
    if (FLAG_ALIAS[f]) return FLAG_ALIAS[f];
    return f.indexOf('_') > 0 ? f.replace(/_([a-z0-9])/g, (m, c) => c.toUpperCase()) : f;
  }

  class GameState {
    constructor() { this.reset(); }

    reset() {
      this.budget = CONFIG.startMoney;
      this.energy = CONFIG.startEnergy;
      this.stress = CONFIG.startStress;
      this.time = CONFIG.dayStart;
      this.flags = new Map();
      this.vars = { district: null, caffeinated: false, weather: 'clear' };
      this.ledger = [];
      this.history = [];
      this.stressLog = [{ t: this.time, v: this.stress, label: 'Старт' }];
      this.energyLog = [{ t: this.time, v: this.energy }];
      this.eventIndex = 0;
      this.maxStress = this.stress;
      this.saved = 0;
      this.endTime = null;
      this.entered = new Set();
      this.district = null;
      this.debt = 0;              // «в долг» после исчерпанных сюжетных разворотов
      this.queue = [];            // очередь сюжетных разворотов (fail-forward)
      this.pivotsUsed = new Set();
      this.injected = null;       // событие-разворот, которое сейчас на экране
      this.bonds = {};            // отношения с людьми маршрута: bakyt, apa, aksakal, parents…
      this.memories = new Set();  // предметы памяти: note, kurut, photo, cassette…
    }

    clone() {
      const c = new GameState();
      c.budget = this.budget;
      c.energy = this.energy;
      c.stress = this.stress;
      c.time = this.time;
      c.flags = new Map(this.flags);
      c.vars = Object.assign({}, this.vars);
      c.ledger = this.ledger.slice();
      c.history = this.history.slice();
      c.stressLog = this.stressLog.slice();
      c.energyLog = this.energyLog.slice();
      c.eventIndex = this.eventIndex;
      c.maxStress = this.maxStress;
      c.saved = this.saved;
      c.endTime = this.endTime;
      c.entered = new Set(this.entered);
      c.district = this.district;
      c.debt = this.debt;
      c.queue = this.queue.slice();
      c.pivotsUsed = new Set(this.pivotsUsed);
      c.injected = this.injected;
      c.bonds = Object.assign({}, this.bonds);
      c.memories = new Set(this.memories);
      return c;
    }

    bond(name) { return this.bonds[name] || 0; }
    addBond(name, d) { this.bonds[name] = Math.max(0, Math.min(5, this.bond(name) + d)); }
    hasItem(name) { return this.memories.has(name); }
    giveItem(name) { this.memories.add(name); }

    has(f) { return this.flags.has(flagKey(f)); }
    set(f) { this.flags.set(flagKey(f), null); }
    clear(f) { this.flags.delete(flagKey(f)); }

    getVar(name, fallback) {
      return this.vars[name] === undefined ? fallback : this.vars[name];
    }

    setVar(name, value) {
      this.vars[name] = value;
    }

    applyVars(vars) {
      if (!vars) return;
      const out = typeof vars === 'function' ? (vars(this) || {}) : vars;
      Object.keys(out).forEach((k) => { this.vars[k] = out[k]; });
    }

    get spent() { return this.ledger.reduce((a, e) => a + (e.amount < 0 ? -e.amount : 0), 0); }
    get earned() { return this.ledger.reduce((a, e) => a + (e.amount > 0 ? e.amount : 0), 0); }

    addStats(fx) {
      if (!fx) return;
      if (fx.money) this.budget += fx.money;
      if (fx.energy) this.energy = clamp(this.energy + fx.energy, 0, 100);
      if (fx.stress) this.stress = clamp(this.stress + fx.stress, 0, 100);
      if (fx.saved) this.saved += fx.saved;
      if (fx.debt) this.debt += fx.debt;
      this.maxStress = Math.max(this.maxStress, this.stress);
    }
  }

  /* ====================================================================== */
  /*  ДВИЖОК                                                                */
  /* ====================================================================== */

  class Engine {
    constructor() {
      this.state = new GameState();
      this.summary = null;
    }

    start(districtId) {
      this.state.reset();
      this.summary = null;
      const district = BD.getDistrict(districtId) || BD.getDistrict(BD.DEFAULT_DISTRICT);
      if (district) {
        const s = this.state;
        s.district = district.id;
        s.vars.district = district.id;
        s.vars.locationStart = district.id;
        s.budget = district.start.money;
        s.energy = district.start.energy;
        s.stress = district.start.stress;
        s.maxStress = district.start.stress;
        s.stressLog = [{ t: s.time, v: s.stress, label: 'Старт · ' + district.name }];
        s.energyLog = [{ t: s.time, v: s.energy }];
      }
      // первое событие тоже должно подходить району (у районов свои стартовые сцены)
      while (this.state.eventIndex < EVENTS.length - 1 && !this.isActive(this.eventAt(this.state.eventIndex))) this.state.eventIndex++;
      this.enterCurrent();
    }

    get event() {
      if (this.state.injected) return this.state.injected;
      return BD.applyDistrict(EVENTS[this.state.eventIndex], this.state.district) || null;
    }

    eventAt(index) {
      return BD.applyDistrict(EVENTS[index], this.state.district) || null;
    }

    /** Событие попадает в день, если подходит район, есть нужные флаги и нет запрещённых. */
    isActive(ev) {
      if (!ev) return false;
      const s = this.state;
      if (ev.districts && ev.districts.indexOf(s.district) < 0) return false;
      if (ev.excludeDistricts && ev.excludeDistricts.indexOf(s.district) >= 0) return false;
      if (ev.requiredFlags && !ev.requiredFlags.every((f) => s.has(f))) return false;
      if (ev.forbiddenFlags && ev.forbiddenFlags.some((f) => s.has(f))) return false;
      return !ev.when || !!ev.when(s);
    }

    activeEvents() {
      const list = [];
      for (let i = 0; i < EVENTS.length; i++) {
        const ev = this.eventAt(i);
        if (this.isActive(ev)) list.push({ index: i, event: ev });
      }
      return list;
    }

    progress() {
      const list = this.activeEvents();
      const at = list.findIndex((item) => item.index === this.state.eventIndex);
      const s = this.state;
      const pendingPivot = !!s.injected || s.queue.length > 0;
      return {
        index: at >= 0 ? at : 0,
        total: list.length,
        isLast: at >= 0 && !pendingPivot ? at === list.length - 1 : false
      };
    }

    enterCurrent() {
      const s = this.state;
      const ev = this.event;
      if (!ev) return;
      if (s.time < ev.time) s.time = ev.time;
      if (!s.entered.has(ev.id)) {
        s.entered.add(ev.id);
        (ev.setsFlags || []).forEach((f) => s.set(f));
        if (typeof ev.onEnter === 'function') ev.onEnter(s, this);
        s.stressLog.push({ t: s.time, v: s.stress, label: ev.kicker || ev.id });
        s.energyLog.push({ t: s.time, v: s.energy });
      }
    }

    resolveChoice(ch, state) {
      const s = state || this.state;
      const fx = typeof ch.fx === 'function' ? (ch.fx(s) || {}) : (ch.fx || {});
      const minutes = typeof ch.minutes === 'function' ? ch.minutes(s) : (ch.minutes || 0);
      const locked = (typeof ch.when === 'function' ? !ch.when(s) : false) ||
        (ch.requiredFlags ? !ch.requiredFlags.every((f) => s.has(f)) : false) ||
        (ch.forbiddenFlags ? ch.forbiddenFlags.some((f) => s.has(f)) : false);
      // Строгая проверка бюджета: платный выбор недоступен, если денег не хватает.
      const bonds = typeof ch.bonds === 'function' ? (ch.bonds(s) || {}) : (ch.bonds || {});
      const items = typeof ch.items === 'function' ? (ch.items(s) || []) : (ch.items || []);
      const cost = fx.money < 0 ? -fx.money : 0;
      const unaffordable = cost > Math.max(0, s.budget);
      const lockReason = unaffordable && !locked
        ? 'Нужно ' + cost + ' сом, а у вас ' + Math.max(0, Math.round(s.budget))
        : (val(ch.lockReason, s) || 'Этот вариант сейчас недоступен.');
      return {
        choice: ch,
        title: val(ch.title, s),
        desc: val(ch.desc, s),
        fx,
        minutes,
        locked: locked || unaffordable,
        unaffordable,
        cost,
        bonds,
        items,
        lockReason
      };
    }

    choose(choiceId) {
      const ev = this.event;
      if (!ev) return null;
      const ch = ev.choices.find((c) => c.id === choiceId);
      if (!ch) return null;
      const resolved = this.resolveChoice(ch);
      if (resolved.locked) return null;

      const s = this.state;
      const before = s.clone();

      s.addStats(resolved.fx);
      if (resolved.fx.money) {
        s.ledger.push({
          label: resolved.title,
          amount: resolved.fx.money,
          event: ev.id
        });
      }

      const flags = (typeof ch.flags === 'function' ? ch.flags(s) : (ch.flags || []))
        .concat(ch.setsFlags || []);
      flags.filter(Boolean).forEach((f) => s.set(f));
      const clear = typeof ch.clear === 'function' ? ch.clear(s) : (ch.clear || []);
      clear.filter(Boolean).forEach((f) => s.clear(f));
      s.applyVars(ch.vars);
      Object.keys(resolved.bonds).forEach((k) => s.addBond(k, resolved.bonds[k]));
      resolved.items.forEach((it) => s.giveItem(it));

      s.time = Math.min(CONFIG.dayEnd, s.time + resolved.minutes);
      s.history.push({
        eventId: ev.id,
        choiceId: ch.id,
        label: resolved.title,
        minutes: resolved.minutes,
        fx: resolved.fx
      });
      s.stressLog.push({ t: s.time, v: s.stress, label: resolved.title });
      s.energyLog.push({ t: s.time, v: s.energy });

      let result = typeof ch.result === 'function'
        ? ch.result(s, resolved, before)
        : (ch.result || '');

      // Fail-forward: сюжетный разворот, который выбор запросил сам (пропущенная маршрутка и т. п.)
      const wanted = typeof ch.pivot === 'function' ? ch.pivot(s) : ch.pivot;
      if (wanted && !s.pivotsUsed.has(wanted)) s.queue.push(wanted);

      // Fail-forward: деньги кончились. Первый раз — разворот района, дальше — «записали в долг».
      if (s.budget < 0) {
        if (!s.pivotsUsed.has('broke') && s.queue.indexOf('broke') < 0) {
          s.queue.push('broke');
        } else if (!s.queue.length || s.queue.indexOf('broke') < 0) {
          s.debt += -s.budget;
          s.budget = 0;
          s.set('inDebt');
          s.stress = clamp(s.stress + 6, 0, 100);
          s.maxStress = Math.max(s.maxStress, s.stress);
          result += (result ? ' ' : '') + 'Касса не приняла карту, но знакомый продавец махнул рукой: ' +
            '«Потом занесёшь». Долг записан в тетрадку, а стресс — в вас.';
        }
      }

      const ending = this.detectGameOver();
      return { resolved, result, ending, before };
    }

    next() {
      const s = this.state;
      s.injected = null;
      while (s.queue.length) {
        const kind = s.queue.shift();
        if (kind === 'broke' && s.budget >= 0) continue;
        const ev = BD.findPivot ? BD.findPivot(kind, s.district) : null;
        if (!ev) continue;
        s.pivotsUsed.add(kind);
        s.set('pivotUsed');
        s.injected = ev;
        this.enterCurrent();
        return { done: false, event: this.event, pivot: true };
      }
      for (let i = s.eventIndex + 1; i < EVENTS.length; i++) {
        const ev = this.eventAt(i);
        if (!this.isActive(ev)) continue;
        s.eventIndex = i;
        this.enterCurrent();
        return { done: false, event: this.event };
      }
      this.finish();
      return { done: true, summary: this.summary };
    }

    detectGameOver() {
      if (this.state.stress >= 100) return 'burnout';
      if (this.state.energy <= 0) return 'exhaustion';
      return null;
    }

    finish() {
      const s = this.state;
      s.endTime = Math.min(s.time, CONFIG.dayEnd);
      s.time = CONFIG.dayEnd;
      s.stressLog.push({ t: CONFIG.dayEnd, v: s.stress, label: 'Итоги дня' });
      s.energyLog.push({ t: CONFIG.dayEnd, v: s.energy });
      const badges = BADGES.map((b) => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        desc: b.desc,
        unlocked: !!b.test(s)
      }));
      const score = this.calculateScore(s);
      const verdict = VERDICTS.find((v) => score >= v.min) || VERDICTS[VERDICTS.length - 1];
      const district = BD.getDistrict(s.district);
      const place = s.vars.shoppingPlace ? ' → ' + s.vars.shoppingPlace : '';
      const route = district ? district.name + place + ' → дом' : '—';
      this.summary = {
        budget: s.budget,
        spent: s.spent,
        earned: s.earned,
        saved: s.saved,
        stressPeak: s.maxStress,
        stress: s.stress,
        energy: s.energy,
        endTime: s.endTime,
        score,
        verdict,
        badges,
        unlocked: badges.filter((b) => b.unlocked).length,
        stressLog: s.stressLog,
        ledger: s.ledger,
        history: s.history,
        eventsPlayed: s.history.length,
        district,
        route,
        routeEnding: BD.pickRouteEnding ? BD.pickRouteEnding(s) : null,
        memories: Array.from(s.memories),
        bonds: Object.assign({}, s.bonds)
      };
      return this.summary;
    }

    calculateScore(s) {
      const wealth = clamp((s.budget + s.saved - s.debt) / 4000, 0, 1) * 40;
      const thrift = clamp(s.saved / 600, 0, 1) * 10;
      const calm = clamp((100 - s.maxStress) / 100, 0, 1) * 25;
      const energy = clamp(s.energy / 100, 0, 1) * 15;
      const latePenalty = Math.max(0, s.endTime - (20 * 60 + 50)) / 6;
      const time = clamp(10 - latePenalty, 0, 10);
      const life =
        (s.has('schoolPaid') ? 1 : 0) +
        (s.has('utilitiesPaid') ? 1 : 0) +
        (s.has('familyTime') ? 1 : 0) +
        ((s.has('visitedParents') || s.has('pickedUpKids') || s.has('calledParents') || s.has('helpedRelative')) ? 1 : 0) +
        (s.has('weatherReady') ? 1 : 0);
      return Math.round(clamp(wealth + thrift + calm + energy + time + life, 0, 100));
    }
  }

  BD.GameState = GameState;
  BD.Engine = Engine;
  BD.fmtTime = fmtTime;
  BD.fmtMoney = fmtMoney;
  BD.fmtSigned = fmtSigned;

  /* ====================================================================== */
  /*  UI                                                                    */
  /* ====================================================================== */
  if (typeof document === 'undefined') return;

  const ICONS = {
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9h6M9 12h6M12 7.5v9"/>',
    bolt: '<path d="M13 2 4.5 13.5H10L9 22l8.5-12H12l1-8Z"/>',
    pulse: '<path d="M2 12h4l2.5-6.5L13 18l2.5-6H22"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 5 6M22 9l-5 6"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M10 21v-6h4v6"/>',
    road: '<path d="M8 21 10 3M16 21 14 3"/><path d="M12 5v3M12 11v3M12 17v3"/>',
    office: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
    bazaar: '<path d="M4 10h16l-2-6H6l-2 6Z"/><path d="M5 10v10h14V10"/><path d="M9 20v-5h6v5"/>',
    night: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/><path d="M17 4v3M15.5 5.5h3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"/>',
    shield: '<path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    heart: '<path d="M20.5 8.5c0 5-8.5 10-8.5 10S3.5 13.5 3.5 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 2.5Z"/>',
    bread: '<path d="M5 11c0-3 3-5 7-5s7 2 7 5c0 2-1 3-3 3v6H8v-6c-2 0-3-1-3-3Z"/><path d="M8 14h8M8 17h8"/>',
    coffee: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7 2v3M11 2v3"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 9h18M16 14h2"/>',
    restart: '<path d="M3 11a9 9 0 1 1 2 6"/><path d="M3 5v6h6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    mountain: '<path d="m2.5 19 6.2-9.5 3.4 5 2.4-3 7 7.5H2.5Z"/><path d="m7.5 11.5 1.4 1.6 1.5-2.4"/>',
    school: '<path d="m12 3 9 4-9 4-9-4 9-4Z"/><path d="M7 9v5c0 1.7 2.2 3 5 3s5-1.3 5-3V9"/><path d="M21 7v6"/>',
    umbrella: '<path d="M12 3a9 9 0 0 0-9 9h18a9 9 0 0 0-9-9Z"/><path d="M12 12v6a2.5 2.5 0 0 0 5 0"/>',
    bus: '<rect x="4" y="4" width="16" height="13" rx="3"/><path d="M4 10h16M8 17v3M16 17v3M8 8h.01M16 8h.01"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || ICONS.star) + '</svg>';
  }

  const $ = (id) => document.getElementById(id);
  const dom = {};
  let engine = null;
  let renderer = null;
  let audio = null;
  let locked = false;
  let pending = null;
  let bestScore = 0;

  function cacheDom() {
    [
      'intro', 'district', 'districtGrid', 'districtBackBtn', 'play', 'summary', 'gameover', 'hud',
      'sceneChip', 'chipIcon', 'chipPlace', 'chipTime',
      'muteBtn', 'muteIcon', 'startBtn', 'introBest', 'eventCard', 'eventKicker', 'eventProgress',
      'eventTitle', 'eventText', 'statusRow', 'choices', 'choiceHint', 'consequence',
      'consequenceText', 'applied', 'nextBtn', 'floatLayer',
      'moneyValue', 'moneyBar', 'energyValue', 'energyBar', 'stressValue', 'stressBar',
      'timeValue', 'timeBar', 'summaryScore', 'summaryScoreRing', 'summaryVerdictTitle',
      'summaryVerdictText', 'sumBudget', 'sumSpent', 'sumEarned', 'sumSaved', 'sumPeak',
      'sumEnergy', 'sumHome', 'sumRoute', 'sumEvents', 'summaryBadges', 'summaryBadgeCount', 'stressChart',
      'bestLabel', 'playAgainBtn', 'districtBtn', 'menuBtn', 'gameoverIcon', 'gameoverKicker',
      'gameoverTitle', 'gameoverText', 'gameoverTip', 'goBudget', 'goEnergy', 'goStress',
      'goTime', 'restartBtn', 'goDistrictBtn', 'goMenuBtn', 'goLast',
      'audioBtn', 'audioPanel', 'volRange', 'ambCheck', 'musCheck', 'glossTip', 'vignetteBar',
      'postcard', 'pcCard', 'pcKicker', 'pcTitle', 'pcText', 'pcItems', 'pcBata', 'pcTip', 'pcStamp',
      'pcNextBtn', 'pcAgainBtn', 'pcDistrictBtn', 'pcMenuBtn'
    ].forEach((id) => { dom[id] = $(id); });
  }

  function showScreen(name) {
    if (name !== 'postcard' && audio && audio.stopDrone) audio.stopDrone();
    if (!dom.intro) return;
    dom.intro.hidden = name !== 'intro';
    dom.district.hidden = name !== 'district';
    dom.play.hidden = name !== 'play';
    dom.summary.hidden = name !== 'summary';
    dom.gameover.hidden = name !== 'gameover';
    dom.postcard.hidden = name !== 'postcard';
    dom.hud.hidden = name !== 'play';
    dom.sceneChip.hidden = name !== 'play';
    document.body.dataset.screen = name;
  }

  function updateMuteUI() {
    const muted = audio ? audio.muted : false;
    dom.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    dom.muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    dom.muteIcon.innerHTML = icon(muted ? 'mute' : 'sound');
  }

  function toggleMute() {
    if (!audio) return;
    audio.toggle();
    updateMuteUI();
  }

  function updateSceneChip() {
    if (!engine || !engine.event) return;
    const ev = engine.event;
    dom.chipPlace.textContent = ev.place;
    dom.chipTime.textContent = fmtTime(engine.state.time);
    const map = { home: 'home', traffic: 'road', office: 'office', bazaar: 'bazaar', evening: 'night', school: 'school',
      courtyard: 'home', stairwell: 'home', kitchen_night: 'coffee', apa_kitchen: 'coffee', parents_home: 'heart', mall: 'bag', park: 'sun',
      school_evening: 'school', south_panorama: 'mountain',
      old_center_courtyard: 'home', memory_corner: 'heart', alatoo_twilight: 'night' };
    dom.chipIcon.innerHTML = icon(map[ev.scene] || 'sun');
  }

  /* --------------------------- выбор района ---------------------------- */

  function deltaTone(delta, lowerIsBetter) {
    if (!delta) return '';
    const good = lowerIsBetter ? delta < 0 : delta > 0;
    return good ? ' good' : ' bad';
  }

  function renderDistricts() {
    if (!dom.districtGrid) return;
    dom.districtGrid.innerHTML = '';
    DISTRICTS.forEach((d, idx) => {
      const moneyDelta = d.start.money - CONFIG.startMoney;
      const energyDelta = d.start.energy - CONFIG.startEnergy;
      const stressDelta = d.start.stress - CONFIG.startStress;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'district-card';
      card.dataset.districtId = d.id;
      card.style.animationDelay = (idx * 80) + 'ms';
      card.setAttribute('aria-label', 'Выбрать район ' + d.name);
      card.innerHTML =
        '<span class="district-top">' +
          '<span class="district-num">' + String(idx + 1).padStart(2, '0') + '</span>' +
          '<span class="district-ico">' + icon(d.icon) + '</span>' +
          '<span class="district-micro">' + d.micro + '</span>' +
        '</span>' +
        '<span class="district-name">' + d.name + '</span>' +
        '<span class="district-tagline">' + d.tagline + '</span>' +
        '<span class="district-desc">' + d.description + '</span>' +
        '<span class="district-stats">' +
          '<span class="dstat' + deltaTone(moneyDelta, false) + '"><b>' + fmtMoney(d.start.money) + '</b>' +
            '<small>сом' + (moneyDelta ? ' ' + fmtSigned(moneyDelta) : '') + '</small></span>' +
          '<span class="dstat' + deltaTone(energyDelta, false) + '"><b>' + d.start.energy + '%</b>' +
            '<small>энергия' + (energyDelta ? ' ' + fmtSigned(energyDelta) : '') + '</small></span>' +
          '<span class="dstat' + deltaTone(stressDelta, true) + '"><b>' + d.start.stress + '%</b>' +
            '<small>стресс' + (stressDelta ? ' ' + fmtSigned(stressDelta) : '') + '</small></span>' +
        '</span>' +
        '<span class="district-commute">' + d.commute + '</span>' +
        '<span class="district-chips">' +
          d.chips.map((c) => '<span class="dchip ' + (c.tone || '') + '">' + c.text + '</span>').join('') +
        '</span>' +
        '<span class="district-highlights">' +
          d.highlights.map((h) => '<span class="dhighlight">' + h + '</span>').join('') +
        '</span>' +
        '<span class="district-pick"><span>Выбрать район</span>' + icon('arrow') + '</span>';

      card.addEventListener('mouseenter', () => audio && audio.play('hover'));
      card.addEventListener('focus', () => audio && audio.play('hover'));
      card.addEventListener('click', () => startGame(d.id));
      dom.districtGrid.appendChild(card);
    });
  }

  function goDistrict() {
    if (!dom.district) return;
    audio && audio.play('whoosh');
    showScreen('district');
    document.body.dataset.tone = 'teal';
    renderer.setScene('traffic');
    renderer.setTime(CONFIG.dayStart - 10);
    setTimeout(() => {
      const first = dom.districtGrid && dom.districtGrid.querySelector('.district-card');
      if (first) first.focus({ preventScroll: true });
    }, 260);
  }

  function currentDistrictId() {
    return engine && engine.state && engine.state.district ? engine.state.district : null;
  }

  /* -------------------------- HUD ------------------------------------- */

  const hud = { money: null, energy: null, stress: null, time: null };

  function numberTween(el, to, fmt, duration) {
    if (!el) return;
    const from = typeof el._val === 'number' ? el._val : to;
    el._val = to;
    if (el._raf) cancelAnimationFrame(el._raf);
    const start = performance.now();
    const dur = duration || 620;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (to - from) * eased;
      el.textContent = fmt(v);
      if (p < 1) el._raf = requestAnimationFrame(tick);
      else el._raf = 0;
    };
    el._raf = requestAnimationFrame(tick);
  }

  function setBar(el, pct, cls) {
    if (!el) return;
    el.style.width = clamp(pct, 0, 100) + '%';
    if (cls) el.dataset.tone = cls;
  }

  function stressTone(v) { return v >= 75 ? 'high' : v >= 50 ? 'mid' : 'low'; }

  function updateHUD(instant) {
    if (!engine) return;
    const s = engine.state;
    numberTween(dom.moneyValue, s.budget, (v) => fmtMoney(v), instant ? 0 : 620);
    numberTween(dom.energyValue, s.energy, (v) => String(Math.round(v)), instant ? 0 : 620);
    numberTween(dom.stressValue, s.stress, (v) => String(Math.round(v)), instant ? 0 : 620);
    dom.timeValue.textContent = fmtTime(s.time);
    setBar(dom.moneyBar, s.budget / CONFIG.moneyScale * 100, s.budget < 0 ? 'high' : s.budget < 900 ? 'mid' : 'low');
    setBar(dom.energyBar, s.energy, s.energy < 25 ? 'high' : s.energy < 50 ? 'mid' : 'low');
    setBar(dom.stressBar, s.stress, stressTone(s.stress));
    setBar(dom.timeBar, (s.time - CONFIG.dayStart) / (CONFIG.dayEnd - CONFIG.dayStart) * 100, 'time');
    document.querySelector('[data-stat="stress"]').classList.toggle('is-hot', s.stress >= 70);
    document.querySelector('[data-stat="energy"]').classList.toggle('is-low', s.energy <= 25);
    document.querySelector('[data-stat="money"]').classList.toggle('is-low', s.budget < 500);
    updateSceneChip();
  }

  function floatDelta(stat, text, tone) {
    const card = document.querySelector('[data-stat="' + stat + '"]');
    if (!card || !dom.floatLayer) return;
    const r = card.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'float-delta ' + tone;
    const iconName = stat === 'money' ? 'coin' : stat === 'time' ? 'clock' : stat;
    el.innerHTML = icon(iconName, 'float-icon');
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    el.style.left = (r.left + r.width / 2) + 'px';
    el.style.top = (r.bottom + 6) + 'px';
    dom.floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 1650);
  }

  function pulseStat(stat, tone) {
    const card = document.querySelector('[data-stat="' + stat + '"]');
    if (!card) return;
    card.classList.remove('flash-good', 'flash-bad');
    void card.offsetWidth;
    card.classList.add(tone);
    setTimeout(() => card.classList.remove(tone), 760);
  }

  function showDeltas(fx, minutes) {
    if (fx.money) floatDelta('money', fmtSigned(fx.money) + ' сом', fx.money > 0 ? 'good' : 'bad');
    if (fx.energy) floatDelta('energy', fmtSigned(fx.energy) + '%', fx.energy > 0 ? 'good' : 'bad');
    if (fx.stress) floatDelta('stress', fmtSigned(fx.stress) + '%', fx.stress > 0 ? 'bad' : 'good');
    if (minutes) floatDelta('time', '−' + minutes + ' мин', 'neutral');
    if (fx.money > 0) pulseStat('money', 'flash-good');
    else if (fx.money < 0) pulseStat('money', 'flash-bad');
    if (fx.energy < 0) pulseStat('energy', 'flash-bad');
    if (fx.stress > 0) pulseStat('stress', 'flash-bad');
    else if (fx.stress < 0) pulseStat('stress', 'flash-good');
  }

  /* ------------------------ карточка события --------------------------- */

  /* Текст с диалогами («@Имя: реплика») и подчёркнутыми словами глоссария. */
  function appendRich(el, text) {
    const src = String(text || '');
    const hits = [];
    (BD.GLOSSARY || []).forEach((g) => {
      for (const m of src.matchAll(g.re)) hits.push({ a: m.index, b: m.index + m[0].length, g });
    });
    hits.sort((x, y) => x.a - y.a || y.b - x.b);
    let pos = 0;
    hits.forEach((h) => {
      if (h.a < pos) return;
      if (h.a > pos) el.appendChild(document.createTextNode(src.slice(pos, h.a)));
      const w = document.createElement('span');
      w.className = 'gloss';
      w.tabIndex = 0;
      w.dataset.term = h.g.term;
      w.dataset.def = h.g.def;
      w.textContent = src.slice(h.a, h.b);
      el.appendChild(w);
      pos = h.b;
    });
    if (pos < src.length) el.appendChild(document.createTextNode(src.slice(pos)));
  }

  function renderParagraphs(container, text) {
    container.innerHTML = '';
    String(text || '').split(/\n\n+/).forEach((raw) => {
      const p = raw.trim();
      if (!p) return;
      const m = /^@([^:\n]{1,32}):\s*([\s\S]*)$/.exec(p);
      if (m) {
        const box = document.createElement('div');
        box.className = 'dialogue';
        const who = document.createElement('span');
        who.className = 'speaker';
        who.textContent = m[1];
        const say = document.createElement('span');
        say.className = 'say';
        say.appendChild(document.createTextNode('\u00ab'));
        appendRich(say, m[2]);
        say.appendChild(document.createTextNode('\u00bb'));
        box.append(who, say);
        container.appendChild(box);
      } else {
        const el = document.createElement('p');
        appendRich(el, p);
        container.appendChild(el);
      }
    });
  }

  function showGloss(target) {
    const tip = dom.glossTip;
    tip.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = target.dataset.term;
    tip.append(b, document.createTextNode(target.dataset.def));
    tip.hidden = false;
    const r = target.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = Math.min(window.innerWidth - tw - 10, Math.max(10, r.left + r.width / 2 - tw / 2));
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function hideGloss() { if (dom.glossTip) dom.glossTip.hidden = true; }

  /* Живые предметы в сцене: подсказка при наведении/тапе на комуз, фото, курут и т. п. */
  function sceneHotspotAt(ev) {
    const rd = BD.debug && BD.debug.renderer;
    if (!rd || !ev.target || ev.target.id !== 'scene' || !BD.hotspotAt) return null;
    const r = ev.target.getBoundingClientRect();
    const vx = (ev.clientX - r.left - rd.offX) / rd.scale, vy = (ev.clientY - r.top - rd.offY) / rd.scale;
    return BD.hotspotAt(rd.scene, rd.sceneLabel, vx, vy);
  }
  function showSceneTip(h, ev) {
    const tip = dom.glossTip;
    tip.innerHTML = '';
    const b = document.createElement('b'); b.textContent = h.term;
    tip.append(b, document.createTextNode(h.def));
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - tw - 10, Math.max(10, ev.clientX - tw / 2)) + 'px';
    tip.style.top = Math.max(8, ev.clientY - th - 18) + 'px';
  }
  let sceneTipOn = false, sceneTipTimer = 0;
  document.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    const h = sceneHotspotAt(ev);
    document.body.classList.toggle('on-hotspot', !!h);
    if (h) { showSceneTip(h, ev); sceneTipOn = true; } else if (sceneTipOn) { hideGloss(); sceneTipOn = false; }
  });
  document.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    const h = sceneHotspotAt(ev);
    if (!h) return;
    showSceneTip(h, ev); clearTimeout(sceneTipTimer); sceneTipTimer = setTimeout(hideGloss, 3500);
  });

  function renderStatuses() {
    const s = engine.state;
    const list = [];
    Object.keys(STATUS).forEach((key) => {
      if (s.has(key)) list.push({ key, ...STATUS[key] });
    });
    if (s.vars && s.vars.caffeinated && !s.has('caffeinated')) {
      list.push({ key: 'caffeinated', ...STATUS.caffeinated });
    }
    list.sort((a, b) => (a.priority || 9) - (b.priority || 9));
    const chips = list.slice(0, 4).map((st) => ({
      cls: st.tone || 'info', label: st.label, hint: st.hint,
      dot: st.tone === 'good' ? '\u2713' : st.tone === 'bad' ? '!' : '\u00b7'
    }));
    // Связи с людьми двора и предметы памяти: тихие чипы после обычных статусов.
    Object.keys(BD.BONDS || {}).forEach((k) => {
      const v = s.bond(k);
      if (v > 0) { const bi = BD.bondInfo(k, s.district); chips.push({ cls: 'bond', dot: '\u2665', label: bi.label + ' \u00b7 ' + v, hint: bi.hint + ' Связь: ' + v + ' из 5.' }); }
    });
    s.memories.forEach((k) => {
      const it = BD.ITEMS && BD.ITEMS[k];
      if (it) chips.push({ cls: 'item', dot: '\u25c6', label: it.label, hint: 'Предмет памяти: ' + it.line + '.' });
    });
    dom.statusRow.innerHTML = '';
    if (!chips.length) {
      dom.statusRow.hidden = true;
      return;
    }
    dom.statusRow.hidden = false;
    chips.forEach((st) => {
      const chip = document.createElement('span');
      chip.className = 'status-chip ' + st.cls;
      chip.title = st.hint || '';
      const dot = document.createElement('i');
      dot.textContent = st.dot;
      chip.appendChild(dot);
      const label = document.createElement('span');
      label.textContent = st.label;
      chip.appendChild(label);
      dom.statusRow.appendChild(chip);
    });
  }

  function previewBadges(resolved) {
    const badges = [];
    const fx = resolved.fx || {};
    if (fx.money) badges.push({ icon: 'coin', text: fmtSigned(fx.money) + ' сом', tone: fx.money > 0 ? 'good' : 'bad' });
    if (fx.energy) badges.push({ icon: 'bolt', text: fmtSigned(fx.energy) + '% энергия', tone: fx.energy > 0 ? 'good' : 'bad' });
    if (fx.stress) badges.push({ icon: 'pulse', text: fmtSigned(fx.stress) + '% стресс', tone: fx.stress > 0 ? 'bad' : 'good' });
    if (fx.saved) badges.push({ icon: 'tag', text: 'экономия ' + Math.round(fx.saved), tone: 'good' });
    if (resolved.minutes) badges.push({ icon: 'clock', text: '−' + resolved.minutes + ' мин', tone: 'neutral' });
    Object.keys(resolved.bonds || {}).forEach((k) => {
      const v = resolved.bonds[k];
      if (v && BD.BONDS && BD.BONDS[k]) badges.push({ icon: 'heart', text: BD.bondInfo(k, engine ? engine.state.district : null).label + ' ' + (v > 0 ? '+' : '') + v, tone: 'bond' });
    });
    (resolved.items || []).forEach((k) => {
      if (BD.ITEMS && BD.ITEMS[k]) badges.push({ icon: 'star', text: 'Память: ' + BD.ITEMS[k].label, tone: 'item' });
    });
    return badges;
  }

  function renderChoices() {
    const s = engine.state;
    dom.choices.innerHTML = '';
    dom.choices.classList.remove('is-done');
    dom.consequence.hidden = true;
    dom.eventCard.classList.remove('is-outcome');
    dom.choiceHint.hidden = false;
    locked = false;

    engine.event.choices.forEach((ch, idx) => {
      const r = engine.resolveChoice(ch, s);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice' + (r.locked ? ' is-locked' : '') + (r.unaffordable ? ' is-unaffordable' : '');
      btn.dataset.choiceId = ch.id;
      btn.dataset.index = String(idx);
      btn.setAttribute('aria-disabled', r.locked ? 'true' : 'false');
      if (r.locked) btn.disabled = true;

      const head = document.createElement('span');
      head.className = 'choice-head';
      const num = document.createElement('span');
      num.className = 'choice-num';
      num.textContent = String(idx + 1);
      const title = document.createElement('span');
      title.className = 'choice-title';
      title.textContent = r.title;
      const arrow = document.createElement('span');
      arrow.className = 'choice-arrow';
      arrow.innerHTML = icon(r.locked ? 'lock' : 'arrow');
      head.append(num, title, arrow);

      const desc = document.createElement('span');
      desc.className = 'choice-desc';
      desc.textContent = r.desc;

      btn.append(head, desc);

      if (r.locked) {
        const lock = document.createElement('span');
        lock.className = 'choice-lock';
        lock.innerHTML = icon(r.unaffordable ? 'coin' : 'lock');
        const txt = document.createElement('span');
        txt.textContent = r.lockReason;
        lock.appendChild(txt);
        btn.appendChild(lock);
      } else {
        const prev = document.createElement('span');
        prev.className = 'choice-preview';
        previewBadges(r).forEach((b) => {
          const badge = document.createElement('span');
          badge.className = 'preview-badge ' + b.tone;
          badge.innerHTML = icon(b.icon);
          const t = document.createElement('span');
          t.textContent = b.text;
          badge.appendChild(t);
          prev.appendChild(badge);
        });
        btn.appendChild(prev);
        btn.addEventListener('mouseenter', () => audio && audio.play('hover'));
        btn.addEventListener('focus', () => audio && audio.play('hover'));
        btn.addEventListener('click', () => choose(ch.id));
      }
      dom.choices.appendChild(btn);
    });
  }

  /* Мобильный вид: карточка закрывает сцену, поэтому её можно убрать кнопкой и посмотреть/потрогать предметы. */
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#peekBtn');
    if (!b) return;
    const on = !document.body.classList.contains('peek-scene');
    document.body.classList.toggle('peek-scene', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = on ? 'К карточке' : 'Показать сцену';
    hideGloss();
  });
  function resetPeek() {
    document.body.classList.remove('peek-scene');
    const b = document.getElementById('peekBtn');
    if (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Показать сцену'; }
  }

  function renderEvent() {
    resetPeek();
    if (!engine) return;
    pending = null;
    const ev = engine.event;
    if (!ev) return;
    const s = engine.state;
    if (s.time < ev.time) s.time = ev.time;

    dom.play.dataset.eventId = ev.id;
    dom.eventKicker.textContent = ev.kicker;
    const progress = engine.progress();
    dom.eventProgress.textContent = String(progress.index + 1).padStart(2, '0') + ' / ' + String(progress.total).padStart(2, '0');
    dom.eventTitle.textContent = ev.title;
    renderParagraphs(dom.eventText, val(ev.text, s));
    renderStatuses();
    renderChoices();

    renderer.setScene(val(ev.scene, s), s.district, val(ev.sceneLabel, s) || val(ev.variant, s));
    renderer.setTime(s.time);
    renderer.setWeather(s.vars.weather || 'clear');
    updateHUD(true);

    dom.eventCard.classList.remove('card-in');
    void dom.eventCard.offsetWidth;
    dom.eventCard.classList.add('card-in');
    dom.eventCard.scrollTop = 0;
    dom.eventCard.setAttribute('aria-live', 'polite');
    setupVignette(ev);
    syncAmbient(ev);
    if (ev.motif && audio) setTimeout(() => { if (engine && engine.event === ev) audio.playMotif(ev.motif); }, 700);
  }

  /* ---------------- виньетки: 15 секунд тишины ---------------- */
  let vigTimer = null;
  function clearVignette() {
    if (vigTimer) { clearTimeout(vigTimer); vigTimer = null; }
    if (dom.vignetteBar) { dom.vignetteBar.hidden = true; dom.vignetteBar.classList.remove('run'); }
  }

  function setupVignette(ev) {
    clearVignette();
    dom.eventCard.classList.toggle('is-vignette', !!ev.vignette);
    if (!ev.vignette) return;
    const ms = typeof BD.VIGNETTE_MS === 'number' ? BD.VIGNETTE_MS : ev.vignette * 1000;
    dom.vignetteBar.hidden = false;
    dom.vignetteBar.style.setProperty('--vig', ms + 'ms');
    void dom.vignetteBar.offsetWidth;
    dom.vignetteBar.classList.add('run');
    const id = ev.id;
    vigTimer = setTimeout(() => {
      vigTimer = null;
      if (!engine || !engine.event || engine.event.id !== id || pending || locked) return;
      const first = engine.event.choices.find((c) => !engine.resolveChoice(c).locked);
      if (!first) return;
      choose(first.id);
      setTimeout(() => { if (pending && engine.event && engine.event.id === id) nextEvent(); }, 1500);
    }, ms);
  }

  /* ---------------- звуковая атмосфера по сцене ---------------- */
  const SCENE_AMBIENT = { home: 'room', traffic: 'city', school: 'city', office: 'room', bazaar: 'market', evening: 'city',
    park: 'park', courtyard: 'courtyard', mall: 'market', parents_home: 'room', stairwell: 'stairwell', kitchen_night: 'kitchen',
    apa_kitchen: 'kitchen', south_panorama: 'hill', school_evening: 'courtyard',
    old_center_courtyard: 'aryk', memory_corner: 'room', alatoo_twilight: 'city' };
  const INDOOR = { home: 1, office: 1, mall: 1, parents_home: 1, stairwell: 1, kitchen_night: 1, apa_kitchen: 1, south_panorama: 1, memory_corner: 1 };

  function syncAmbient(ev, sceneName) {
    if (!audio || !engine) return;
    const s = engine.state;
    const scene = sceneName || val(ev.scene, s) || 'home';
    const profile = ev.ambient || SCENE_AMBIENT[scene] || 'room';
    audio.setAmbient(profile, s.vars.weather === 'rain' && !INDOOR[scene]);
  }

  function choose(choiceId) {
    if (!engine || locked) return;
    const outcome = engine.choose(choiceId);
    if (!outcome) return;
    locked = true;
    pending = outcome;
    clearVignette();
    hideGloss();

    audio && audio.play('click');
    if (outcome.resolved.fx.money > 0) setTimeout(() => audio && audio.play('coin'), 180);
    if (outcome.resolved.fx.stress >= 12 || outcome.resolved.fx.energy <= -18) {
      setTimeout(() => audio && audio.play('alert'), 240);
    }

    // Выбор, меняющий место, сразу меняет и сцену, не дожидаясь следующей карточки.
    const chosen = outcome.resolved.choice;
    if (chosen && chosen.scene) {
      renderer.setScene(chosen.scene, engine.state.district, chosen.sceneLabel || '');
      syncAmbient(engine.event || {}, chosen.scene);
    }
    if (chosen && chosen.motif && audio) setTimeout(() => audio.playMotif(chosen.motif), 350);

    updateHUD(false);
    showDeltas(outcome.resolved.fx, outcome.resolved.minutes);
    renderer.setTime(engine.state.time);
    renderer.setWeather(engine.state.vars.weather || 'clear');
    updateSceneChip();

    const picked = dom.choices.querySelector('[data-choice-id="' + choiceId + '"]');
    if (picked) picked.classList.add('is-picked');
    dom.choices.classList.add('is-done');

    if (outcome.ending) {
      setTimeout(() => showGameOver(outcome), 720);
      return;
    }

    dom.eventCard.classList.add('is-outcome');
    dom.consequence.hidden = false;
    renderParagraphs(dom.consequenceText, outcome.result);
    dom.applied.innerHTML = '';
    previewBadges(outcome.resolved).forEach((b) => {
      const badge = document.createElement('span');
      badge.className = 'applied-badge ' + b.tone;
      badge.innerHTML = icon(b.icon);
      const t = document.createElement('span');
      t.textContent = b.text;
      badge.appendChild(t);
      dom.applied.appendChild(badge);
    });
    dom.choiceHint.hidden = true;
    const progress = engine.progress();
    dom.nextBtn.innerHTML = (progress.isLast ? 'К итогам дня' : 'Дальше') + ' ' + icon('arrow');
    setTimeout(() => dom.nextBtn.focus({ preventScroll: true }), 260);
    if (outcome.result) audio && audio.play(outcome.resolved.fx.stress > 8 ? 'alert' : 'success');
    dom.eventCard.scrollTop = 0;
  }

  function nextEvent() {
    if (!engine || !pending) return;
    audio && audio.play('next');
    pending = null;
    const r = engine.next();
    if (r.done) {
      if (r.summary && r.summary.routeEnding) showPostcard(r.summary.routeEnding, { route: true });
      else showSummary();
    } else renderEvent();
  }

  /* ---------------------------- финалы -------------------------------- */

  /* Вместо Game Over — мягкая концовка: тёплая открытка с бата и собранными предметами. */
  function showGameOver(outcome) {
    const card = BD.softEnding(outcome.ending, engine.state.district);
    showPostcard(card, { soft: true });
  }

  /* ---------------------------- открытки -------------------------------- */

  function collectPostcard(id) {
    let got = [];
    try { got = JSON.parse(localStorage.getItem('bd_postcards') || '[]'); } catch (e) { got = []; }
    if (!Array.isArray(got)) got = [];
    if (got.indexOf(id) < 0) got.push(id);
    try { localStorage.setItem('bd_postcards', JSON.stringify(got)); } catch (e) { /* ignore */ }
    if (typeof updateAlbumCount === 'function') updateAlbumCount();
    return got.length;
  }


  /* ---------------------------- альбом открыток ------------------------- */
  function allPostcards() {
    const list = [];
    Object.keys(BD.POSTCARDS || {}).forEach((k) => list.push(BD.POSTCARDS[k]));
    const soft = BD.SOFT_ENDINGS || {};
    Object.keys(soft).forEach((kind) => Object.keys(soft[kind]).forEach((d) => {
      const c = soft[kind][d];
      if (c && c.id) list.push(Object.assign({}, c, { district: c.district || (d === '_default' ? '' : d) }));
    }));
    const seen = {};
    const order = { vostok5: 0, south: 1, center: 2 };
    return list.filter((c) => c && c.id && !seen[c.id] && (seen[c.id] = 1))
      .sort((x, y) => ((order[x.district] ?? 9) - (order[y.district] ?? 9)) || ((x.kind === 'soft') - (y.kind === 'soft')));
  }
  function collectedIds() {
    try { const g = JSON.parse(localStorage.getItem('bd_postcards') || '[]'); return Array.isArray(g) ? g : []; } catch (e) { return []; }
  }
  const DISTRICT_NAMES = { south: 'Юг', center: 'Центр', vostok5: 'Восток-5' };
  function updateAlbumCount() {
    const n = collectedIds().length, el = document.getElementById('albumCount');
    if (el) el.textContent = n + ' / ' + (allPostcards().length);
  }
  function openAlbum() {
    const grid = document.getElementById('albumGrid'), got = collectedIds();
    grid.innerHTML = '';
    allPostcards().forEach((c) => {
      const open = got.indexOf(c.id) >= 0;
      const el = document.createElement('article');
      el.className = 'album-card' + (open ? '' : ' is-locked') + (c.kind === 'soft' ? ' is-soft' : '');
      const k = document.createElement('p'); k.className = 'pc-kicker';
      k.textContent = (DISTRICT_NAMES[c.district] || 'Город') + (c.kind === 'soft' ? ' · тихий финал' : ' · финал');
      const h = document.createElement('h3'); h.textContent = open ? c.title : 'Закрытая открытка';
      const p = document.createElement('p'); p.className = 'album-text'; p.textContent = open ? c.bata : 'Её ещё не получали. Пройдите день по-другому.';
      el.append(k, h, p); grid.appendChild(el);
    });
    document.getElementById('album').hidden = false;
    document.body.classList.add('album-open');
  }
  function closeAlbum() { document.getElementById('album').hidden = true; document.body.classList.remove('album-open'); }
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#albumBtn')) openAlbum();
    else if (e.target.closest && e.target.closest('#albumCloseBtn')) closeAlbum();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('album').hidden) closeAlbum(); });
  updateAlbumCount();

  function showPostcard(card, opts) {
    opts = opts || {};
    clearVignette();
    hideGloss();
    const s = engine.state;
    showScreen('postcard');
    document.body.dataset.tone = card.tone || 'gold';
    dom.pcKicker.textContent = card.kicker;
    dom.pcTitle.textContent = card.title;
    renderParagraphs(dom.pcText, card.text);
    dom.pcItems.innerHTML = '';
    s.memories.forEach((k) => {
      const it = BD.ITEMS && BD.ITEMS[k];
      if (!it) return;
      const el = document.createElement('span');
      el.className = 'pc-item';
      const b = document.createElement('b');
      b.textContent = '\u25c6 ' + it.label;
      el.append(b, document.createTextNode(it.line));
      dom.pcItems.appendChild(el);
    });
    dom.pcBata.innerHTML = '';
    appendRich(dom.pcBata, card.bata);
    dom.pcTip.hidden = !card.tip;
    dom.pcTip.textContent = card.tip ? 'Как не повторить: ' + card.tip : '';
    const n = collectPostcard(card.id);
    dom.pcStamp.textContent = 'Открытка в коллекции: ' + n + ' из ' + BD.POSTCARD_IDS.length;
    dom.pcNextBtn.hidden = !opts.route;
    dom.pcAgainBtn.hidden = !opts.soft;
    dom.pcDistrictBtn.hidden = !opts.soft;
    dom.pcMenuBtn.hidden = !opts.soft;
    const district = BD.getDistrict(s.district);
    dom.pcAgainBtn.textContent = 'Ещё раз: ' + (district ? district.name : 'день');
    renderer.setScene(card.scene, s.district, card.variant || '');
    renderer.setTime(opts.soft ? s.time : Math.max(s.time, 21 * 60));
    renderer.setWeather('clear');
    if (audio) {
      audio.setAmbient(SCENE_AMBIENT[card.scene] || 'room', false);
      setTimeout(() => audio.playMotif('bata'), 500);
      setTimeout(() => { if (!dom.postcard.hidden) audio.startDrone(); }, 900);
      audio.play(opts.soft ? 'next' : 'success');
    }
    dom.pcCard.style.animation = 'none';
    void dom.pcCard.offsetWidth;
    dom.pcCard.style.animation = '';
    dom.pcCard.scrollTop = 0;
    setTimeout(() => { const b = [dom.pcNextBtn, dom.pcAgainBtn].find((x) => !x.hidden); if (b) b.focus({ preventScroll: true }); }, 400);
  }

  /* ---------------------------- итоги --------------------------------- */

  function drawStressChart(summary) {
    const c = dom.stressChart;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width < 10) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    const pad = { l: 38, r: 14, t: 22, b: 26 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    ctx.clearRect(0, 0, w, h);

    const color = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#3fd0b6';
    const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#f3b64b';

    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(245,242,234,.46)';
    ctx.textAlign = 'right';
    [0, 50, 100].forEach((v) => {
      const y = pad.t + ih - v / 100 * ih;
      ctx.fillText(String(v), pad.l - 10, y + 4);
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + iw, y); ctx.stroke();
    });

    const logs = summary.stressLog || [];
    const x = (t) => pad.l + clamp((t - CONFIG.dayStart) / (CONFIG.dayEnd - CONFIG.dayStart), 0, 1) * iw;
    const y = (v) => pad.t + ih - clamp(v, 0, 100) / 100 * ih;

    if (logs.length) {
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ih);
      grad.addColorStop(0, 'rgba(63,208,182,.32)');
      grad.addColorStop(1, 'rgba(63,208,182,.02)');
      ctx.beginPath();
      ctx.moveTo(x(logs[0].t), pad.t + ih);
      logs.forEach((p) => ctx.lineTo(x(p.t), y(p.v)));
      ctx.lineTo(x(logs[logs.length - 1].t), pad.t + ih);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      logs.forEach((p, i) => { if (i === 0) ctx.moveTo(x(p.t), y(p.v)); else ctx.lineTo(x(p.t), y(p.v)); });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      logs.forEach((p) => {
        ctx.beginPath();
        ctx.arc(x(p.t), y(p.v), 2.6, 0, TAU);
        ctx.fillStyle = color;
        ctx.fill();
      });

      let peak = logs[0];
      logs.forEach((p) => { if (p.v > peak.v) peak = p; });
      const px = x(peak.t), py = y(peak.v);
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, TAU);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,16,20,.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = gold;
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('пик ' + Math.round(peak.v) + '%', Math.min(px + 10, w - 64), Math.max(py - 9, 14));
    }

    ctx.fillStyle = 'rgba(245,242,234,.4)';
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('07:30', pad.l, h - 7);
    ctx.textAlign = 'center';
    ctx.fillText('12:00', pad.l + iw * 0.36, h - 7);
    ctx.fillText('17:00', pad.l + iw * 0.76, h - 7);
    ctx.textAlign = 'right';
    ctx.fillText('21:30', pad.l + iw, h - 7);
  }

  function showSummary() {
    if (!engine) return;
    const sum = engine.summary || engine.finish();
    showScreen('summary');
    renderer.setScene('evening');
    renderer.setTime(CONFIG.dayEnd);
    document.body.dataset.tone = 'teal';

    dom.summaryVerdictTitle.textContent = sum.verdict.title;
    dom.summaryVerdictText.textContent = sum.verdict.text;
    dom.sumBudget.textContent = fmtMoney(sum.budget);
    dom.sumSpent.textContent = fmtMoney(sum.spent) + ' сом';
    dom.sumEarned.textContent = fmtMoney(sum.earned) + ' сом';
    dom.sumSaved.textContent = fmtMoney(sum.saved) + ' сом';
    dom.sumPeak.textContent = Math.round(sum.stressPeak) + '%';
    dom.sumEnergy.textContent = Math.round(sum.energy) + '%';
    dom.sumHome.textContent = fmtTime(sum.endTime);
    dom.sumRoute.textContent = sum.route || (sum.district ? sum.district.name + ' → дом' : '—');
    if (dom.sumEvents) dom.sumEvents.textContent = String(sum.eventsPlayed) + ' из ' + engine.progress().total;
    dom.playAgainBtn.innerHTML = 'Ещё раз: ' + (sum.district ? sum.district.name : 'день') + ' ' + icon('restart');

    dom.summaryScore.textContent = '0';
    dom.summaryScoreRing.style.setProperty('--p', sum.score);
    const scoreEl = dom.summaryScore;
    scoreEl._val = 0;
    numberTween(scoreEl, sum.score, (v) => String(Math.round(v)), 950);

    const isRecord = sum.score > bestScore;
    if (isRecord) {
      bestScore = sum.score;
      try { localStorage.setItem('bd_best', String(bestScore)); } catch (e) { /* ignore */ }
    }
    dom.bestLabel.textContent = isRecord ? 'Новый рекорд!' : 'Лучший результат: ' + bestScore + '/100';
    dom.summaryBadgeCount.textContent = sum.unlocked + ' из ' + sum.badges.length;

    dom.summaryBadges.innerHTML = '';
    sum.badges.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'badge-card' + (b.unlocked ? ' is-unlocked' : ' is-locked');
      el.style.animationDelay = (i * 55) + 'ms';
      el.innerHTML =
        '<span class="badge-icon">' + icon(b.icon) + '</span>' +
        '<span class="badge-body"><strong></strong><small></small></span>' +
        '<span class="badge-mark">' + (b.unlocked ? icon('check') : icon('lock')) + '</span>';
      el.querySelector('strong').textContent = b.name;
      el.querySelector('small').textContent = b.unlocked ? b.desc : 'Ещё не открыто';
      el.title = b.name + ' — ' + (b.unlocked ? b.desc : 'ещё не открыто');
      dom.summaryBadges.appendChild(el);
    });

    requestAnimationFrame(() => {
      drawStressChart(sum);
      audio && audio.play('success');
      setTimeout(() => { if (sum.badges.some((b) => b.unlocked)) audio && audio.play('badge'); }, 500);
    });
    audio && audio.play('whoosh');
    setTimeout(() => dom.playAgainBtn.focus({ preventScroll: true }), 500);
  }

  function startGame(districtId) {
    if (!districtId) { goDistrict(); return; }
    audio && audio.ensure();
    audio && audio.play('whoosh');
    engine = new Engine();
    engine.start(districtId);
    BD.debug = { engine, renderer }; // для автотестов и отладки из консоли
    showScreen('play');
    document.body.dataset.tone = 'teal';
    renderer.setWeather('clear');
    updateHUD(true);
    renderEvent();
  }

  function goMenu() {
    clearVignette();
    showScreen('intro');
    document.body.dataset.tone = 'teal';
    audio && audio.setAmbient('city', false);
    renderer.setScene('traffic');
    renderer.setTime(CONFIG.dayStart);
    updateIntroBest();
  }

  function updateIntroBest() {
    if (!dom.introBest) return;
    dom.introBest.textContent = bestScore > 0 ? 'Лучший результат: ' + bestScore + '/100' : '';
    dom.introBest.hidden = !(bestScore > 0);
  }

  function bind() {
    dom.startBtn.addEventListener('click', goDistrict);
    dom.districtBackBtn.addEventListener('click', goMenu);
    dom.muteBtn.addEventListener('click', toggleMute);
    dom.nextBtn.addEventListener('click', nextEvent);
    dom.playAgainBtn.addEventListener('click', () => startGame(currentDistrictId()));
    dom.districtBtn.addEventListener('click', goDistrict);
    dom.menuBtn.addEventListener('click', goMenu);
    dom.restartBtn.addEventListener('click', () => startGame(currentDistrictId()));
    dom.goDistrictBtn.addEventListener('click', goDistrict);
    dom.goMenuBtn.addEventListener('click', goMenu);
    dom.pcNextBtn.addEventListener('click', showSummary);
    dom.pcAgainBtn.addEventListener('click', () => startGame(currentDistrictId()));
    dom.pcDistrictBtn.addEventListener('click', goDistrict);
    dom.pcMenuBtn.addEventListener('click', goMenu);

    // Подсказки глоссария: наведение и фокус.
    document.addEventListener('mouseover', (e) => { const g = e.target.closest && e.target.closest('.gloss'); if (g) showGloss(g); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('.gloss')) hideGloss(); });
    document.addEventListener('focusin', (e) => { const g = e.target.closest && e.target.closest('.gloss'); if (g) showGloss(g); });
    document.addEventListener('focusout', (e) => { if (e.target.closest && e.target.closest('.gloss')) hideGloss(); });

    // Панель звука: громкость, атмосфера, мотив.
    dom.volRange.value = String(Math.round(audio.settings.volume * 100));
    dom.ambCheck.checked = audio.settings.ambient;
    dom.musCheck.checked = audio.settings.music;
    dom.audioBtn.addEventListener('click', () => {
      const open = dom.audioPanel.hidden;
      dom.audioPanel.hidden = !open;
      dom.audioBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    dom.volRange.addEventListener('input', () => audio.setVolume(Number(dom.volRange.value) / 100));
    dom.ambCheck.addEventListener('change', () => { audio.ensure(); audio.setAmbientOn(dom.ambCheck.checked); });
    dom.musCheck.addEventListener('change', () => { audio.setMusicOn(dom.musCheck.checked); if (dom.musCheck.checked) audio.playMotif('warm'); });

    [dom.startBtn, dom.playAgainBtn, dom.districtBtn, dom.restartBtn, dom.goDistrictBtn,
      dom.menuBtn, dom.goMenuBtn, dom.districtBackBtn, dom.muteBtn, dom.pcNextBtn, dom.pcAgainBtn, dom.pcDistrictBtn, dom.pcMenuBtn].forEach((b) => {
      if (!b) return;
      b.addEventListener('mouseenter', () => audio && audio.play('hover'));
    });

    window.addEventListener('mousemove', (e) => {
      if (!renderer) return;
      // над блоком выбора сцена не реагирует на курсор: ничего не плывёт за стеклом
      if (e.target && e.target.closest && e.target.closest('.event-card')) return;
      renderer.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    });
    window.addEventListener('mouseleave', () => renderer && renderer.setPointer(0, 0));
    window.addEventListener('resize', () => {
      if (!dom.summary.hidden && engine && engine.summary) drawStressChart(engine.summary);
    });

    document.addEventListener('keydown', (e) => {
      const key = e.key;
      if (key === 'm' || key === 'M' || key === 'ь' || key === 'Ь') {
        toggleMute();
        return;
      }
      if (key === 'Escape' && !dom.audioPanel.hidden) {
        dom.audioPanel.hidden = true;
        dom.audioBtn.setAttribute('aria-expanded', 'false');
        return;
      }
      if (key === 'Escape' && !dom.district.hidden) {
        goMenu();
        return;
      }
      if (key === 'Escape' && !dom.play.hidden) {
        goMenu();
        return;
      }
      if (key === 'Enter' || key === ' ') {
        if (e.target && e.target.tagName === 'BUTTON') return;
        if (!dom.intro.hidden) { e.preventDefault(); goDistrict(); return; }
        if (!dom.summary.hidden) { e.preventDefault(); startGame(currentDistrictId()); return; }
        if (!dom.postcard.hidden) { e.preventDefault(); const b = [dom.pcNextBtn, dom.pcAgainBtn].find((x) => !x.hidden); if (b) b.click(); return; }
        if (!dom.gameover.hidden) { e.preventDefault(); startGame(currentDistrictId()); return; }
        if (!dom.play.hidden && !dom.consequence.hidden) { e.preventDefault(); nextEvent(); return; }
      }
      if (!dom.district.hidden && !locked && /^[1-3]$/.test(key)) {
        const idx = Number(key) - 1;
        const d = DISTRICTS[idx];
        if (d) {
          e.preventDefault();
          startGame(d.id);
        }
        return;
      }
      if (!dom.play.hidden && !locked && /^[1-4]$/.test(key)) {
        const idx = Number(key) - 1;
        const btn = dom.choices.children[idx];
        if (btn && !btn.disabled) {
          e.preventDefault();
          choose(btn.dataset.choiceId);
        }
      }
    });
  }

  function init() {
    cacheDom();
    audio = new BD.AudioFX();
    BD.audioFX = audio; // для автотестов
    renderer = new BD.Renderer($('scene'));
    renderer.setScene('traffic');
    renderer.setTime(CONFIG.dayStart);
    try { bestScore = parseInt(localStorage.getItem('bd_best') || '0', 10) || 0; } catch (e) { bestScore = 0; }
    updateMuteUI();
    updateIntroBest();
    renderDistricts();
    bind();
    showScreen('intro');
    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);

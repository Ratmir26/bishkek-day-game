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
  /* Кикер хранит авторское время, но показывает реальное: часы в HUD и в карточке не расходятся. */
  function kickerText(ev, s) {
    const raw = typeof ev.kicker === 'function' ? (ev.kicker(s) || '') : (ev.kicker || '');
    if (!/^\d{1,2}:\d{2}(\s|·)/.test(raw)) return raw;
    return fmtTime(s.time) + raw.replace(/^\d{1,2}:\d{2}/, '');
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
      this.bonds = { parents: 0, bakyt: 0, apa: 0, dvor: 0, kid: 0 };
      this.memory = [];           // собранные предметы памяти (id из BD.MEMORY)
      this.vignettesShown = new Set();
      this.postcard = null;       // открытка памяти, выбранная в финале
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
      c.memory = this.memory.slice();
      c.vignettesShown = new Set(this.vignettesShown);
      c.postcard = this.postcard;
      return c;
    }

    has(f) { return this.flags.has(flagKey(f)); }
    set(f) { this.flags.set(flagKey(f), null); }
    clear(f) { this.flags.delete(flagKey(f)); }

    addBond(name, amount) {
      if (!name || !amount) return;
      this.bonds[name] = clamp((this.bonds[name] || 0) + amount, 0, 12);
    }

    addMemory(id) {
      if (!id) return;
      if (this.memory.indexOf(id) < 0) this.memory.push(id);
    }

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

      const bonds = val(ch.bonds, s) || {};
      Object.keys(bonds).forEach((name) => s.addBond(name, bonds[name]));
      const memory = val(ch.memory, s);
      (Array.isArray(memory) ? memory : [memory]).filter(Boolean).forEach((id) => s.addMemory(id));

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
        bonds: Object.assign({}, s.bonds),
        memory: s.memory.slice(),
        memoryItems: s.memory
          .map((id) => (BD.MEMORY && BD.MEMORY[id] ? Object.assign({ id }, BD.MEMORY[id]) : null))
          .filter(Boolean),
        postcard: BD.pickPostcard ? BD.pickPostcard(s) : null
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
      const bondTotal = Object.keys(s.bonds || {}).reduce((a, k) => a + (s.bonds[k] || 0), 0);
      const bondBonus = clamp(bondTotal / 20, 0, 1) * 5;
      const life =
        (s.has('schoolPaid') ? 1 : 0) +
        (s.has('utilitiesPaid') ? 1 : 0) +
        (s.has('familyTime') ? 1 : 0) +
        ((s.has('visitedParents') || s.has('pickedUpKids') || s.has('calledParents') || s.has('helpedRelative')) ? 1 : 0) +
        (s.has('weatherReady') ? 1 : 0);
      return Math.round(clamp(wealth + thrift + calm + energy + time + life + bondBonus, 0, 100));
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
      'muteBtn', 'muteIcon', 'volRange', 'startBtn', 'introBest', 'eventCard', 'eventKicker', 'eventProgress',
      'eventTitle', 'eventText', 'eventDialogue', 'statusRow', 'bondRow', 'choices', 'choiceHint', 'consequence',
      'consequenceText', 'applied', 'nextBtn', 'floatLayer',
      'moneyValue', 'moneyBar', 'energyValue', 'energyBar', 'stressValue', 'stressBar',
      'timeValue', 'timeBar', 'summaryScore', 'summaryScoreRing', 'summaryVerdictTitle',
      'summaryVerdictText', 'sumBudget', 'sumSpent', 'sumEarned', 'sumSaved', 'sumPeak',
      'sumEnergy', 'sumHome', 'sumRoute', 'sumEvents', 'summaryBadges', 'summaryBadgeCount', 'stressChart',
      'bestLabel', 'playAgainBtn', 'districtBtn', 'menuBtn', 'gameoverIcon', 'gameoverKicker',
      'gameoverTitle', 'gameoverText', 'gameoverTip', 'goBudget', 'goEnergy', 'goStress',
      'goTime', 'restartBtn', 'goDistrictBtn', 'goMenuBtn', 'goLast', 'softPostcard',
      'postcardPanel', 'postcardMount', 'summaryBonds', 'summaryMemory', 'summaryMemoryCount', 'bondsPanel',
      'albumBtn', 'albumCount', 'album', 'albumGrid', 'albumMemory', 'albumCloseBtn', 'vignette',
      'vignetteKicker', 'vignetteText', 'vignetteWho', 'vignetteBar', 'vignetteSkip'
    ].forEach((id) => { dom[id] = $(id); });
  }

  function showScreen(name) {
    if (!dom.intro) return;
    dom.intro.hidden = name !== 'intro';
    dom.district.hidden = name !== 'district';
    dom.play.hidden = name !== 'play';
    dom.summary.hidden = name !== 'summary';
    dom.gameover.hidden = name !== 'gameover';
    dom.hud.hidden = name !== 'play';
    dom.sceneChip.hidden = name !== 'play';
    if (dom.album) dom.album.hidden = true;
    document.body.classList.remove('album-open');
    if (dom.vignette) dom.vignette.hidden = true;
    document.body.classList.remove('vignette-open');
    clearTimeout(vignetteTimer);
    vignetteTimer = 0;
    vignetteDone = null;
    document.body.dataset.screen = name;
  }

  function updateMuteUI() {
    const muted = audio ? audio.muted : false;
    dom.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    dom.muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    dom.muteIcon.innerHTML = icon(muted ? 'mute' : 'sound');
    if (dom.volRange) dom.volRange.classList.toggle('is-off', muted);
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
    const map = {
      home: 'home', parents_home: 'home', courtyard: 'home', stairwell: 'home',
      kitchen_night: 'coffee', traffic: 'road', office: 'office', bazaar: 'bazaar',
      evening: 'night', school: 'school', park: 'mountain', mall: 'bag'
    };
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

  /* Слова из глоссария подчёркиваются пунктиром и объясняются при наведении
     или фокусе. Разметка строится текстовыми узлами — никакого innerHTML с
     пользовательским текстом. */
  const WORD_RE = /[A-Za-zА-Яа-яЁёӨөҮүҢң]+/g;

  function glossaryFragment(text) {
    const frag = document.createDocumentFragment();
    const str = String(text || '');
    let last = 0;
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(str))) {
      if (m.index > last) frag.appendChild(document.createTextNode(str.slice(last, m.index)));
      const word = m[0];
      const g = BD.findGlossary ? BD.findGlossary(word) : null;
      if (g) {
        const term = document.createElement('span');
        term.className = 'glossary-term';
        term.tabIndex = 0;
        term.setAttribute('role', 'note');
        term.setAttribute('aria-label', word + '. ' + g.hint);
        term.dataset.hint = g.hint;
        term.textContent = word;
        const pop = document.createElement('span');
        pop.className = 'glossary-pop';
        pop.textContent = g.hint;
        term.appendChild(pop);
        frag.appendChild(term);
      } else {
        frag.appendChild(document.createTextNode(word));
      }
      last = m.index + word.length;
    }
    if (last < str.length) frag.appendChild(document.createTextNode(str.slice(last)));
    return frag;
  }

  function renderParagraphs(container, text) {
    container.innerHTML = '';
    String(text || '').split(/\n\n+/).forEach((p) => {
      const el = document.createElement('p');
      el.appendChild(glossaryFragment(p.trim()));
      container.appendChild(el);
    });
  }

  function renderDialogue() {
    if (!dom.eventDialogue || !engine.event) return;
    const lines = val(engine.event.dialogue, engine.state) || [];
    dom.eventDialogue.innerHTML = '';
    if (!Array.isArray(lines) || !lines.length) {
      dom.eventDialogue.hidden = true;
      return;
    }
    dom.eventDialogue.hidden = false;
    lines.slice(0, 3).forEach((line, i) => {
      const row = document.createElement('div');
      row.className = 'dialogue-line';
      row.style.animationDelay = (i * 90) + 'ms';
      const who = document.createElement('span');
      who.className = 'dialogue-who';
      who.textContent = line.who;
      const txt = document.createElement('span');
      txt.className = 'dialogue-text';
      txt.appendChild(glossaryFragment(line.text));
      row.append(who, txt);
      dom.eventDialogue.appendChild(row);
    });
  }

  /* Отношения показываются тихими чипами: без цифр успеха, только тепло. */
  function renderBonds() {
    if (!dom.bondRow || !engine) return;
    const b = engine.state.bonds || {};
    const keys = (BD.BOND_ORDER || Object.keys(b)).filter((k) => (b[k] || 0) > 0);
    const memory = engine.state.memory || [];
    dom.bondRow.innerHTML = '';
    if (!keys.length && !memory.length) {
      dom.bondRow.hidden = true;
      return;
    }
    dom.bondRow.hidden = false;
    keys.slice(0, 5).forEach((name) => {
      const def = (BD.BONDS && BD.BONDS[name]) || { label: name, icon: 'heart' };
      const chip = document.createElement('span');
      chip.className = 'bond-chip';
      chip.title = (def.hint ? def.hint + ' ' : '') + 'Сейчас: ' + b[name];
      const ico = document.createElement('span');
      ico.className = 'bond-ico';
      ico.innerHTML = icon(def.icon);
      const label = document.createElement('span');
      label.className = 'bond-name';
      label.textContent = BD.bondLabel ? BD.bondLabel(name, engine.state.district) : def.label;
      const count = document.createElement('b');
      count.className = 'bond-count';
      count.textContent = '· ' + b[name];
      chip.append(ico, label, count);
      dom.bondRow.appendChild(chip);
    });
    if (memory.length) {
      const chip = document.createElement('span');
      chip.className = 'bond-chip is-memory';
      chip.title = memory.map((id) => (BD.MEMORY[id] ? BD.MEMORY[id].label : id)).join(', ');
      const ico = document.createElement('span');
      ico.className = 'bond-ico';
      ico.innerHTML = icon('star');
      const label = document.createElement('span');
      label.className = 'bond-name';
      label.textContent = 'память';
      const count = document.createElement('b');
      count.className = 'bond-count';
      count.textContent = '· ' + memory.length;
      chip.append(ico, label, count);
      dom.bondRow.appendChild(chip);
    }
  }

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
    dom.statusRow.innerHTML = '';
    if (!list.length) {
      dom.statusRow.hidden = true;
      return;
    }
    dom.statusRow.hidden = false;
    list.slice(0, 5).forEach((st) => {
      const chip = document.createElement('span');
      chip.className = 'status-chip ' + (st.tone || 'info');
      chip.title = st.hint || '';
      const dot = document.createElement('i');
      dot.textContent = st.tone === 'good' ? '✓' : st.tone === 'bad' ? '!' : '·';
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
    const choice = resolved.choice || {};
    const bonds = val(choice.bonds, engine.state) || {};
    Object.keys(bonds).forEach((name) => {
      const def = BD.BONDS && BD.BONDS[name];
      if (def && bonds[name]) badges.push({ icon: def.icon, text: '+' + (BD.bondLabel ? BD.bondLabel(name, engine.state.district) : def.label), tone: 'bond' });
    });
    const memory = val(choice.memory, engine.state);
    (Array.isArray(memory) ? memory : [memory]).filter(Boolean).forEach((id) => {
      const def = BD.MEMORY && BD.MEMORY[id];
      if (def) badges.push({ icon: def.icon, text: def.label, tone: 'memory' });
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

  function renderEvent() {
    if (!engine) return;
    pending = null;
    const ev = engine.event;
    if (!ev) return;
    const s = engine.state;
    if (s.time < ev.time) s.time = ev.time;

    dom.play.dataset.eventId = ev.id;
    dom.eventKicker.textContent = kickerText(ev, engine.state);
    const progress = engine.progress();
    dom.eventProgress.textContent = String(progress.index + 1).padStart(2, '0') + ' / ' + String(progress.total).padStart(2, '0');
    dom.eventTitle.textContent = ev.title;
    renderParagraphs(dom.eventText, val(ev.text, s));
    renderDialogue();
    renderStatuses();
    renderBonds();
    renderChoices();

    renderer.setScene(val(ev.scene, s), s.district, val(ev.sceneLabel, s));
    renderer.setFestive(s.time >= 19 * 60);
    renderer.setTime(s.time);
    renderer.setWeather(s.vars.weather || 'clear');
    ambienceFor(val(ev.scene, s), s);
    updateHUD(true);

    dom.eventCard.classList.remove('card-in');
    void dom.eventCard.offsetWidth;
    dom.eventCard.classList.add('card-in');
    dom.eventCard.scrollTop = 0;
    dom.eventCard.setAttribute('aria-live', 'polite');
  }

  function choose(choiceId) {
    if (!engine || locked) return;
    const outcome = engine.choose(choiceId);
    if (!outcome) return;
    locked = true;
    pending = outcome;

    audio && audio.play('click');
    if (outcome.resolved.fx.money > 0) setTimeout(() => audio && audio.play('coin'), 180);
    if (outcome.resolved.fx.stress >= 12 || outcome.resolved.fx.energy <= -18) {
      setTimeout(() => audio && audio.play('alert'), 240);
    }

    // Выбор, меняющий место, сразу меняет и сцену, не дожидаясь следующей карточки.
    const chosen = outcome.resolved.choice;
    if (chosen && chosen.scene) {
      renderer.setScene(chosen.scene, engine.state.district, chosen.sceneLabel || '');
    }

    updateHUD(false);
    showDeltas(outcome.resolved.fx, outcome.resolved.minutes);
    renderer.setTime(engine.state.time);
    renderer.setWeather(engine.state.vars.weather || 'clear');
    renderer.setFestive(engine.state.time >= 19 * 60);
    renderBonds();
    updateSceneChip();
    ambienceFor(chosen && chosen.scene ? chosen.scene : val(engine.event.scene, engine.state), engine.state);

    const picked = dom.choices.querySelector('[data-choice-id="' + choiceId + '"]');
    if (picked) picked.classList.add('is-picked');
    dom.choices.classList.add('is-done');

    if (outcome.ending) {
      setTimeout(() => showGameOver(outcome), 720);
      return;
    }

    dom.eventCard.classList.add('is-outcome');
    dom.consequence.hidden = false;
    dom.consequenceText.textContent = outcome.result;
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

  /* ------------------------- открытки и память ------------------------- */

  const ALBUM_KEY = 'bd_postcards_v1';
  let album = [];
  try {
    const raw = localStorage.getItem(ALBUM_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    album = Array.isArray(parsed) ? parsed : [];
  } catch (e) { album = []; }

  function updateAlbumCount() {
    const n = String(album.length);
    if (dom.albumCount) dom.albumCount.textContent = n;
    document.querySelectorAll('[data-album-count]').forEach((el) => { el.textContent = n; });
  }

  function savePostcard(pc) {
    if (!pc || !pc.id) return;
    album = [pc].concat(album.filter((p) => p.id !== pc.id)).slice(0, 12);
    try { localStorage.setItem(ALBUM_KEY, JSON.stringify(album)); } catch (e) { /* ignore */ }
    updateAlbumCount();
  }

  /* Мини-иллюстрация открытки: несколько плоских фигур, без внешних файлов. */
  function postcardArt(scene) {
    if (scene === 'kitchen_night') {
      return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
        '<rect width="320" height="180" fill="#241b15"/>' +
        '<rect x="42" y="16" width="236" height="104" rx="6" fill="#1a1410"/>' +
        '<rect x="196" y="28" width="78" height="66" rx="3" fill="#0f1a2b"/>' +
        '<rect x="200" y="32" width="34" height="28" fill="#243449"/><rect x="236" y="32" width="34" height="28" fill="#1b2a3d"/>' +
        '<rect x="200" y="62" width="34" height="28" fill="#1b2a3d"/><rect x="236" y="62" width="30" height="28" fill="#243449"/>' +
        '<g fill="#f6c96e" opacity=".8"><rect x="204" y="38" width="6" height="7"/><rect x="244" y="68" width="6" height="7"/><rect x="208" y="70" width="6" height="7"/></g>' +
        '<path d="M148 16v30" stroke="#5c4630" stroke-width="3"/>' +
        '<path d="M130 46h36l-8 20h-20z" fill="#e2aa55"/>' +
        '<circle cx="148" cy="72" r="34" fill="#f2b64b" opacity=".16"/>' +
        '<circle cx="148" cy="72" r="16" fill="#ffe0a0" opacity=".55"/>' +
        '<rect x="34" y="116" width="252" height="10" rx="5" fill="#8a5a30"/>' +
        '<rect x="52" y="126" width="9" height="42" fill="#6d4526"/><rect x="260" y="126" width="9" height="42" fill="#6d4526"/>' +
        '<ellipse cx="126" cy="112" rx="18" ry="7" fill="#d9c7a4"/><path d="M116 100h20l-3 12h-14z" fill="#efe2c8"/>' +
        '<path d="M138 102q12 4 0 10" stroke="#efe2c8" stroke-width="3" fill="none"/>' +
        '<ellipse cx="186" cy="114" rx="12" ry="5" fill="#e8dcc0"/><ellipse cx="216" cy="114" rx="12" ry="5" fill="#e8dcc0"/>' +
        '<ellipse cx="246" cy="114" rx="12" ry="5" fill="#e8dcc0"/>' +
        '<path d="M184 96q6-10 0-18M216 98q6-10 0-18" stroke="#f6e8cc" stroke-width="2" opacity=".35" fill="none"/>' +
        '</svg>';
    }
    if (scene === 'stairwell') {
      return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
        '<rect width="320" height="180" fill="#3b3731"/>' +
        '<rect x="0" y="120" width="320" height="60" fill="#2a2722"/>' +
        '<rect x="26" y="24" width="84" height="92" rx="3" fill="#1b2638"/>' +
        '<path d="M26 92 110 44v72H26Z" fill="#e7a86a" opacity=".22"/>' +
        '<rect x="64" y="24" width="6" height="92" fill="#6b6257"/><rect x="26" y="66" width="84" height="6" fill="#6b6257"/>' +
        '<path d="M152 180V126h34v-26h34v-26h34v-24h34v-14" stroke="#5d574d" stroke-width="10" fill="none"/>' +
        '<path d="M146 150h36M182 124h36M218 98h36M254 72h36" stroke="#7a7265" stroke-width="4"/>' +
        '<path d="M150 42v96M254 22v96" stroke="#8b8274" stroke-width="3"/>' +
        '<text x="188" y="52" font-family="Inter, sans-serif" font-size="30" fill="#d8c8a4" opacity=".85">5</text>' +
        '<rect x="30" y="96" width="10" height="20" rx="3" fill="#d9c7a4"/>' +
        '<path d="M50 116q26-14 52 0" stroke="#8a3f3f" stroke-width="4" fill="none" opacity=".8"/>' +
        '</svg>';
    }
    if (scene === 'evening') {
      return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
        '<rect width="320" height="180" fill="#2a2438"/>' +
        '<circle cx="244" cy="58" r="30" fill="#f2a45b" opacity=".3"/>' +
        '<circle cx="244" cy="58" r="15" fill="#f8ce92" opacity=".8"/>' +
        '<path d="M0 120 30 96 54 110 84 84 118 112 150 92 182 114 214 88 248 112 280 96 320 118V180H0Z" fill="#171a2b"/>' +
        '<g fill="#101322"><rect x="18" y="108" width="40" height="72"/><rect x="76" y="96" width="34" height="84"/><rect x="130" y="112" width="46" height="68"/><rect x="198" y="100" width="38" height="80"/><rect x="254" y="110" width="52" height="70"/></g>' +
        '<g fill="#f6c96e" opacity=".8"><rect x="28" y="120" width="5" height="7"/><rect x="44" y="140" width="5" height="7"/><rect x="84" y="110" width="5" height="7"/><rect x="142" y="128" width="5" height="7"/><rect x="208" y="116" width="5" height="7"/><rect x="268" y="128" width="5" height="7"/></g>' +
        '<path d="M0 168h320" stroke="#3c3550" stroke-width="14"/>' +
        '<path d="M22 168h48M108 168h48M194 168h48M272 168h30" stroke="#ffd782" stroke-width="2.5" opacity=".7"/>' +
        '</svg>';
    }
    if (scene === 'apa_kitchen') {
      return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
        '<rect width="320" height="180" fill="#3b2a1d"/>' +
        '<rect width="320" height="116" fill="#8a6438"/>' +
        '<rect y="116" width="320" height="64" fill="#553a24"/>' +
        '<rect x="18" y="20" width="86" height="66" rx="3" fill="#1d2338"/>' +
        '<rect x="22" y="24" width="78" height="58" fill="#5c4058"/>' +
        '<circle cx="80" cy="58" r="13" fill="#f2b57c" opacity=".85"/>' +
        '<path d="M22 82 40 60 54 72 70 54 86 74 100 62v20H22Z" fill="#2a2438"/>' +
        '<g fill="#ffd282" opacity=".85"><rect x="30" y="74" width="4" height="5"/><rect x="48" y="78" width="4" height="5"/><rect x="66" y="76" width="4" height="5"/><rect x="86" y="72" width="4" height="5"/></g>' +
        '<rect x="59" y="24" width="2" height="58" fill="#6b5137"/><rect x="22" y="52" width="78" height="2" fill="#6b5137"/>' +
        '<path d="M12 16h16v74H12z" fill="#b7834f"/><path d="M94 16h14v74H94z" fill="#c08f5e"/>' +
        '<rect x="198" y="44" width="108" height="4" rx="1" fill="#8a5a30"/>' +
        '<g><rect x="206" y="26" width="14" height="18" rx="2" fill="#c0503f"/><rect x="228" y="30" width="14" height="14" rx="2" fill="#d9a43c"/><rect x="250" y="24" width="14" height="20" rx="2" fill="#7fa04a"/><rect x="272" y="32" width="14" height="12" rx="2" fill="#b06a8a"/></g>' +
        '<path d="M150 0v22" stroke="#3a2f22" stroke-width="2"/>' +
        '<path d="M130 22h40l-7 13h-26z" fill="#2f6a4d"/>' +
        '<circle cx="150" cy="40" r="24" fill="#ffce84" opacity=".14"/>' +
        '<ellipse cx="150" cy="35" rx="20" ry="3" fill="#ffe4a8"/>' +
        '<rect x="226" y="12" width="62" height="30" rx="3" fill="#8a5a30"/>' +
        '<rect x="230" y="16" width="30" height="22" rx="2" fill="#c9a86e"/>' +
        '<path d="M232 22h26M232 27h26M232 32h26" stroke="#8a5a30" stroke-width="1.4" opacity=".6"/>' +
        '<circle cx="274" cy="25" r="7" fill="#2f2a24" stroke="#e8d8b8" stroke-width="1.2"/>' +
        '<circle cx="271" cy="34" r="2" fill="#e2574c"/>' +
        '<rect x="228" y="104" width="92" height="48" rx="3" fill="#d6cdb9"/>' +
        '<rect x="228" y="100" width="92" height="6" fill="#3a3a37"/>' +
        '<ellipse cx="274" cy="100" rx="38" ry="12" fill="#3a3632"/>' +
        '<ellipse cx="274" cy="97" rx="33" ry="9" fill="#e0a03c"/>' +
        '<g fill="#efc478"><rect x="252" y="92" width="9" height="6" rx="1" transform="rotate(20 256 95)"/><rect x="266" y="90" width="9" height="6" rx="1" transform="rotate(-15 270 93)"/><rect x="280" y="93" width="9" height="6" rx="1" transform="rotate(30 284 96)"/><rect x="292" y="90" width="8" height="5" rx="1" transform="rotate(-24 296 92)"/></g>' +
        '<path d="M260 86q4-9 0-17M288 88q4-9 0-17" stroke="#fffaf0" stroke-width="2" opacity=".32" fill="none"/>' +
        '<rect x="38" y="124" width="232" height="8" rx="2" fill="#c9a36a"/>' +
        '<rect x="46" y="132" width="8" height="40" fill="#6b4a2c"/><rect x="254" y="132" width="8" height="40" fill="#6b4a2c"/>' +
        '<rect x="54" y="118" width="96" height="6" rx="2" fill="#b98a55"/>' +
        '<g fill="#f7ead0"><ellipse cx="70" cy="114" rx="10" ry="4.5"/><ellipse cx="92" cy="113" rx="10" ry="4.5"/><ellipse cx="114" cy="115" rx="10" ry="4.5"/></g>' +
        '<g transform="rotate(-6 120 111)"><rect x="74" y="107" width="84" height="7" rx="3" fill="#8a5a30"/><rect x="68" y="109" width="8" height="4" rx="2" fill="#6d4526"/><rect x="156" y="109" width="8" height="4" rx="2" fill="#6d4526"/></g>' +
        '<ellipse cx="196" cy="119" rx="24" ry="6" fill="#efe4cc"/>' +
        '<g fill="#e8b45c"><rect x="184" y="111" width="8" height="5" rx="1" transform="rotate(18 188 113)"/><rect x="195" y="110" width="8" height="5" rx="1" transform="rotate(-22 199 112)"/><rect x="206" y="112" width="8" height="5" rx="1" transform="rotate(12 210 114)"/></g>' +
        '<path d="M224 116h16q5 0 4 5h-24q-1-5 4-5Z" fill="#efe4cc"/><path d="M238 118q7 2 0 5" stroke="#efe4cc" stroke-width="2.5" fill="none"/>' +
        '<path d="M232 108q3-6 0-12M240 110q3-6 0-12" stroke="#fffaf0" stroke-width="2" opacity=".3" fill="none"/>' +
        '</svg>';
    }
    if (scene === 'school_evening') {
      return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
        '<rect width="320" height="180" fill="#241f36"/>' +
        '<rect width="320" height="108" fill="#4a3554"/>' +
        '<rect y="72" width="320" height="36" fill="#a75f60" opacity=".7"/>' +
        '<rect y="96" width="320" height="24" fill="#e99a6c" opacity=".8"/>' +
        '<circle cx="246" cy="96" r="34" fill="#f2a45b" opacity=".28"/>' +
        '<circle cx="246" cy="96" r="14" fill="#f8ce92" opacity=".9"/>' +
        '<path d="M0 112 38 76 70 96 104 64 140 100 176 74 212 102 250 78 288 100 320 84V132H0Z" fill="#3d2f4a"/>' +
        '<path d="M0 116 44 92 84 108 126 86 168 110 214 92 260 112 320 96V132H0Z" fill="#2c2438"/>' +
        '<g fill="#ff9a8a" opacity=".35"><path d="M38 76 26 92h24zM104 64 88 86h32zM176 74 162 92h28zM250 78 238 94h24z"/></g>' +
        '<rect x="22" y="48" width="186" height="76" fill="#b8a48b"/>' +
        '<rect x="22" y="44" width="186" height="6" fill="#8f7a63"/>' +
        '<g fill="#ffd282"><rect x="34" y="56" width="14" height="16" rx="1"/><rect x="58" y="56" width="14" height="16" rx="1"/><rect x="106" y="56" width="14" height="16" rx="1"/><rect x="130" y="56" width="14" height="16" rx="1"/><rect x="178" y="56" width="14" height="16" rx="1"/></g>' +
        '<g fill="#2a2438"><rect x="82" y="56" width="14" height="16" rx="1"/><rect x="154" y="56" width="14" height="16" rx="1"/></g>' +
        '<g fill="#ffd282"><rect x="34" y="82" width="14" height="16" rx="1"/><rect x="82" y="82" width="14" height="16" rx="1"/><rect x="130" y="82" width="14" height="16" rx="1"/><rect x="178" y="82" width="14" height="16" rx="1"/></g>' +
        '<g fill="#2a2438"><rect x="58" y="82" width="14" height="16" rx="1"/><rect x="106" y="82" width="14" height="16" rx="1"/><rect x="154" y="82" width="14" height="16" rx="1"/></g>' +
        '<rect x="104" y="100" width="24" height="24" fill="#3b3028"/>' +
        '<rect x="104" y="108" width="24" height="16" fill="#ffce84" opacity=".7"/>' +
        '<rect x="112" y="34" width="52" height="16" rx="2" fill="#1f4f93"/>' +
        '<text x="138" y="45" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#f2f4f6" text-anchor="middle">ШКОЛА № 61</text>' +
        '<rect x="22" y="124" width="296" height="56" fill="#2c2733"/>' +
        '<path d="M236 124v-34M268 124v-34M232 94h40M232 106h40" stroke="#5d5763" stroke-width="3"/>' +
        '<circle cx="270" cy="100" r="7" fill="none" stroke="#d9483f" stroke-width="2"/>' +
        '<path d="M208 124v-40" stroke="#4a4148" stroke-width="3"/>' +
        '<circle cx="208" cy="82" r="4" fill="#ffe0a8"/><circle cx="208" cy="82" r="12" fill="#ffce84" opacity=".16"/>' +
        '<g fill="#f0d9a8" opacity=".55"><rect x="40" y="140" width="26" height="6"/><rect x="90" y="140" width="26" height="6"/><rect x="140" y="140" width="26" height="6"/></g>' +
        '<g fill="#ffd282" opacity=".75"><rect x="30" y="152" width="4" height="4"/><rect x="82" y="154" width="4" height="4"/><rect x="132" y="152" width="4" height="4"/><rect x="182" y="154" width="4" height="4"/></g>' +
        '</svg>';
    }
    if (scene === 'south_panorama') {
      return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
        '<rect width="320" height="180" fill="#151a32"/>' +
        '<rect y="52" width="320" height="40" fill="#3a2b4c"/>' +
        '<rect y="92" width="320" height="34" fill="#8a4e5e"/>' +
        '<rect y="126" width="320" height="22" fill="#d97b62"/>' +
        '<rect y="148" width="320" height="18" fill="#f2b47c"/>' +
        '<g fill="#fff"><rect x="26" y="18" width="2" height="2"/><rect x="74" y="30" width="2" height="2"/><rect x="128" y="14" width="2" height="2"/><rect x="188" y="26" width="2" height="2"/><rect x="242" y="12" width="2" height="2"/><rect x="292" y="32" width="2" height="2"/></g>' +
        '<circle cx="238" cy="142" r="34" fill="#f6b77c" opacity=".3"/>' +
        '<circle cx="238" cy="142" r="15" fill="#ffe0ae" opacity=".9"/>' +
        '<path d="M0 132 38 92 72 112 108 78 146 114 184 84 220 112 258 88 292 110 320 96V160H0Z" fill="#3b2e46"/>' +
        '<path d="M0 138 44 116 86 130 128 108 170 132 214 112 258 132 320 116V160H0Z" fill="#2a2438"/>' +
        '<g fill="#ff9a8a" opacity=".3"><path d="M38 92 24 110h28zM108 78 92 102h32zM184 84 170 104h28zM258 88 246 106h24z"/></g>' +
        '<g fill="#241f30"><rect x="10" y="140" width="30" height="30"/><rect x="46" y="132" width="24" height="38"/><rect x="76" y="144" width="34" height="26"/><rect x="116" y="136" width="26" height="34"/><rect x="148" y="146" width="38" height="24"/><rect x="192" y="138" width="28" height="32"/><rect x="226" y="146" width="36" height="24"/><rect x="268" y="136" width="30" height="34"/></g>' +
        '<g fill="#ffd282" opacity=".9"><rect x="18" y="146" width="4" height="5"/><rect x="32" y="154" width="4" height="5"/><rect x="52" y="140" width="4" height="5"/><rect x="84" y="150" width="4" height="5"/><rect x="124" y="144" width="4" height="5"/><rect x="156" y="152" width="4" height="5"/><rect x="200" y="144" width="4" height="5"/><rect x="234" y="152" width="4" height="5"/><rect x="276" y="142" width="4" height="5"/></g>' +
        '<path d="M0 170q90-24 180-6t140 4v14H0Z" fill="#1d1926"/>' +
        '<g stroke="#5a4640" stroke-width="3"><path d="M176 156v-22M232 154v-22M288 152v-22"/></g>' +
        '<path d="M170 136h126" stroke="#6b534a" stroke-width="4"/>' +
        '<g fill="#8a5a34"><rect x="196" y="150" width="96" height="5" rx="1"/><rect x="196" y="158" width="96" height="5" rx="1"/><rect x="196" y="166" width="96" height="5" rx="1"/></g>' +
        '<g fill="#7d4f2d"><rect x="202" y="132" width="84" height="4" rx="1"/><rect x="202" y="140" width="84" height="4" rx="1"/></g>' +
        '<path d="M202 132v34M286 132v34" stroke="#5f3f26" stroke-width="4"/>' +
        '<rect x="270" y="142" width="9" height="16" rx="2" fill="#b04a3e"/><rect x="272" y="138" width="5" height="5" rx="1" fill="#8a3a32"/>' +
        '<ellipse cx="258" cy="158" rx="5" ry="2" fill="#efe4cc"/><ellipse cx="246" cy="158" rx="5" ry="2" fill="#efe4cc"/>' +
        '<path d="M300 158v-34" stroke="#3d3434" stroke-width="3"/><circle cx="300" cy="122" r="5" fill="#ffe0a8"/><circle cx="300" cy="122" r="13" fill="#ffce84" opacity=".18"/>' +
        '</svg>';
    }
    return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<rect width="320" height="180" fill="#123033"/>' +
      '<circle cx="256" cy="42" r="30" fill="#f2b64b" opacity=".26"/>' +
      '<circle cx="256" cy="42" r="15" fill="#f2b64b" opacity=".8"/>' +
      '<path d="M0 108 34 82 62 96 94 70 128 98 162 78 196 100 232 74 266 96 300 82 320 100V180H0Z" fill="#1b4446"/>' +
      '<rect x="14" y="98" width="86" height="62" rx="3" fill="#264a49"/>' +
      '<rect x="112" y="86" width="74" height="74" rx="3" fill="#2a4d4b"/>' +
      '<g fill="#f6c96e" opacity=".85"><rect x="24" y="108" width="10" height="12" rx="1"/><rect x="46" y="108" width="10" height="12" rx="1"/><rect x="68" y="130" width="10" height="12" rx="1"/><rect x="124" y="98" width="10" height="12" rx="1"/><rect x="146" y="120" width="10" height="12" rx="1"/></g>' +
      '<g><rect x="186" y="132" width="118" height="12" rx="3" fill="#8a5a30"/><rect x="192" y="144" width="7" height="18" fill="#6d4526"/><rect x="290" y="144" width="7" height="18" fill="#6d4526"/>' +
      '<path d="M190 132q56-16 110 0" stroke="#e8c98a" stroke-width="2" fill="none" opacity=".8"/>' +
      '<rect x="214" y="121" width="22" height="11" rx="3" fill="#d9b06a"/><rect x="250" y="121" width="22" height="11" rx="3" fill="#d9b06a"/>' +
      '<ellipse cx="243" cy="128" rx="12" ry="4" fill="#f3ead2"/><ellipse cx="243" cy="125" rx="6" ry="3" fill="#e8dcc0"/></g>' +
      '<path d="M18 60q86 34 170 8" stroke="#f2b64b" stroke-width="1.4" fill="none" opacity=".55"/>' +
      '<g fill="#ffd782"><circle cx="52" cy="70" r="3"/><circle cx="92" cy="78" r="3"/><circle cx="132" cy="76" r="3"/><circle cx="172" cy="70" r="3"/></g>' +
      '<g fill="#ffb36b"><circle cx="222" cy="146" r="2.5"/><circle cx="268" cy="140" r="2.5"/><circle cx="286" cy="150" r="2.2"/></g>' +
      '</svg>';
  }

  function postcardElement(pc, opts) {
    opts = opts || {};
    const card = document.createElement('article');
    card.className = 'postcard' +
      (opts.compact ? ' is-compact' : '') +
      (opts.brief ? ' is-brief' : '');
    card.dataset.tone = pc.tone || 'teal';

    const art = document.createElement('div');
    art.className = 'postcard-art';
    art.innerHTML = postcardArt(pc.scene);

    const body = document.createElement('div');
    body.className = 'postcard-body';

    const kicker = document.createElement('span');
    kicker.className = 'postcard-kicker';
    kicker.textContent = pc.kicker || 'Открытка памяти';
    const title = document.createElement('h3');
    title.className = 'postcard-title';
    title.textContent = pc.title || '';
    const sub = document.createElement('p');
    sub.className = 'postcard-sub';
    sub.textContent = pc.subtitle || '';
    const text = document.createElement('p');
    text.className = 'postcard-text';
    text.appendChild(glossaryFragment(pc.text || ''));
    const bata = document.createElement('blockquote');
    bata.className = 'postcard-bata';
    const bataLabel = document.createElement('span');
    bataLabel.textContent = 'Бата';
    const bataText = document.createElement('em');
    bataText.textContent = '«' + (pc.bata || '') + '»';
    bata.append(bataLabel, bataText);

    const items = document.createElement('div');
    items.className = 'postcard-items';
    (pc.items || []).forEach((id) => {
      const def = BD.MEMORY && BD.MEMORY[id];
      if (!def) return;
      const chip = document.createElement('span');
      chip.className = 'memory-chip';
      chip.title = def.desc || '';
      const ico = document.createElement('span');
      ico.className = 'memory-ico';
      ico.innerHTML = icon(def.icon);
      const label = document.createElement('span');
      label.textContent = def.label;
      chip.append(ico, label);
      items.appendChild(chip);
    });
    if (!items.children.length) items.hidden = true;

    const foot = document.createElement('div');
    foot.className = 'postcard-foot';
    const stamp = document.createElement('span');
    stamp.className = 'postcard-stamp';
    stamp.textContent = pc.stamp || 'БИШКЕК';
    const mark = document.createElement('span');
    mark.className = 'postcard-mark';
    mark.innerHTML = icon(pc.icon || 'star');
    foot.append(stamp, mark);

    body.append(kicker, title, sub, text, bata, items, foot);
    if (opts.brief) {
      kicker.remove();
      title.remove();
      text.remove();
    }
    card.append(art, body);
    return card;
  }

  function renderAlbum() {
    if (!dom.albumGrid) return;
    dom.albumGrid.innerHTML = '';
    if (!album.length) {
      const empty = document.createElement('div');
      empty.className = 'album-empty';
      empty.innerHTML = '<strong>Пока пусто.</strong><span>Проживите день в Востоке-5 — и двор оставит вам открытку.</span>';
      dom.albumGrid.appendChild(empty);
    } else {
      album.forEach((pc) => dom.albumGrid.appendChild(postcardElement(pc)));
    }
    if (!dom.albumMemory) return;
    const ids = [];
    album.forEach((pc) => (pc.items || []).forEach((id) => { if (ids.indexOf(id) < 0) ids.push(id); }));
    dom.albumMemory.innerHTML = '';
    if (!ids.length) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = 'Предметы появятся вместе с открытками.';
      dom.albumMemory.appendChild(note);
      return;
    }
    ids.forEach((id) => {
      const def = BD.MEMORY && BD.MEMORY[id];
      if (!def) return;
      const chip = document.createElement('span');
      chip.className = 'memory-chip';
      chip.title = def.desc || '';
      const ico = document.createElement('span');
      ico.className = 'memory-ico';
      ico.innerHTML = icon(def.icon);
      const label = document.createElement('span');
      label.textContent = def.label;
      chip.append(ico, label);
      dom.albumMemory.appendChild(chip);
    });
  }

  function openAlbum() {
    if (!dom.album) return;
    renderAlbum();
    dom.album.hidden = false;
    document.body.classList.add('album-open');
    audio && audio.play('whoosh');
    setTimeout(() => { if (dom.albumCloseBtn) dom.albumCloseBtn.focus({ preventScroll: true }); }, 80);
  }

  function closeAlbum() {
    if (!dom.album || dom.album.hidden) return;
    dom.album.hidden = true;
    document.body.classList.remove('album-open');
  }

  /* -------------------- пятнадцать секунд тишины ----------------------- */

  let vignetteTimer = 0;
  let vignetteDone = null;

  function closeVignette() {
    if (!dom.vignette || dom.vignette.hidden) return;
    clearTimeout(vignetteTimer);
    vignetteTimer = 0;
    dom.vignette.hidden = true;
    document.body.classList.remove('vignette-open');
    const fn = vignetteDone;
    vignetteDone = null;
    if (fn) fn();
  }

  function showVignette(ev, done) {
    if (!dom.vignette || !ev || !ev.vignette) { if (done) done(); return; }
    engine.state.vignettesShown.add(ev.id);
    dom.vignetteWho.textContent = ev.vignette.who || ev.place || '';
    dom.vignetteKicker.textContent = kickerText(ev, engine.state) || 'Пауза';
    dom.vignetteText.textContent = ev.vignette.text || '';
    dom.vignette.hidden = false;
    document.body.classList.add('vignette-open');
    if (dom.vignetteBar) {
      dom.vignetteBar.style.animation = 'none';
      void dom.vignetteBar.offsetWidth;
      dom.vignetteBar.style.animation = '';
    }
    vignetteDone = done;
    clearTimeout(vignetteTimer);
    vignetteTimer = setTimeout(closeVignette, 15000);
    audio && audio.play('soft');
    setTimeout(() => { if (dom.vignetteSkip) dom.vignetteSkip.focus({ preventScroll: true }); }, 120);
  }

  /* ------------------------------ звук -------------------------------- */

  function ambienceFor(scene, state) {
    if (!audio || !audio.setAmbience) return;
    const map = {
      home: 'home', parents_home: 'home', kitchen_night: 'home', apa_kitchen: 'home',
      courtyard: 'courtyard', stairwell: 'stairwell',
      bazaar: 'market', traffic: 'street', evening: 'street', mall: 'street',
      school_evening: 'breeze', south_panorama: 'breeze',
      office: 'day', school: 'day', park: 'day'
    };
    audio.setAmbience(map[scene] || null, { rain: !!(state && state.vars && state.vars.weather === 'rain') });
  }

  /* ---------------------------- переходы ------------------------------- */

  function nextEvent() {
    if (!engine || !pending) return;
    audio && audio.play('next');
    pending = null;
    const r = engine.next();
    if (r.done) { showSummary(); return; }
    renderEvent();
    const ev = engine.event;
    if (ev && ev.vignette && !engine.state.vignettesShown.has(ev.id)) {
      showVignette(ev, () => {
        dom.eventCard.scrollTop = 0;
        const first = dom.choices.querySelector('.choice:not(:disabled)');
        if (first) first.focus({ preventScroll: true });
      });
    }
  }

  /* ---------------------------- финалы -------------------------------- */

  const SOFT_TIPS = {
    exhaustion: 'Силы кончились раньше дня — это не провал. В Бишкеке на такое говорят: «Спи, сынок, утро само разберётся».',
    burnout: 'Иногда надо не доделать, а выдохнуть. Двор без вас не развалится, а чай можно выпить и завтра.',
    bankrupt: 'Двор не считает сомы. Долг отдашь — сначала поешь. Так тут принято.',
    default: 'День можно закончить раньше. От этого он не становится хуже — просто становится короче.'
  };

  function showGameOver(outcome) {
    const s = engine.state;
    const soft = BD.pickSoftPostcard ? BD.pickSoftPostcard(s, outcome.ending) : null;
    const pc = BD.hydratePostcard ? BD.hydratePostcard(soft, s) : soft;
    const tone = (pc && pc.tone) || 'teal';

    showScreen('gameover');
    document.body.dataset.tone = tone;
    dom.gameoverKicker.textContent = (pc && pc.kicker) || 'Тихий финал';
    dom.gameoverTitle.textContent = (pc && pc.title) || 'День решил остановиться';
    dom.gameoverText.textContent = (pc && pc.text) || 'Вы дошли до вечера, но силы закончились раньше планов.';
    dom.gameoverTip.textContent = SOFT_TIPS[outcome.ending] || SOFT_TIPS.default;
    dom.gameoverIcon.innerHTML = icon((pc && pc.icon) || 'night');
    dom.goBudget.textContent = fmtMoney(s.budget) + ' сом';
    dom.goEnergy.textContent = Math.round(s.energy) + '%';
    dom.goStress.textContent = Math.round(s.stress) + '%';
    dom.goTime.textContent = fmtTime(s.time);
    dom.goLast.textContent = outcome.result
      ? 'Последнее, что вы успели: ' + outcome.result
      : 'День закончился раньше, чем вы успели к нему привыкнуть.';

    if (dom.softPostcard) {
      dom.softPostcard.innerHTML = '';
      if (pc) {
        dom.softPostcard.appendChild(postcardElement(pc, { compact: true, brief: true }));
        savePostcard(pc);
      }
      dom.softPostcard.hidden = !pc;
    }

    dom.restartBtn.innerHTML = 'Прожить день иначе ' + icon('restart');
    audio && audio.play('soft');
    const scene = (pc && pc.scene) || 'evening';
    renderer.setScene(scene);
    renderer.setFestive(scene === 'courtyard');
    renderer.setTime(Math.min(s.time, 20 * 60 + 30));
    ambienceFor(scene, s);
    setTimeout(() => dom.restartBtn.focus({ preventScroll: true }), 300);
  }

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

  function renderSummaryStory(sum, pc) {
    if (dom.postcardPanel && dom.postcardMount) {
      dom.postcardMount.innerHTML = '';
      if (pc) {
        dom.postcardMount.appendChild(postcardElement(pc));
        savePostcard(pc);
        dom.postcardPanel.hidden = false;
      } else {
        dom.postcardPanel.hidden = true;
      }
    }

    const bonds = sum.bonds || {};
    const keys = (BD.BOND_ORDER || Object.keys(bonds)).filter((k) => (bonds[k] || 0) > 0);
    const items = sum.memoryItems || [];
    const districtId = sum.district && sum.district.id;

    if (dom.summaryBonds) {
      dom.summaryBonds.innerHTML = '';
      keys.forEach((name) => {
        const def = (BD.BONDS && BD.BONDS[name]) || { label: name, icon: 'heart' };
        const chip = document.createElement('span');
        chip.className = 'bond-chip';
        chip.title = def.hint || '';
        const ico = document.createElement('span');
        ico.className = 'bond-ico';
        ico.innerHTML = icon(def.icon);
        const label = document.createElement('span');
        label.className = 'bond-name';
        label.textContent = BD.bondLabel ? BD.bondLabel(name, districtId) : def.label;
        const count = document.createElement('b');
        count.className = 'bond-count';
        count.textContent = '· ' + bonds[name];
        chip.append(ico, label, count);
        dom.summaryBonds.appendChild(chip);
      });
      if (!keys.length) {
        const note = document.createElement('p');
        note.className = 'empty-note';
        note.textContent = 'День прошёл без новых знакомств.';
        dom.summaryBonds.appendChild(note);
      }
    }

    if (dom.summaryMemory) {
      dom.summaryMemory.innerHTML = '';
      items.forEach((item) => {
        const chip = document.createElement('span');
        chip.className = 'memory-chip';
        chip.title = item.desc || '';
        const ico = document.createElement('span');
        ico.className = 'memory-ico';
        ico.innerHTML = icon(item.icon || 'star');
        const label = document.createElement('span');
        label.textContent = item.label;
        chip.append(ico, label);
        dom.summaryMemory.appendChild(chip);
      });
      if (!items.length) {
        const note = document.createElement('p');
        note.className = 'empty-note';
        note.textContent = 'Ничего не взяли с собой — только вечер.';
        dom.summaryMemory.appendChild(note);
      }
    }

    if (dom.summaryMemoryCount) dom.summaryMemoryCount.textContent = String(items.length);
    if (dom.bondsPanel) dom.bondsPanel.hidden = !(keys.length || items.length);
    updateAlbumCount();
  }

  function showSummary() {
    if (!engine) return;
    const sum = engine.summary || engine.finish();
    const pc = sum.postcard && BD.hydratePostcard ? BD.hydratePostcard(sum.postcard, engine.state) : null;
    showScreen('summary');
    renderer.setScene(pc ? pc.scene : 'evening');
    renderer.setFestive(!!pc && pc.scene === 'courtyard');
    renderer.setTime(CONFIG.dayEnd);
    document.body.dataset.tone = 'teal';
    ambienceFor(pc ? pc.scene : 'evening', engine.state);
    renderSummaryStory(sum, pc);

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
    showScreen('intro');
    document.body.dataset.tone = 'teal';
    renderer.setScene('traffic');
    renderer.setTime(CONFIG.dayStart);
    if (audio && audio.setAmbience) audio.setAmbience(null);
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

    if (dom.albumBtn) dom.albumBtn.addEventListener('click', openAlbum);
    if (dom.albumCloseBtn) dom.albumCloseBtn.addEventListener('click', closeAlbum);
    document.querySelectorAll('[data-album]').forEach((b) => b.addEventListener('click', openAlbum));
    document.querySelectorAll('[data-album-close]').forEach((b) => b.addEventListener('click', closeAlbum));
    if (dom.vignetteSkip) dom.vignetteSkip.addEventListener('click', closeVignette);

    if (dom.volRange && audio) {
      dom.volRange.value = String(Math.round((audio.volume != null ? audio.volume : 0.7) * 100));
      dom.volRange.addEventListener('input', () => {
        audio.setVolume(Number(dom.volRange.value) / 100);
        if (audio.muted) { audio.setMuted(false); updateMuteUI(); }
      });
    }

    [dom.startBtn, dom.playAgainBtn, dom.districtBtn, dom.restartBtn, dom.goDistrictBtn,
      dom.menuBtn, dom.goMenuBtn, dom.districtBackBtn, dom.muteBtn].forEach((b) => {
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
      if (dom.album && !dom.album.hidden) {
        if (key === 'Escape' || key === 'Backspace') { e.preventDefault(); closeAlbum(); }
        return;
      }
      if (dom.vignette && !dom.vignette.hidden) {
        if (key === 'Escape' || key === 'Enter' || key === ' ') { e.preventDefault(); closeVignette(); }
        return;
      }
      if (key === 'm' || key === 'M' || key === 'ь' || key === 'Ь') {
        toggleMute();
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
    renderer = new BD.Renderer($('scene'));
    renderer.setScene('traffic');
    renderer.setTime(CONFIG.dayStart);
    try { bestScore = parseInt(localStorage.getItem('bd_best') || '0', 10) || 0; } catch (e) { bestScore = 0; }
    updateMuteUI();
    updateIntroBest();
    updateAlbumCount();
    renderDistricts();
    bind();
    showScreen('intro');
    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);

/* Ядро контента: конфиг, статусы, наложение районных правок (applyDistrict). */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const T = (h, m = 0) => h * 60 + m;

  BD.DISTRICTS = [];

  BD.CONFIG = {
    startMoney: 2500,
    startEnergy: 75,
    startStress: 20,
    dayStart: T(7, 30),
    dayEnd: T(21, 30),
    moneyScale: 5000
  };

  /* Статусы, которые показываются чипами в карточке события. */
  BD.STATUS = {
    headache: {
      label: 'Головная боль', tone: 'bad', priority: 1,
      hint: 'Голодное утро + набитая маршрутка. Срочный заказ в таком состоянии лучше не брать.'
    },
    soaked: {
      label: 'Промок', tone: 'bad', priority: 1,
      hint: 'Дождь застал без зонта. Вечерняя дорога будет тяжелее.'
    },
    childUpset: {
      label: 'Ребёнок расстроен', tone: 'bad', priority: 1,
      hint: 'Кружок не оплачен. Вечером этот разговор всё равно случится.'
    },
    lateToSchool: {
      label: 'Опоздали в школу', tone: 'warn', priority: 2,
      hint: 'Учительница всё видела. Вечером будет отдельный разговор.'
    },
    schoolPaymentDeferred: {
      label: 'Кружок не оплачен', tone: 'warn', priority: 2,
      hint: 'Вы попросили отсрочку до аванса. Долг никуда не делся.'
    },
    utilityUnpaid: {
      label: 'Коммуналка ждёт', tone: 'warn', priority: 2,
      hint: 'Счётчик не оплачен. Напоминание уже висит в уведомлениях.'
    },
    owesFavor: {
      label: 'Должны Азамату', tone: 'info', priority: 3,
      hint: 'Коллега выручил с авралом. Услуга имеет свойство возвращаться.'
    },
    colleagueOffended: {
      label: 'Азамат обиделся', tone: 'warn', priority: 3,
      hint: 'Вы ушли вовремя, а он остался. Завтра придётся объясняться.'
    },
    boughtFreshBread: {
      label: 'Свежий хлеб', tone: 'good', priority: 4,
      hint: 'Ещё тёплый. В Бишкеке — универсальная валюта добрососедства.'
    },
    helpedNeighbor: {
      label: 'Доброе дело', tone: 'good', priority: 5,
      hint: 'Сумки донесены. Совесть работает лучше любого фитнеса.'
    },
    weatherReady: {
      label: 'Готов к погоде', tone: 'good', priority: 4,
      hint: 'Зонт или машина под рукой. Дождь больше не хозяин вечера.'
    },
    caffeinated: {
      label: 'Кофеин в крови', tone: 'good', priority: 6,
      hint: 'Мир снова резкий. Главное — не перепутать бодрость с бессмертием.'
    },
    helpedRelative: {
      label: 'Выручил родню', tone: 'good', priority: 3,
      hint: 'Поручение выполнено. В семейном чате временно тихо.'
    },
    visitedParents: {
      label: 'Заехал к родителям', tone: 'good', priority: 3,
      hint: 'Полчаса за чаем стоят дороже любых скидок.'
    },
    gotSarkyt: {
      label: 'Есть саркыт', tone: 'good', priority: 4,
      hint: 'Мама собрала контейнеры с едой. Ужин дома можно не заказывать.'
    },
    helpedDad: {
      label: 'Помог отцу', tone: 'good', priority: 3,
      hint: 'Папа сказал «нормально». От него это почти орден.'
    },
    stuckInTraffic: {
      label: 'В пробке', tone: 'warn', priority: 5,
      hint: 'Чуй стоит. Вы уже поняли, что значит «ещё пять минут».'
    },
    inDebt: {
      label: 'В долг до пятницы', tone: 'warn', priority: 2,
      hint: 'Запись в тетрадке или перевод от родни. Деньги вернуться придётся.'
    },
    owesBakyt: {
      label: 'Должны Бакыту', tone: 'info', priority: 3,
      hint: 'Сосед подвёз утром. Двор помнит такие вещи.'
    },
    owesNurlan: {
      label: 'Должны Нурлану', tone: 'info', priority: 3,
      hint: 'Одноклассник одолжил до пятницы. Лучше не пропадать.'
    },
    neighborGratitude: {
      label: 'Ужин от апы', tone: 'good', priority: 5,
      hint: 'Доброе дело вернулось тарелкой горячего.'
    }
  };



  BD.DEFAULT_DISTRICT = 'south';

  BD.getDistrict = function (id) {
    const key = id === 'vostok' ? 'vostok5' : id; // старое имя района тоже принимается
    return BD.DISTRICTS.find((d) => d.id === key) || null;
  };

  /* Накладывает районные правки на событие, не мутируя исходный контент. */
  /* Гарантия «без тупиков»: в каждом событии есть вариант за 0 сом без условий.
     Если ни у базы, ни у района его нет — добавляется бесплатный запасной вариант. */
  BD.FALLBACKS = {
    traffic: {
      id: 'walk-free', title: 'Пойти пешком',
      desc: 'Свежий воздух, наушники и сорок минут вдоль дороги. Бесплатно, зато на своих двоих.',
      minutes: 40, fx: { energy: -16, stress: 4 },
      flags: ['walkedToWork'], vars: { transportType: 'walk', stuckInTraffic: false },
      result: 'Вы дошли пешком мимо всех пробок сразу. Машины стояли, а вы шли — редкое утреннее удовольствие.'
    },
    afternoon: {
      id: 'close-laptop', title: 'Отложить всё до завтра',
      desc: 'Закрыть вкладки, выпить воды из кулера и ничего не оплачивать. Деньги не нужны.',
      minutes: 20, fx: { energy: 4, stress: -4 },
      flags: ['postponedChores'], vars: { postponed: true },
      result: 'Вы закрыли ноутбук и честно сказали себе: «Завтра». Счёт за свет подождёт, он терпеливый.'
    },
    bazaar: {
      id: 'fridge-dinner', scene: 'home', title: 'Ужин из того, что есть в холодильнике',
      desc: 'Яйца, макароны и полпучка зелени. Ноль сом и чуть-чуть фантазии.',
      minutes: 25, fx: { energy: -5, stress: 3 },
      flags: ['fridgeDinner'], vars: { shoppingPlace: 'холодильник' },
      result: 'Из яиц, макарон и зелени получилось нечто, что на сковороде называется «фирменным». Жить можно.'
    },
    _default: {
      id: 'free-default', title: 'Обойтись без трат',
      desc: 'Сделать всё по-простому, без денег.',
      minutes: 15, fx: { energy: -3, stress: 2 },
      result: 'Вы справились своими силами, не потратив ни сома.'
    }
  };

  function hasFreeChoice(ev) {
    return (ev.choices || []).some((c) => {
      if (c.requiredFlags || c.forbiddenFlags || c.when) return false;
      let fx = {};
      try { fx = typeof c.fx === 'function' ? (c.fx({ time: 0, has: () => false, vars: {}, budget: 0 }) || {}) : (c.fx || {}); } catch (e) { fx = { money: -1 }; }
      return !(fx.money < 0);
    });
  }

  BD.applyDistrict = function (ev, districtId) {
    const out = applyDistrictOverlay(ev, districtId);
    if (!out || out.pivot || !out.choices) return out;
    if (hasFreeChoice(out)) return out;
    const fb = BD.FALLBACKS[out.id] || BD.FALLBACKS._default;
    return Object.assign({}, out, { choices: out.choices.concat([Object.assign({}, fb)]) });
  };

  function applyDistrictOverlay(ev, districtId) {
    if (!ev || !districtId) return ev;
    const district = BD.getDistrict(districtId);
    const ov = district && district.events && district.events[ev.id];
    if (!ov) return ev;

    const out = Object.assign({}, ev);
    if (ov.place) out.place = ov.place;
    if (ov.kicker) out.kicker = ov.kicker;
    if (ov.title) out.title = ov.title;
    if (ov.scene) out.scene = ov.scene;
    if (ov.sceneLabel) out.sceneLabel = ov.sceneLabel;
    if (ov.when) out.when = ov.when;

    if (ov.replaceText !== undefined) {
      out.text = ov.replaceText;
    } else if (ov.appendText !== undefined) {
      const baseText = ev.text;
      out.text = (s) => {
        const base = typeof baseText === 'function' ? baseText(s) : (baseText || '');
        const add = typeof ov.appendText === 'function' ? ov.appendText(s) : ov.appendText;
        return add ? base + (base ? ' ' : '') + add : base;
      };
    }

    if (ov.choicesReplace) {
      out.choices = ov.choicesReplace;
    } else if (ov.choices) {
      out.choices = ev.choices.map((ch) => (
        ov.choices[ch.id] ? Object.assign({}, ch, ov.choices[ch.id]) : ch
      ));
    }

    if (ov.onEnter) {
      const baseEnter = ev.onEnter;
      out.onEnter = (s, engine) => {
        if (typeof baseEnter === 'function') baseEnter(s, engine);
        ov.onEnter(s, engine);
      };
    }

    return out;
  }

})(typeof window !== 'undefined' ? window : globalThis);

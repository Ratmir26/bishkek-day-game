/* Ачивки. */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const T = (h, m = 0) => h * 60 + m;

  BD.BADGES = [
    {
      id: 'survivor',
      name: 'Дожил(а) до 21:30',
      icon: 'sun',
      desc: 'День прожит. Это уже результат.',
      test: () => true
    },
    {
      id: 'strategist',
      name: 'Хранитель бюджета',
      icon: 'coin',
      desc: 'Финальный бюджет от 3000 сом и сэкономленные деньги.',
      test: (s) => s.budget >= 3000 && s.saved >= 300
    },
    {
      id: 'orto-strategist',
      name: 'Финансовый стратег Орто-Сая',
      icon: 'bread',
      desc: 'Сторговаться на рынке и сэкономить минимум 250 сом.',
      test: (s) => s.has('haggledAtBazaar') && s.saved >= 250
    },
    {
      id: 'nerves',
      name: 'Железные нервы',
      icon: 'shield',
      desc: 'Пик стресса ниже 55%. Ни одна маршрутка не сломила.',
      test: (s) => s.maxStress < 55
    },
    {
      id: 'time-master',
      name: 'Мастер бишкекского тайм-менеджмента',
      icon: 'clock',
      desc: 'Дома до 21:05, без героического овертайма.',
      test: (s) => s.endTime <= T(21, 5) && !s.has('stayedOvertime')
    },
    {
      id: 'family',
      name: 'Семьянин года',
      icon: 'heart',
      desc: 'Семейный вечер, оплаченный кружок и никаких долгов в чате.',
      test: (s) => s.has('familyTime') && s.has('schoolPaid') && !s.has('childUpset')
    },
    {
      id: 'gourmet',
      name: 'Гурман Орто-Сая',
      icon: 'bread',
      desc: 'Сторговаться на базаре и принести домой свежий хлеб.',
      test: (s) => s.has('haggledAtBazaar') && s.has('boughtFreshBread')
    },
    {
      id: 'rescuer',
      name: 'Кофейный стоик',
      icon: 'coffee',
      desc: 'Поймать головную боль и вовремя её обезвредить.',
      test: (s) => s.has('headacheTreated')
    },
    {
      id: 'deadline',
      name: 'Человек-дедлайн',
      icon: 'bolt',
      desc: 'Закрыть аврал или срочный заказ в тот же день.',
      test: (s) => s.has('freelanceDone') || s.has('heroAtWork')
    },
    {
      id: 'kind',
      name: 'Добрый сосед',
      icon: 'home',
      desc: 'Помочь Апе с сумками или поделиться хлебом.',
      test: (s) => s.has('helpedNeighbor')
    },
    {
      id: 'local',
      name: 'Свой в районе',
      icon: 'road',
      desc: 'Добраться до центра районным транспортом — маршруткой, автобусом или пешком.',
      test: (s) => s.has('districtLocal')
    },
    {
      id: 'commuter',
      name: 'Выживший в пробке на Чуй',
      icon: 'road',
      desc: 'Проехать час пик в набитой маршрутке и всё равно дойти до дома.',
      test: (s) => s.has('stuckInTraffic') && s.has('crowdedMarshrutka')
    },
    {
      id: 'weatherproof',
      name: 'Готов к погоде',
      icon: 'umbrella',
      desc: 'Встретить вечерний дождь с зонтом или в такси.',
      test: (s) => s.has('weatherReady')
    },
    {
      id: 'logistics',
      name: 'Логист вечера',
      icon: 'bag',
      desc: 'Заехать к родителям, забрать ребёнка или выручить родню.',
      test: (s) => s.has('visitedParents') || s.has('pickedUpKids') || s.has('helpedRelative')
    },
    {
      id: 'caffeine',
      name: 'Кофеиновый баланс',
      icon: 'coffee',
      desc: 'Пить кофе и при этом не поймать головную боль.',
      test: (s) => s.vars.caffeinated && !s.has('headache')
    },
    {
      id: 'school-hero',
      name: 'Школьный герой',
      icon: 'school',
      desc: 'Сдать ребёнка в школу вовремя и без скандала.',
      test: (s) => s.has('childAtSchool') && !s.has('lateToSchool')
    }
  ];

  BD.BADGES.push({
    id: 'resourceful',
    name: 'Нашёл выход',
    icon: 'star',
    desc: 'Выкрутиться, когда деньги кончились или транспорт ушёл.',
    test: (s) => s.has('pivotUsed')
  });
})(typeof window !== 'undefined' ? window : globalThis);

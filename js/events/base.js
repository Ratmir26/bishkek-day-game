/* ==========================================================================
   «Один день в Бишкеке» — конфиг и статусы
   Модуль контента. Работает с общим пространством BD.
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const T = BD.T || (BD.T = (h, m) => h * 60 + m);

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

  /* ====================================================================== */
  /*  РАЙОНЫ                                                               */
  /* ====================================================================== */
})(typeof window !== 'undefined' ? window : globalThis);

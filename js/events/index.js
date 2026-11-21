/* ==========================================================================
   «Один день в Бишкеке» — сборка контента.
   Подключается последним из модулей событий: склеивает общий день и районы.
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});

  (BD.DISTRICT_EVENTS || []).forEach((ev) => BD.EVENTS.push(ev));
  BD.EVENTS.sort((a, b) => a.time - b.time);

  BD.BADGES.push({
    id: 'resourceful',
    name: 'Нашёл выход',
    icon: 'star',
    desc: 'Выкрутиться, когда деньги кончились или транспорт ушёл.',
    test: (s) => s.has('pivotUsed')
  });

  BD.getEvent = function (id) {
    return BD.EVENTS.find((ev) => ev.id === id) || null;
  };

  /* Для отладки и автотестов: список событий района в порядке дня. */
  BD.eventsFor = function (districtId) {
    const key = districtId === 'vostok' ? 'vostok5' : districtId;
    return BD.EVENTS.filter((ev) => !ev.districts || ev.districts.indexOf(key) >= 0);
  };
})(typeof window !== 'undefined' ? window : globalThis);

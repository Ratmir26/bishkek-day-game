/* Финальная сборка: порядок событий по времени. */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const T = (h, m = 0) => h * 60 + m;

  BD.EVENTS.sort((a, b) => a.time - b.time);
})(typeof window !== 'undefined' ? window : globalThis);

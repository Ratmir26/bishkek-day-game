/* Загрузчик для Node-тестов: подключает модули контента в том же порядке, что и index.html. */
const path = require('path');
['core', 'base-events', 'story-core', 'hotspots', 'districts/south', 'districts/south-story', 'districts/center', 'districts/center-story', 'districts/vostok5', 'districts/vostok5-story', 'districts/shared',
 'pivots', 'badges', 'endings', 'finalize'].forEach((m) => require(path.join(__dirname, m + '.js')));

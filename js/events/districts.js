/* ==========================================================================
   «Один день в Бишкеке» — районы, оверлеи и запасные варианты
   Модуль контента. Работает с общим пространством BD.
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const T = BD.T || (BD.T = (h, m) => h * 60 + m);

BD.DISTRICTS = [
    {
      id: 'south',
      name: 'Южные микрорайоны',
      micro: 'Асанбай · Орто-Сай · 7 Апреля',
      icon: 'mountain',
      tagline: 'Горы близко, центр — далеко',
      description: 'Дворы, школы, ДСК и рынок под боком. До центра — 195-я, 212-я или такси через Абдрахманова. Утро здесь пахнет тандыром, а вечер — пробкой.',
      route: 'Асанбай → 7 Апреля → Чуй',
      commute: 'Автобусы 195 и 212 (оплата по «Тулпару»), Южная магистраль или такси до центра.',
      start: { money: 2500, energy: 74, stress: 22 },
      chips: [
        { text: 'по «Тулпару»', tone: 'good' },
        { text: '35–45 мин', tone: 'bad' },
        { text: 'тандыр рядом', tone: 'good' }
      ],
      highlights: [
        'Школа №61 — в двух дворах',
        'Орто-Сайский рынок под боком'
      ],
      events: {
        morning: {
          appendText: 'Вы живёте в Асанбае, у 7 Апреля. Во дворе уже шумит детвора, ' +
            'с гор тянет холодом, а из соседнего подъезда пахнет свежей самсой.'
        },
        traffic: {
          place: 'Асанбай · 7 Апреля',
          kicker: '08:30 · Час пик',
          title: '7 Апреля выпускает в город',
          replaceText: 'На остановке уже стоит очередь из тех, кто тоже верит в 195-й. ' +
            '212-й подходит редко и обычно полный. Можно дойти до Южной магистрали и поймать ' +
            'любой автобус — дольше, зато можно дышать.',
          choicesReplace: [
            {
              id: 'marshrutka',
              title: 'Автобус 195 / 212',
              desc: 'Проезд по «Тулпару» и тридцать две минуты в компании чужих локтей.',
              minutes: 32,
              fx: { money: -25, energy: -12, stress: 18 },
              flags: ['crowdedMarshrutka', 'districtLocal', 'stuckInTraffic'],
              vars: { transportType: 'marshrutka', stuckInTraffic: true },
              result: 'Вы влезли в 195-й третьим, а вышли уже другим человеком. ' +
                'Водитель объявил остановки ровно один раз — и то не ту.'
            },
            {
              id: 'bus',
              title: 'Пешком к Южной магистрали',
              desc: 'Двадцать минут быстрым шагом и любой автобус с местом у окна — если повезёт.',
              minutes: 38,
              fx: { money: -20, energy: -6, stress: 8 },
              flags: ['rodeBus', 'districtLocal'],
              vars: { transportType: 'bus', stuckInTraffic: false },
              result: 'Вы дошли до Южной магистрали, поймали первый автобус, приложили «Тулпар» ' +
                'и всю дорогу смотрели, как Асанбай остаётся позади.'
            },
            {
              id: 'taxi',
              title: 'Yandex Go по Абдрахманова',
              desc: 'Триста шестьдесят сом за двадцать четыре минуты и право не толкаться.',
              minutes: 24,
              fx: { money: -360, energy: 6, stress: -6 },
              flags: ['comfortRide'],
              vars: { transportType: 'taxi', stuckInTraffic: false },
              result: 'Водитель поехал через Абдрахманова, объехал пробку и включил что-то ' +
                'из двухтысячных. Дорого, зато вы приехали в офис человеком.'
            }
          ]
        },
        'school-run': {
          place: 'Школа №61 · Асанбай',
          title: 'Школа №61 и утренний двор',
          appendText: 'Школа №61 — в двух дворах, но подъезд к ней уже забит родительскими машинами. ' +
            'Ребёнок идёт рядом и напоминает, что опаздывать некрасиво.'
        },
        'local-emergency': {
          appendText: 'Из Асанбая звонит двоюродная сестра: просит забрать посылку, пока вы в центре.'
        },
        bazaar: {
          appendText: 'До Орто-Сайского рынка отсюда рукой подать — грех не заскочить за самсой.',
          choicesReplace: [
            {
              id: 'orto-sai',
              scene: 'bazaar',
              title: 'Орто-Сай: торговаться до победы',
              desc: 'Свежее, дешевле и с уважением к процессу. Только времени больше.',
              minutes: 50,
              fx: (s) => ({
                money: s.time > T(18, 30) ? -1200 : -1150,
                energy: -14,
                stress: s.has('soaked') ? 14 : (s.time > T(18, 30) ? 10 : 8),
                saved: s.time > T(18, 30) ? 300 : 350
              }),
              flags: ['haggledAtBazaar', 'boughtFreshBread', 'boughtGroceries'],
              vars: { shoppingPlace: 'Орто-Сай', boughtGroceries: true },
              result: 'Вы сторговали хлеб, овощи и молоко. Продавец сказал «бери, уважаемый», ' +
                'и это прозвучало как победа. Свежий хлеб ещё тёплый.'
            },
            {
              id: 'globus',
              scene: 'mall', sceneLabel: '«ГЛОБУС»',
              title: '«Глобус»: супермаркет по дороге',
              desc: 'Быстрее и спокойнее, чем рынок. Чек длиннее, зато без театра торга.',
              minutes: 35,
              fx: { money: -1150, energy: -6, stress: -2, saved: 150 },
              flags: ['boughtAtGlobus', 'boughtFreshBread', 'boughtGroceries'],
              vars: { shoppingPlace: '«Глобус»', boughtGroceries: true },
              result: 'Корзина собрана за полчаса, чек длиннее, чем хотелось. Зато хлеб свежий, ' +
                'и никто не спорил за последний помидор.'
            },
            {
              id: 'delivery',
              scene: 'home',
              title: 'Доставка на дом',
              desc: 'Ноль очередей. Максимальный чек. Курьер приедет к подъезду.',
              minutes: 10,
              fx: { money: -1300, energy: 2, stress: -8 },
              flags: ['deliveryGroceries', 'boughtGroceries'],
              vars: { shoppingPlace: 'доставка', boughtGroceries: true },
              result: 'Продукты приехали через двадцать минут. Вы заплатили за комфорт тринадцать сотен — ' +
                'и всё равно не пожалели.'
            }
          ]
        },
        'evening-logistics': {
          place: 'Асанбай · вечерние дела',
          appendText: 'Родители живут в Асанбае, кружок — на 7 Апреля, а до дома ещё два двора.'
        },
        'road-home': {
          replaceText: 'Вечерний Бишкек окрашивается в оранжевый. Сумки оттягивают руки, ' +
            'а до Асанбая — тридцать пять минут на 195-м, сорок пешком по Южной магистрали ' +
            'или двадцать пять на такси.',
          choicesReplace: [
            {
              id: 'taxi-home',
              title: 'Такси до Асанбая',
              desc: 'Четыреста пятьдесят сом за двадцать пять минут и право не толкаться с пакетами.',
              minutes: 25,
              fx: { money: -450, energy: 6, stress: -8 },
              flags: ['taxiHome'],
              vars: { routeHome: 'такси до Асанбая' },
              result: 'Вы доехали с комфортом, глядя на огни Абдрахманова. Дорого, но нервы дороже.'
            },
            {
              id: 'marshrutka-home',
              title: 'Автобус 195 домой',
              desc: 'Проезд по «Тулпару» и тридцать пять минут в вечерней толкучке.',
              minutes: 35,
              fx: (s) => ({
                money: -25,
                energy: -9,
                stress: 14 + (s.has('boughtGroceries') ? 6 : 0) +
                  (s.has('soaked') ? 6 : 0) - (s.has('weatherReady') ? 4 : 0)
              }),
              flags: ['marshrutkaHome'],
              vars: { routeHome: '195-й до Асанбая' },
              result: 'Вы втиснулись с пакетами, уступили место и всё равно остались виноватым. ' +
                'Вечерний 195-й — отдельный вид спорта.'
            },
            {
              id: 'walk-home',
              title: 'Пройтись по Южной магистрали',
              desc: 'Сорок минут под фонарями, зато без давки и с видом на горы.',
              minutes: 40,
              fx: (s) => ({
                energy: -16,
                stress: -6 + (s.has('soaked') ? 8 : 0) - (s.has('weatherReady') ? 4 : 0)
              }),
              flags: ['walkedHome'],
              vars: { routeHome: 'пешком по Южной магистрали' },
              result: 'Вы прошли по Южной магистрали под фонарями. Пакеты скрипели, ' +
                'зато голова проветрилась, а горы на горизонте сделали вечер честнее.'
            }
          ]
        },
        'family-evening': {
          appendText: 'По пути вы заскочили в «Азию» за хлебом и кефиром — ' +
            'в Асанбае без этого вечер не вечер.'
        }
      }
    },

    {
      id: 'center',
      name: 'Центр',
      micro: 'Чуй / Абдрахманова · Ала-Тоо',
      icon: 'office',
      tagline: 'Всё рядом, но всё дороже',
      description: 'Офисы, университеты, ЦУМ и вечная пробка на Чуй. До работы можно дойти пешком, но за кофе и парковку придётся платить по-столичному.',
      route: 'Чуй → Абдрахманова → Ала-Тоо',
      commute: 'Автобус №7 по Чуй, пешком через центр или такси, которое всё равно стоит.',
      start: { money: 2400, energy: 78, stress: 19 },
      chips: [
        { text: '15–25 мин', tone: 'good' },
        { text: 'дороже', tone: 'bad' },
        { text: 'всё рядом', tone: 'good' }
      ],
      highlights: [
        'Ала-Тоо и офисы в пешей доступности',
        'ЦУМ, ГУМ и «Фрунзе» по пути'
      ],
      events: {
        morning: {
          appendText: 'Вы живёте в центре, на Чуй. За окном уже гудит проспект, ' +
            'а до офиса — двадцать минут пешком, если не считать светофоры и соблазн зайти за кофе.'
        },
        traffic: {
          place: 'Чуй / Абдрахманова',
          kicker: '08:30 · Час пик',
          title: 'Чуй стоит до самого Ала-Тоо',
          replaceText: 'Проспект Чуй замер от Абдрахманова до Ала-Тоо. Автобус №7 подходит ' +
            'переполненным, пешком — двадцать пять минут через дворы, а такси уже показывает ' +
            '«повышенный спрос». Классика центрального утра.',
          choicesReplace: [
            {
              id: 'bus7',
              title: 'Автобус №7 по Чуй',
              desc: 'Проезд по «Тулпару» и двадцать две минуты. Дёшево, тесно, с видом на пробку.',
              minutes: 22,
              fx: { money: -30, energy: -8, stress: 12 },
              flags: ['rodeBus7', 'districtLocal', 'stuckInTraffic'],
              vars: { transportType: 'bus7', stuckInTraffic: true },
              result: 'Вы сели в автобус №7 на Абдрахманова и вышли у Ала-Тоо. ' +
                'Двадцать две минуты счастья по цене одного латте.'
            },
            {
              id: 'walk',
              title: 'Пешком через центр',
              desc: 'Двадцать пять минут, ноль сом и утренний Бишкек без стекла.',
              minutes: 25,
              fx: { energy: -14, stress: 2 },
              flags: ['walkedToWork', 'districtLocal'],
              vars: { transportType: 'walk', stuckInTraffic: false },
              result: 'Вы прошли через дворы и бульвар, обгоняя автобус. ' +
                'В центре утро пахнет кофе и мокрым асфальтом.'
            },
            {
              id: 'taxi',
              title: 'Yandex Go через Абдрахманова',
              desc: 'Двести восемьдесят сом за пятнадцать минут и тишину без чужих разговоров.',
              minutes: 15,
              fx: { money: -280, energy: 6, stress: -8 },
              flags: ['comfortRide'],
              vars: { transportType: 'taxi', stuckInTraffic: false },
              result: 'Водитель объехал Чуй по Абдрахманова и высадил вас у самого офиса. ' +
                'Двести восемьдесят сом — но вы пришли первым.'
            }
          ]
        },
        'school-run': {
          place: 'Школа за Чуй · центр',
          title: 'Школа за проспектом',
          appendText: 'Школа — за Чуй, и переходить проспект утром нужно с запасом по времени. ' +
            'Ребёнок уже знает, где работают все светофоры, и это немного пугает.'
        },
        'local-emergency': {
          appendText: 'Пока вы в центре, родня просит заскочить в ЦУМ за «одной мелочью». ' +
            'Обычно такие мелочи весят килограмма три.'
        },
        bazaar: {
          appendText: 'ЦУМ «Айчурек», ГУМ и «Фрунзе» — в двух шагах, но за фиксированные цены приходится платить.',
          scene: 'mall', sceneLabel: 'ЦУМ «АЙЧУРЕК»',
          choicesReplace: [
            {
              id: 'tsum',
              scene: 'mall', sceneLabel: 'ЦУМ «АЙЧУРЕК»',
              title: 'ЦУМ «Айчурек»: всё под одной крышей',
              desc: 'Фиксированные цены, кондиционер и никакого торга. Чек длиннее.',
              minutes: 35,
              fx: { money: -1150, energy: -6, stress: -2, saved: 150 },
              flags: ['boughtAtTsum', 'boughtFreshBread', 'boughtGroceries'],
              vars: { shoppingPlace: 'ЦУМ «Айчурек»', boughtGroceries: true },
              result: 'Вы прошли ЦУМ насквозь и собрали корзину без единого спора. ' +
                'Хлеб свежий, настроение ровное, чек — как обычно.'
            },
            {
              id: 'frunze',
              scene: 'mall', sceneLabel: '«ФРУНЗЕ»',
              title: '«Фрунзе»: супермаркет по пути',
              desc: 'Тридцать минут по полкам, скидки и никаких базарных страстей.',
              minutes: 30,
              fx: { money: -1050, energy: -4, stress: 2, saved: 200 },
              flags: ['boughtAtFrunze', 'boughtFreshBread', 'boughtGroceries'],
              vars: { shoppingPlace: '«Фрунзе»', boughtGroceries: true },
              result: 'Вы взяли всё по списку и ещё немного «по акции». ' +
                'Кассир пожелал хорошего вечера, и это было искренне.'
            },
            {
              id: 'gum',
              scene: 'mall', sceneLabel: 'ГУМ',
              title: 'ГУМ: продукты и подарок',
              desc: 'Чуть дороже, зато можно сразу взять что-то родителям.',
              minutes: 42,
              fx: { money: -1350, energy: -7, stress: -4, saved: 100 },
              flags: ['boughtAtGum', 'boughtFreshBread', 'boughtGroceries', 'boughtGifts'],
              vars: { shoppingPlace: 'ГУМ', boughtGroceries: true, boughtGifts: true },
              result: 'Вы взяли продукты и тёплый платок маме. Бюджет скрипнул, ' +
                'но мысль о её лице стоит дороже.'
            }
          ]
        },
        'evening-logistics': {
          place: 'Центр · вечерние дела',
          appendText: 'Родители на Ала-Тоо, кружок — за Абдрахманова, а пробка уже начала ' +
            'делать вид, что она здесь навсегда.'
        },
        'road-home': {
          replaceText: 'Вечерний центр включает огни. До дома — двенадцать минут на такси, ' +
            'восемнадцать на автобусе №7 или двадцать пять пешком через Ала-Тоо.',
          choicesReplace: [
            {
              id: 'taxi-home',
              title: 'Такси до дома',
              desc: 'Двести пятьдесят сом за двенадцать минут и никаких пакетов в толпе.',
              minutes: 12,
              fx: { money: -250, energy: 4, stress: -8 },
              flags: ['taxiHome'],
              vars: { routeHome: 'такси до центра' },
              result: 'Вы доехали за двенадцать минут. В центре это почти телепортация.'
            },
            {
              id: 'bus7-home',
              title: 'Автобус №7 по Чуй',
              desc: 'Проезд по «Тулпару», восемнадцать минут и вечерний проспект в окне.',
              minutes: 18,
              fx: (s) => ({
                money: -30,
                energy: -5,
                stress: 8 + (s.has('boughtGroceries') ? 6 : 0) +
                  (s.has('soaked') ? 6 : 0) - (s.has('weatherReady') ? 4 : 0)
              }),
              flags: ['rodeBus7Home'],
              vars: { routeHome: 'автобус №7 по Чуй' },
              result: 'Автобус №7 тащился по Чуй, но вам было близко. ' +
                'В окне проплывали ЦУМ, Ала-Тоо и чья-то очень важная встреча.'
            },
            {
              id: 'walk-home',
              title: 'Пройтись через Ала-Тоо',
              desc: 'Двадцать пять минут по вечернему центру. Пакеты — бонус.',
              minutes: 25,
              fx: (s) => ({
                energy: -12,
                stress: -5 + (s.has('soaked') ? 8 : 0) - (s.has('weatherReady') ? 4 : 0)
              }),
              flags: ['walkedHome'],
              vars: { routeHome: 'пешком через Ала-Тоо' },
              result: 'Вы прошли через площадь, где уже играла музыка. ' +
                'Пакеты тянули руки, зато вечер был ваш.'
            }
          ]
        },
        'family-evening': {
          appendText: 'В центре вечером шумно даже во дворе: где-то гуляет свадьба, ' +
            'а из соседнего окна слышно телевизор.'
        }
      }
    },

    {
      id: 'vostok5',
      name: 'Восток-5',
      micro: 'Восток-5 · Чуй · 7 Апреля',
      icon: 'home',
      tagline: 'Свой двор, свой магазин, свой рынок на Чуй',
      description: 'Спальный район на востоке города, между Чуй, 7 Апреля и Айтматова. Школа рядом, магазин у подъезда, рынок «Мадина» на Чуй. До центра — автобус №7 по проспекту и пробка вместе с ним.',
      route: 'Восток-5 → Чуй → центр',
      commute: 'Автобус №7 по Чуй (оплата по «Тулпару»), пешком до рынка «Мадина» или такси по Чуй.',
      start: { money: 2550, energy: 92, stress: 20 },
      chips: [
        { text: 'по «Тулпару»', tone: 'good' },
        { text: '40–50 мин', tone: 'bad' },
        { text: 'всё во дворе', tone: 'good' }
      ],
      highlights: [
        'Школа и магазин в шаговой доступности',
        'Рынок «Мадина» и «Народный» по пути'
      ],
      events: {
        morning: {
          appendText: 'Вы живёте в Востоке-5, недалеко от Айтматова. Двор ещё спит, ' +
            'но на Чуй уже гудят автобусы, а в местном магазине принимают свежий хлеб.'
        },
        traffic: {
          place: 'Восток-5 · остановка',
          kicker: '08:30 · Час пик',
          title: 'Автобус №7 и пробка на Чуй',
          replaceText: 'На остановке уже собрались те, кто едет в центр каждый день. ' +
            'Автобус №7 идёт по Чуй мимо рынка «Мадина» до самого ЦУМа, ' +
            'а такси предлагает «комфорт» за цену половины дневного бюджета.',
          choicesReplace: [
            {
              id: 'bus7',
              title: 'Автобус №7 по Чуй',
              desc: 'Проезд по «Тулпару» и сорок минут в компании всего Востока-5.',
              minutes: 40,
              fx: { money: -25, energy: -12, stress: 18 },
              flags: ['crowdedMarshrutka', 'districtLocal', 'stuckInTraffic'],
              vars: { transportType: 'bus7', stuckInTraffic: true },
              result: 'Вы влезли в автобус №7 на задней площадке и вышли у ЦУМа с чувством, ' +
                'что проехали не сорок минут, а небольшой жизненный этап.'
            },
            {
              id: 'bus',
              title: 'Пешком до «Мадины», дальше попутным автобусом',
              desc: 'Пятнадцать минут пешком по Чуй, зато в автобус сядете не на первой остановке.',
              minutes: 46,
              fx: { money: -20, energy: -8, stress: 8 },
              flags: ['rodeBus', 'districtLocal'],
              vars: { transportType: 'bus', stuckInTraffic: false },
              result: 'Вы дошли до рынка «Мадина», поймали первый автобус, приложили «Тулпар» ' +
                'и всю дорогу смотрели на проспект, который никак не кончается.'
            },
            {
              id: 'taxi',
              title: 'Yandex Go по Чуй',
              desc: 'Триста восемьдесят сом за двадцать восемь минут и право не толкаться.',
              minutes: 28,
              fx: { money: -380, energy: 6, stress: -6 },
              flags: ['comfortRide'],
              vars: { transportType: 'taxi', stuckInTraffic: false },
              result: 'Водитель вывернул на Чуй и проскочил пробку по боковым улицам. ' +
                'Триста восемьдесят сом — дорого, зато вы приехали в офис до начала планёрки.'
            }
          ]
        },
        'school-run': {
          place: 'Школа во дворе · Восток-5',
          title: 'Школа, которую видно из окна',
          appendText: 'Школа — прямо во дворе, и это единственное утро, когда вы можете ' +
            'проводить ребёнка без спешки. Если, конечно, не считать очередь у ворот.'
        },
        'local-emergency': {
          appendText: 'Из Востока-5 пишут соседи: в подъезде отключили воду, ' +
            'а в местном чате уже ищут виноватого.'
        },
        bazaar: {
          scene: 'bazaar',
          replaceText: (s) => {
            let t = 'Вечерний Восток-5 пахнет лепёшками, бензином и жареным луком. Нужно что-то к ужину и на завтра. ' +
              '«Народный» — у дома, с фиксированными ценами. Рынок «Мадина» на Чуй — это ткани, швейная фурнитура ' +
              'и уйгурская кухня, так что туда ходят за пуговицами и лагманом, а не за овощами. Остаётся доставка.';
            if (s.has('stayedOvertime')) t += ' Вы добрались позже обычного — на «Мадине» уже сворачивают прилавки.';
            if (s.has('soaked')) t += ' Куртка ещё не высохла, и это добавляет вечеру характера.';
            if (s.has('helpedRelative')) t += ' В сумке лежит чужая посылка, которую тоже надо донести.';
            return t;
          },
          choicesReplace: [
            {
              id: 'narodny',
              scene: 'courtyard',
              title: '«Народный» у дома',
              desc: 'Двадцать восемь минут, знакомый кассир и всё по списку.',
              minutes: 28,
              fx: { money: -1000, energy: -4, stress: -1, saved: 220 },
              flags: ['boughtAtNarodny', 'boughtFreshBread', 'boughtGroceries'],
              vars: { shoppingPlace: '«Народный»', boughtGroceries: true },
              result: 'Вы дошли до «Народного» пешком, взяли хлеб, кефир и что-то к ужину. ' +
                'Кассир сказал: «Как всегда?» — и это было приятнее любой скидки.'
            },
            {
              id: 'madina',
              scene: 'bazaar',
              title: 'Рынок «Мадина»: фурнитура и горячий лагман',
              desc: 'Тридцать минут: пуговицы и молния, лагман с собой и торг за рулон ткани на шторы.',
              minutes: 30,
              fx: { money: -1050, energy: -4, stress: 2, saved: 200 },
              flags: ['boughtAtMadina', 'boughtFreshBread', 'boughtGroceries'],
              vars: { shoppingPlace: '«Мадина»', boughtGroceries: true },
              result: 'На «Мадине» вы перебрали рулоны ткани, взяли пуговицы и молнию, которых хватит на три курточки, ' +
                'а в уйгурском кафе взяли лагман и самсу с собой. Торговались ровно настолько, чтобы почувствовать себя местным.'
            },
            {
              id: 'delivery',
              scene: 'home',
              title: 'Доставка к подъезду',
              desc: 'Ноль очередей. Максимальный чек. Курьер уже едет.',
              minutes: 10,
              fx: { money: -1300, energy: 2, stress: -8 },
              flags: ['deliveryGroceries', 'boughtGroceries'],
              vars: { shoppingPlace: 'доставка', boughtGroceries: true },
              result: 'Курьер привёз продукты к подъезду и даже помог донести до лифта. ' +
                'Вы заплатили за комфорт, но вечер получился заметно человечнее.'
            }
          ]
        },
        'evening-logistics': {
          place: 'Восток-5 · вечерние дела',
          appendText: 'Родители живут на Мамбетова, кружок — на 7 Апреля, ' +
            'а до дома рукой подать. Если не считать пакетов.'
        },
        'road-home': {
          replaceText: 'Вечерний Восток-5 встречает огнями магазинов. До дома — ' +
            'сорок минут на автобусе №7, пятьдесят пешком или тридцать на такси.',
          choicesReplace: [
            {
              id: 'taxi-home',
              title: 'Такси до Востока-5',
              desc: 'Четыреста восемьдесят сом за тридцать минут и пакеты без приключений.',
              minutes: 30,
              fx: { money: -480, energy: 6, stress: -8 },
              flags: ['taxiHome'],
              vars: { routeHome: 'такси до Востока-5' },
              result: 'Вы доехали с комфортом, глядя на вечерние огни Чуй. ' +
                'Дорого, но сегодня это было лучшим решением вечера.'
            },
            {
              id: 'marshrutka-home',
              title: 'Автобус №7 домой',
              desc: 'Проезд по «Тулпару» и сорок минут в вечерней толкучке.',
              minutes: 40,
              fx: (s) => ({
                money: -25,
                energy: -10,
                stress: 16 + (s.has('boughtGroceries') ? 6 : 0) +
                  (s.has('soaked') ? 6 : 0) - (s.has('weatherReady') ? 4 : 0)
              }),
              flags: ['marshrutkaHome'],
              vars: { routeHome: 'автобус №7 до Востока-5' },
              result: 'Автобус №7 полз по Чуй, набитый пакетами и уставшими людьми. ' +
                'Вы вышли у своего двора и почувствовали, что день был длинным.'
            },
            {
              id: 'walk-home',
              title: 'Пешком по Чуй и 7 Апреля',
              desc: 'Пятьдесят минут под фонарями. Спортзал, за который не надо платить.',
              minutes: 50,
              fx: (s) => ({
                energy: -18,
                stress: -6 + (s.has('soaked') ? 8 : 0) - (s.has('weatherReady') ? 4 : 0)
              }),
              flags: ['walkedHome'],
              vars: { routeHome: 'пешком по Чуй и 7 Апреля' },
              result: 'Вы прошли по Чуй, свернули на 7 Апреля и дошли до Востока-5, здороваясь с соседями. ' +
                'Пакеты тянули руки, зато голова проветрилась.'
            }
          ]
        },
        'family-evening': {
          appendText: 'В Востоке-5 вечер начинается с запаха ужина из соседних квартир ' +
            'и разговоров у подъезда.'
        }
      }
    }
  ];

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

  /* ====================================================================== */
  /*  СОБЫТИЯ                                                               */
  /* ====================================================================== */
})(typeof window !== 'undefined' ? window : globalThis);

/* ==========================================================================
   «Один день в Бишкеке» — открытки памяти и тихие финалы.
   Открытка — не экран поражения, а вещь, которую хочется сохранить.
   ========================================================================== */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});

  BD.POSTCARDS = {
    family: {
      id: 'vostok-family',
      title: 'Двор как семья',
      subtitle: 'Восток-5 · ашар на тапчане',
      kicker: 'Открытка памяти · Восток-5',
      stamp: 'ВОСТОК-5 · 20:20',
      tone: 'teal',
      icon: 'home',
      scene: 'courtyard',
      bata: 'Бата — не про деньги. Бата — про то, что ты не один.',
      text: 'Длинный тапчан, чужие пиалы, дым над казаном и родители, которые вышли за хлебом ' +
        'и остались до ночи. Двор запомнил этот вечер раньше, чем вы успели его сфотографировать.',
      ending: 'family'
    },
    kitchen: {
      id: 'vostok-kitchen',
      title: 'Кухня на двоих',
      subtitle: 'Мамбетова, 12 · поздний чай',
      kicker: 'Открытка памяти · Восток-5',
      stamp: 'МАМБЕТОВА · 21:05',
      tone: 'gold',
      icon: 'coffee',
      scene: 'kitchen_night',
      bata: 'Самое дорогое гостеприимство — не стол, а место, которое тебе оставили.',
      text: 'Одна лампа, три чашки, зажеванная кассета и разговор, который не надо было начинать ' +
        'с главного. Иногда сюрприз — это просто закрыть дверь и остаться.',
      ending: 'kitchen'
    },
    surprise: {
      id: 'vostok-surprise',
      title: 'Сюрприз для всех, кроме именинника',
      subtitle: 'Восток-5 · двор, который всё знал',
      kicker: 'Открытка памяти · Восток-5',
      stamp: 'ВОСТОК-5 · 21:05',
      tone: 'coral',
      icon: 'star',
      scene: 'courtyard',
      bata: 'Хороший сюрприз — когда все делают вид, что не знают, а потом обнимаются.',
      text: 'Бакыт просил казан, Апа Гуля — скатерть, мама гладила рубашку «просто так». ' +
        'Отец всё знал и играл свою роль до конца. Сюрприз удался для всех, кроме именинника.',
      ending: 'surprise'
    },

    /* --- юг: бата на дорогу --- */
    southBata: {
      id: 'south-bata',
      title: 'Бата получена',
      subtitle: 'Асанбай · дастархан на Панораме',
      kicker: 'Открытка памяти · Юг',
      stamp: 'АСАНБАЙ · 21:30',
      tone: 'gold',
      icon: 'star',
      scene: 'south_panorama',
      bata: 'Пусть дорога будет ровной, а дом — всегда за спиной.',
      text: 'Горка домашних боорсоков, мешочек курута в кармане Эрлана и слова, которые нашлись сами. ' +
        'Ата Кадыр поднял ладони над городом, и на площадке стало тихо. Это была бата.',
      ending: 'bata'
    },
    southPride: {
      id: 'south-pride',
      title: 'Тихая гордость',
      subtitle: 'Асанбай · чай после разговора',
      kicker: 'Открытка памяти · Юг',
      stamp: 'АСАНБАЙ · 21:30',
      tone: 'teal',
      icon: 'heart',
      scene: 'apa_kitchen',
      bata: 'Не всё надо говорить вслух. Главное — чтобы тебя услышали.',
      text: 'Вы помогли апе, дошли до Панорамы и сказали меньше, чем хотели. Эрлан понял без слов: ' +
        'обнял у перил и пообещал писать. Апа потом молча подвинула вам чай.',
      ending: 'pride'
    },
    southNoTable: {
      id: 'south-no-table',
      title: 'Дастархан без вас',
      subtitle: 'Асанбай · чай, который налили без слов',
      kicker: 'Открытка памяти · Юг',
      stamp: 'АСАНБАЙ · 21:30',
      tone: 'coral',
      icon: 'coffee',
      scene: 'apa_kitchen',
      bata: 'Долг отдашь. Сначала поешь.',
      text: 'Вы пришли позже и с пустыми руками. Апа уже накрыла стол сама, а Эрлан делал вид, ' +
        'что всё в порядке. На прощании слова не нашлись. Апа молча подвинула вам чашку чая — ' +
        'и это было громче любой баты.',
      ending: 'noTable'
    },

    /* --- центр: Фрунзе в кармане --- */
    centerSong: {
      id: 'center-song',
      title: 'Песня вернулась',
      subtitle: 'Старый двор · арык и комуз',
      kicker: 'Открытка памяти · Центр',
      stamp: 'ФРУНЗЕ · 21:30',
      tone: 'gold',
      icon: 'sound',
      scene: 'old_center_courtyard',
      bata: 'Пока кто-то играет, город помнит.',
      text: 'Низкий двор за ЦУМом, урюк у ворот и вода в арыке. Нурлан играет ту самую мелодию, ' +
        'а вы сидите рядом и узнаёте её не ушами, а где-то глубже. Фотография деда больше не ' +
        'просто бумажка в кармане — у неё есть адрес, голос и этот вечер.',
      ending: 'song'
    },
    centerPhoto: {
      id: 'center-photo',
      title: 'Фотография в кармане',
      subtitle: 'Центр · адрес, который остался',
      kicker: 'Открытка памяти · Центр',
      stamp: 'ФРУНЗЕ · 21:30',
      tone: 'teal',
      icon: 'photo',
      scene: 'memory_corner',
      bata: 'Адрес — ещё не встреча. Но уже не случайность.',
      text: 'Вы узнали про двор, услышали про арык и даже подержали в руках чужую кассету. ' +
        'Но вечер сложился иначе: работа, дела, завтра. Фотография лежит в кармане, и на обороте ' +
        'всё ещё написано «Кирова, двор 12». Теперь вы знаете, что это значит.',
      ending: 'photo'
    },
    centerCity: {
      id: 'center-city',
      title: 'Город без тебя',
      subtitle: 'Ала-Тоо · вечер, который прошёл мимо',
      kicker: 'Открытка памяти · Центр',
      stamp: 'АЛА-ТОО · 21:30',
      tone: 'coral',
      icon: 'night',
      scene: 'alatoo_twilight',
      bata: 'Город не обижается. Он просто живёт дальше.',
      text: 'Фонтаны у ЦУМ включили подсветку, клиент получил презентацию, премия капнула на карту. ' +
        'А где-то за площадью, в старом дворе, кто-то играл на комузе для пустого тапчана. ' +
        'Вы успели всё, кроме самого главного. Впрочем, адрес у вас остался.',
      ending: 'city'
    },

    /* --- тихие финалы: день решил остановиться, двор — нет --- */
    softTapchan: {
      id: 'soft-tapchan',
      title: 'Тапчан, курпача и чужой плед',
      subtitle: 'Тихий финал · двор не отпустил',
      kicker: 'Тихий финал · Восток-5',
      stamp: 'ВОСТОК-5 · ПОЗДНО',
      tone: 'teal',
      icon: 'night',
      scene: 'courtyard',
      bata: 'Спи, сынок. Утро само разберётся.',
      text: 'Вы уснули на тапчане, не дождавшись чая. Апа Гуля укрыла вас курпачой, ' +
        'Бакыт убрал казан, а родители сидели рядом и говорили шёпотом, чтобы не разбудить. ' +
        'День закончился раньше — и никто не считал это поражением.',
      items: ['kurpacha']
    },
    softStairwell: {
      id: 'soft-stairwell',
      title: 'Чай на лестнице',
      subtitle: 'Тихий финал · между этажами',
      kicker: 'Тихий финал · Восток-5',
      stamp: 'ВОСТОК-5 · ЛЕСТНИЦА',
      tone: 'gold',
      icon: 'coffee',
      scene: 'stairwell',
      bata: 'Не всё надо доделывать сегодня.',
      text: 'Апа Гуля увела вас на площадку, налила чай в крышку термоса и сказала, что двор ' +
        'справится без вас. Впервые за день вы поверили. Внизу всё ещё пахло пловом, ' +
        'а наверху уже никуда не торопились.',
      items: ['kurpacha']
    },
    softDvor: {
      id: 'soft-dvor',
      title: 'Двор не считает сомы',
      subtitle: 'Тихий финал · ашар без бюджета',
      kicker: 'Тихий финал · Восток-5',
      stamp: 'ВОСТОК-5 · ДВОР',
      tone: 'coral',
      icon: 'bread',
      scene: 'courtyard',
      bata: 'Долг отдашь. Сначала поешь.',
      text: 'Кошелёк опустел раньше вечера, но двор сделал вид, что ничего не заметил. ' +
        'Кто-то принёс плов, кто-то — лепёшки, Апа Гуля просто подвинулась. ' +
        'В Бишкеке это называется не помощь, а «так принято».',
      items: ['kurut']
    },
    softSouthKitchen: {
      id: 'soft-south-kitchen',
      title: 'Тапчан у апы',
      subtitle: 'Тихий финал · юг, курпача',
      kicker: 'Тихий финал · Юг',
      stamp: 'АСАНБАЙ · ПОЗДНО',
      tone: 'gold',
      icon: 'night',
      scene: 'apa_kitchen',
      bata: 'Спи, сынок. Утро само разберётся.',
      text: 'Вы уснули на тапчане, не дождавшись чая. Апа укрыла вас курпачой, Эрлан оставил на столе ' +
        'записку: «Позвоню из Стамбула». День закончился раньше — и никто не считал это поражением.',
      items: ['kurpacha']
    },
    softSouthPanorama: {
      id: 'soft-south-panorama',
      title: 'Свет над Асанбаем',
      subtitle: 'Тихий финал · Панорама',
      kicker: 'Тихий финал · Юг',
      stamp: 'ПАНОРАМА · ПОЗДНО',
      tone: 'teal',
      icon: 'sun',
      scene: 'south_panorama',
      bata: 'Город никуда не денется. И горы тоже.',
      text: 'Вы дошли до Панорамы и сели на скамейку. Внизу зажигался Бишкек, а вы просто смотрели. ' +
        'Ата Кадыр сказал: «Не всё надо успеть сегодня». Это тоже была бата.',
      items: ['warmBread']
    },
    softSouthDastorkhan: {
      id: 'soft-south-dastorkhan',
      title: 'Чай у апы',
      subtitle: 'Тихий финал · дастархан без бюджета',
      kicker: 'Тихий финал · Юг',
      stamp: 'АСАНБАЙ · ЧАЙ',
      tone: 'coral',
      icon: 'coffee',
      scene: 'apa_kitchen',
      bata: 'Долг отдашь. Сначала поешь.',
      text: 'Кошелёк опустел раньше вечера, но апа сделала вид, что ничего не заметила. Она поставила ' +
        'перед вами лепёшку и курут и сказала: «В дорогу собираются не деньгами». Эрлан пододвинул вам пиалу.',
      items: ['kurutBag']
    },
    softCenterCourtyard: {
      id: 'soft-center-courtyard',
      title: 'Тапчан у арыка',
      subtitle: 'Тихий финал · центр, курпача',
      kicker: 'Тихий финал · Центр',
      stamp: 'ФРУНЗЕ · ПОЗДНО',
      tone: 'teal',
      icon: 'night',
      scene: 'old_center_courtyard',
      bata: 'Спи, сынок. Арык шумит и без тебя.',
      text: 'Вы прилегли на тапчан на минуту и не заметили, как уснули. Нурлан укрыл вас курпачой, ' +
        'убрал комуз в чехол и оставил на краю пиалу с чаем. Арык шумел всю ночь, а двор ' +
        'никуда не торопился. День закончился раньше — и никто не считал это поражением.',
      items: ['kurpacha']
    },
    softCenterFountains: {
      id: 'soft-center-fountains',
      title: 'Свет у фонтана',
      subtitle: 'Тихий финал · Ала-Тоо',
      kicker: 'Тихий финал · Центр',
      stamp: 'АЛА-ТОО · ПОЗДНО',
      tone: 'gold',
      icon: 'sun',
      scene: 'alatoo_twilight',
      bata: 'Не всё надо успеть сегодня.',
      text: 'Вы дошли до Ала-Тоо и сели у фонтана. Вода падала обратно в чашу, подсветка меняла цвет, ' +
        'а вы просто смотрели. Фотография лежала в кармане, и впервые за день никто ничего ' +
        'от вас не требовал. Город никуда не денется. И двор тоже.',
      items: ['frunzePhoto']
    },
    softCenterChai: {
      id: 'soft-center-chai',
      title: 'Чай у арыка',
      subtitle: 'Тихий финал · двор без денег',
      kicker: 'Тихий финал · Центр',
      stamp: 'ФРУНЗЕ · ЧАЙ',
      tone: 'coral',
      icon: 'coffee',
      scene: 'old_center_courtyard',
      bata: 'Долг отдашь. Сначала поешь.',
      text: 'Кошелёк опустел раньше вечера, но Нурлан сделал вид, что ничего не заметил. ' +
        'Он налил чай, бабушка подвинула лепёшку, а кассета осталась лежать на тапчане между вами. ' +
        'В старом дворе это называется не помощь, а «так принято».',
      items: ['melodyCassette']
    },
    softGeneric: {
      id: 'soft-generic',
      title: 'День, который решил остановиться',
      subtitle: 'Тихий финал',
      kicker: 'Тихий финал',
      stamp: 'БИШКЕК · ВЕЧЕР',
      tone: 'gold',
      icon: 'sun',
      scene: 'evening',
      bata: 'Завтра будет новый день. И новый чай.',
      text: 'Вы дошли до вечера, но силы закончились раньше планов. Это не провал — ' +
        'это сигнал. Город никуда не денется, а чай можно выпить и завтра.',
      items: ['note']
    }
  };

  BD.POSTCARD_ORDER = [
    'family', 'kitchen', 'surprise',
    'southBata', 'southPride', 'southNoTable',
    'centerSong', 'centerPhoto', 'centerCity'
  ];

  BD.pickPostcard = function (state) {
    if (!state) return null;

    if (state.district === 'center') {
      if (state.has('endingSong')) return BD.POSTCARDS.centerSong;
      if (state.has('endingCity')) return BD.POSTCARDS.centerCity;
      if (state.has('endingPhoto')) return BD.POSTCARDS.centerPhoto;
      /* Мягкий запасной путь: если финальный выбор не записался, смотрим на собранную историю. */
      const b = state.bonds || {};
      if (state.has('choseCourtyard') && state.has('keptCassette') && (b.nurlan || 0) >= 4) {
        return BD.POSTCARDS.centerSong;
      }
      if (state.has('foundPhoto') || state.has('erkindikLead') || state.has('metClassmate')) {
        return BD.POSTCARDS.centerPhoto;
      }
      return BD.POSTCARDS.centerCity;
    }

    if (state.district === 'south') {
      if (state.has('endingBata')) return BD.POSTCARDS.southBata;
      if (state.has('endingPride')) return BD.POSTCARDS.southPride;
      if (state.has('endingNoTable')) return BD.POSTCARDS.southNoTable;
      /* Мягкий запасной путь: если финальный выбор не записался, смотрим на флаги и отношения. */
      const b = state.bonds || {};
      if (state.has('cooked_boorsok') && (b.apa || 0) >= 4) return BD.POSTCARDS.southBata;
      if (state.has('called_apa') || state.has('half_promise') || (b.apa || 0) >= 2) return BD.POSTCARDS.southPride;
      return BD.POSTCARDS.southNoTable;
    }

    if (state.district !== 'vostok5') return null;
    if (state.has('endingKitchen')) return BD.POSTCARDS.kitchen;
    if (state.has('endingSurprise')) return BD.POSTCARDS.surprise;
    if (state.has('endingFamily')) return BD.POSTCARDS.family;
    /* Мягкий запасной путь: если финальный выбор не записался, смотрим на отношения. */
    const b = state.bonds || {};
    if ((b.parents || 0) >= (b.dvor || 0) + 2) return BD.POSTCARDS.kitchen;
    if ((b.dvor || 0) >= 5) return BD.POSTCARDS.family;
    return BD.POSTCARDS.surprise;
  };

  BD.pickSoftPostcard = function (state, kind) {
    if (state && state.district === 'center') {
      if (kind === 'exhaustion') return BD.POSTCARDS.softCenterCourtyard;
      if (kind === 'burnout') return BD.POSTCARDS.softCenterFountains;
      if (kind === 'broke' || kind === 'bankrupt') return BD.POSTCARDS.softCenterChai;
    }
    if (state && state.district === 'south') {
      if (kind === 'exhaustion') return BD.POSTCARDS.softSouthKitchen;
      if (kind === 'burnout') return BD.POSTCARDS.softSouthPanorama;
      if (kind === 'broke' || kind === 'bankrupt') return BD.POSTCARDS.softSouthDastorkhan;
    }
    if (state && state.district === 'vostok5') {
      if (kind === 'exhaustion') return BD.POSTCARDS.softTapchan;
      if (kind === 'burnout') return BD.POSTCARDS.softStairwell;
      if (kind === 'broke' || kind === 'bankrupt') return BD.POSTCARDS.softDvor;
    }
    return BD.POSTCARDS.softGeneric;
  };

  /* Собирает открытку для показа: добавляет собранные предметы и дату. */
  BD.hydratePostcard = function (postcard, state) {
    if (!postcard) return null;
    const out = Object.assign({}, postcard);
    const memory = (state && state.memory) || [];
    out.items = (postcard.items || memory).filter((id, i, arr) => arr.indexOf(id) === i);
    out.date = new Date().toISOString();
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);

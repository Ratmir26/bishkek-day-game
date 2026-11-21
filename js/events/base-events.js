/* Базовый граф дня (общий для всех районов). */
(function (root) {
  'use strict';
  const BD = (root.BD = root.BD || {});
  const T = (h, m = 0) => h * 60 + m;

  BD.EVENTS = [
    {
      id: 'morning',
      time: T(8, 0),
      scene: 'home',
      place: 'Дом · кухня',
      kicker: '08:00 · Завтрак',
      title: 'Чайник закипает во второй раз',
      text: () => 'В окне розовеет рассвет над Ала-Тоо, на плите остывает вчерашний чайник. ' +
        'До выхода — сорок минут, а в голове уже крутится список: отчёт, кружок, коммуналка. ' +
        'Главный вопрос утра простой: чем заправить этот день?',
      choices: [
        {
          id: 'cook',
          title: 'Приготовить нормальный завтрак',
          desc: 'Яичница, хлеб, чай. Двадцать пять минут, зато по-человечески.',
          minutes: 25,
          fx: { money: -140, energy: 14, stress: -8 },
          flags: ['cookedBreakfast'],
          vars: { morningFood: 'home', caffeinated: true },
          result: 'Вы позавтракали как взрослый человек, а не как студент в сессию. ' +
            'Настроение ровное, в кармане на 140 сом меньше.'
        },
        {
          id: 'samsa',
          title: 'Самса и кофе по пути',
          desc: 'Быстро, вкусно, немного дороже. Зато без мытья сковородки.',
          minutes: 10,
          fx: { money: -180, energy: 6, stress: 5 },
          flags: ['streetBreakfast', 'bought_samsa'],
          vars: { morningFood: 'street', caffeinated: true },
          result: 'Горячая самса в салфетке, кофе в бумажном стакане. Классика жанра — ' +
            'и минус 180 сом из бюджета.'
        },
        {
          id: 'skip',
          title: 'Выскочить голодным',
          desc: 'Успею поесть в офисе. Наверное. Когда-нибудь.',
          minutes: 5,
          fx: { energy: -12, stress: 10 },
          flags: ['skippedBreakfast'],
          vars: { morningFood: 'skip', caffeinated: false },
          result: 'Вы вышли из дома налегке. Желудок остался дома и уже начал задавать вопросы.'
        }
      ]
    },

    {
      id: 'traffic',
      time: T(8, 30),
      scene: 'traffic',
      place: 'Чуй / Советская',
      kicker: '08:30 · Час пик',
      title: 'Чуй не прощает сентиментальности',
      text: (s) => {
        let t = 'Пробка на Чуй стоит от Советской до самого центра. Снежные вершины Ала-Тоо ' +
          'спокойны, чего не скажешь о водителях. До офиса — четыре километра и три варианта.';
        if (s.vars.morningFood === 'skip') t += ' Живот напоминает о завтраке громче, чем радио в соседней машине.';
        if (s.vars.morningFood === 'home') t += ' Сытый человек терпеливее — но не настолько, чтобы полюбить пробки.';
        return t;
      },
      choices: [
        {
          id: 'marshrutka',
          title: 'Маршрутка за 20 сом',
          desc: 'Та самая, где одиннадцать человек стоят на местах для двоих.',
          minutes: 25,
          fx: { money: -20, energy: -10, stress: 16 },
          flags: ['crowdedMarshrutka', 'stuckInTraffic'],
          vars: { transportType: 'marshrutka', stuckInTraffic: true },
          result: 'Вы вошли третьим в дверь и вышли другим человеком. Двадцать сом оказались ' +
            'самой дорогой экономией утра.'
        },
        {
          id: 'taxi',
          title: 'Yandex Go Comfort',
          desc: 'Сиденье, кондиционер и водитель, который знает дорогу лучше навигатора.',
          minutes: 18,
          fx: { money: -320, energy: 8, stress: -8 },
          flags: ['comfortRide'],
          vars: { transportType: 'taxi', stuckInTraffic: false },
          result: 'Дорога стоила 320 сом, но нервы остались целы. Иногда это лучшая инвестиция дня.'
        },
        {
          id: 'walk',
          title: 'Пойти пешком',
          desc: 'Свежий воздух, подкаст в наушниках и сорок минут по обочине цивилизации.',
          minutes: 40,
          fx: { energy: -18, stress: 5 },
          flags: ['walkedToWork'],
          vars: { transportType: 'walk', stuckInTraffic: false },
          result: 'Вы пришли в офис бодрым, но с ощущением, что уже отработали смену грузчика.'
        }
      ]
    },

    {
      id: 'school-run',
      time: T(9, 5),
      scene: 'school',
      place: 'Школа · двор',
      kicker: '09:05 · Школа',
      title: 'Ребёнка надо сдать живым и вовремя',
      text: (s) => {
        let t = 'Вы обещали завезти ребёнка в школу до первого звонка. У ворот уже толпятся ' +
          'родители, кто-то ищет сменку, кто-то — совесть. Ребёнок смотрит на часы красноречивее учителя.';
        if (s.vars.morningFood === 'skip') t += ' Голодный организм требует самсу, а не педагогики.';
        if (s.vars.transportType === 'marshrutka') t += ' После маршрутки вы всё ещё пахнете чужими куртками.';
        return t;
      },
      choices: [
        {
          id: 'walk-school',
          title: 'Дойти пешком и по пути поговорить',
          desc: 'Двадцать минут, минус энергия, зато ребёнок доволен и вы всё успеваете.',
          minutes: 20,
          fx: { energy: -8, stress: 4 },
          flags: ['childAtSchool'],
          vars: { schoolRun: 'walk' },
          result: 'Вы дошли до школы пешком, обсудив важное: кто сегодня дежурит и почему ' +
            'нельзя есть чипсы на завтрак. Ребёнок вошёл в ворота с чувством собственного достоинства.'
        },
        {
          id: 'taxi-school',
          title: 'Такси до самых ворот',
          desc: 'Сто восемьдесят сом и двенадцать минут. Быстро, сухо и почти без нервов.',
          minutes: 12,
          fx: { money: -180, energy: 2, stress: -4 },
          flags: ['childAtSchool'],
          vars: { schoolRun: 'taxi' },
          result: 'Таксист остановился у самых ворот и пожелал ребёнку хорошей учёбы. ' +
            'Сто восемьдесят сом — но первый звонок вы услышали из машины.'
        },
        {
          id: 'late-school',
          title: 'Опоздать, но не сдаваться',
          desc: 'Восемь минут и лишний стресс. Учительница всё поймёт. Наверное.',
          minutes: 8,
          fx: { energy: -4, stress: 10 },
          flags: ['childAtSchool', 'lateToSchool'],
          vars: { schoolRun: 'late' },
          result: 'Вы вбежали во двор после звонка. Ребёнок успел, вы — нет. ' +
            'Учительница посмотрела так, что стало ясно: родительское собрание будет интересным.'
        }
      ]
    },

    {
      id: 'office-rush',
      time: T(10, 30),
      scene: 'office',
      place: 'Офис в центре',
      kicker: '10:30 · Утренний аврал',
      title: 'Начальник: «Это нужно к обеду»',
      text: (s) => {
        let t = 'В опенспейсе пахнет кофе и чужими дедлайнами. Начальник приносит презентацию ' +
          'для клиента: «Нужно к обеду, ты же у нас лучший». На экране — сорок два слайда и ни одного нормального заголовка.';
        if (s.vars.transportType === 'walk') t += ' Ноги ещё помнят утренние километры.';
        if (s.has('lateToSchool')) t += ' После школы вы уже один раз опоздали — второго раза начальник не поймёт.';
        return t;
      },
      choices: [
        {
          id: 'solo',
          title: 'Сделать самому и красиво',
          desc: 'Закрыть задачу, получить благодарность и премию. Ценой энергии.',
          minutes: 90,
          fx: { money: 800, energy: -20, stress: 18 },
          flags: ['heroAtWork'],
          vars: { workMode: 'solo' },
          result: 'Вы собрали презентацию за девяносто минут. Начальник обещал премию — ' +
            'и, что удивительно, сразу перевёл 800 сом.'
        },
        {
          id: 'help',
          title: 'Попросить Азамата помочь',
          desc: 'Вдвоём быстрее. Но услуга — это кредит, который однажды попросят вернуть.',
          minutes: 55,
          fx: { energy: -6, stress: 4 },
          flags: ['owesFavor'],
          vars: { workMode: 'team', helpedColleague: true },
          result: 'Азамат разобрал половину слайдов и сказал: «С тебя кофе. Большой». ' +
            'Вы кивнули, понимая, что кофе — это только начало.'
        },
        {
          id: 'defer',
          title: 'Ответить школе и отложить задачу',
          desc: 'Чат важнее. Но у дедлайна своё мнение на этот счёт.',
          minutes: 20,
          fx: { energy: -2, stress: 10 },
          flags: ['workTaskDeferred', 'schoolChatAnswered'],
          vars: { workMode: 'defer' },
          result: 'Вы ответили школе, задачу сдвинули на вечер. В опенспейсе стало тише — ' +
            'примерно как перед грозой.'
        }
      ]
    },

    {
      id: 'family-chat',
      time: T(11, 40),
      scene: 'office',
      place: 'Офис · семейный чат',
      kicker: '11:40 · Сообщение',
      title: 'Кружок не ждёт зарплаты',
      text: (s) => {
        let t = 'Телефон вибрирует: учительница напоминает про оплату кружка — 900 сом до конца дня. ' +
          'В семейном чате уже три сообщения и один голосовой на минуту. Начальник делает вид, ' +
          'что не смотрит на ваш экран. Все всё понимают.';
        if (s.has('lateToSchool')) t += ' В том же чате уже висит вопрос про утреннее опоздание.';
        return t;
      },
      choices: [
        {
          id: 'pay-full',
          title: 'Перевести 900 сом сразу',
          desc: 'Забыть и выдохнуть. Бюджет выдохнет вместе с вами.',
          minutes: 10,
          fx: { money: -900, energy: -2, stress: 4 },
          flags: ['schoolPaid'],
          vars: { schoolPayment: 'full' },
          result: 'Перевод ушёл, учительница поставила сердечко. В семейном чате наступило ' +
            'редкое согласие — и минус 900 сом в бюджете.'
        },
        {
          id: 'split',
          title: 'Скинуться 50/50',
          desc: 'Попросить вторую половину перевести свою часть.',
          minutes: 8,
          fx: { money: -450, energy: -1, stress: 2 },
          flags: ['schoolPaid', 'schoolSplit'],
          vars: { schoolPayment: 'split' },
          result: 'Договорились по-семейному: 450 сом с вас, остальное — с супруга. ' +
            'Взрослая жизнь иногда выглядит как бухгалтерия в мессенджере.'
        },
        {
          id: 'defer-payment',
          title: 'Попросить отсрочку до аванса',
          desc: 'Сэкономить сейчас. Объясняться — вечером.',
          minutes: 5,
          fx: { stress: 14 },
          flags: ['schoolPaymentDeferred', 'childUpset'],
          vars: { schoolPayment: 'deferred' },
          result: 'Учительница ответила вежливым «хорошо». Внутри стало неприятно, ' +
            'и это ощущение останется до вечера.'
        }
      ]
    },

    {
      id: 'local-emergency',
      time: T(12, 20),
      scene: 'office',
      place: 'Офис · телефон',
      kicker: '12:20 · Форс-мажор',
      title: 'MBank, родня и дедлайн в одном чате',
      text: (s) => {
        let t = 'В самый неподходящий момент телефон оживает: MBank напоминает про свет — 850 сом, ' +
          'двоюродная сестра просит забрать посылку, а в рабочем чате уже спрашивают, ' +
          'где та самая презентация.';
        if (s.vars.helpedColleague) t += ' Азамат делает вид, что не замечает вашего телефона. Услуга работает.';
        return t;
      },
      onEnter: (s) => {
        if (!s.has('utilitiesPaid')) s.set('utilityUnpaid');
      },
      choices: [
        {
          id: 'pay-utility',
          title: 'Оплатить коммуналку через MBank',
          desc: '850 сом, пятнадцать минут — и напоминания исчезнут.',
          minutes: 15,
          fx: { money: -850, energy: -2, stress: 6 },
          flags: ['utilitiesPaid'],
          clear: ['utilityUnpaid'],
          vars: { emergency: 'utility', utilityPaid: true },
          result: 'Вы провели платёж, не отходя от стола. Счётчик больше не пишет, ' +
            'а бюджет стал на 850 сом взрослее.'
        },
        {
          id: 'help-relative',
          title: 'Выручить родню с посылкой',
          desc: 'Тридцать пять минут, триста сом на дорогу и репутация хорошего родственника.',
          minutes: 35,
          fx: { money: -300, energy: -12, stress: 8 },
          flags: ['helpedRelative'],
          vars: { emergency: 'relative', helpedRelative: true },
          result: 'Вы забрали посылку и отправили фото в семейный чат. ' +
            'Сестра ответила тремя сердечками, тётя — голосовым на две минуты. Обе довольны.'
        },
        {
          id: 'call-azamat',
          title: 'Позвонить Азамату: пусть прикроет',
          desc: 'Утренняя услуга работает в обе стороны. Полчаса форы — уже победа.',
          minutes: 10,
          fx: { energy: 2, stress: -4 },
          flags: ['azamatCovered'],
          vars: { emergency: 'azamat' },
          when: (s) => !!s.vars.helpedColleague,
          lockReason: 'Азамат вам ничего не должен: утром вы справлялись сами.',
          result: 'Азамат прикрыл вас перед начальником и сказал: «Теперь мы квиты. Почти». ' +
            'Вы получили полчаса, чтобы разобраться с телефоном.'
        },
        {
          id: 'ignore',
          title: 'Игнорировать: сначала работа',
          desc: 'Пять минут и минус спокойствие. Счета и родня подождут. Наверное.',
          minutes: 5,
          fx: { stress: 8 },
          flags: ['utilityUnpaid', 'ignoredEmergency'],
          vars: { emergency: 'ignore' },
          result: 'Вы отложили телефон и вернулись к слайдам. Уведомления копились ' +
            'где-то на периферии совести.'
        }
      ]
    },

    {
      id: 'lunch',
      time: T(13, 30),
      scene: 'office',
      place: 'Офис · 13:30',
      kicker: '13:30 · Обед',
      title: 'Обед, который решает вечер',
      text: (s) => {
        if (s.has('headache')) {
          return 'К половине второго голова становится чугунной. Пустое утро плюс набитая ' +
            'маршрутка сделали своё дело: свет режет глаза, а мысль о сорока слайдах вызывает тоску. ' +
            'В столовой пахнет пловом и надеждой.';
        }
        let t = 'В столовой пахнет пловом, лагманом и чьим-то парфюмом. Коллеги зовут на бизнес-ланч, ' +
          'в рюкзаке лежит контейнер с домашней едой, а в телефоне — напоминание про срочный заказ.';
        if (s.vars.morningFood === 'skip') t += ' Желудок уже не напоминает — он требует.';
        return t;
      },
      onEnter: (s) => {
        if (s.vars.morningFood === 'skip' && s.has('crowdedMarshrutka') && !s.has('headacheTreated')) {
          s.set('headache');
        }
      },
      choices: [
        {
          id: 'business-lunch',
          title: 'Бизнес-ланч с коллегами',
          desc: 'Первое, второе, разговоры про отпуск и ни одного слайда.',
          minutes: 60,
          when: (s) => s.budget >= 450,
          lockReason: 'На бизнес-ланч не хватает 450 сом. Обед придётся импровизировать.',
          fx: (s) => ({ money: -450, energy: 22, stress: s.has('headache') ? -4 : -12 }),
          flags: ['businessLunch'],
          vars: { lunchType: 'business' },
          result: 'Плов, чай и полчаса без рабочих чатов. Впервые за день вы почувствовали себя человеком.'
        },
        {
          id: 'homemade',
          title: 'Домашняя еда из контейнера',
          desc: 'Бесплатно, сытно и с лёгким запахом вчерашнего ужина.',
          minutes: 40,
          fx: { energy: 8, stress: -3 },
          flags: ['homemadeLunch'],
          vars: { lunchType: 'homemade' },
          result: 'Контейнер сделал своё дело. Вы сэкономили деньги и приобрели лёгкое чувство ' +
            'превосходства над столовой.'
        },
        {
          id: 'coffee-meds',
          title: (s) => s.has('headache') ? 'Кофе и обезболивающее' : 'Кофе и круассан',
          desc: (s) => s.has('headache')
            ? '120 сом за шанс снова думать. Таблетка уже в кармане.'
            : 'Маленький ритуал, который спасает вторую половину дня.',
          minutes: 15,
          fx: (s) => s.has('headache')
            ? { money: -120, energy: 5, stress: -6 }
            : { money: -120, energy: 6, stress: -4 },
          flags: (s) => s.has('headache') ? ['headacheTreated'] : ['coffeeBreak'],
          clear: ['headache'],
          vars: { lunchType: 'coffee', caffeinated: true, headacheTreated: true },
          result: (s, ch, before) => before.has('headache')
            ? 'Кофе, таблетка и пятнадцать минут тишины. Мир снова обрёл резкость — теперь можно работать.'
            : 'Кофе и круассан. Не обед, но достаточно, чтобы дожить до вечера.'
        }
      ]
    },

    {
      id: 'afternoon',
      time: T(15, 30),
      scene: 'office',
      place: 'Офис · 15:30',
      kicker: '15:30 · Послеобеденный спад',
      title: 'Срочный заказ против счёта за свет',
      text: (s) => {
        let t = 'Послеобеденный спад накрывает офис. Постоянный клиент предлагает срочный заказ: ' +
          '2400 сом, если сдать до вечера. В это же время на телефон приходит счёт за коммуналку — 850 сом.';
        if (s.has('utilitiesPaid')) t += ' Коммуналку вы уже закрыли, так что совесть молчит — по крайней мере, до следующего счёта.';
        if (s.has('headache')) t += ' Голова всё ещё гудит, и цифры на экране плывут.';
        if (s.vars.emergency === 'relative') t += ' После посылки руки ещё помнят вес коробки.';
        return t;
      },
      choices: [
        {
          id: 'freelance',
          title: 'Взять срочный заказ',
          desc: 'Самый прибыльный вариант дня. Если голова позволит.',
          minutes: 75,
          when: (s) => !s.has('headache'),
          lockReason: 'Голова раскалывается. Сначала кофе и обезболивающее, потом заказы.',
          fx: { money: 2400, energy: -25, stress: 12 },
          flags: (s) => s.has('utilitiesPaid') ? ['freelanceDone'] : ['freelanceDone', 'utilityUnpaid'],
          vars: (s) => ({ freelance: true, utilityUnpaid: !s.has('utilitiesPaid') }),
          result: 'Вы сдали заказ за час пятнадцать. Клиент перевёл 2400 сом и попросил ' +
            '«ещё пару правок». Вы сделали вид, что не прочитали.'
        },
        {
          id: 'coffee-break',
          title: (s) => s.has('headache') ? 'Кофе и таблетка из аптечки' : 'Кофе-брейк и почта',
          desc: (s) => s.has('headache')
            ? 'Снять головную боль и вернуться в реальность.'
            : 'Десять минут без чатов. Проверить почту и не отвечать на всё сразу.',
          minutes: 25,
          fx: (s) => s.has('headache')
            ? { money: -120, energy: 10, stress: -6 }
            : { money: -120, energy: 10, stress: -8 },
          flags: (s) => s.has('headache') ? ['headacheTreated'] : ['coffeeBreak'],
          clear: ['headache'],
          vars: { caffeinated: true, headacheTreated: true },
          result: 'Кофе, тишина и отсутствие уведомлений. Иногда это и есть корпоративный wellness.'
        },
        {
          id: 'utilities',
          title: (s) => s.has('utilitiesPaid') ? 'Сверить расходы за месяц' : 'Оплатить коммуналку',
          desc: (s) => s.has('utilitiesPaid')
            ? 'Пятнадцать минут с таблицей. Скучно, зато полезно.'
            : '850 сом. Неприятно, но напоминания прекратятся.',
          minutes: (s) => s.has('utilitiesPaid') ? 15 : 20,
          fx: (s) => s.has('utilitiesPaid')
            ? { energy: -2, stress: -4 }
            : { money: -850, stress: 10 },
          flags: (s) => s.has('utilitiesPaid') ? ['budgetChecked'] : ['utilitiesPaid'],
          clear: (s) => s.has('utilitiesPaid') ? [] : ['utilityUnpaid'],
          vars: (s) => s.has('utilitiesPaid')
            ? { budgetChecked: true }
            : { utilityPaid: true },
          result: (s, ch, before) => before.has('utilitiesPaid')
            ? 'Вы сверили расходы и нашли две подписки, о которых забыли. Минус стресс, плюс взрослость.'
            : 'Счётчик оплачен, совесть чиста. Бюджет посмотрел на вас с укором, но промолчал.'
        }
      ]
    },

    {
      id: 'weather-shift',
      time: T(16, 30),
      scene: 'traffic',
      place: 'Центр · выход из офиса',
      kicker: '16:30 · Погода меняется',
      title: 'Солнце уходит, дождь уже в пути',
      text: (s) => {
        let t = 'После обеда небо над Ала-Тоо меняет мнение: солнце прячется за тучи, ' +
          'с гор тянет холодом, а синоптики обещают дождь ровно к выходу из офиса.';
        if (s.vars.transportType === 'walk') t += ' Вы сегодня уже ходили пешком. Ноги помнят всё.';
        if (s.vars.district === 'south') t += ' С юга тучи приходят быстрее, чем 195-я.';
        if (s.vars.district === 'vostok') t += ' До Востока-5 дождь обычно доезжает вместе с вами.';
        return t;
      },
      choices: [
        {
          id: 'buy-umbrella',
          title: 'Купить зонт в переходе',
          desc: 'Триста пятьдесят сом за сухость и чувство контроля над погодой.',
          minutes: 15,
          fx: { money: -350, energy: -2, stress: -2 },
          flags: ['weatherReady', 'boughtUmbrella'],
          vars: { weather: 'rain', weatherReady: true },
          result: 'Вы купили зонт у метро. Продавец сказал «берите, хороший», и впервые за день ' +
            'это звучало как правда. Дождь начался через семь минут.'
        },
        {
          id: 'taxi-weather',
          title: 'Вызвать такси заранее',
          desc: 'Двести пятьдесят сом, двенадцать минут и никакого дождя за шиворот.',
          minutes: 12,
          fx: { money: -250, energy: 4, stress: -4 },
          flags: ['weatherReady', 'usedWeatherTaxi'],
          vars: { weather: 'rain', weatherReady: true },
          result: 'Машина подъехала к офису, когда первые капли уже стучали по асфальту. ' +
            'Вы сели в сухое и на секунду почувствовали себя человеком, который всё предусмотрел.'
        },
        {
          id: 'brave-weather',
          title: 'Пойти как есть: дождь не сахар',
          desc: 'Пять минут и минус спокойствие. Зато бесплатно и по-бишкекски.',
          minutes: 5,
          fx: { energy: -6, stress: 8 },
          flags: ['soaked'],
          vars: { weather: 'rain', soaked: true },
          result: 'Вы вышли под дождь в том, в чём были. Через минуту стало ясно: ' +
            'Бишкек не злой, просто у него свои отношения с погодой.'
        }
      ]
    },

    {
      id: 'overtime',
      time: T(17, 0),
      scene: 'office',
      place: 'Офис · 17:00',
      kicker: '17:00 · Конец дня?',
      title: '«Ты же понимаешь, у нас проект»',
      text: (s) => {
        let t = 'Пять вечера. Начальник останавливается у стола: «Тут ещё немного, доделаем?» ' +
          'В офисе уже пахнет вечером, а за окном Бишкек начинает включать фары.';
        if (s.has('owesFavor')) t += ' Азамат смотрит на вас выразительно: он помнит про утреннюю услугу.';
        if (s.has('workTaskDeferred')) t += ' Утренняя задача вернулась с процентами.';
        if (s.has('soaked')) t += ' Мокрые ботинки тихо напоминают, что домой всё-таки хочется.';
        return t;
      },
      choices: [
        {
          id: 'stay',
          title: 'Остаться до победного',
          desc: 'Деньги сейчас, вечер — потом. Начальник оценит.',
          minutes: 70,
          fx: (s) => ({
            money: 1100,
            energy: -22,
            stress: 12 + (s.has('workTaskDeferred') ? 6 : 0) + (s.has('soaked') ? 4 : 0)
          }),
          flags: ['stayedOvertime'],
          vars: { overtime: 'full' },
          result: 'Проект закрыт в 18:10. Начальник кивнул и ушёл. Вы заработали 1 100 сом и ' +
            'ещё немного уважения — правда, ценой вечера.'
        },
        {
          id: 'leave',
          title: 'Уйти ровно в 17:00',
          desc: 'Работа не убежит. По крайней мере, до завтра.',
          minutes: 10,
          fx: (s) => ({ energy: 2, stress: s.has('owesFavor') ? 4 : -6 }),
          flags: (s) => s.has('owesFavor')
            ? ['leftOnTime', 'colleagueOffended']
            : ['leftOnTime'],
          vars: { overtime: 'none' },
          result: (s) => s.has('colleagueOffended')
            ? 'Вы вышли вовремя, но Азамат остался. Его взгляд вы ещё увидите завтра у кулера.'
            : 'Вы закрыли ноутбук ровно в семнадцать ноль-ноль. Взрослый поступок, за который никто не даст премию.'
        },
        {
          id: 'partial',
          title: 'Сделать часть и уйти',
          desc: 'Компромисс: немного денег, немного вечера.',
          minutes: 35,
          fx: { money: 450, energy: -10, stress: 6 },
          flags: ['partialOvertime'],
          vars: { overtime: 'partial' },
          result: 'Вы закрыли самое горящее, отдали остальное и ушли. Не идеально, зато по-человечески.'
        }
      ]
    },

    {
      id: 'bazaar',
      excludeDistricts: ['south'],
      time: T(17, 45),
      scene: 'bazaar',
      place: 'Вечерний закуп',
      kicker: '17:45 · Вечерний закуп',
      title: 'Сумки, цены и искусство торга',
      text: (s) => {
        let t = 'Вечерний Бишкек пахнет лепёшками, бензином и специями. Нужно купить продукты ' +
          'на завтра: хлеб, молоко, овощи, что-то к ужину. Впереди — рынок с торгом, ' +
          'супермаркет с фиксированными ценами или доставка.';
        if (s.has('stayedOvertime')) t += ' Вы добрались позже обычного — продавцы уже сворачиваются.';
        if (s.has('soaked')) t += ' Куртка ещё не высохла, и это добавляет вечеру характера.';
        if (s.has('helpedRelative')) t += ' В сумке лежит чужая посылка, которую тоже надо донести.';
        return t;
      },
      choices: [
        {
          id: 'market',
          title: 'Рынок: торговаться до победы',
          desc: 'Свежее, дешевле и с уважением к процессу. Только времени больше.',
          minutes: 50,
          fx: (s) => ({
            money: s.time > T(18, 30) ? -1200 : -1150,
            energy: -14,
            stress: (s.has('soaked') ? 12 : 8) + (s.time > T(18, 30) ? 2 : 0),
            saved: s.time > T(18, 30) ? 300 : 350
          }),
          flags: ['haggledAtBazaar', 'boughtFreshBread', 'boughtGroceries'],
          vars: { shoppingPlace: 'рынок', boughtGroceries: true },
          result: 'Вы сторговали хлеб, овощи и молоко. Продавец сказал «бери, уважаемый», ' +
            'и это прозвучало как победа. Свежий хлеб ещё тёплый.'
        },
        {
          id: 'supermarket',
          title: 'Супермаркет: всё по полкам',
          desc: 'Быстрее, спокойнее, дороже. Без театра торга.',
          minutes: 35,
          fx: { money: -1150, energy: -6, stress: -2, saved: 150 },
          flags: ['boughtAtSupermarket', 'boughtFreshBread', 'boughtGroceries'],
          vars: { shoppingPlace: 'супермаркет', boughtGroceries: true },
          result: 'Корзина собрана за полчаса, чек длиннее, чем хотелось. Зато хлеб свежий, ' +
            'и никто не спорил за последний помидор.'
        },
        {
          id: 'delivery',
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

    {
      id: 'evening-logistics',
      excludeDistricts: ['vostok5', 'south', 'center'],
      time: T(18, 30),
      scene: 'evening',
      place: 'Вечерний Бишкек · дела',
      kicker: '18:30 · Семейная логистика',
      title: 'Родители, кружок и пакеты — всё сразу',
      text: (s) => {
        let t = 'Пока вы разбираете пакеты, телефон напоминает: родителей давно не видели, ' +
          'у ребёнка завтра кружок, а дома закончился хлеб. Вечер обещает быть логистическим.';
        if (s.has('helpedRelative')) t += ' Двоюродная сестра уже отзвонилась и передала спасибо — теперь ждёт родителей.';
        if (s.has('childUpset')) t += ' Ребёнок ждёт разговора про кружок и делает вид, что не ждёт.';
        if (s.has('soaked')) t += ' Мокрые ботинки стоят у двери и намекают, что сегодня лучше никуда не бежать.';
        return t;
      },
      choices: [
        {
          id: 'visit-parents',
          title: 'Заехать к родителям',
          desc: 'Тридцать пять минут, двести пятьдесят сом на гостинцы и чай, который нельзя отменить.',
          minutes: 35,
          fx: { money: -250, energy: -8, stress: -10 },
          flags: ['visitedParents'],
          vars: { eveningPlan: 'parents' },
          scene: 'parents_home',
          pivot: 'parents-visit',
          result: 'Вы заехали к родителям, привезли хлеб и новости. Мама сказала: «Худой какой», ' +
            'папа включил новости. Полчаса прошли правильно.'
        },
        {
          id: 'pickup-kids',
          title: 'Забрать ребёнка из кружка',
          desc: 'Тридцать минут, сто пятьдесят сом на такси и вовремя оказаться в нужном дворе.',
          minutes: 30,
          fx: { money: -150, energy: -6, stress: -4 },
          flags: ['pickedUpKids'],
          vars: { eveningPlan: 'kids' },
          result: 'Вы успели к концу занятия и забрали ребёнка первым. ' +
            'Он рассказал всю дорогу, как делал аппликацию, и это было лучше любых новостей.'
        },
        {
          id: 'call-parents',
          title: 'Позвонить и успеть домой',
          desc: 'Восемь минут разговора. Не визит, но честный компромисс.',
          minutes: 8,
          fx: { energy: -1, stress: -3 },
          flags: ['calledParents'],
          vars: { eveningPlan: 'call' },
          result: 'Вы позвонили родителям по дороге домой. Мама сказала, что всё хорошо, ' +
            'и попросила не забывать надевать шапку. Вы обещали.'
        }
      ]
    },

    {
      id: 'road-home',
      excludeDistricts: ['vostok5', 'south', 'center'],
      time: T(19, 5),
      scene: 'evening',
      place: 'Вечерний Бишкек',
      kicker: '19:05 · Дорога домой',
      title: 'Город включает огни',
      text: (s) => {
        let t = 'Вечерний Бишкек окрашивается в оранжевый. Сумки оттягивают руки, в наушниках — ' +
          'любимая песня, на дорогах — привычная стихия. До дома двадцать минут пешком, ' +
          'тридцать пять на маршрутке или двадцать на такси.';
        if (s.has('utilityUnpaid')) t += ' В уведомлениях висит неоплаченная коммуналка.';
        if (s.has('soaked')) t += ' Дождь закончился, но куртка всё ещё тяжёлая.';
        if (s.has('visitedParents')) t += ' После родительского чая идти стало теплее.';
        return t;
      },
      choices: [
        {
          id: 'taxi-home',
          title: 'Взять такси',
          desc: '450 сом за тишину и возможность не держать пакеты в толпе.',
          minutes: 20,
          fx: { money: -450, energy: 6, stress: -8 },
          flags: ['taxiHome'],
          vars: { routeHome: 'такси' },
          result: 'Вы доехали с комфортом, слушая радио и глядя на огни. Дорого, но нервы дороже.'
        },
        {
          id: 'marshrutka-home',
          title: 'Маршрутка за 25 сом',
          desc: 'Быстро и дёшево, если считать толкучку частью колорита.',
          minutes: 35,
          fx: (s) => ({
            money: -25,
            energy: -8,
            stress: 12 + (s.has('boughtGroceries') ? 6 : 0) +
              (s.has('soaked') ? 6 : 0) - (s.has('weatherReady') ? 4 : 0)
          }),
          flags: ['marshrutkaHome'],
          vars: { routeHome: 'маршрутка' },
          result: 'Вы втиснулись с пакетами, уступили место и всё равно остались виноватым. ' +
            'Вечерний общественный транспорт — отдельный вид спорта.'
        },
        {
          id: 'walk-home',
          title: 'Пройтись пешком',
          desc: 'Свежий воздух и экономия. Если сумки не против.',
          minutes: 40,
          fx: (s) => ({
            energy: -16,
            stress: -4 + (s.has('soaked') ? 8 : 0) - (s.has('weatherReady') ? 4 : 0)
          }),
          flags: ['walkedHome'],
          vars: { routeHome: 'пешком' },
          result: 'Вы прошли двадцать минут под фонарями. Пакеты скрипели, зато голова проветрилась.'
        }
      ]
    },

    {
      id: 'neighbor',
      excludeDistricts: ['vostok5', 'south', 'center'],
      time: T(19, 40),
      scene: 'evening',
      place: 'Двор · подъезд',
      kicker: '19:40 · Соседка',
      title: 'Апа с четырьмя сумками',
      text: (s) => {
        let t = 'У подъезда соседка Апа пытается одновременно открыть дверь и удержать четыре сумки. ' +
          'Лифт снова «на профилактике». Она улыбается и делает вид, что всё под контролем.';
        if (s.has('boughtFreshBread')) t += ' В вашей сумке лежит ещё тёплый хлеб.';
        if (s.has('soaked')) t += ' С вашей куртки капает, но Апа деликатно не замечает.';
        if (s.has('pickedUpKids')) t += ' Ребёнок уже дома и, кажется, ждёт вас.';
        return t;
      },
      choices: [
        {
          id: 'help-bags',
          title: 'Донести сумки до пятого этажа',
          desc: 'Двадцать минут, двенадцать пролётов и много «спасибо».',
          minutes: 20,
          fx: { energy: -12, stress: -3 },
          flags: ['helpedNeighbor'],
          vars: { neighbor: 'help' },
          result: 'Вы дотащили сумки до пятого этажа. Апа угостила вас конфетами и рассказом ' +
            'о том, как раньше во дворе было тише.'
        },
        {
          id: 'give-bread',
          title: (s) => s.has('boughtFreshBread')
            ? 'Отдать свежий хлеб'
            : 'Помочь донести хотя бы до лифта',
          desc: (s) => s.has('boughtFreshBread')
            ? 'Иногда лучший подарок — тёплый хлеб и пять минут разговора.'
            : 'Без героизма, но по-соседски.',
          minutes: (s) => s.has('boughtFreshBread') ? 10 : 8,
          fx: (s) => s.has('boughtFreshBread')
            ? { energy: -4, stress: -6 }
            : { energy: -6, stress: -1 },
          flags: (s) => s.has('boughtFreshBread')
            ? ['helpedNeighbor', 'sharedBread']
            : ['helpedNeighborPartially'],
          vars: { neighbor: 'bread' },
          result: (s) => s.has('sharedBread')
            ? 'Апа взяла хлеб, прижала к груди и сказала: «Вот это по-нашему». ' +
              'Совесть работает лучше любого фитнеса.'
            : 'Вы донесли сумки до лифта и извинились, что спешите. Апа кивнула: «Иди, милый, иди».'
        },
        {
          id: 'rush-home',
          title: 'Извиниться и поспешить домой',
          desc: 'Вечер короткий, уроки не сделаны, ужин не приготовлен.',
          minutes: 5,
          fx: { stress: 4 },
          flags: ['hurriedHome'],
          vars: { neighbor: 'rush' },
          result: 'Вы извинились и прошли мимо. Домашние дела никуда не делись, ' +
            'а неприятный осадок остался.'
        }
      ]
    },

    {
      id: 'family-evening',
      excludeDistricts: ['vostok5', 'south', 'center'],
      time: T(20, 15),
      scene: 'home',
      place: 'Дом · вечер',
      kicker: '20:15 · Дома',
      title: 'Вечер, который тоже надо прожить',
      text: (s) => {
        let t = 'Дома тепло и пахнет чаем. На столе — продукты, в рюкзаке — рабочий ноутбук, ' +
          'в телефоне — ещё два непрочитанных чата. До конца дня остаётся час с небольшим.';
        if (s.has('childUpset')) t += ' Ребёнок уже спросил про кружок и ушёл в комнату.';
        if (s.has('boughtFreshBread')) t += ' Свежий хлеб на столе пахнет утром.';
        if (s.has('headache')) t += ' Голова всё ещё напоминает о себе.';
        if (s.has('soaked')) t += ' Мокрые ботинки сохнут у батареи, а куртка — на стуле.';
        if (s.vars.eveningPlan === 'parents') t += ' После родителей осталось тёплое чувство и пакет гостинцев.';
        if (s.vars.eveningPlan === 'kids') t += ' Ребёнок уже нарисовал что-то важное и ждёт оценки.';
        if (s.has('lateToSchool')) t += ' Утреннее опоздание всё ещё висит в воздухе.';
        return t;
      },
      choices: [
        {
          id: 'family-time',
          title: 'Ужин и уроки вместе',
          desc: 'Сорок пять минут без телефона. Самый дефицитный ресурс дня.',
          minutes: 45,
          fx: (s) => ({
            energy: -10,
            stress: -12 +
              (s.has('childUpset') ? 8 : 0) +
              (s.has('soaked') ? 6 : 0) +
              (s.vars.eveningPlan === 'kids' ? -4 : 0) +
              (s.vars.eveningPlan === 'parents' ? -2 : 0)
          }),
          flags: ['familyTime'],
          vars: { familyEvening: 'time' },
          result: (s) => s.has('childUpset')
            ? 'Уроки сделаны, ужин съеден. Ребёнок всё ещё грустит из-за кружка, но вы рядом — ' +
              'и это уже немало.'
            : 'Вы сделали уроки, поужинали и посмеялись над ошибкой в задаче. День наконец стал похож на жизнь.'
        },
        {
          id: 'eat-sarkyt',
          title: 'Разогреть мамин саркыт',
          desc: 'Контейнеры от мамы: плов, манты и три котлеты «на завтра». Ноль сом.',
          requiredFlags: ['gotSarkyt'],
          lockReason: 'Для этого нужно было вернуться от родителей с контейнерами.',
          minutes: 15,
          fx: { energy: 6, stress: -6 },
          flags: ['familyTime', 'ateSarkyt'],
          vars: { familyEvening: 'dinner' },
          result: 'Плов разогрелся быстрее, чем закипел чайник. Ребёнок попросил добавки и сказал «как у бабушки», ' +
            'что для плова было высшей оценкой.'
        },
        {
          id: 'order-dinner',
          title: 'Заказать ужин и включить мультики',
          desc: '350 сом за вечер без плиты и мытья посуды.',
          minutes: 25,
          fx: (s) => ({
            money: -350,
            energy: 4,
            stress: s.has('childUpset') ? -2 : -4
          }),
          flags: ['orderedDinner', 'familyTime'],
          vars: { familyEvening: 'dinner' },
          result: 'Ужин приехал в контейнерах, мультики включились сами. Вы лежали на диване ' +
            'и впервые за день никуда не торопились.'
        },
        {
          id: 'evening-finish',
          title: (s) => s.has('schoolPaymentDeferred') && !s.has('schoolPaid')
            ? 'Перевести 900 сом и сесть за уроки'
            : 'Подготовить завтрак и лечь пораньше',
          desc: (s) => s.has('schoolPaymentDeferred') && !s.has('schoolPaid')
            ? 'Закрыть вопрос с кружком и провести вечер с ребёнком.'
            : 'Сварить кашу на завтра и лечь спать до полуночи.',
          minutes: (s) => s.has('schoolPaymentDeferred') && !s.has('schoolPaid') ? 50 : 25,
          fx: (s) => s.has('schoolPaymentDeferred') && !s.has('schoolPaid')
            ? { money: -900, energy: -12, stress: -2 }
            : { energy: 8, stress: -8 },
          flags: (s) => s.has('schoolPaymentDeferred') && !s.has('schoolPaid')
            ? ['schoolPaid', 'familyTime', 'homeworkDone']
            : ['prepTomorrow'],
          clear: ['schoolPaymentDeferred', 'childUpset'],
          vars: (s) => s.has('schoolPaymentDeferred') && !s.has('schoolPaid')
            ? { schoolPayment: 'paid-late', familyEvening: 'finish' }
            : { familyEvening: 'prep' },
          result: (s, ch, before) => before.has('schoolPaymentDeferred') && !before.has('schoolPaid')
            ? 'Вы перевели 900 сом и сели за уроки. Ребёнок обнял вас и сказал: «Я знал, что ты сможешь». ' +
              'Бюджет пострадал, совесть — нет.'
            : 'Каша на завтра сварена, будильник поставлен. Вы легли раньше обычного — роскошь, ' +
              'которую не купишь за 900 сом.'
        }
      ]
    },

    {
      id: 'parents-call',
      excludeDistricts: ['vostok5', 'south', 'center'],
      time: T(21, 0),
      scene: 'home',
      place: 'Дом · телефон',
      kicker: '21:00 · Звонок',
      title: 'Мама звонит первой',
      when: (s) => s.vars.eveningPlan === 'parents',
      text: () => 'Вы только что вернулись от родителей, а телефон уже звонит. ' +
        'Мама забыла сказать что-то важное — или просто захотела услышать ваш голос ещё раз.',
      choices: [
        {
          id: 'talk',
          title: 'Поговорить ещё десять минут',
          desc: 'Десять минут, минус два процента энергии и минус шесть процентов стресса.',
          minutes: 10,
          fx: { energy: -2, stress: -6 },
          flags: ['calledParents', 'longParentCall'],
          vars: { calledParents: true },
          result: 'Вы проговорили десять минут о шапке, погоде и том, что надо бы приехать на выходных. ' +
            'Положили трубку и улыбнулись.'
        },
        {
          id: 'short',
          title: 'Коротко: «Всё хорошо, мам»',
          desc: 'Четыре минуты. Иногда этого достаточно.',
          minutes: 4,
          fx: { stress: -2 },
          flags: ['calledParentsShort'],
          vars: { calledParents: true },
          result: 'Вы сказали, что всё хорошо, и пообещали позвонить завтра. ' +
            'Мама вздохнула с облегчением — она умеет слышать больше, чем вы говорите.'
        },
        {
          id: 'skip-call',
          title: 'Не брать: сил уже нет',
          desc: 'Две минуты тишины и плюс четыре процента стресса.',
          minutes: 2,
          fx: { stress: 4 },
          flags: ['ignoredParentCall'],
          vars: { calledParents: false },
          result: 'Вы посмотрели на звонок и отложили телефон. Завтра будет новый день ' +
            'и новый повод позвонить.'
        }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);

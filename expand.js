// AIRCOURT — раскрывающиеся карточки на странице товара («Доставка», «Обмен», «Уход»).
// По клику карточка поднимается наверх и раскрывается: картинка растёт, название уезжает под неё,
// появляются подробности, а остальные карточки опускаются и гаснут. Повторный клик сворачивает обратно.
// Пока покупатель ничего не нажал, карточки раскрываются по очереди сами.

// ---------- Пружина ----------
// Пружина хранит текущее значение x, скорость v и цель t.
// k — жёсткость (чем больше, тем быстрее догоняет цель), c — затухание (чем больше, тем меньше качается)
function spring(x, k, c) {
  // если в системе выключены анимации — убираем раскачку, движение остаётся плавным
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) c = 2 * Math.sqrt(k);
  return { x: x, v: 0, t: x, k: k, c: c };
}

// Один маленький шаг по времени dt (в секундах): сила тянет к цели, затухание гасит скорость
function springStep(s, dt) {
  var force = -s.k * (s.x - s.t) - s.c * s.v;
  s.v += force * dt;
  s.x += s.v * dt;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ---------- Карточки ----------
var EXPAND_LIST_H = 280;   // высота всего блока
var EXPAND_ROW = 72;       // высота свёрнутой карточки
var EXPAND_GAP = 8;        // расстояние между карточками

// list — блок с карточками .ex внутри
function initExpandCards(list) {
  var pad = (EXPAND_LIST_H - (3 * EXPAND_ROW + 2 * EXPAND_GAP)) / 2;
  var timers = [];         // отложенные действия (считаются по времени анимации)
  var clock = 0;           // сколько секунд прошло
  var userUntil = 0;       // до какого момента не включать автопоказ (после клика)
  var open = -1;           // номер раскрытой карточки, -1 — все свёрнуты
  var next = 0;            // какую карточку автопоказ раскроет следующей

  // У каждой карточки свои пружины: p — раскрытие (0..1), a — проявление подробностей,
  // y — положение по вертикали, o — прозрачность, s — масштаб
  var rows = Array.prototype.map.call(list.querySelectorAll('.ex'), function (el, i) {
    return {
      el: el, i: i,
      thumb: el.querySelector('.thumb'), head: el.querySelector('.head'),
      price: el.querySelector('.price'), more: el.querySelector('.more'),
      p: spring(0, 240, 21), a: spring(0, 260, 28), y: spring(pad + i * (EXPAND_ROW + EXPAND_GAP), 300, 26),
      o: spring(1, 300, 30), s: spring(1, 300, 26)
    };
  });

  function after(seconds, fn) {
    timers.push({ left: seconds, fn: fn });
  }

  // Раскрыть карточку номер i (или свернуть все, если i = -1): меняем только цели пружин
  function show(i) {
    open = i;
    rows.forEach(function (r) {
      var home = pad + r.i * (EXPAND_ROW + EXPAND_GAP);
      if (i < 0) {
        r.p.t = 0; r.a.t = 0; r.y.t = home; r.o.t = 1; r.s.t = 1;
      } else if (r.i === i) {
        r.p.t = 1; r.y.t = 0; r.o.t = 1; r.s.t = 1;
        r.el.style.zIndex = 2;
        // подробности проявляются чуть позже, когда карточка уже начала расти
        after(0.16, function () { if (open === i) r.a.t = 1; });
      } else {
        r.a.t = 0; r.p.t = 0; r.o.t = 0; r.s.t = 0.94;
        r.y.t = home + (r.i < i ? -24 : 24);
        r.el.style.zIndex = 1;
      }
    });
  }

  rows.forEach(function (r) {
    r.el.addEventListener('click', function () {
      userUntil = clock + 7;   // после клика автопоказ ждёт 7 секунд
      show(open === r.i ? -1 : r.i);
    });
  });

  // Автопоказ: раскрыть карточку, подержать 2.8 с, свернуть, через 1.3 с — следующую
  function auto() {
    if (clock >= userUntil) {
      if (open < 0) {
        show(next % 3);
        next++;
        after(2.8, auto);
        return;
      }
      show(-1);
    }
    after(1.3, auto);
  }
  auto();

  // Пересчёт пружин (4 маленьких шага за кадр — так движение точнее)
  function update(dt) {
    clock += dt;
    for (var t = timers.length - 1; t >= 0; t--) {
      timers[t].left -= dt;
      if (timers[t].left <= 0) timers.splice(t, 1)[0].fn();
    }
    for (var k = 0; k < 4; k++) {
      rows.forEach(function (r) {
        [r.p, r.a, r.y, r.o, r.s].forEach(function (s) { springStep(s, dt / 4); });
      });
    }
  }

  // Перенос значений пружин в стили
  function draw() {
    var width = list.offsetWidth;
    rows.forEach(function (r) {
      var p = r.p.x;
      var q = clamp(p, 0, 1);
      var full = 176 + r.more.offsetHeight + 16;   // высота раскрытой карточки
      r.el.style.height = (EXPAND_ROW + p * (full - EXPAND_ROW)) + 'px';
      r.el.style.transform = 'translateY(' + r.y.x + 'px) scale(' + r.s.x + ')';
      r.el.style.opacity = clamp(r.o.x, 0, 1);
      r.el.style.pointerEvents = r.o.t > 0.5 ? 'auto' : 'none';
      // картинка растёт из квадрата 48×48 в широкую полосу
      r.thumb.style.width = (48 + q * (width - 24 - 48)) + 'px';
      r.thumb.style.height = Math.max(48, 48 + p * 56) + 'px';
      r.thumb.style.borderRadius = (12 + q * 4) + 'px';
      // название и цена съезжают под картинку
      r.head.style.transform = 'translate(' + (72 - 56 * q) + 'px,' + (16 + 112 * p) + 'px)';
      r.price.style.transform = 'translateY(' + (26 + 106 * p) + 'px)';
      r.more.style.opacity = clamp(r.a.x, 0, 1);
      r.more.style.transform = 'translateY(' + ((1 - r.a.x) * 10) + 'px)';
    });
  }

  // Анимация идёт каждый кадр и останавливается, когда блок убрали со страницы
  var last = performance.now();
  function frame(now) {
    if (!document.body.contains(list)) return;
    var dt = Math.min((now - last) / 1000, 1 / 30);   // не больше 1/30 с, если вкладка тормозила
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

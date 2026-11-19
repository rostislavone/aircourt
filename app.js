// AIRCOURT — сайт магазина. Данные приходят с сервера программы (C#) через запросы /api/...
// В этом файле: общие функции, переходы между страницами, шапка, главная и каталог.
// Страницы товара, корзины, входа и кабинета — в pages.js

var state = {
  me: { loggedIn: false, cartCount: 0 },
  categories: [],
  brands: [],
  homeLoaded: false,
  catalog: { category: 0, brand: 0, sort: 'new', search: '' }
};

// Общие функции (api, money, esc, toast) — в common.js

// ---------- Переходы между страницами (#home, #catalog/1, #product/5, #cart, #login, #account) ----------

function route() {
  var parts = location.hash.replace('#', '').split('/');
  var name = parts[0] || 'home';

  if (name === 'catalog') {
    showScreen('home');
    // текст поиска приходит из строки поиска; при обычном переходе по меню поиск сбрасывается
    var search = state.pendingSearch || '';
    state.pendingSearch = '';
    openCatalog(+parts[1] || 0, +parts[2] || 0, parts[3] || 'new', search);
    return;
  }
  if ((name === 'cart' || name === 'account') && !state.me.loggedIn) {
    toast('Сначала войдите в аккаунт');
    location.hash = '#login';
    return;
  }
  if (!$(name)) {
    name = 'home';
  }

  showScreen(name);
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'home') loadHome();
  if (name === 'product') loadProduct(+parts[1]);
  if (name === 'cart') loadCart();
  if (name === 'account') loadAccount();
  if (name === 'login') showLogin();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.classList.toggle('active', screen.id === name);
  });
  $('nav').classList.remove('open');
  closeMega();
  closeHeadSearch();
  stopSmooth();
}

// ---------- Шапка ----------

function refreshMe() {
  return api('/api/me').then(function (me) {
    state.me = me;
    var link = $('userLink');
    link.textContent = me.loggedIn ? me.firstName : 'Войти';
    link.href = me.loggedIn ? '#account' : '#login';
    $('cartCount').textContent = me.cartCount;
  });
}

// Выпадающее меню категорий (данные из /api/menu, запоминаем, чтобы не грузить повторно)
var menuCache = {};
var megaTimer;

function openMega(categoryId) {
  clearTimeout(megaTimer);
  if (menuCache[categoryId]) {
    fillMega(categoryId, menuCache[categoryId]);
    return;
  }
  api('/api/menu?category=' + categoryId).then(function (data) {
    menuCache[categoryId] = data;
    fillMega(categoryId, data);
  });
}

function fillMega(categoryId, data) {
  var html = '<div><h4>Бренды</h4><ul>';
  data.brands.forEach(function (b) {
    html += '<li><a href="#catalog/' + categoryId + '/' + b.BrandID + '">' + esc(b.BrandName) + '</a></li>';
  });
  html += '</ul></div><div><h4>Подборки</h4><ul>' +
    '<li><a href="#catalog/' + categoryId + '/0/new">Новинки</a></li>' +
    '<li><a href="#catalog/' + categoryId + '/0/cheap">Сначала дешёвые</a></li>' +
    '<li><a href="#catalog/' + categoryId + '/0/expensive">Сначала дорогие</a></li>' +
    '<li><a href="#catalog/' + categoryId + '">Все товары</a></li></ul></div><div></div>';
  if (data.newest.length > 0) {
    var p = data.newest[0];
    html += '<div class="mega-promo"><div class="art" style="background:' + productBack(p.CategoryID) + '"><img src="' + p.Image + '" alt=""></div>' +
      '<div><div class="muted" style="font-size:12px">Новинка категории</div><b>' + esc(p.ProductName) + '</b></div>' +
      '<a class="btn btn-sm" href="#product/' + p.ProductID + '">Смотреть</a></div>';
  }
  $('mega').innerHTML = html;
  $('mega').classList.add('open');
}

function closeMega() {
  $('mega').classList.remove('open');
}

// ---------- Главная ----------

function loadHome() {
  if (state.homeLoaded) {
    return Promise.resolve();
  }
  state.homeLoaded = true;

  // веер карточек остался только на странице входа, на главной — три фото
  api('/api/products?sort=random&limit=11').then(function (list) {
    renderFan('authFan', list.concat(list).slice(0, 7), 110);
  });
  api('/api/products?onlyNew=1&limit=4').then(function (list) {
    renderCards('newGrid', list, true);
  });
  api('/api/picks').then(function (data) {
    renderRank('topList', data.top);
    renderRank('gearList', data.gear);
    if (data.featured.length > 0) renderFirefly(data.featured[0]);
  });
  return api('/api/catalog').then(function (data) {
    state.categories = data.categories;
    state.brands = data.brands;
    var tabs = '<span data-cat="0">Все</span>';
    data.categories.forEach(function (c) {
      tabs += '<span data-cat="' + c.CategoryID + '">' + esc(c.CategoryName) + '</span>';
    });
    $('catalogTabs').innerHTML = tabs;
    var brands = '<option value="0">Все бренды</option>';
    data.brands.forEach(function (b) {
      brands += '<option value="' + b.BrandID + '">' + esc(b.BrandName) + '</option>';
    });
    $('brandSelect').innerHTML = brands;
    loadCatalog();
  });
}

function openCatalog(category, brand, sort, search) {
  state.catalog.category = category;
  state.catalog.brand = brand;
  state.catalog.sort = sort;
  state.catalog.search = search;
  $('searchInput').value = search;
  loadHome().then(function () {
    loadCatalog();
    setTimeout(function () { $('catalog').scrollIntoView({ behavior: 'smooth' }); }, 50);
  });
}

function loadCatalog() {
  var c = state.catalog;
  document.querySelectorAll('#catalogTabs span').forEach(function (tab) {
    tab.classList.toggle('active', +tab.dataset.cat === c.category);
  });
  $('brandSelect').value = c.brand;
  $('sortSelect').value = c.sort;

  var query = '/api/products?category=' + c.category + '&brand=' + c.brand + '&sort=' + c.sort +
    '&search=' + encodeURIComponent(c.search);
  api(query).then(function (list) {
    renderCards('catalogGrid', list, false);
    $('foundCount').textContent = list.length > 0 ? 'Найдено: ' + list.length : 'Ничего не найдено';
  });
}

// Категории без товаров убираем из меню в шапке (у ссылок в data-menu записан ID категории)
function hideEmptyCategories() {
  api('/api/catalog').then(function (data) {
    var filled = data.categories.map(function (c) { return String(c.CategoryID); });
    document.querySelectorAll('#nav a[data-menu]').forEach(function (link) {
      link.style.display = filled.indexOf(link.dataset.menu) >= 0 ? '' : 'none';
    });
  });
}

// Веер карточек (на странице входа)
function renderFan(id, list, spread) {
  var html = '';
  var count = Math.min(11, list.length);
  var middle = (count - 1) / 2;
  for (var i = 0; i < count; i++) {
    var p = list[i];
    var k = i - middle;
    html += '<div class="fan-card" style="background:' + productBack(p.CategoryID) + ';z-index:' + (20 - Math.abs(Math.round(k))) +
      ';transform:translateX(calc(-50% + ' + (k * spread) + 'px)) translateY(' + (k * k * 4) + 'px) rotate(' + (k * 4) + 'deg)">' +
      '<img src="' + p.Image + '" alt=""></div>';
  }
  $(id).innerHTML = html;
}

// Колонка-рейтинг: номер, картинка, название, бренд и цена
function renderRank(id, list) {
  $(id).innerHTML = list.map(function (p, i) {
    return '<a class="rank-row" href="#product/' + p.ProductID + '"><span class="num' + (i === 0 ? ' first' : '') + '">' + (i + 1) + '</span>' +
      '<span class="thumb" style="background:' + productBack(p.CategoryID) + '"><img src="' + p.Image + '" alt=""></span>' +
      '<span><b>' + esc(p.ProductName) + '</b><small>' + esc(p.BrandName) + '</small></span>' +
      '<span class="price">' + money(p.Price) + '</span></a>';
  }).join('');
}

// Блок «Выбрано для тебя»: случайный товар на сером круге
function renderFirefly(p) {
  $('fireflyImage').src = p.Image;
  $('fireflyName').textContent = p.ProductName;
  $('fireflyMeta').textContent = p.BrandName + ' · ' + money(p.Price);
  $('firefly').href = '#product/' + p.ProductID;
  $('fireflyButton').href = '#product/' + p.ProductID;
}

// Карточки товаров (у карточек в чёрном блоке фон задаёт CSS)
function renderCards(id, list, isDark) {
  var html = '';
  list.forEach(function (p) {
    var label = p.IsNew == 1 ? '<span class="pill ' + (isDark ? '' : 'pill-accent') + '">NEW</span>' : '';
    var back = isDark ? '' : ' style="background:' + productBack(p.CategoryID) + '"';
    html += '<a class="p-card" href="#product/' + p.ProductID + '">' +
      '<div class="p-img"' + back + '>' + label + '<img src="' + p.Image + '" alt=""></div>' +
      '<div class="p-brand">' + esc(p.BrandName) + '</div><div class="p-name">' + esc(p.ProductName) + '</div>' +
      '<div class="p-price">' + money(p.Price) + '</div></a>';
  });
  $(id).innerHTML = html || '<p class="empty">Ничего не найдено. Попробуйте другой фильтр.</p>';
}

// ---------- Плавная прокрутка колёсиком ----------
// Браузер прокручивает колёсиком рывками. Мы перехватываем колёсико и каждый кадр
// проезжаем 12% оставшегося пути — страница мягко «догоняет» нужную точку и замедляется в конце

var smooth = { current: 0, target: 0, running: false };

function onWheel(e) {
  // Ctrl + колёсико — это масштаб страницы, выпадающие списки и поля крутятся сами
  if (e.ctrlKey || e.target.closest('select, textarea')) return;
  e.preventDefault();
  if (!smooth.running) {
    smooth.current = window.scrollY;
    smooth.target = window.scrollY;
  }
  var delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;   // если колёсико шлёт строки — переводим в пиксели
  var max = document.documentElement.scrollHeight - window.innerHeight;
  smooth.target = Math.max(0, Math.min(max, smooth.target + delta));
  if (!smooth.running) {
    smooth.running = true;
    requestAnimationFrame(smoothStep);
  }
}

function smoothStep() {
  smooth.current += (smooth.target - smooth.current) * 0.12;
  if (Math.abs(smooth.target - smooth.current) < 0.5) {
    smooth.current = smooth.target;
  }
  window.scrollTo({ top: smooth.current, behavior: 'instant' });
  if (smooth.current !== smooth.target) {
    requestAnimationFrame(smoothStep);
  } else {
    smooth.running = false;
  }
}

// Если прокрутили не колёсиком (полоса прокрутки, клавиши, переход по ссылке) — останавливаем нашу анимацию
function stopSmooth() {
  smooth.running = false;
  smooth.target = window.scrollY;
  smooth.current = window.scrollY;
}

// ---------- Поиск ----------

function searchFor(text) {
  state.pendingSearch = text;
  $('searchInput').value = text;
  $('headSearchInput').value = text;
  closeHeadSearch();
  if (location.hash === '#catalog/0') {
    route();
  } else {
    location.hash = '#catalog/0';
  }
}

function toggleHeadSearch() {
  var box = $('headSearch');
  if (box.classList.contains('open')) {
    closeHeadSearch();
    return;
  }
  closeMega();
  box.classList.add('open');
  setTimeout(function () { $('headSearchInput').focus(); }, 50);
}

function closeHeadSearch() {
  $('headSearch').classList.remove('open');
}

// ---------- Появление блоков при прокрутке ----------
// IntersectionObserver сообщает, когда элемент попал на экран.
// Тогда добавляем класс show, а саму анимацию (сдвиг снизу и проявление) делает CSS
var revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
      revealObserver.unobserve(entry.target);   // второй раз анимировать не нужно
    }
  });
}, { threshold: 0.15 });

function startReveal() {
  document.querySelectorAll('.reveal').forEach(function (block) {
    revealObserver.observe(block);
  });
}

// ---------- Запуск ----------

window.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('#nav a[data-menu]').forEach(function (link) {
    link.addEventListener('mouseenter', function () { openMega(link.dataset.menu); });
  });
  $('header').addEventListener('mouseleave', function () { megaTimer = setTimeout(closeMega, 150); });
  $('mega').addEventListener('mouseenter', function () { clearTimeout(megaTimer); });
  $('burger').onclick = function () { $('nav').classList.toggle('open'); };
  window.addEventListener('scroll', function () { $('header').classList.toggle('scrolled', window.scrollY > 10); });

  $('catalogTabs').addEventListener('click', function (e) {
    if (e.target.dataset.cat !== undefined) {
      state.catalog.category = +e.target.dataset.cat;
      loadCatalog();
    }
  });
  $('brandSelect').onchange = function () { state.catalog.brand = +this.value; loadCatalog(); };
  $('sortSelect').onchange = function () { state.catalog.sort = this.value; loadCatalog(); };
  $('searchForm').onsubmit = function (e) {
    e.preventDefault();
    searchFor($('searchInput').value.trim());
  };
  $('headSearchButton').onclick = toggleHeadSearch;
  $('bannerButton').onclick = function () { $('newBlock').scrollIntoView({ behavior: 'smooth' }); };
  $('headSearch').onsubmit = function (e) {
    e.preventDefault();
    searchFor($('headSearchInput').value.trim());
  };
  $('headSearchInput').onkeydown = function (e) {
    if (e.key === 'Escape') closeHeadSearch();
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', stopSmooth);
  window.addEventListener('mousedown', stopSmooth);

  initPages();
  startReveal();
  hideEmptyCategories();
  refreshMe().then(function () {
    route();
    window.addEventListener('hashchange', route);
  });
});

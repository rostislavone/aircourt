// AIRCOURT — демо-версия сайта для GitHub Pages.
// Настоящий сайт получает данные от сервера на C# (запросы /api/...). На GitHub Pages сервера нет,
// поэтому здесь функция api() из common.js заменена своей: товары берутся из папки data,
// а вход, корзина и заказы хранятся в браузере (localStorage) — у каждого посетителя свои.
//
// Весь файл обёрнут в (function () { ... })(), чтобы его функции (route, load, save...) не путались
// с одноимёнными функциями из app.js и pages.js. Наружу отдаём только api — в самом конце файла.
(function () {

var demo ={ products: [], catalog: { categories: [], brands: [] }, picks: { top: [], gear: [] } };

// Загружаем данные один раз при открытии страницы
demo.ready = Promise.all([
  fetch('data/products.json').then(function (r) { return r.json(); }),
  fetch('data/catalog.json').then(function (r) { return r.json(); }),
  fetch('data/picks.json').then(function (r) { return r.json(); })
]).then(function (data) {
  demo.products = data[0];
  demo.catalog = data[1];
  demo.picks = data[2];
});

// ---------- Хранилище в браузере ----------
// try/catch — в режиме «инкогнито» localStorage может быть недоступен, тогда просто ничего не сохраняем

function load(name, empty) {
  try {
    var value = JSON.parse(localStorage.getItem('aircourt-' + name));
    return value === null ? empty : value;
  } catch (e) {
    return empty;
  }
}

function save(name, value) {
  try {
    localStorage.setItem('aircourt-' + name, JSON.stringify(value));
  } catch (e) { }
}

// ---------- Замена api() ----------

function api(path, body) {
  return demo.ready.then(function () {
    var parts = path.split('?');
    var query = new URLSearchParams(parts[1] || '');
    var result = route(parts[0], query, body || {});
    // отдаём копию, чтобы страница случайно не испортила наши данные
    return JSON.parse(JSON.stringify(result));
  });
}

function route(name, q, body) {
  switch (name) {
    case '/api/catalog': return demo.catalog;
    case '/api/products': return findProducts(q);
    case '/api/picks': return picks();
    case '/api/product': return product(+q.get('id'));
    case '/api/menu': return menu(+q.get('category'));
    case '/api/me': return me();
    case '/api/login': return login(body);
    case '/api/register': return register(body);
    case '/api/logout': save('user', null); return { ok: true };
    case '/api/cart': return cart(q.get('promo') || '');
    case '/api/cart/add': return cartAdd(body);
    case '/api/cart/quantity': return cartQuantity(body);
    case '/api/cart/remove': return cartRemove(body);
    case '/api/order': return placeOrder(body);
    case '/api/account': return body.firstName === undefined ? account() : saveProfile(body);
  }
  throw new Error('Нет такого запроса');
}

// ---------- Каталог (те же правила, что в Shop.cs) ----------

function byId(id) {
  return demo.products.filter(function (p) { return p.ProductID === id; })[0];
}

function findProducts(q) {
  var list = demo.products.slice();
  var category = +q.get('category'), brand = +q.get('brand'), exclude = +q.get('exclude');
  var search = (q.get('search') || '').trim().toLowerCase();

  list = list.filter(function (p) {
    if (category > 0 && p.CategoryID !== category) return false;
    if (brand > 0 && p.BrandID !== brand) return false;
    if (exclude > 0 && p.ProductID === exclude) return false;
    if (q.get('onlyNew') === '1' && p.IsNew != 1) return false;
    // поиск по названию и бренду без учёта регистра
    if (search !== '' && (p.ProductName + ' ' + p.BrandName).toLowerCase().indexOf(search) < 0) return false;
    return true;
  });

  var sort = q.get('sort');
  if (sort === 'cheap') list.sort(function (a, b) { return a.Price - b.Price; });
  else if (sort === 'expensive') list.sort(function (a, b) { return b.Price - a.Price; });
  else if (sort === 'random') list.sort(function () { return Math.random() - 0.5; });
  else list.sort(function (a, b) { return (b.IsNew - a.IsNew) || (b.ProductID - a.ProductID); });   // сначала новинки

  var limit = +q.get('limit') || 100;
  return list.slice(0, limit);
}

function picks() {
  var random = demo.products[Math.floor(Math.random() * demo.products.length)];
  return { top: demo.picks.top.map(byId), gear: demo.picks.gear.map(byId), featured: [random] };
}

function product(id) {
  var p = byId(id);
  if (!p) throw new Error('Товар не найден');
  return p;
}

function menu(categoryId) {
  var inCategory = demo.products.filter(function (p) { return p.CategoryID === categoryId; });
  var brandIds = inCategory.map(function (p) { return p.BrandID; });
  var brands = demo.catalog.brands.filter(function (b) { return brandIds.indexOf(b.BrandID) >= 0; });
  inCategory.sort(function (a, b) { return (b.IsNew - a.IsNew) || (b.ProductID - a.ProductID); });
  return { brands: brands, newest: inCategory.slice(0, 1) };
}

// ---------- Вход ----------
// В демо подходят любой email и пароль: пользователь хранится только в этом браузере

function me() {
  var user = load('user', null);
  if (!user) return { loggedIn: false, cartCount: 0 };
  var count = load('cart', []).reduce(function (sum, item) { return sum + item.Quantity; }, 0);
  return { loggedIn: true, firstName: user.firstName, cartCount: count };
}

function login(body) {
  var email = (body.email || '').trim();
  if (email === '' || !body.password) throw new Error('Введите email и пароль.');
  var user = load('profile', null) || { firstName: email.split('@')[0], lastName: '', email: email, phone: '', address: '' };
  save('profile', user);
  save('user', user);
  return { ok: true };
}

function register(body) {
  if (!body.firstName || !body.lastName) throw new Error('Введите имя и фамилию.');
  if ((body.email || '').indexOf('@') < 0) throw new Error('Введите корректный email.');
  if ((body.password || '').length < 6) throw new Error('Пароль должен быть не короче 6 символов.');
  var user = { firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone || '', address: '' };
  save('profile', user);
  save('user', user);
  return { ok: true };
}

function requireLogin() {
  var user = load('user', null);
  if (!user) throw new Error('Войдите в аккаунт.');
  return user;
}

// ---------- Корзина и заказ ----------
// В корзине храним только номер товара, размер и количество, остальное берём из products.json

var FREE_DELIVERY_FROM = 10000;
var DELIVERY_PRICE = 490;

function promoPercent(code) {
  return code.trim().toUpperCase() === 'AIRCOURT10' ? 10 : 0;
}

function cartItems() {
  return load('cart', []).map(function (item) {
    var p = byId(item.ProductID);
    return Object.assign({}, p, { CartItemID: item.CartItemID, Quantity: item.Quantity, Size: item.Size });
  });
}

function totals(items, percent) {
  var t = { count: 0, sum: 0 };
  items.forEach(function (item) {
    t.count += item.Quantity;
    t.sum += item.Price * item.Quantity;
  });
  t.discount = Math.round(t.sum * percent / 100);
  var afterDiscount = t.sum - t.discount;
  t.delivery = afterDiscount === 0 || afterDiscount >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
  t.total = afterDiscount + t.delivery;
  return t;
}

function cart(promo) {
  var user = requireLogin();
  var items = cartItems();
  var t = totals(items, promoPercent(promo));
  return {
    items: items, count: t.count, sum: t.sum, discount: t.discount, delivery: t.delivery, total: t.total,
    promoOk: promoPercent(promo) > 0, address: user.address
  };
}

function cartAdd(body) {
  requireLogin();
  var p = byId(body.productId);
  if (!p) throw new Error('Товар не найден.');
  if (p.Stock <= 0) throw new Error('Товара нет в наличии.');
  var sizes = p.Size ? p.Size.replace(/ /g, '').split(',') : [];
  var size = sizes.length ? body.size : '';
  if (sizes.length && sizes.indexOf(size) < 0) throw new Error('Выберите размер.');

  var items = load('cart', []);
  var same = items.filter(function (i) { return i.ProductID === p.ProductID && i.Size === size; })[0];
  if (same) {
    same.Quantity = Math.min(p.Stock, same.Quantity + Math.max(1, body.quantity));   // не больше, чем на складе
  } else {
    items.push({ CartItemID: Date.now(), ProductID: p.ProductID, Size: size, Quantity: Math.max(1, Math.min(p.Stock, body.quantity)) });
  }
  save('cart', items);
  return { ok: true };
}

function cartQuantity(body) {
  requireLogin();
  var items = load('cart', []);
  var item = items.filter(function (i) { return i.CartItemID === body.cartItemId; })[0];
  if (!item) throw new Error('Товар не найден.');
  var stock = byId(item.ProductID).Stock;
  if (body.quantity < 1) throw new Error('Количество должно быть от 1.');
  if (body.quantity > stock) throw new Error('На складе только ' + stock + ' шт.');
  item.Quantity = body.quantity;
  save('cart', items);
  return { ok: true };
}

function cartRemove(body) {
  requireLogin();
  save('cart', load('cart', []).filter(function (i) { return i.CartItemID !== body.cartItemId; }));
  return { ok: true };
}

function placeOrder(body) {
  var user = requireLogin();
  var items = cartItems();
  var address = (body.address || '').trim();
  if (items.length === 0) throw new Error('Корзина пуста.');
  if (address.length < 10) throw new Error('Укажите полный адрес доставки: город, улица, дом.');

  var orders = load('orders', []);
  var number = 1000 + orders.length + 1;
  orders.unshift({
    '№': number,
    'Дата': new Date().toLocaleDateString('ru-RU'),
    'Товары': items.map(function (i) { return i.ProductName + (i.Quantity > 1 ? ' ×' + i.Quantity : ''); }).join(', '),
    'Сумма': totals(items, promoPercent(body.promo || '')).total,
    'Статус': 'Новый'
  });
  save('orders', orders);
  save('cart', []);
  user.address = address;   // запоминаем адрес для следующего заказа
  save('user', user);
  save('profile', user);
  return { ok: true, orderId: number };
}

// ---------- Личный кабинет ----------

function account() {
  var user = requireLogin();
  var orders = load('orders', []);
  return {
    client: { FirstName: user.firstName, LastName: user.lastName, Email: user.email, Phone: user.phone, Address: user.address },
    orders: orders,
    ordersCount: orders.length,
    spent: orders.reduce(function (sum, o) { return sum + o['Сумма']; }, 0),
    onTheWay: 0
  };
}

function saveProfile(body) {
  requireLogin();
  if (!body.firstName || !body.lastName) throw new Error('Введите имя и фамилию.');
  if ((body.email || '').indexOf('@') < 0) throw new Error('Введите корректный email.');
  var user = { firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone, address: body.address };
  save('user', user);
  save('profile', user);
  return { ok: true };
}

// заменяем api() из common.js на демо-версию
window.api = api;

})();

// AIRCOURT — страницы товара, корзины, входа и личного кабинета

// ---------- Товар ----------

function loadProduct(id) {
  var box = $('productBox');
  box.innerHTML = '<p class="loading">Загрузка…</p>';
  api('/api/product?id=' + id).then(function (p) {
    var sizes = p.Size ? p.Size.split(',') : [];
    var selectedSize = '';
    var quantity = 1;

    var sizesHtml = sizes.length > 0 ? '' : '<p class="muted" style="margin-bottom:22px">Размер единый</p>';
    sizes.forEach(function (s) { sizesHtml += '<div class="size">' + esc(s) + '</div>'; });
    // миниатюры ракурсов под большим фото (если у товара их несколько)
    var thumbs = '';
    if (p.Gallery.length > 1) {
      thumbs = '<div class="thumbs" id="thumbs">';
      p.Gallery.forEach(function (src, i) {
        thumbs += '<div class="' + (i === 0 ? 'active' : '') + '" style="background:' + productBack(p.CategoryID) + '" data-src="' + src + '">' +
          '<img src="' + src + '" alt=""></div>';
      });
      thumbs += '</div>';
    }
    var stock = p.Stock > 0
      ? '<div class="stock">● В наличии: ' + p.Stock + ' шт.</div>'
      : '<div class="stock off">Нет в наличии</div>';

    box.innerHTML =
      '<div class="crumbs"><a href="#home">Главная</a> / <a href="#catalog/' + p.CategoryID + '">' + esc(p.CategoryName) + '</a> / <b>' + esc(p.ProductName) + '</b></div>' +
      '<div class="product"><div><div class="gallery-main" style="background:' + productBack(p.CategoryID) + '">' +
      (p.IsNew == 1 ? '<span class="pill pill-accent">NEW</span>' : '') + '<img id="mainPhoto" src="' + p.Image + '" alt=""></div>' + thumbs + '</div>' +
      '<div><div class="muted" style="font-size:13px;font-weight:600">' + esc(p.BrandName) + ' · ' + esc(p.CategoryName) + '</div>' +
      '<h1 class="h2 p-title">' + esc(p.ProductName) + '</h1><div class="p-price-big">' + money(p.Price) + '</div>' + stock +
      '<div class="opt-label"><span>Размер</span></div><div class="sizes" id="sizes">' + (sizes.length ? sizesHtml : '') + '</div>' +
      (sizes.length ? '' : sizesHtml) +
      '<div class="opt-label"><span>Цвет: ' + esc(p.Color) + '</span></div>' +
      '<div class="buy-row"><div class="qty"><button id="qtyMinus">−</button><span id="qtyValue">1</span><button id="qtyPlus">+</button></div>' +
      '<button class="btn" id="addToCart"' + (p.Stock > 0 ? '' : ' disabled') + '>Добавить в корзину</button></div>' +
      '<div class="desc"><b>Описание</b><p style="margin-top:6px">' + esc(p.Description) + '</p><div class="specs">' +
      '<div><span class="muted">Бренд</span><b>' + esc(p.BrandName) + '</b></div>' +
      '<div><span class="muted">Цвет</span><b>' + esc(p.Color) + '</b></div>' +
      '<div><span class="muted">Артикул</span><b>AC-' + ('000' + p.ProductID).slice(-4) + '</b></div></div></div>' +
      expandCardsHtml(p) + '</div></div>' +
      '<div class="block"><div class="page-head" style="margin-top:0"><h2 class="h2">С этим <span class="dim">покупают</span></h2></div><div class="grid" id="moreGrid"></div></div>';

    document.querySelectorAll('#thumbs div').forEach(function (thumb) {
      thumb.onclick = function () {
        $('mainPhoto').src = thumb.dataset.src;
        document.querySelectorAll('#thumbs div').forEach(function (t) { t.classList.toggle('active', t === thumb); });
      };
    });
    document.querySelectorAll('#sizes .size').forEach(function (el) {
      el.onclick = function () {
        document.querySelectorAll('#sizes .size').forEach(function (s) { s.classList.remove('active'); });
        el.classList.add('active');
        selectedSize = el.textContent;
      };
    });
    $('qtyMinus').onclick = function () { quantity = Math.max(1, quantity - 1); $('qtyValue').textContent = quantity; };
    $('qtyPlus').onclick = function () {
      if (quantity < p.Stock) quantity++; else toast('На складе только ' + p.Stock + ' шт.');
      $('qtyValue').textContent = quantity;
    };
    $('addToCart').onclick = function () {
      if (!state.me.loggedIn) {
        toast('Чтобы добавить товар в корзину, войдите в аккаунт');
        location.hash = '#login';
        return;
      }
      api('/api/cart/add', { productId: p.ProductID, size: selectedSize, quantity: quantity })
        .then(function () { refreshMe(); toast('Товар добавлен в корзину'); })
        .catch(function (e) { toast(e.message, true); });
    };

    // раскрывающиеся карточки «Доставка / Обмен / Уход» (анимация — в expand.js)
    initExpandCards($('expandList'));
    // кнопки внутри карточек: stopPropagation — чтобы клик по кнопке не сворачивал карточку
    $('expandCart').onclick = function (e) { e.stopPropagation(); $('addToCart').click(); };
    $('expandSizes').onclick = function (e) {
      e.stopPropagation();
      ($('sizes').children.length ? $('sizes') : $('qtyValue')).scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    $('expandMore').onclick = function (e) { e.stopPropagation(); location.hash = '#catalog/' + p.CategoryID; };

    api('/api/products?exclude=' + p.ProductID + '&sort=random&limit=4').then(function (list) {
      renderCards('moreGrid', list, false);
    });
  }).catch(function (e) {
    box.innerHTML = '<p class="empty">' + esc(e.message) + '</p>';
  });
}

// Советы по уходу для каждой категории: 1 — кроссовки, 2 — джерси, 3 — мячи, 4 — экипировка
var careTips = {
  1: { short: 'Кроссовки', text: 'Протирайте влажной тканью, стельки вынимайте и сушите отдельно. Не сушите на батарее и не стирайте в машинке.', chips: ['Без машинки', 'Сушить без батареи'] },
  2: { short: 'Джерси', text: 'Стирайте наизнанку при 30°, без отбеливателя. Номер и нашивки не гладьте утюгом.', chips: ['30°, наизнанку', 'Без утюга'] },
  3: { short: 'Мяч', text: 'Храните накачанным до нормы, вдали от солнца. Зальный мяч не берите на асфальт — покрытие быстро сотрётся.', chips: ['Держать накачанным', 'Не на асфальт'] },
  4: { short: 'Экипировка', text: 'Стирайте в мешке для белья при 30° и сушите в расправленном виде. Сумки и рюкзаки чистите влажной тканью.', chips: ['30°, в мешке', 'Без сушилки'] }
};

// Три раскрывающиеся карточки под описанием товара
function expandCardsHtml(p) {
  var care = careTips[p.CategoryID] || careTips[4];
  return '<div class="expand-title">Доставка, обмен и уход</div><div class="expand-list" id="expandList">' +
    expandCard(1, 'Доставка', 'Курьером по городу', 'за 1 день',
      'Привезём на следующий день после заказа. Статус видно в личном кабинете — от сборки до двери.',
      ['Бесплатно от 10 000 ₽', 'Курьер'], 'В корзину', 'expandCart') +
    expandCard(2, 'Обмен и возврат', 'Если не подошёл размер', '14 дней',
      'Обменяем бесплатно в течение 14 дней. Сохраните бирки и упаковку — остальное сделаем сами.',
      ['Бесплатно', 'Бирки на месте'], 'К размерам', 'expandSizes') +
    expandCard(3, 'Уход', care.short + ': как сохранить вид', '3 совета', care.text, care.chips, 'Похожие', 'expandMore') +
    '</div>';
}

function expandCard(art, title, subtitle, price, text, chips, button, buttonId) {
  return '<div class="ex"><div class="thumb" data-art="' + art + '"></div>' +
    '<div class="head"><p class="t">' + title + '</p><p class="s">' + esc(subtitle) + '</p></div><span class="price">' + price + '</span>' +
    '<div class="more"><p>' + text + '</p><div class="row">' +
    chips.map(function (c) { return '<span class="chip">' + c + '</span>'; }).join('') +
    '<button class="go" id="' + buttonId + '">' + button + '</button></div></div></div>';
}

// ---------- Корзина ----------

var promoCode = '';

function loadCart() {
  api('/api/cart?promo=' + encodeURIComponent(promoCode)).then(renderCart).catch(function (e) {
    $('cartBox').innerHTML = '<p class="empty">' + esc(e.message) + '</p>';
  });
}

function renderCart(c) {
  var rows = '';
  c.items.forEach(function (item) {
    var meta = (item.Size ? 'Размер ' + esc(item.Size) + ' · ' : '') + esc(item.BrandName);
    rows += '<div class="cart-item">' +
      '<a class="cart-thumb" href="#product/' + item.ProductID + '" style="background:' + productBack(item.CategoryID) + '"><img src="' + item.Image + '" alt=""></a>' +
      '<div><div class="name">' + esc(item.ProductName) + '</div><div class="meta">' + meta + '</div>' +
      '<div class="qty"><button data-id="' + item.CartItemID + '" data-qty="' + (item.Quantity - 1) + '">−</button><span>' + item.Quantity +
      '</span><button data-id="' + item.CartItemID + '" data-qty="' + (item.Quantity + 1) + '">+</button></div></div>' +
      '<div class="cart-right"><div class="price">' + money(item.Price * item.Quantity) + '</div>' +
      '<span class="remove" data-remove="' + item.CartItemID + '">Удалить</span></div></div>';
  });

  $('cartBox').innerHTML =
    '<div class="page-head"><h1 class="h2">Корзина <span class="dim">' + c.count + ' шт.</span></h1>' +
    '<a class="btn btn-ghost btn-sm" href="#catalog/0">← Продолжить покупки</a></div>' +
    '<div class="cart"><div>' + (rows || '<p class="empty">В корзине пока ничего нет. Загляните в каталог — там много интересного.</p>') + '</div>' +
    '<aside class="dark summary"><h3 class="h3" style="margin-bottom:16px">Ваш заказ</h3>' +
    '<div class="sum-row"><span>Товары (' + c.count + ')</span><span>' + money(c.sum) + '</span></div>' +
    '<div class="sum-row"><span>Скидка</span><span>' + (c.discount > 0 ? '− ' + money(c.discount) : '0 ₽') + '</span></div>' +
    '<div class="sum-row"><span>Доставка</span><span class="free">' + (c.delivery > 0 ? money(c.delivery) : 'Бесплатно') + '</span></div>' +
    '<div class="sum-row sum-total"><span>Итого</span><span>' + money(c.total) + '</span></div>' +
    '<div class="promo-code"><input class="input" id="promoInput" placeholder="Промокод" value="' + esc(promoCode) + '"><button class="btn btn-light btn-sm" style="height:44px" id="promoButton">ОК</button></div>' +
    '<div class="field"><label>Адрес доставки</label><input class="input" id="addressInput" value="' + esc(c.address) + '"></div>' +
    '<button class="btn btn-accent btn-block" style="margin-top:6px" id="checkoutButton"' + (c.items.length ? '' : ' disabled') + '>Оформить заказ</button>' +
    '<p class="muted" style="font-size:12px;margin-top:12px">Бесплатная доставка от 10 000 ₽. Промокод для теста: AIRCOURT10</p></aside></div>';

  document.querySelectorAll('#cartBox .qty button').forEach(function (button) {
    button.onclick = function () { changeQuantity(+button.dataset.id, +button.dataset.qty); };
  });
  document.querySelectorAll('#cartBox [data-remove]').forEach(function (link) {
    link.onclick = function () { removeItem(+link.dataset.remove); };
  });
  $('promoButton').onclick = function () {
    promoCode = $('promoInput').value.trim();
    api('/api/cart?promo=' + encodeURIComponent(promoCode)).then(function (data) {
      toast(data.promoOk ? 'Промокод применён: скидка 10%' : 'Такого промокода нет', !data.promoOk);
      if (!data.promoOk) promoCode = '';
      renderCart(data);
    });
  };
  $('checkoutButton').onclick = function () {
    api('/api/order', { address: $('addressInput').value, promo: promoCode }).then(function (r) {
      promoCode = '';
      refreshMe();
      toast('Заказ №' + r.orderId + ' оформлен!');
      location.hash = '#account';
    }).catch(function (e) { toast(e.message, true); });
  };
}

function changeQuantity(cartItemId, quantity) {
  if (quantity < 1) {
    removeItem(cartItemId);
    return;
  }
  api('/api/cart/quantity', { cartItemId: cartItemId, quantity: quantity })
    .then(function () { refreshMe(); loadCart(); })
    .catch(function (e) { toast(e.message, true); });
}

function removeItem(cartItemId) {
  if (!confirm('Удалить товар из корзины?')) return;
  api('/api/cart/remove', { cartItemId: cartItemId }).then(function () { refreshMe(); loadCart(); });
}

// ---------- Вход и регистрация ----------

function showLogin() {
  loadHome();
  if (state.me.loggedIn) {
    location.hash = '#account';
  }
}

function showAuthTab(tab) {
  $('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  $('regForm').style.display = tab === 'reg' ? 'block' : 'none';
  document.querySelectorAll('#authTabs span').forEach(function (s) { s.classList.toggle('active', s.dataset.tab === tab); });
}

// Данные формы → объект { имя поля: значение }
function formData(form) {
  var data = {};
  form.querySelectorAll('input').forEach(function (input) { data[input.name] = input.value; });
  return data;
}

function initPages() {
  document.querySelectorAll('#authTabs span').forEach(function (s) {
    s.onclick = function () { showAuthTab(s.dataset.tab); };
  });
  $('loginForm').onsubmit = function (e) {
    e.preventDefault();
    api('/api/login', formData(this)).then(afterLogin).catch(function (err) { $('loginError').textContent = err.message; });
  };
  $('regForm').onsubmit = function (e) {
    e.preventDefault();
    api('/api/register', formData(this)).then(function () {
      toast('Аккаунт создан. Добро пожаловать в AIRCOURT!');
      afterLogin();
    }).catch(function (err) { $('regError').textContent = err.message; });
  };
}

function afterLogin() {
  $('loginError').textContent = '';
  $('regError').textContent = '';
  document.querySelectorAll('#login input').forEach(function (input) { input.value = ''; });
  refreshMe().then(function () { location.hash = '#home'; });
}

// ---------- Личный кабинет ----------

function loadAccount() {
  api('/api/account').then(function (a) {
    var c = a.client;
    var initials = (c.FirstName.charAt(0) + c.LastName.charAt(0)).toUpperCase();
    var orders = '';
    a.orders.forEach(function (o) {
      var status = o['Статус'] === 'Доставлен' ? 'done' : o['Статус'] === 'В пути' ? 'way' : 'new';
      orders += '<tr><td>#' + o['№'] + '</td><td>' + esc(o['Дата']) + '</td><td>' + esc(o['Товары']) + '</td><td>' + money(o['Сумма']) +
        '</td><td><span class="status ' + status + '">' + esc(o['Статус']) + '</span></td></tr>';
    });

    $('accountBox').innerHTML =
      '<div class="page-head"><h1 class="h2">Личный <span class="dim">кабинет</span></h1></div><div class="account">' +
      '<aside class="side"><div class="user-head"><div class="ava">' + esc(initials) + '</div><div><b>' + esc(c.FirstName + ' ' + c.LastName) +
      '</b><small>' + esc(c.Email) + '</small></div></div>' +
      '<a class="active" href="#account">Мои данные</a><a id="toOrders">История заказов</a><a href="#cart">Корзина</a><a class="exit" id="logout">Выйти</a></aside>' +
      '<div><div class="stats"><div class="stat dark-stat"><b>' + a.ordersCount + '</b><span>Заказов сделано</span></div>' +
      '<div class="stat"><b>' + money(a.spent) + '</b><span>Потрачено всего</span></div>' +
      '<div class="stat"><b>' + a.onTheWay + '</b><span>Заказов в пути</span></div></div>' +
      '<form class="panel" id="profileForm"><h3 class="h3">Мои данные</h3><div class="row-2">' +
      field('Имя', 'firstName', c.FirstName) + field('Фамилия', 'lastName', c.LastName) +
      field('Email', 'email', c.Email) + field('Телефон', 'phone', c.Phone) + '</div>' + field('Адрес доставки', 'address', c.Address) +
      '<div class="form-error" id="profileError"></div><button class="btn">Сохранить изменения</button></form>' +
      '<div class="panel" id="ordersPanel"><h3 class="h3">История заказов</h3><div class="table-wrap"><table class="table">' +
      '<tr><th>№ заказа</th><th>Дата</th><th>Товары</th><th>Сумма</th><th>Статус</th></tr>' +
      (orders || '<tr><td colspan="5" class="muted">Заказов пока нет</td></tr>') + '</table></div></div></div></div>';

    $('profileForm').onsubmit = function (e) {
      e.preventDefault();
      api('/api/account', formData(this)).then(function () {
        toast('Данные сохранены');
        refreshMe();
        loadAccount();
      }).catch(function (err) { $('profileError').textContent = err.message; });
    };
    $('toOrders').onclick = function () { $('ordersPanel').scrollIntoView({ behavior: 'smooth' }); };
    $('logout').onclick = function () {
      api('/api/logout', {}).then(function () { refreshMe().then(function () { location.hash = '#home'; }); });
    };
  });
}

function field(label, name, value) {
  return '<div class="field"><label>' + label + '</label><input class="input" name="' + name + '" value="' + esc(value) + '"></div>';
}

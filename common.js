// AIRCOURT — общие функции для сайта и админ-панели

// Запрос к серверу. body есть — отправляем POST, нет — GET
function api(path, body) {
  var options = {};
  if (body) {
    options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }
  return fetch(path, options).then(function (response) {
    return response.json().then(function (data) {
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка сервера');
      }
      return data;
    });
  });
}

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
}

// Защита от вставки HTML в текст (например, в названии товара)
function esc(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Цвет фона карточки по категории — как в программе
function productBack(categoryId) {
  var colors = { 1: '#F2F2F2', 2: '#EEEEEE', 3: '#F5F5F5' };
  return colors[categoryId] || '#F0F0F0';
}

// Всплывающее сообщение внизу экрана
var toastTimer;
function toast(text, isError) {
  var box = $('toast');
  box.textContent = text;
  box.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { box.className = 'toast'; }, 2800);
}

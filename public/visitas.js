(function () {
  'use strict';

  var elementos = document.querySelectorAll('[data-contador-visitas]');
  if (!elementos.length) return;

  function mostrar(total) {
    var texto = Number(total).toLocaleString('pt-BR');
    elementos.forEach(function (el) {
      el.textContent = texto;
    });
  }

  var JA_VISITOU = 'magoVisitou';
  var jaContou = false;
  try {
    jaContou = sessionStorage.getItem(JA_VISITOU) === '1';
  } catch (e) {
    jaContou = false;
  }

  var metodo = jaContou ? 'GET' : 'POST';

  fetch('/api/visitas', { method: metodo })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res || !res.ok) return;
      mostrar(res.total);
      if (!jaContou) {
        try {
          sessionStorage.setItem(JA_VISITOU, '1');
        } catch (e) {
          /* sem localStorage/sessionStorage disponível — sem problema */
        }
      }
    })
    .catch(function () {
      /* falha silenciosa — o site funciona normalmente sem o contador */
    });
})();

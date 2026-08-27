(function () {
  'use strict';

  var form = document.getElementById('form-busca');
  var campoCodigo = document.getElementById('codigo');
  var cardResultado = document.getElementById('card-resultado');

  var ROTULOS = {
    pendente: { texto: 'Pendente — aguardando confirmação do Mago', classe: 'pendente' },
    confirmado: { texto: 'Confirmado', classe: 'confirmado' },
    recusado: { texto: 'Não foi possível atender esse pedido', classe: 'recusado' },
  };

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function mostrar(html) {
    cardResultado.innerHTML = html;
    cardResultado.style.display = 'block';
  }

  function consultar(codigo) {
    mostrar('<p class="vazio">Consultando...</p>');
    fetch('/api/solicitacoes/' + encodeURIComponent(codigo))
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, corpo: j }; }); })
      .then(function (res) {
        if (res.status === 404 || !res.corpo.ok) {
          mostrar('<div class="msg erro">Código não encontrado. Confira se digitou certo.</div>');
          return;
        }
        var s = res.corpo.solicitacao;
        var rotulo = ROTULOS[s.status] || { texto: s.status, classe: '' };
        mostrar(
          '<span class="badge ' + rotulo.classe + '">' + escapeHtml(rotulo.texto) + '</span>' +
          '<div style="margin-top:16px;">' +
            '<div class="linha-info"><span>Serviço</span><span>' + escapeHtml(s.servico) + '</span></div>' +
            '<div class="linha-info"><span>Dia</span><span>' + escapeHtml(s.dataBr) + '</span></div>' +
            '<div class="linha-info"><span>Horário</span><span>' + escapeHtml(s.horario) + '</span></div>' +
            '<div class="linha-info"><span>Código</span><span>' + escapeHtml(s.codigo) + '</span></div>' +
          '</div>'
        );
      })
      .catch(function () {
        mostrar('<div class="msg erro">Falha de conexão. Tente novamente.</div>');
      });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var codigo = campoCodigo.value.trim();
    if (!codigo) return;
    consultar(codigo);
  });

  var params = new URLSearchParams(window.location.search);
  var codigoUrl = params.get('codigo');
  if (codigoUrl) {
    campoCodigo.value = codigoUrl.toUpperCase();
    consultar(codigoUrl);
  }
})();

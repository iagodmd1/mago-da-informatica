(function () {
  'use strict';

  var campoData = document.getElementById('data');
  var campoHorario = document.getElementById('horario');
  var hintHorario = document.getElementById('hint-horario');
  var form = document.getElementById('form-agendar');
  var btnEnviar = document.getElementById('btn-enviar');
  var msgErro = document.getElementById('msg-erro');

  // Impede escolher uma data no passado.
  campoData.min = new Date().toISOString().slice(0, 10);

  // Pré-seleciona o serviço quando chega de um link "Agendar" de um card específico.
  (function preSelecionarServico() {
    var params = new URLSearchParams(window.location.search);
    var servico = params.get('servico');
    if (!servico) return;
    var select = document.getElementById('servico');
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === servico) {
        select.selectedIndex = i;
        break;
      }
    }
  })();

  function mostrarErro(texto) {
    msgErro.textContent = texto;
    msgErro.style.display = 'block';
    msgErro.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function esconderErro() {
    msgErro.style.display = 'none';
  }

  function carregarHorarios() {
    var data = campoData.value;
    campoHorario.innerHTML = '';
    campoHorario.disabled = true;
    hintHorario.textContent = '';

    if (!data) {
      var optVazio = new Option('Escolha o dia primeiro', '');
      campoHorario.add(optVazio);
      return;
    }

    var optCarregando = new Option('Carregando horários...', '');
    campoHorario.add(optCarregando);

    fetch('/api/horarios?data=' + encodeURIComponent(data))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        campoHorario.innerHTML = '';
        if (!res.ok) {
          campoHorario.add(new Option('Data inválida', ''));
          hintHorario.textContent = res.erro || 'Escolha outra data.';
          return;
        }
        hintHorario.textContent = res.fimDeSemana
          ? 'Fim de semana: atendimento das 08h ao meio-dia.'
          : 'Dia útil: atendimento das 08h às 18h.';

        var algumLivre = false;
        res.horarios.forEach(function (h) {
          if (h.disponivel) {
            campoHorario.add(new Option(h.hora, h.hora));
            algumLivre = true;
          }
        });

        if (!algumLivre) {
          campoHorario.add(new Option('Sem horários livres nesse dia', ''));
          campoHorario.disabled = true;
        } else {
          campoHorario.disabled = false;
        }
      })
      .catch(function () {
        campoHorario.innerHTML = '';
        campoHorario.add(new Option('Erro ao carregar horários', ''));
      });
  }

  campoData.addEventListener('change', carregarHorarios);

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    esconderErro();

    var dados = {
      nome: document.getElementById('nome').value.trim(),
      whatsapp: document.getElementById('whatsapp').value.trim(),
      servico: document.getElementById('servico').value,
      data: campoData.value,
      horario: campoHorario.value,
      observacoes: document.getElementById('observacoes').value.trim(),
      site_web: document.getElementById('site_web').value, // honeypot
    };

    if (!dados.nome || !dados.whatsapp || !dados.servico || !dados.data || !dados.horario) {
      mostrarErro('Preencha nome, WhatsApp, serviço, dia e horário.');
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    fetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, corpo: j }; }); })
      .then(function (res) {
        if (res.status !== 201 || !res.corpo.ok) {
          mostrarErro(res.corpo.erro || 'Não foi possível enviar. Tente novamente.');
          btnEnviar.disabled = false;
          btnEnviar.textContent = 'Enviar solicitação';
          if (res.corpo.horarioOcupado) carregarHorarios();
          return;
        }
        window.location.href = '/status?codigo=' + encodeURIComponent(res.corpo.codigo);
      })
      .catch(function () {
        mostrarErro('Falha de conexão. Tente novamente.');
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar solicitação';
      });
  });
})();

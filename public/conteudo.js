// Renderiza dinamicamente a loja de sistemas e a lista de serviços a partir
// de /api/conteudo, para que as edições feitas no painel /admin apareçam no
// site sem precisar de um novo deploy.

(function () {
  function escapeHtml(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function capa(item, classeImg, classeIcone) {
    if (item.imagem) {
      return `<img class="${classeImg}" src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.titulo)}" loading="lazy">`;
    }
    return `<div class="${classeIcone}">${item.icone ? escapeHtml(item.icone) : '🧙'}</div>`;
  }

  function renderServico(item) {
    const badge = item.badge ? `<span class="svc-badge">${escapeHtml(item.badge)}</span>` : '';
    return `
    <div class="svc-card">
      ${badge}
      <div class="svc-top">${capa(item, 'svc-cover', 'svc-icon')}<h3>${escapeHtml(item.titulo)}</h3></div>
      <p class="desc">${escapeHtml(item.descricao)}</p>
      <div class="svc-price-row"><span class="svc-price">${escapeHtml(item.preco)}</span></div>
      <a class="svc-agendar" href="${item.whatsapp}" target="_blank" rel="noopener">📅 Agendar</a>
    </div>`;
  }

  function renderLoja(item) {
    if (item.custom) {
      return `
    <div class="shop-card shop-custom">
      <div class="svc-top">${capa(item, 'shop-cover', 'svc-icon')}<h3>${escapeHtml(item.titulo)}</h3></div>
      <span class="shop-tag">${escapeHtml(item.tag)}</span>
      <p class="desc">${escapeHtml(item.descricaoCurta)}</p>
      <a class="shop-buy" href="${item.whatsapp}" target="_blank" rel="noopener">🛒 Pedir sistema sob medida</a>
    </div>`;
    }
    const descCompleta = item.descricaoCompleta
      ? `<details class="shop-details">
        <summary>Ver descrição completa</summary>
        <p>${escapeHtml(item.descricaoCompleta)}</p>
      </details>`
      : '';
    return `
    <div class="shop-card">
      <div class="svc-top">${capa(item, 'shop-cover', 'svc-icon')}<h3>${escapeHtml(item.titulo)}</h3></div>
      <span class="shop-tag">${escapeHtml(item.tag)}</span>
      <p class="desc">${escapeHtml(item.descricaoCurta)}</p>
      ${descCompleta}
      <a class="shop-buy" href="${item.whatsapp}" target="_blank" rel="noopener">🛒 Comprar / solicitar orçamento</a>
    </div>`;
  }

  function mostrarErro(container) {
    if (!container) return;
    container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-mute);">Não foi possível carregar o conteúdo agora. Tente novamente em instantes.</p>';
  }

  async function iniciar() {
    const lojaGrid = document.getElementById('loja-grid');
    const servicosGrid = document.getElementById('servicos-grid');
    const contador = document.querySelector('[data-contador-sistemas]');

    try {
      const resp = await fetch('/api/conteudo');
      if (!resp.ok) throw new Error('Falha ao carregar /api/conteudo');
      const dados = await resp.json();

      if (servicosGrid) {
        servicosGrid.innerHTML = (dados.servicos || []).map(renderServico).join('');
      }
      if (lojaGrid) {
        lojaGrid.innerHTML = (dados.loja || []).map(renderLoja).join('');
      }
      if (contador) {
        contador.textContent = (dados.loja || []).length;
      }
    } catch (e) {
      console.error(e);
      mostrarErro(lojaGrid);
      mostrarErro(servicosGrid);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();

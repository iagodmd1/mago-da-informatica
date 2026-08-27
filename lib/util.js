const crypto = require('crypto');

const SERVICOS = [
  'Formatação de PC e notebook',
  'Instalação e ativação do Office',
  'Troca e upgrade de componentes',
  'Ativação do Windows',
  'Limpeza de PC ou notebook',
  'Orçamento sob medida / sistema personalizado',
  'Outro',
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// Mantém só dígitos e adiciona o 55 (Brasil) se parecer um número local sem DDI.
function normalizarWhatsapp(numero) {
  let digitos = String(numero || '').replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return digitos;
}

function linkWhatsapp(numeroComDDI, texto) {
  return `https://wa.me/${numeroComDDI}?text=${encodeURIComponent(texto)}`;
}

// Comparação em tempo constante, tolerante a tamanhos diferentes (evita
// vazar por timing o comprimento da senha configurada).
function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Ainda assim compara contra algo do mesmo tamanho pra não retornar cedo.
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function formatarDataBr(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

module.exports = {
  SERVICOS,
  escapeHtml,
  normalizarWhatsapp,
  linkWhatsapp,
  compararSeguro,
  formatarDataBr,
};

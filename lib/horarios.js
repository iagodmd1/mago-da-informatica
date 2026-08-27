// Regras de horário de atendimento do Mago da Informática.
//   Segunda a sexta: 08:00–18:00
//   Sábado e domingo: 08:00–12:00
// Todas as contas de "agora" usam o fuso horário de Bahia (America/Bahia).

const FUSO = 'America/Bahia';

function agoraNoFuso() {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(agora);
  const obj = {};
  for (const p of partes) obj[p.type] = p.value;
  return {
    data: `${obj.year}-${obj.month}-${obj.day}`,
    hora: `${obj.hour}:${obj.minute}`,
  };
}

function diaDaSemana(dataStr) {
  // dataStr: 'YYYY-MM-DD'. Meio-dia UTC evita virar o dia por causa do fuso.
  const d = new Date(`${dataStr}T12:00:00Z`);
  return d.getUTCDay(); // 0=domingo ... 6=sábado
}

function dataValida(dataStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dataStr) && !Number.isNaN(new Date(`${dataStr}T00:00:00Z`).getTime());
}

function faixaDoDia(dataStr) {
  const dow = diaDaSemana(dataStr);
  const fimDeSemana = dow === 0 || dow === 6;
  return { inicio: 8, fim: fimDeSemana ? 12 : 18, fimDeSemana };
}

function horariosDoDia(dataStr) {
  const { inicio, fim } = faixaDoDia(dataStr);
  const horarios = [];
  for (let h = inicio; h < fim; h++) {
    horarios.push(`${String(h).padStart(2, '0')}:00`);
  }
  return horarios;
}

function horarioValidoParaData(dataStr, horaStr) {
  return horariosDoDia(dataStr).includes(horaStr);
}

// Impede marcar em data/horário já passado (comparando com "agora" em Bahia).
function estaNoPassado(dataStr, horaStr) {
  const agora = agoraNoFuso();
  if (dataStr < agora.data) return true;
  if (dataStr > agora.data) return false;
  return horaStr <= agora.hora;
}

module.exports = {
  FUSO,
  agoraNoFuso,
  diaDaSemana,
  dataValida,
  faixaDoDia,
  horariosDoDia,
  horarioValidoParaData,
  estaNoPassado,
};

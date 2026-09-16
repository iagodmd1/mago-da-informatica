// Contador de visitas simples, gravado em arquivo JSON com fila de escrita
// (mesmo padrão usado nos outros armazenamentos do projeto) para evitar
// corromper o arquivo em gravações concorrentes.
//
// IMPORTANTE (deploy no Railway): o sistema de arquivos do container é
// efêmero — sem um Volume anexado, o contador zera a cada redeploy ou
// reinício. Anexe um Volume no serviço e aponte DATA_DIR para o caminho
// montado (ex.: /data) para persistir de verdade.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ARQUIVO = path.join(DATA_DIR, 'visitas.json');

// Valor inicial do contador na primeira vez que o arquivo é criado (ajustável
// pela variável de ambiente VISITAS_INICIAL). Depois disso, o painel /admin
// também permite ajustar o total manualmente a qualquer momento.
const VISITAS_INICIAL = Number.isFinite(Number(process.env.VISITAS_INICIAL))
  ? Number(process.env.VISITAS_INICIAL)
  : 180;

let filaDeEscrita = Promise.resolve();

function garantirArquivo() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ARQUIVO)) fs.writeFileSync(ARQUIVO, JSON.stringify({ total: VISITAS_INICIAL }), 'utf8');
}

function lerTotal() {
  garantirArquivo();
  try {
    const bruto = fs.readFileSync(ARQUIVO, 'utf8');
    const obj = JSON.parse(bruto);
    return Number.isFinite(obj.total) ? obj.total : 0;
  } catch (e) {
    console.error('Falha ao ler visitas.json, tratando como zero:', e.message);
    return 0;
  }
}

function salvarTotalAtomico(total) {
  const tmp = `${ARQUIVO}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ total }), 'utf8');
  fs.renameSync(tmp, ARQUIVO);
}

// Serializa todas as operações de leitura+escrita numa fila, para que duas
// requisições simultâneas nunca pisem uma na outra.
function comFila(fn) {
  const resultado = filaDeEscrita.then(() => fn());
  filaDeEscrita = resultado.catch(() => {});
  return resultado;
}

async function registrarVisita() {
  return comFila(() => {
    const total = lerTotal() + 1;
    salvarTotalAtomico(total);
    return total;
  });
}

async function obterTotal() {
  return comFila(() => lerTotal());
}

async function definirTotal(novoTotal) {
  return comFila(() => {
    const total = Math.max(0, Math.trunc(Number(novoTotal) || 0));
    salvarTotalAtomico(total);
    return total;
  });
}

module.exports = { registrarVisita, obterTotal, definirTotal };

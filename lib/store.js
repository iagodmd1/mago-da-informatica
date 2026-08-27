// Armazenamento simples em arquivo JSON, com fila de escrita para evitar
// corromper o arquivo em gravações concorrentes. Suficiente para o volume
// de um pequeno negócio local; não é um banco de dados de verdade.
//
// IMPORTANTE (deploy no Railway): o sistema de arquivos do container é
// efêmero — sem um Volume anexado, os dados são perdidos a cada redeploy
// ou reinício. Anexe um Volume no serviço e aponte DATA_DIR para o
// caminho montado (ex.: /data) para persistir de verdade.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ARQUIVO = path.join(DATA_DIR, 'solicitacoes.json');

let filaDeEscrita = Promise.resolve();

function garantirArquivo() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ARQUIVO)) fs.writeFileSync(ARQUIVO, '[]', 'utf8');
}

function lerTudo() {
  garantirArquivo();
  try {
    const bruto = fs.readFileSync(ARQUIVO, 'utf8');
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    console.error('Falha ao ler solicitacoes.json, tratando como vazio:', e.message);
    return [];
  }
}

function salvarTudoAtomico(lista) {
  const tmp = `${ARQUIVO}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(lista, null, 2), 'utf8');
  fs.renameSync(tmp, ARQUIVO);
}

// Serializa todas as operações de leitura+escrita numa fila, para que duas
// requisições simultâneas nunca pisem uma na outra.
function comFila(fn) {
  const resultado = filaDeEscrita.then(() => fn());
  filaDeEscrita = resultado.catch(() => {});
  return resultado;
}

function gerarCodigo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para evitar confusão
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    codigo += alfabeto[crypto.randomInt(alfabeto.length)];
  }
  return codigo;
}

async function listar() {
  return comFila(() => lerTudo());
}

async function buscarPorId(id) {
  return comFila(() => lerTudo().find((s) => s.id === id) || null);
}

async function buscarPorCodigo(codigo) {
  const alvo = String(codigo || '').trim().toUpperCase();
  return comFila(() => lerTudo().find((s) => s.codigo === alvo) || null);
}

// Retorna os horários (data+hora) já ocupados por solicitações pendentes ou
// confirmadas, para não deixar dois clientes marcarem o mesmo horário.
async function horariosOcupados(dataStr) {
  return comFila(() =>
    lerTudo()
      .filter((s) => s.data === dataStr && (s.status === 'pendente' || s.status === 'confirmado'))
      .map((s) => s.horario)
  );
}

async function criar({ nome, whatsapp, servico, data, horario, observacoes }) {
  return comFila(() => {
    const lista = lerTudo();
    const conflito = lista.some(
      (s) => s.data === data && s.horario === horario && (s.status === 'pendente' || s.status === 'confirmado')
    );
    if (conflito) {
      const erro = new Error('Esse horário acabou de ser reservado por outra pessoa.');
      erro.codigo = 'HORARIO_OCUPADO';
      throw erro;
    }
    let codigo;
    do {
      codigo = gerarCodigo();
    } while (lista.some((s) => s.codigo === codigo));

    const agora = new Date().toISOString();
    const solicitacao = {
      id: crypto.randomUUID(),
      codigo,
      nome,
      whatsapp,
      servico,
      data,
      horario,
      observacoes: observacoes || '',
      status: 'pendente',
      criadoEm: agora,
      atualizadoEm: agora,
    };
    lista.push(solicitacao);
    salvarTudoAtomico(lista);
    return solicitacao;
  });
}

async function atualizarStatus(id, novoStatus) {
  return comFila(() => {
    const lista = lerTudo();
    const idx = lista.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    lista[idx].status = novoStatus;
    lista[idx].atualizadoEm = new Date().toISOString();
    salvarTudoAtomico(lista);
    return lista[idx];
  });
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorCodigo,
  horariosOcupados,
  criar,
  atualizarStatus,
};

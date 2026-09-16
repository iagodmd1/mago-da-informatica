// Conteúdo editável do site (serviços e loja de sistemas), gravado em
// data/conteudo.json. Mesmo padrão de fila de escrita usado em
// lib/visitas.js, para não corromper o arquivo em gravações concorrentes.
//
// IMPORTANTE (deploy no Railway): sem um Volume anexado e DATA_DIR
// apontando para ele, tudo isso (textos, preços e imagens enviadas pelo
// painel) volta ao conteúdo padrão a cada redeploy/reinício.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ARQUIVO = path.join(DATA_DIR, 'conteudo.json');
const PASTA_UPLOADS = path.join(DATA_DIR, 'uploads');

const NUMERO_WHATSAPP = '5577981020268';

function linkWhatsapp(texto) {
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

// ---------- Conteúdo padrão (usado só na primeira vez, se o arquivo não existir) ----------

const PADRAO = {
  servicos: [
    {
      id: 'formatacao-com-backup',
      ordem: 1,
      titulo: 'Formatação com backup',
      badge: 'Inclui Office',
      descricao: 'Formatação completa com backup de todos os seus arquivos antes de reinstalar o sistema. Já vem com o Microsoft Office instalado.',
      preco: 'R$ 150,00',
      icone: '🖥️',
      imagem: null,
    },
    {
      id: 'formatacao-sem-backup',
      ordem: 2,
      titulo: 'Formatação sem backup',
      badge: 'Inclui Office',
      descricao: 'Formatação completa e instalação limpa do sistema, sem backup prévio dos arquivos — indicada para quem já salvou o que precisa. Já vem com o Microsoft Office instalado.',
      preco: 'R$ 100,00',
      icone: '🖥️',
      imagem: null,
    },
    {
      id: 'office-avulso',
      ordem: 3,
      titulo: 'Instalação e ativação do Office',
      badge: '',
      descricao: 'Instalação e ativação do Microsoft Office avulsa, sem formatação — ideal para quem só precisa do Office.',
      preco: 'R$ 50,00',
      icone: '📄',
      imagem: null,
    },
    {
      id: 'upgrade-componentes',
      ordem: 4,
      titulo: 'Troca e upgrade de componentes',
      badge: '',
      descricao: 'Instalação de componentes diversos: memória, SSD, placas e muito mais, com teste de funcionamento antes da entrega.',
      preco: 'R$ 50,00',
      icone: '🔧',
      imagem: null,
    },
    {
      id: 'ativacao-windows',
      ordem: 5,
      titulo: 'Ativação do Windows',
      badge: '',
      descricao: 'Ativação segura e definitiva do seu sistema operacional Windows.',
      preco: 'R$ 50,00',
      icone: '🪟',
      imagem: null,
    },
    {
      id: 'limpeza',
      ordem: 6,
      titulo: 'Limpeza de PC ou notebook',
      badge: '',
      descricao: 'Limpeza física e interna completa, prevenindo superaquecimento e travamentos.',
      preco: 'R$ 100,00',
      icone: '🧹',
      imagem: null,
    },
    {
      id: 'orcamento-sob-medida',
      ordem: 7,
      titulo: 'Orçamento sob medida',
      badge: '',
      descricao: 'Não encontrou o que precisa? Fale com o Mago e receba uma solução personalizada.',
      preco: 'Consulte',
      icone: '✨',
      imagem: null,
    },
  ],
  loja: [
    {
      id: 'estoque',
      ordem: 1,
      titulo: 'Sistema de Estoque',
      tag: 'Gestão interna',
      descricaoCurta: 'Controle de inventário com relatórios, auditoria e exportação para Excel.',
      descricaoCompleta: 'Cadastro e controle de estoque com histórico de movimentações, exportação para Excel, relatórios e console de auditoria, e controle de acesso por usuário — um admin gerencia as senhas de todos, os demais só a própria. Login protegido com criptografia.',
      icone: '📦',
      imagem: null,
      custom: false,
    },
    {
      id: 'padaria',
      ordem: 2,
      titulo: 'Sistema para Padaria',
      tag: 'Comércio local',
      descricaoCurta: 'PDV, estoque, produção e pedidos de clientes, tudo integrado.',
      descricaoCompleta: 'Sistema completo para padaria: PDV para vendas no caixa, controle de estoque de insumos, produção (receitas) e pedidos/encomendas de clientes, tudo integrado num só sistema, com login simples e acesso remoto pela internet.',
      icone: '🥖',
      imagem: null,
      custom: false,
    },
    {
      id: 'painel-atendimento',
      ordem: 3,
      titulo: 'Painel de Atendimento e Senhas',
      tag: 'Atendimento ao público',
      descricaoCurta: 'Totem de emissão de senhas e painel multi-guichê para organizar filas.',
      descricaoCompleta: 'Totem de emissão de senhas, painel de chamada multi-guichê e relatórios de tempo médio de atendimento, com autenticação por perfil — ideal para clínicas, comércios e qualquer negócio com atendimento ao público.',
      icone: '🎫',
      imagem: null,
      custom: false,
    },
    {
      id: 'cofre-senhas',
      ordem: 4,
      titulo: 'Cofre de Senhas',
      tag: 'Segurança pessoal',
      descricaoCurta: 'Gerenciador de senhas local, criptografado, com gerador de senhas fortes.',
      descricaoCompleta: 'Guarda as senhas de todas as suas contas num banco local (sem depender da internet), protegido por senha mestra e criptografia AES-256-GCM/scrypt, com gerador de senhas aleatórias fortes embutido.',
      icone: '🔐',
      imagem: null,
      custom: false,
    },
    {
      id: 'instalador-remoto',
      ordem: 5,
      titulo: 'Instalador Remoto',
      tag: 'Suporte de TI',
      descricaoCurta: 'Instala programas em várias máquinas da rede ao mesmo tempo.',
      descricaoCompleta: 'Interface web para instalar programas em várias máquinas da rede simultaneamente, com catálogo de programas editável, progresso em tempo real por máquina e diagnóstico automático de erros de acesso — economiza horas de instalação manual máquina por máquina.',
      icone: '📥',
      imagem: null,
      custom: false,
    },
    {
      id: 'desinstalador-remoto',
      ordem: 6,
      titulo: 'Desinstalador Remoto',
      tag: 'Suporte de TI',
      descricaoCurta: 'Remove programas de várias máquinas da rede, à distância e com segurança.',
      descricaoCompleta: 'Ferramenta web para desinstalar programas remotamente em lote, via PowerShell Remoting/WinRM — sem depender de ferramentas que costumam disparar alarme falso em antivírus corporativos.',
      icone: '🗑️',
      imagem: null,
      custom: false,
    },
    {
      id: 'rmm-bancada',
      ordem: 7,
      titulo: 'RMM Bancada',
      tag: 'Suporte de TI',
      descricaoCurta: 'Monitoramento e gestão remota de toda a rede, sem instalar agente.',
      descricaoCompleta: 'Painel para monitorar e gerenciar máquinas da rede remotamente (100% sem agente, via WinRM): status em tempo real, execução de comandos, instalação/remoção de programas em lote e localização de máquina por IP.',
      icone: '🖥️',
      imagem: null,
      custom: false,
    },
    {
      id: 'scanner-ameacas',
      ordem: 8,
      titulo: 'Scanner de Ameaças',
      tag: 'Segurança',
      descricaoCurta: 'Detecta trojans, keyloggers e itens suspeitos de inicialização.',
      descricaoCompleta: 'Ferramenta de triagem de segurança que escaneia o computador em busca de trojans, keyloggers e programas suspeitos configurados para iniciar com o Windows, com relatório detalhado do que foi encontrado e integração opcional com o VirusTotal.',
      icone: '🛡️',
      imagem: null,
      custom: false,
    },
    {
      id: 'notificador-whatsapp',
      ordem: 9,
      titulo: 'Notificador WhatsApp',
      tag: 'Automação',
      descricaoCurta: 'Avisa você automaticamente no WhatsApp quando alguém entra em contato pelo seu site.',
      descricaoCompleta: 'Bot próprio (sem depender de serviços de terceiros que ficam instáveis) que manda um aviso direto no seu WhatsApp sempre que algo importante acontece no seu site — como um novo contato ou pedido —, com painel web de configuração.',
      icone: '📲',
      imagem: null,
      custom: false,
    },
    {
      id: 'agente-ti',
      ordem: 10,
      titulo: 'Agente de TI com IA',
      tag: 'Produtividade',
      descricaoCurta: 'Painel pessoal que organiza sua agenda e prioridades, com assistente de IA.',
      descricaoCompleta: 'Painel pessoal para organizar agenda, prioridades e chamados do dia a dia de TI, com assistente de chat via inteligência artificial integrado para tirar dúvidas e ajudar a priorizar — feito sob medida para o ritmo do suporte técnico.',
      icone: '🧙',
      imagem: null,
      custom: false,
    },
    {
      id: 'sob-medida',
      ordem: 11,
      titulo: 'Sistema sob medida',
      tag: 'Sob encomenda',
      descricaoCurta: 'Não achou o sistema ideal na loja? Eu desenvolvo do zero, do jeito que o seu negócio precisa.',
      descricaoCompleta: '',
      icone: '✨',
      imagem: null,
      custom: true,
    },
  ],
};

let filaDeEscrita = Promise.resolve();

function comFila(fn) {
  const resultado = filaDeEscrita.then(() => fn());
  filaDeEscrita = resultado.catch(() => {});
  return resultado;
}

function garantirArquivo() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PASTA_UPLOADS)) fs.mkdirSync(PASTA_UPLOADS, { recursive: true });
  if (!fs.existsSync(ARQUIVO)) {
    fs.writeFileSync(ARQUIVO, JSON.stringify(PADRAO, null, 2), 'utf8');
  }
}

function ler() {
  garantirArquivo();
  try {
    const bruto = fs.readFileSync(ARQUIVO, 'utf8');
    const obj = JSON.parse(bruto);
    if (!Array.isArray(obj.servicos)) obj.servicos = [];
    if (!Array.isArray(obj.loja)) obj.loja = [];
    return obj;
  } catch (e) {
    console.error('Falha ao ler conteudo.json, usando padrão:', e.message);
    return JSON.parse(JSON.stringify(PADRAO));
  }
}

function salvarAtomico(obj) {
  const tmp = `${ARQUIVO}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, ARQUIVO);
}

function slugificar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || crypto.randomBytes(4).toString('hex');
}

function idUnico(lista, base) {
  let id = slugificar(base);
  let candidato = id;
  let n = 2;
  while (lista.some((i) => i.id === candidato)) {
    candidato = `${id}-${n}`;
    n += 1;
  }
  return candidato;
}

function proximaOrdem(lista) {
  return lista.reduce((max, i) => Math.max(max, i.ordem || 0), 0) + 1;
}

// ---------- API pública (uso interno) ----------

async function obterConteudoPublico() {
  return comFila(() => {
    const dados = ler();
    const ordenar = (a, b) => (a.ordem || 0) - (b.ordem || 0);
    const comLink = (item, texto) => ({ ...item, whatsapp: linkWhatsapp(texto) });
    const servicos = [...dados.servicos].sort(ordenar).map((s) =>
      comLink(s, `Olá! Gostaria de agendar: ${s.titulo}${s.preco ? ` (${s.preco})` : ''}. Poderia me passar os horários disponíveis?`)
    );
    const loja = [...dados.loja].sort(ordenar).map((s) =>
      comLink(
        s,
        s.custom
          ? 'Olá! Não encontrei na loja o sistema que preciso. Gostaria de um sistema sob medida — poderia me ajudar?'
          : `Olá! Vi a loja do site e tenho interesse no sistema: ${s.titulo}. Poderia me passar mais detalhes e um orçamento?`
      )
    );
    return { servicos, loja };
  });
}

async function listarAdmin() {
  return comFila(() => {
    const dados = ler();
    const ordenar = (a, b) => (a.ordem || 0) - (b.ordem || 0);
    return {
      servicos: [...dados.servicos].sort(ordenar),
      loja: [...dados.loja].sort(ordenar),
    };
  });
}

async function criar(tipo, campos) {
  return comFila(() => {
    const dados = ler();
    const lista = dados[tipo];
    const item = {
      id: idUnico(lista, campos.titulo || tipo),
      ordem: proximaOrdem(lista),
      imagem: null,
      ...campos,
    };
    lista.push(item);
    salvarAtomico(dados);
    return item;
  });
}

async function atualizar(tipo, id, campos) {
  return comFila(() => {
    const dados = ler();
    const lista = dados[tipo];
    const idx = lista.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    lista[idx] = { ...lista[idx], ...campos };
    salvarAtomico(dados);
    return lista[idx];
  });
}

async function definirImagem(tipo, id, caminhoRelativo) {
  return atualizar(tipo, id, { imagem: caminhoRelativo });
}

async function remover(tipo, id) {
  return comFila(() => {
    const dados = ler();
    const antes = dados[tipo].length;
    dados[tipo] = dados[tipo].filter((i) => i.id !== id);
    salvarAtomico(dados);
    return dados[tipo].length < antes;
  });
}

module.exports = {
  DATA_DIR,
  PASTA_UPLOADS,
  obterConteudoPublico,
  listarAdmin,
  criar,
  atualizar,
  definirImagem,
  remover,
};

// Mago da Informática — site + sistema de agendamento com aprovação manual.
//
// Fluxo: o cliente pede um horário em /agendar -> fica "pendente" -> o Mago
// aprova ou recusa no painel /admin -> se aprovar, o painel gera um link do
// WhatsApp já preenchido com a mensagem de confirmação, pronto para enviar
// com um clique (não usa a API paga do WhatsApp Business, então o envio
// final é sempre um clique do Mago, não é 100% automático).

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const store = require('./lib/store');
const horarios = require('./lib/horarios');
const { SERVICOS, escapeHtml, normalizarWhatsapp, linkWhatsapp, compararSeguro, formatarDataBr } = require('./lib/util');

const PORT = process.env.PORT || 8080;
const PROD = process.env.NODE_ENV === 'production';
const ADMIN_USUARIO = process.env.ADMIN_USUARIO || 'mago';
const ADMIN_SENHA = process.env.ADMIN_SENHA || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const NUMERO_MAGO = normalizarWhatsapp(process.env.WHATSAPP_NUMERO || '5577981020268');
const NOTIFICADOR_URL = process.env.NOTIFICADOR_URL || '';
const NOTIFICADOR_TOKEN = process.env.NOTIFICADOR_TOKEN || '';

if (!NOTIFICADOR_URL || !NOTIFICADOR_TOKEN) {
    console.warn(
          '\n[AVISO] NOTIFICADOR_URL / NOTIFICADOR_TOKEN não definidos — notificações do WhatsApp para novos agendamentos ' +
          'ficarão desativadas. Defina essas variáveis nas configurações do serviço no Railway.\n'
        );
}

// Avisa o Notificador WhatsApp sobre um novo agendamento. Não bloqueia nem derruba a
// requisição do cliente se o notificador estiver fora do ar — é só um "melhor esforço".
async function notificarNovoAgendamento(s) {
    if (!NOTIFICADOR_URL || !NOTIFICADOR_TOKEN) return;
    try {
          const controle = new AbortController();
          const timeout = setTimeout(() => controle.abort(), 8000);
          const resposta = await fetch(`${NOTIFICADOR_URL.replace(/\/+$/, '')}/api/notificar`, {
                  method: 'POST',
                  headers: {
                            Authorization: `Bearer ${NOTIFICADOR_TOKEN}`,
                            'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                            mensagem:
                                        `Novo agendamento: ${s.nome} - ${s.servico} - ${formatarDataBr(s.data)} às ${s.horario} ` +
                                        `(código ${s.codigo})`,
                  }),
                  signal: controle.signal,
          });
          clearTimeout(timeout);
          if (!resposta.ok) {
                  console.error(`[notificador] Falha ao notificar (HTTP ${resposta.status}):`, await resposta.text().catch(() => ''));
          }
    } catch (e) {
          console.error('[notificador] Erro ao notificar novo agendamento:', e.message);
    }
}

if (!ADMIN_SENHA) {
    console.warn(
          '\n[AVISO] Variável de ambiente ADMIN_SENHA não definida — o painel /admin não vai aceitar nenhum login.\n' +
          'Defina ADMIN_SENHA (e opcionalmente ADMIN_USUARIO) nas variáveis do serviço no Railway.\n'
        );
}
if (!process.env.SESSION_SECRET) {
    console.warn('[AVISO] SESSION_SECRET não definido — gerando um valor aleatório (sessões somem a cada reinício).');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway fica atrás de um proxy — necessário para cookies "secure" e IP correto

// ---------- Cabeçalhos de segurança ----------
app.use((req, res, next) => {
    res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; " +
          "form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests"
        );
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
          'Permissions-Policy',
          'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), ' +
          'geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), interest-cohort=()'
        );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
});

app.use(express.json({ limit: '15kb' }));
app.use(express.urlencoded({ extended: false, limit: '15kb' }));

app.use(
    session({
          name: 'mago.sid',
          secret: SESSION_SECRET,
          resave: false,
          saveUninitialized: false,
          cookie: {
                  httpOnly: true,
                  sameSite: 'lax',
                  secure: PROD,
                  maxAge: 8 * 60 * 60 * 1000, // 8h
          },
    })
  );

// ---------- Limitador de requisições simples (anti-spam no formulário público) ----------
const tentativasPorIp = new Map();
function limitarTaxa(maxTentativas, janelaMs) {
    return (req, res, next) => {
          const ip = req.ip || 'desconhecido';
          const agora = Date.now();
          const historico = (tentativasPorIp.get(ip) || []).filter((t) => agora - t < janelaMs);
          if (historico.length >= maxTentativas) {
                  return res.status(429).json({ ok: false, erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
          }
          historico.push(agora);
          tentativasPorIp.set(ip, historico);
          next();
    };
}

// ---------- Site estático ----------
app.use(
    express.static(path.join(__dirname, 'public'), {
          extensions: ['html'],
          setHeaders(res, filePath) {
                  if (filePath.endsWith('.html')) {
                            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                  } else {
                            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                  }
          },
    })
  );

// ================= API pública =================

app.get('/api/horarios', (req, res) => {
    const data = String(req.query.data || '');
    if (!horarios.dataValida(data)) {
          return res.status(400).json({ ok: false, erro: 'Data inválida.' });
    }

          Promise.resolve(store.horariosOcupados(data)).then((ocupados) => {
                const { fimDeSemana } = horarios.faixaDoDia(data);
                const lista = horarios.horariosDoDia(data).map((hora) => ({
                        hora,
                        disponivel: !ocupados.includes(hora) && !horarios.estaNoPassado(data, hora),
                }));
                res.json({ ok: true, fimDeSemana, horarios: lista });
          });
});

app.post('/api/solicitacoes', limitarTaxa(8, 15 * 60 * 1000), async (req, res) => {
    const corpo = req.body || {};

           // Honeypot: se o campo invisível veio preenchido, é bot. Responde "sucesso" falso.
           if (corpo.site_web) {
                 return res.status(201).json({ ok: true, codigo: 'OK0000' });
           }

           const nome = String(corpo.nome || '').trim().slice(0, 80);
    const whatsappBruto = String(corpo.whatsapp || '').trim();
    const servico = String(corpo.servico || '').trim().slice(0, 120);
    const data = String(corpo.data || '').trim();
    const horario = String(corpo.horario || '').trim();
    const observacoes = String(corpo.observacoes || '').trim().slice(0, 300);

           if (!nome || nome.length < 2) return res.status(400).json({ ok: false, erro: 'Informe seu nome.' });

           const whatsapp = normalizarWhatsapp(whatsappBruto);
    if (whatsapp.length < 12 || whatsapp.length > 13) {
          return res.status(400).json({ ok: false, erro: 'Informe um WhatsApp válido com DDD.' });
    }

           if (!SERVICOS.includes(servico)) {
                 return res.status(400).json({ ok: false, erro: 'Escolha um serviço da lista.' });
           }

           if (!horarios.dataValida(data)) {
                 return res.status(400).json({ ok: false, erro: 'Data inválida.' });
           }

           if (!horarios.horarioValidoParaData(data, horario)) {
                 return res.status(400).json({ ok: false, erro: 'Esse horário não está dentro do funcionamento do dia escolhido.' });
           }

           if (horarios.estaNoPassado(data, horario)) {
                 return res.status(400).json({ ok: false, erro: 'Escolha uma data e horário futuros.' });
           }

           try {
                 const solicitacao = await store.criar({ nome, whatsapp, servico, data, horario, observacoes });
                 res.status(201).json({ ok: true, codigo: solicitacao.codigo });
                 notificarNovoAgendamento(solicitacao); // melhor esforço, não atrasa a resposta ao cliente
           } catch (e) {
                 if (e.codigo === 'HORARIO_OCUPADO') {
                         return res.status(409).json({ ok: false, erro: e.message, horarioOcupado: true });
                 }
                 console.error('Erro ao criar solicitação:', e);
                 res.status(500).json({ ok: false, erro: 'Erro interno. Tente novamente em instantes.' });
           }
});

app.get('/api/solicitacoes/:codigo', async (req, res) => {
    const s = await store.buscarPorCodigo(req.params.codigo);
    if (!s) return res.status(404).json({ ok: false, erro: 'Não encontrado.' });
    res.json({
          ok: true,
          solicitacao: {
                  codigo: s.codigo,
                  servico: s.servico,
                  data: s.data,
                  dataBr: formatarDataBr(s.data),
                  horario: s.horario,
                  status: s.status,
          },
    });
});

// ================= Painel administrativo =================

function exigirLogin(req, res, next) {
    if (req.session && req.session.autenticado) return next();
    res.redirect('/admin/login');
}

function layoutAdmin(titulo, conteudo) {
    return `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(titulo)} — Painel Mago</title>
    <meta name="robots" content="noindex">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/agenda.css">
    </head>
    <body>
    ${conteudo}
    </body>
    </html>`;
}

app.get('/admin/login', (req, res) => {
    if (req.session && req.session.autenticado) return res.redirect('/admin');
    const erro = req.query.erro
      ? '<div class="msg erro">Usuário ou senha incorretos.</div>'
          : '';
    res.send(layoutAdmin('Login', `
        <div class="topbar"><a class="brand" href="/">✦ Mago da Informática</a></div>
            <div class="wrap">
                  <div class="card">
                          <h1 style="font-size:20px;margin:0 0 16px;">Painel do Mago</h1>
                                  ${erro}
                                          <form method="POST" action="/admin/login">
                                                    <label for="usuario">Usuário</label>
                                                              <input id="usuario" name="usuario" type="text" autocomplete="username" required>
                                                                        <label for="senha">Senha</label>
                                                                                  <input id="senha" name="senha" type="password" autocomplete="current-password" required>
                                                                                            <button class="btn" type="submit">Entrar</button>
                                                                                                    </form>
                                                                                                          </div>
                                                                                                              </div>
                                                                                                                `));
});

app.post('/admin/login', (req, res) => {
    const { usuario, senha } = req.body || {};
    const usuarioOk = compararSeguro(String(usuario || ''), ADMIN_USUARIO);
    const senhaOk = ADMIN_SENHA && compararSeguro(String(senha || ''), ADMIN_SENHA);
    if (usuarioOk && senhaOk) {
          req.session.regenerate((err) => {
                  if (err) return res.redirect('/admin/login?erro=1');
                  req.session.autenticado = true;
                  res.redirect('/admin');
          });
          return;
    }
    res.redirect('/admin/login?erro=1');
});

app.post('/admin/logout', exigirLogin, (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

function cartaoSolicitacao(s, acoes) {
    return `
        <div class="solicitacao">
              <h4>${escapeHtml(s.nome)} — ${escapeHtml(s.servico)}</h4>
                    <div class="meta">
                            📅 ${escapeHtml(formatarDataBr(s.data))} às ${escapeHtml(s.horario)} ·
                                    📱 ${escapeHtml(s.whatsapp)} ·
                                            Código ${escapeHtml(s.codigo)}
                                                    ${s.observacoes ? `<br>💬 ${escapeHtml(s.observacoes)}` : ''}
                                                          </div>
                                                                ${acoes}
                                                                    </div>`;
}

app.get('/admin', exigirLogin, async (req, res) => {
    const todas = await store.listar();
    const pendentes = todas.filter((s) => s.status === 'pendente').sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));
    const confirmados = todas.filter((s) => s.status === 'confirmado').sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));
    const recusados = todas.filter((s) => s.status === 'recusado').sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)).slice(0, 15);

          const mensagemConfirmacao = (s) =>
                `Olá ${s.nome}! Seu atendimento (${s.servico}) com o Mago da Informática foi *confirmado* para ${formatarDataBr(s.data)} às ${s.horario}. Qualquer imprevisto, me chama por aqui. Até lá! 🧙‍♂️`;

          const htmlPendentes = pendentes.length
      ? pendentes.map((s) => cartaoSolicitacao(s, `
              <div class="acoes">
                        <form method="POST" action="/admin/solicitacoes/${s.id}/aprovar"><button class="btn" type="submit" style="margin-top:0;">✅ Aprovar</button></form>
                                  <form method="POST" action="/admin/solicitacoes/${s.id}/recusar"><button class="btn perigo" type="submit" style="margin-top:0;">✖ Recusar</button></form>
                                          </div>
                                                `)).join('')
                : '<p class="vazio">Nenhuma solicitação pendente.</p>';

          const htmlConfirmados = confirmados.length
      ? confirmados.map((s) => cartaoSolicitacao(s, `
              <div class="acoes">
                        <a class="btn whatsapp" style="margin-top:0;" target="_blank" rel="noopener"
                                     href="${linkWhatsapp(s.whatsapp, mensagemConfirmacao(s))}">✅ Enviar confirmação no WhatsApp</a>
                                             </div>
                                                   `)).join('')
                : '<p class="vazio">Nenhum atendimento confirmado ainda.</p>';

          const htmlRecusados = recusados.length
      ? recusados.map((s) => cartaoSolicitacao(s, '')).join('')
                : '<p class="vazio">Nenhuma recusa recente.</p>';

          res.send(layoutAdmin('Painel', `
              <div class="topbar">
                    <a class="brand" href="/">✦ Mago da Informática</a>
                          <form method="POST" action="/admin/logout"><button class="btn secundario" style="margin:0;padding:8px 16px;" type="submit">Sair</button></form>
                              </div>
                                  <div class="wrap wide">
                                        <div class="secao-titulo"><h2>🕒 Pendentes</h2><span class="contagem">${pendentes.length}</span></div>
                                              ${htmlPendentes}

                                                    <div class="secao-titulo"><h2>✅ Confirmados</h2><span class="contagem">${confirmados.length}</span></div>
                                                          ${htmlConfirmados}

                                                                <div class="secao-titulo"><h2>✖ Recusados recentes</h2><span class="contagem">${recusados.length}</span></div>
                                                                      ${htmlRecusados}
                                                                          </div>
                                                                            `));
});

app.post('/admin/solicitacoes/:id/aprovar', exigirLogin, async (req, res) => {
    await store.atualizarStatus(req.params.id, 'confirmado');
    res.redirect('/admin');
});

app.post('/admin/solicitacoes/:id/recusar', exigirLogin, async (req, res) => {
    await store.atualizarStatus(req.params.id, 'recusado');
    res.redirect('/admin');
});

// ================= 404 =================
app.use((req, res) => {
    res.status(404).send('Página não encontrada.');
});

app.listen(PORT, () => {
    console.log(`Mago da Informática rodando na porta ${PORT}`);
});

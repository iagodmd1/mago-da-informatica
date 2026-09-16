// Mago da Informática — site institucional + loja de sistemas + painel admin.
//
// Agendamento e compra de sistemas acontecem direto no WhatsApp (o site só
// leva o cliente até lá com a mensagem já pronta). O conteúdo da loja e do
// catálogo de serviços (textos, preços e imagens de capa) fica em
// data/conteudo.json e é editável pelo painel /admin.

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

const visitas = require('./lib/visitas');
const conteudo = require('./lib/conteudo');
const { escapeHtml } = require('./lib/util');

const PORT = process.env.PORT || 8080;
const PROD = process.env.NODE_ENV === 'production';
const ADMIN_USUARIO = process.env.ADMIN_USUARIO || 'mago';
const ADMIN_SENHA = process.env.ADMIN_SENHA || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

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

// Imagens de capa enviadas pelo painel — gravadas em DATA_DIR/uploads (ver
// aviso de persistência no README) e servidas aqui.
app.use('/uploads', express.static(conteudo.PASTA_UPLOADS, {
  maxAge: '30d',
}));

// ================= API pública =================

app.get('/api/conteudo', async (req, res) => {
  try {
    const dados = await conteudo.obterConteudoPublico();
    res.json({ ok: true, ...dados });
  } catch (e) {
    console.error('Erro ao obter conteúdo:', e);
    res.status(500).json({ ok: false, erro: 'Erro interno.' });
  }
});

app.post('/api/visitas', async (req, res) => {
  try {
    const total = await visitas.registrarVisita();
    res.json({ ok: true, total });
  } catch (e) {
    console.error('Erro ao registrar visita:', e);
    res.status(500).json({ ok: false, erro: 'Erro interno.' });
  }
});

app.get('/api/visitas', async (req, res) => {
  try {
    const total = await visitas.obterTotal();
    res.json({ ok: true, total });
  } catch (e) {
    console.error('Erro ao consultar visitas:', e);
    res.status(500).json({ ok: false, erro: 'Erro interno.' });
  }
});

// ================= Upload de imagens =================

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, conteudo.PASTA_UPLOADS),
    filename: (req, file, cb) => {
      const extOriginal = path.extname(file.originalname || '').toLowerCase();
      const ext = /^\.(png|jpe?g|webp|gif)$/.test(extOriginal) ? extOriginal : '.jpg';
      const tipo = (req.params.tipo || 'item').replace(/[^a-z]/g, '');
      const id = (req.params.id || crypto.randomBytes(4).toString('hex')).replace(/[^a-z0-9-]/g, '');
      cb(null, `${tipo}-${id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Envie uma imagem (PNG, JPG, WEBP ou GIF).'));
  },
});

// ================= Painel administrativo =================

function exigirLogin(req, res, next) {
  if (req.session && req.session.autenticado) return next();
  res.redirect('/admin/login');
}

function layoutAdmin(titulo, conteudoHtml) {
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
<link rel="stylesheet" href="/admin.css">
</head>
<body>
${conteudoHtml}
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

function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

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

const TIPOS_VALIDOS = ['servicos', 'loja'];
function validarTipo(req, res, next) {
  if (!TIPOS_VALIDOS.includes(req.params.tipo)) return res.status(404).send('Não encontrado.');
  next();
}

function capaHtml(item) {
  return item.imagem
    ? `<img class="capa" src="${escapeHtml(item.imagem)}" alt="Capa de ${escapeHtml(item.titulo)}">`
    : `<div class="sem-capa">${escapeHtml(item.icone || '🧩')}</div>`;
}

function cardServico(s) {
  return `
    <div class="item-card">
      ${capaHtml(s)}
      <b>${escapeHtml(s.titulo)}</b> — <span style="color:var(--gold-2);">${escapeHtml(s.preco || '')}</span>
      <details class="form-editar">
        <summary>Editar</summary>
        <form method="POST" action="/admin/itens/servicos/${escapeHtml(s.id)}" enctype="multipart/form-data">
          <label>Título</label>
          <input name="titulo" value="${escapeHtml(s.titulo)}" required>
          <label>Selo (ex.: "Inclui Office", opcional)</label>
          <input name="badge" value="${escapeHtml(s.badge || '')}">
          <label>Descrição</label>
          <textarea name="descricao">${escapeHtml(s.descricao || '')}</textarea>
          <div class="linha2">
            <div><label>Preço (ex.: R$ 100,00)</label><input name="preco" value="${escapeHtml(s.preco || '')}"></div>
            <div><label>Ordem</label><input name="ordem" type="number" value="${Number(s.ordem) || 0}"></div>
          </div>
          <label>Ícone (emoji, usado se não houver foto)</label>
          <input name="icone" value="${escapeHtml(s.icone || '')}" maxlength="4">
          <label>Foto de capa (opcional)</label>
          <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp,image/gif">
          <button class="btn" type="submit">Salvar</button>
        </form>
      </details>
      <div class="acoes-item">
        <form method="POST" action="/admin/itens/servicos/${escapeHtml(s.id)}/remover" onsubmit="return confirm('Remover este serviço?');">
          <button class="btn perigo pequeno" type="submit" style="width:100%;">Remover</button>
        </form>
      </div>
    </div>`;
}

function cardLoja(s) {
  return `
    <div class="item-card">
      ${capaHtml(s)}
      <b>${escapeHtml(s.titulo)}</b>
      <details class="form-editar">
        <summary>Editar</summary>
        <form method="POST" action="/admin/itens/loja/${escapeHtml(s.id)}" enctype="multipart/form-data">
          <label>Título</label>
          <input name="titulo" value="${escapeHtml(s.titulo)}" required>
          <label>Categoria (ex.: "Suporte de TI")</label>
          <input name="tag" value="${escapeHtml(s.tag || '')}">
          <label>Descrição curta (aparece no card)</label>
          <textarea name="descricaoCurta">${escapeHtml(s.descricaoCurta || '')}</textarea>
          <label>Descrição completa (aparece em "Ver descrição completa")</label>
          <textarea name="descricaoCompleta">${escapeHtml(s.descricaoCompleta || '')}</textarea>
          <div class="linha2">
            <div><label>Ícone (emoji, usado se não houver foto)</label><input name="icone" value="${escapeHtml(s.icone || '')}" maxlength="4"></div>
            <div><label>Ordem</label><input name="ordem" type="number" value="${Number(s.ordem) || 0}"></div>
          </div>
          <label>Foto de capa (opcional)</label>
          <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp,image/gif">
          <button class="btn" type="submit">Salvar</button>
        </form>
      </details>
      <div class="acoes-item">
        <form method="POST" action="/admin/itens/loja/${escapeHtml(s.id)}/remover" onsubmit="return confirm('Remover este sistema da loja?');">
          <button class="btn perigo pequeno" type="submit" style="width:100%;">Remover</button>
        </form>
      </div>
    </div>`;
}

app.get('/admin', exigirLogin, async (req, res) => {
  const { servicos, loja } = await conteudo.listarAdmin();
  const totalVisitas = await visitas.obterTotal();

  res.send(layoutAdmin('Painel', `
    <div class="topbar">
      <a class="brand" href="/">✦ Mago da Informática</a>
      <form method="POST" action="/admin/logout"><button class="btn secundario pequeno" type="submit">Sair</button></form>
    </div>
    <div class="wrap wide">

      <div class="secao-titulo"><h2>👁️ Contador de visitas</h2></div>
      <div class="card">
        <p style="margin:0 0 6px;color:var(--text-dim);font-size:14px;">Total atual: <b style="color:var(--gold-2);">${totalVisitas.toLocaleString('pt-BR')}</b></p>
        <form method="POST" action="/admin/visitas" style="display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1;"><label style="margin-top:0;">Ajustar total para</label><input name="total" type="number" min="0" value="${totalVisitas}"></div>
          <button class="btn pequeno" type="submit" style="margin-top:0;">Salvar</button>
        </form>
      </div>

      <div class="secao-titulo"><h2>🛠️ Catálogo de serviços</h2><span class="contagem">${servicos.length}</span></div>
      <div class="itens-grid">
        ${servicos.map(cardServico).join('')}
      </div>
      <div class="card novo-item" style="margin-top:18px;">
        <b>Adicionar novo serviço</b>
        <form method="POST" action="/admin/itens/servicos/novo" enctype="multipart/form-data">
          <label>Título</label>
          <input name="titulo" required>
          <label>Selo (opcional)</label>
          <input name="badge">
          <label>Descrição</label>
          <textarea name="descricao"></textarea>
          <div class="linha2">
            <div><label>Preço</label><input name="preco" placeholder="R$ 0,00"></div>
            <div><label>Ícone (emoji)</label><input name="icone" maxlength="4" placeholder="🛠️"></div>
          </div>
          <label>Foto de capa (opcional)</label>
          <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp,image/gif">
          <button class="btn" type="submit">Adicionar serviço</button>
        </form>
      </div>

      <div class="secao-titulo"><h2>🛒 Loja de sistemas</h2><span class="contagem">${loja.length}</span></div>
      <div class="itens-grid">
        ${loja.map(cardLoja).join('')}
      </div>
      <div class="card novo-item" style="margin-top:18px;">
        <b>Adicionar novo sistema</b>
        <form method="POST" action="/admin/itens/loja/novo" enctype="multipart/form-data">
          <label>Título</label>
          <input name="titulo" required>
          <label>Categoria</label>
          <input name="tag">
          <label>Descrição curta</label>
          <textarea name="descricaoCurta"></textarea>
          <label>Descrição completa</label>
          <textarea name="descricaoCompleta"></textarea>
          <label>Ícone (emoji)</label>
          <input name="icone" maxlength="4" placeholder="🧩">
          <label>Foto de capa (opcional)</label>
          <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp,image/gif">
          <button class="btn" type="submit">Adicionar sistema</button>
        </form>
      </div>

    </div>
    <footer class="rodape">© 2026 Mago da Informática</footer>
  `));
});

app.post('/admin/visitas', exigirLogin, async (req, res) => {
  await visitas.definirTotal(req.body && req.body.total);
  res.redirect('/admin');
});

app.post('/admin/itens/:tipo/novo', exigirLogin, validarTipo, upload.single('imagem'), async (req, res) => {
  try {
    const campos = camposDoFormulario(req.params.tipo, req.body);
    const item = await conteudo.criar(req.params.tipo, campos);
    if (req.file) {
      await conteudo.definirImagem(req.params.tipo, item.id, `/uploads/${req.file.filename}`);
    }
    res.redirect('/admin');
  } catch (e) {
    console.error('Erro ao criar item:', e);
    res.status(400).send(`Erro: ${escapeHtml(e.message)}. <a href="/admin">Voltar</a>`);
  }
});

app.post('/admin/itens/:tipo/:id', exigirLogin, validarTipo, upload.single('imagem'), async (req, res) => {
  try {
    const campos = camposDoFormulario(req.params.tipo, req.body);
    await conteudo.atualizar(req.params.tipo, req.params.id, campos);
    if (req.file) {
      await conteudo.definirImagem(req.params.tipo, req.params.id, `/uploads/${req.file.filename}`);
    }
    res.redirect('/admin');
  } catch (e) {
    console.error('Erro ao atualizar item:', e);
    res.status(400).send(`Erro: ${escapeHtml(e.message)}. <a href="/admin">Voltar</a>`);
  }
});

app.post('/admin/itens/:tipo/:id/remover', exigirLogin, validarTipo, async (req, res) => {
  await conteudo.remover(req.params.tipo, req.params.id);
  res.redirect('/admin');
});

function camposDoFormulario(tipo, corpo) {
  const b = corpo || {};
  const ordem = b.ordem !== undefined && b.ordem !== '' ? Number(b.ordem) : undefined;
  if (tipo === 'servicos') {
    return limpar({
      titulo: String(b.titulo || '').trim().slice(0, 100),
      badge: String(b.badge || '').trim().slice(0, 40),
      descricao: String(b.descricao || '').trim().slice(0, 500),
      preco: String(b.preco || '').trim().slice(0, 30),
      icone: String(b.icone || '').trim().slice(0, 8),
      ordem,
    });
  }
  return limpar({
    titulo: String(b.titulo || '').trim().slice(0, 100),
    tag: String(b.tag || '').trim().slice(0, 40),
    descricaoCurta: String(b.descricaoCurta || '').trim().slice(0, 200),
    descricaoCompleta: String(b.descricaoCompleta || '').trim().slice(0, 600),
    icone: String(b.icone || '').trim().slice(0, 8),
    ordem,
  });
}

function limpar(obj) {
  const saida = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) saida[k] = v;
  }
  return saida;
}

// Erros do multer (arquivo grande demais, tipo inválido) viram uma resposta
// legível em vez de derrubar o processo.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || (err && /imagem/i.test(err.message || ''))) {
    return res.status(400).send(`Erro no upload: ${escapeHtml(err.message)}. <a href="/admin">Voltar</a>`);
  }
  next(err);
});

// ================= 404 =================
app.use((req, res) => {
  res.status(404).send('Página não encontrada.');
});

app.listen(PORT, () => {
  console.log(`Mago da Informática rodando na porta ${PORT}`);
});

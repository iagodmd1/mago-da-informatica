// Mago da Informática — site institucional + loja de sistemas.
//
// Agendamento e compra de sistemas acontecem direto no WhatsApp do Mago
// (o site só leva o cliente até lá com a mensagem já pronta). O servidor
// aqui só serve o site estático e mantém o contador de visitas.

const path = require('path');
const express = require('express');

const visitas = require('./lib/visitas');

const PORT = process.env.PORT || 8080;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway fica atrás de um proxy — necessário para o IP correto

// ---------- Cabeçalhos de segurança ----------
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; " +
    "form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests"
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

// ================= Contador de visitas =================
// POST registra uma nova visita (uma vez por sessão de navegador, controlado
// no próprio front-end). GET só consulta o total, sem incrementar.

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

// ================= 404 =================
app.use((req, res) => {
  res.status(404).send('Página não encontrada.');
});

app.listen(PORT, () => {
  console.log(`Mago da Informática rodando na porta ${PORT}`);
});

# Mago da Informática — site + sistema de agendamento

Site do Mago da Informática com um sistema de agendamento de atendimentos:
o cliente escolhe serviço, dia e horário; a solicitação fica **pendente**;
o Mago aprova ou recusa no painel interno; ao aprovar, o painel gera um
link do WhatsApp já com a mensagem de confirmação pronta para enviar.

## O que mudou

Antes este repositório era um site 100% estático (sem backend, sem
JavaScript, sem formulário) servido pelo Caddy. Para dar esse sistema de
agendamento com aprovação, ele agora é uma aplicação **Node.js + Express**
que:

- Serve o site (pasta `public/`, incluindo o `index.html` original).
- Expõe um formulário de agendamento em `/agendar`.
- Guarda cada solicitação num arquivo JSON (`data/solicitacoes.json`).
- Tem um painel protegido por login em `/admin` para aprovar/recusar.
- Gera, ao aprovar, um link `wa.me` com a mensagem de confirmação pronta —
  não usa a API paga do WhatsApp Business, então o envio final é sempre
  **um clique do Mago**, não é 100% automático sem intervenção.
- Dá ao cliente uma página `/status` para acompanhar o pedido pelo código
  recebido (sem precisar de login).

## Arquivos

| Arquivo/pasta | O que é |
|---|---|
| `server.js` | Aplicação Express: rotas do site, API e painel admin. |
| `lib/horarios.js` | Regras de horário de funcionamento. |
| `lib/store.js` | Leitura/gravação das solicitações em `data/solicitacoes.json`. |
| `lib/util.js` | Helpers (escape de HTML, normalização de WhatsApp, etc). |
| `public/` | Site estático + páginas de agendamento/status (HTML, CSS, JS). |
| `Dockerfile` | Imagem Node usada pelo Railway. |

## Horário de atendimento

- Segunda a sexta: **08h às 18h**
- Sábado e domingo: **08h ao meio-dia**

Definido em `lib/horarios.js` — para mudar os horários, é só editar essa
função.

## Variáveis de ambiente (configurar no Railway)

| Variável | Obrigatória | O que faz |
|---|---|---|
| `ADMIN_USUARIO` | não (padrão `mago`) | Usuário de login do painel `/admin`. |
| `ADMIN_SENHA` | **sim** | Senha do painel. Sem ela, o login nunca funciona. Escolha uma senha forte. |
| `SESSION_SECRET` | recomendado | Chave para assinar o cookie de sessão. Sem ela, todo login é derrubado a cada reinício do serviço. Gere uma com `openssl rand -hex 32`. |
| `WHATSAPP_NUMERO` | não (padrão `5577981020268`) | Não é usado para enviar — é só um valor de referência; o link de confirmação vai para o WhatsApp **do cliente**, não do Mago. Pode remover essa variável. |
| `DATA_DIR` | não (padrão `./data`) | Onde o arquivo de solicitações é gravado — ver aviso do Volume abaixo. |
| `NOTIFICADOR_URL` | não (sem ela, notificações ficam desligadas) | URL pública do Notificador WhatsApp (ex: `https://xxxx.ngrok-free.app`), **sem** `/api/notificar` no final. |
| `NOTIFICADOR_TOKEN` | não (sem ela, notificações ficam desligadas) | Token Bearer mostrado no painel do Notificador WhatsApp, em "Integração com o seu site". |

## Notificação no WhatsApp de novos agendamentos

Toda vez que um cliente envia uma solicitação em `/agendar` (rota
`POST /api/solicitacoes`), o servidor chama, em segundo plano, o painel
**Notificador WhatsApp** para avisar o Mago pelo WhatsApp. Isso é feito por
`notificarNovoAgendamento()` em `server.js` e não atrasa nem derruba a
resposta ao cliente caso o notificador esteja fora do ar.

Para ativar:

1. No painel do Notificador WhatsApp, copie o token em "Integração com o seu site".
2. O Notificador roda em `localhost`, então ele só é alcançável pelo Railway se você expuser essa porta publicamente — por exemplo com um túnel (`ngrok http 3300`, Cloudflare Tunnel) mantendo o computador e o painel ligados, ou fazendo deploy do próprio Notificador em algum serviço na nuvem.
3. Configure no Railway as variáveis `NOTIFICADOR_URL` (a URL pública, sem `/api/notificar` no final) e `NOTIFICADOR_TOKEN` (o token copiado).
4. Se o túnel for reiniciado (o ngrok grátis muda de URL a cada reinício), atualize `NOTIFICADOR_URL` no Railway.

Sem essas duas variáveis configuradas, o site funciona normalmente — só não envia a notificação.

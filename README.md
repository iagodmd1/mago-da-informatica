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

## Persistência dos dados — **importante**

O sistema de arquivos de um container no Railway é **efêmero**: sem um
Volume anexado, tudo que for gravado em `data/solicitacoes.json` some a
cada novo deploy ou reinício do serviço. Para não perder as solicitações:

1. No serviço no Railway → **Settings → Volumes → New Volume**.
2. Monte em, por exemplo, `/data`.
3. Defina a variável `DATA_DIR=/data`.

Sem isso, o sistema funciona normalmente no dia a dia, mas um redeploy
apaga o histórico de agendamentos.

## Como subir no Railway

1. Suba estes arquivos para o repositório `iagodmd1/mago-da-informatica`
   (substituindo os antigos `index.html` e `Caddyfile`).
2. No Railway, o serviço já existente vai detectar o novo `Dockerfile` e
   fazer o build automaticamente a cada push.
3. Configure as variáveis de ambiente acima (pelo menos `ADMIN_SENHA`).
4. (Recomendado) Anexe um Volume conforme a seção acima.
5. Acesse `/admin` com o usuário e senha configurados para aprovar
   solicitações.

## Segurança

- Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options etc.) continuam
  ativos, agora configurados no próprio Express em vez do Caddy.
- O painel `/admin` exige login (usuário/senha via variáveis de
  ambiente) e usa cookie de sessão `httpOnly`, `secure` em produção.
- O formulário público (`/api/solicitacoes`) tem limite de tamanho de
  entrada, um campo-armadilha (honeypot) anti-bot e um limitador de
  taxa por IP.
- Toda entrada de usuário é escapada antes de aparecer no painel admin,
  para evitar XSS armazenado.
- **Ative 2FA na conta do GitHub e do Railway.** Continua sendo o vetor
  real de ataque: quem entra na sua conta troca o serviço inteiro.
- **Não commite segredo nenhum no repositório.** `ADMIN_SENHA` e
  `SESSION_SECRET` são configurados como variáveis de ambiente no
  Railway, nunca no código.

# Mago da Informática — site de apresentação

Site estático (uma página) com a identidade visual do Mago da Informática:
apresentação, sistemas, catálogo de preços, seção de internet e contato.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O site inteiro. Logo embutida, sem dependências externas além das fontes do Google. |
| `Caddyfile` | Configuração do servidor: cabeçalhos de segurança, cache e bloqueios. |
| `Dockerfile` | Imagem de deploy (Caddy Alpine). É o que o Railway usa. |

## Como subir no Railway

1. Suba os três arquivos para o repositório `iagodmd1/mago-da-informatica`
   (GitHub → **Add file** → **Upload files** → arraste os três → **Commit changes**).
2. No projeto do Railway → **Create** → **GitHub Repository** → escolha
   `mago-da-informatica`.
3. O Railway detecta o `Dockerfile` sozinho e faz o build. Não precisa
   configurar nada — a porta vem da variável `PORT` que o Railway injeta.
4. Em **Settings → Networking → Generate Domain** para gerar a URL pública.

## Segurança

O site não tem backend, banco de dados, formulário, login nem JavaScript.
Não há entrada de usuário em lugar nenhum, então não existe injeção de SQL,
upload malicioso ou sequestro de sessão — não há sessão.

O que está configurado no `Caddyfile`:

- **`Content-Security-Policy` com `script-src 'none'`** — a proteção mais forte
  aqui. Mesmo que alguém consiga injetar `<script>` na página, o navegador se
  recusa a executar. XSS fica inofensivo por construção.
- **`frame-ancestors 'none'` + `X-Frame-Options: DENY`** — ninguém consegue
  embutir o site num iframe para aplicar clickjacking.
- **`Strict-Transport-Security` (2 anos, com subdomínios)** — força HTTPS e
  bloqueia downgrade para HTTP.
- **`X-Content-Type-Options: nosniff`** — impede o navegador de reinterpretar
  um arquivo como outro tipo.
- **`Referrer-Policy: strict-origin-when-cross-origin`** — não vaza a URL
  completa para terceiros.
- **`Permissions-Policy`** — desliga câmera, microfone, geolocalização, USB,
  pagamento e afins. O site não usa nada disso.
- **Métodos não-leitura (`POST`, `PUT`, `DELETE`…) respondem `405`.**
- **Arquivos ocultos (`.env`, `.git`, `.ssh`, `.aws`) respondem `404`** — o
  scan automático de script kiddie não acha nada.
- **`-Server` e `-X-Powered-By`** — o servidor não se identifica, então não
  entrega a versão para alguém procurar exploit conhecido.

Tudo isso foi testado localmente antes de entregar (headers conferidos com
`curl`, `POST` retornando 405, `.env` e `.git/config` retornando 404).

### O que ainda depende de você

Segurança de site estático é quase toda operacional. Os pontos que sobram:

- **Ative 2FA na conta do GitHub e na do Railway.** Hoje esse é o vetor real:
  quem entra na sua conta troca o conteúdo do site. Nenhum cabeçalho protege
  contra isso.
- **Não commite segredo nenhum no repositório** (token, senha, chave de API).
  Repositório público é indexado.
- **Se ligar um domínio próprio**, confirme que o HTTPS foi emitido antes de
  divulgar o endereço.

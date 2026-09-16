# Mago da Informática — site institucional + loja de sistemas

Site do Mago da Informática: catálogo de serviços, loja apresentando os
sistemas próprios (cada um com descrição e botão de compra) e contador de
visitas. Agendamento e compra acontecem direto no WhatsApp — os botões do
site já abrem a conversa com a mensagem pronta, você combina dia, horário e
valor por lá.

Os textos, preços e imagens de capa de cada serviço/sistema são editáveis
pelo painel `/admin`, sem precisar mexer em código ou fazer um novo deploy.

## Arquivos

| Arquivo/pasta | O que é |
|---|---|
| `server.js` | Aplicação Express: site, APIs públicas e painel `/admin`. |
| `lib/visitas.js` | Leitura/gravação do contador de visitas em `data/visitas.json`. |
| `lib/conteudo.js` | CRUD do conteúdo da loja e dos serviços em `data/conteudo.json`. |
| `lib/util.js` | Helper de escape de HTML. |
| `public/` | Site estático (HTML, CSS, JS). |
| `public/conteudo.js` | Busca `/api/conteudo` e renderiza a loja e os serviços no front-end. |
| `public/visitas.js` | Registra e exibe o contador de visitas no front-end. |
| `public/admin.css` | Estilo do painel `/admin`. |
| `Dockerfile` | Imagem Node usada pelo Railway. |

## Painel administrativo (`/admin`)

Acesse `/admin` e faça login com `ADMIN_USUARIO`/`ADMIN_SENHA` (variáveis de
ambiente — ver tabela abaixo). No painel dá para:

- ajustar o total do contador de visitas manualmente a qualquer momento;
- editar título, descrição, preço/categoria, ícone (emoji) e ordem de cada
  serviço e de cada sistema da loja;
- enviar uma foto de capa personalizada por item (loja e serviços) — quando
  não há foto, o site usa o ícone em emoji;
- adicionar novos serviços/sistemas ou remover os existentes.

As alterações feitas no painel aparecem no site publicamente na hora,
porque a página pública busca o conteúdo dinamicamente em `/api/conteudo`
em vez de ter os itens fixos no HTML.

**Importante (deploy no Railway):** sem um Volume anexado e `DATA_DIR`
apontando para ele, tanto o conteúdo editado (`data/conteudo.json`) quanto
as fotos enviadas (`data/uploads/`) voltam ao padrão a cada redeploy ou
reinício — ver aviso do Volume abaixo.

## Contador de visitas

Cada visitante conta uma vez por sessão de navegador (`sessionStorage`
evita contar de novo a cada recarregamento de página). O total fica salvo
em `data/visitas.json` e é exibido no herói e no rodapé do site. Na
primeira vez que o arquivo é criado, o contador começa no valor de
`VISITAS_INICIAL` (padrão `180`); depois disso ele só é alterado por
visitas reais ou por um ajuste manual feito no painel `/admin`.

**Importante (deploy no Railway):** o sistema de arquivos do container é
efêmero — sem um Volume anexado, o contador (e qualquer dado gravado em
`DATA_DIR`, incluindo o conteúdo editável e as fotos enviadas) zera a cada
redeploy ou reinício. Anexe um Volume no serviço e aponte a variável
`DATA_DIR` para o caminho montado (ex.: `/data`) para persistir de verdade.

## Variáveis de ambiente (configurar no Railway)

| Variável | Obrigatória | O que faz |
|---|---|---|
| `DATA_DIR` | não (padrão `./data`) | Onde ficam `visitas.json`, `conteudo.json` e as fotos enviadas (`uploads/`) — ver aviso do Volume acima. |
| `PORT` | não (padrão `8080`) | Porta em que o servidor escuta (o Railway define automaticamente). |
| `VISITAS_INICIAL` | não (padrão `180`) | Valor inicial do contador, usado só na primeira vez que `visitas.json` é criado. |
| `ADMIN_USUARIO` | não (padrão `mago`) | Usuário de login do painel `/admin`. |
| `ADMIN_SENHA` | **sim**, para usar o `/admin` | Senha de login do painel. Sem ela, o login fica bloqueado (avisado no log do servidor). |
| `SESSION_SECRET` | recomendado | Chave usada para assinar o cookie de sessão do painel. Sem ela, uma chave aleatória é gerada a cada reinício (todos são deslogados). |

## Agendamento e loja

Não há mais formulário nem painel de aprovação de agendamento: todo botão
de "Agendar" ou "Comprar" do site abre o WhatsApp (`wa.me`) já com a
mensagem preenchida (serviço ou sistema de interesse). O número usado está
fixo em `lib/conteudo.js` (constante `NUMERO_WHATSAPP`) — para trocar,
altere essa constante.

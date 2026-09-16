# Mago da Informática — site institucional + loja de sistemas

Site do Mago da Informática: catálogo de serviços, loja apresentando os
sistemas próprios (cada um com descrição e botão de compra) e contador de
visitas. Agendamento e compra acontecem direto no WhatsApp — os botões do
site já abrem a conversa com a mensagem pronta, você combina dia, horário e
valor por lá.

## Arquivos

| Arquivo/pasta | O que é |
|---|---|
| `server.js` | Aplicação Express: serve o site e o contador de visitas. |
| `lib/visitas.js` | Leitura/gravação do contador de visitas em `data/visitas.json`. |
| `lib/util.js` | Helper de escape de HTML. |
| `public/` | Site estático (HTML, CSS, JS). |
| `public/visitas.js` | Registra e exibe o contador de visitas no front-end. |
| `Dockerfile` | Imagem Node usada pelo Railway. |

## Contador de visitas

Cada visitante conta uma vez por sessão de navegador (`sessionStorage`
evita contar de novo a cada recarregamento de página). O total fica salvo
em `data/visitas.json` e é exibido no herói e no rodapé do site.

**Importante (deploy no Railway):** o sistema de arquivos do container é
efêmero — sem um Volume anexado, o contador (e qualquer dado gravado em
`DATA_DIR`) zera a cada redeploy ou reinício. Anexe um Volume no serviço e
aponte a variável `DATA_DIR` para o caminho montado (ex.: `/data`) para
persistir de verdade.

## Variáveis de ambiente (configurar no Railway)

| Variável | Obrigatória | O que faz |
|---|---|---|
| `DATA_DIR` | não (padrão `./data`) | Onde o contador de visitas é gravado — ver aviso do Volume acima. |
| `PORT` | não (padrão `8080`) | Porta em que o servidor escuta (o Railway define automaticamente). |

## Agendamento e loja

Não há mais formulário nem painel de aprovação: todo botão de "Agendar" ou
"Comprar" do site abre o WhatsApp (`wa.me`) já com a mensagem preenchida
(serviço ou sistema de interesse). O número usado está fixo nos links do
`public/index.html` — para trocar, procure por `wa.me/55779810202` no
arquivo e substitua em todas as ocorrências.

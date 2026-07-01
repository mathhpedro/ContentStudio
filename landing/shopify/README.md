# Landing no Shopify — arquivos de tema (Playbook IA na Prática)

Estes arquivos colocam a landing **dentro do tema do Shopify** com o visual idêntico
(sem o header/footer do tema), usando um **layout próprio**.

## Arquivos
| Arquivo | Destino no tema | O que é |
| --- | --- | --- |
| `layout/playbook.liquid` | `layout/playbook.liquid` | Layout mínimo (só `content_for_header` + `content_for_layout`) com as fontes e o CSS da landing. Isola do CSS do tema. |
| `templates/page.playbook.liquid` | `templates/page.playbook.liquid` | Template da página. Usa **imagens como assets do tema** (`{{ 'x.jpg' \| asset_url }}`). Requer subir as imagens em `assets/`. |
| `templates/page.playbook.url.liquid` | `templates/page.playbook.liquid` | **Alternativa self-contained**: mesmas imagens, mas via URL pública do GitHub — **não precisa subir assets**. Renomeie para `page.playbook.liquid` se preferir este. |

> Use **um** dos dois templates. O `.url.liquid` é o mais rápido (nada de subir imagens);
> o `page.playbook.liquid` (asset_url) é o "definitivo" (imagens hospedadas no seu tema).

## Passo a passo (manual, no Admin do Shopify)
1. **Loja virtual → Temas → (Horizon) → ⋯ → Duplicar** (trabalhe sempre na cópia).
2. Na cópia: **⋯ → Editar código**.
3. Em **Layout**, `Adicionar um novo layout` → nome `playbook` → cole o conteúdo de `layout/playbook.liquid`.
4. Em **Templates**, `Adicionar um novo template` → tipo **page** → sufixo `playbook` →
   cole o conteúdo de `templates/page.playbook.liquid` **ou** `templates/page.playbook.url.liquid`.
5. (Só se usar o template `asset_url`) Em **Assets**, suba as 16 imagens listadas abaixo.
6. **Loja virtual → Páginas → Adicionar página** → título “Playbook IA na Prática” →
   em **Template**, escolha `page.playbook` → salvar.
7. Abra a página em **Pré-visualizar** (na cópia do tema) e confira.
8. Quando aprovar: **Temas → cópia → Publicar** (aí vai ao ar).

## Imagens (16) — para o template `asset_url`
Suba em `assets/` do tema. Fonte pública (branch/commit atual):
`https://raw.githubusercontent.com/mathhpedro/ContentStudio/<commit>/landing/assets/…`

- `cover.jpg`, `canvas.jpg`, `ficha.jpg`, `priorizacao.jpg`, `method.jpg`,
  `agent-cover.jpg`, `agent-build.jpg`, `agent-run.jpg`, `checklist.jpg`,
  `roteiro.jpg`, `plano.jpg`
- Avatares: `person-1.jpg` … `person-5.jpg` (estão em `landing/assets/avatars/`)

## Já configurado nesta loja (via API)
- **Produto**: “Playbook IA na Prática — 5 Agentes Prontos para Negócios”
  - Status **rascunho (DRAFT)**, preço **R$ 97**, comparação **R$ 197**, capa, descrição e tags.
  - ID: `gid://shopify/Product/10621474013478`.
  - ⚠️ Ativar só depois de configurar a **entrega do arquivo digital** (app, ex.: “Digital Downloads”).

## Observações
- **Publicar o tema** não é feito por API (o Shopify bloqueia isso via API) — é um clique no Admin.
- O botão de compra da oferta usa âncora `#oferta`; troque pela **URL do produto/checkout**
  quando o produto estiver ativo.

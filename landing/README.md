# Landing page — Playbook IA na Prática

Página de vendas premium e responsiva para o **“Playbook IA na Prática: 5 Agentes
Prontos para Negócios”**, no design system **LEVVL Labs**. HTML/CSS puro,
autossuficiente (sem build), com pré-visualizações usando as **páginas reais** do e-book.

## Arquivos
| Arquivo | O que é |
| --- | --- |
| `index.html` | A landing completa (16 seções + header/footer). Fontes via Google Fonts (CDN). |
| `assets/*.jpg` | Imagens reais das páginas do playbook (capa, canvas, agentes, checklist…), usadas nos mockups e nos scroll-clips. |

## Seções (na ordem)
Hero · Barra de credibilidade · Problema · Transformação (antes/depois) · O que você
recebe · **Os 5 agentes** · Por dentro (scroll-clips) · Método A.G.E.N.T.E. · Aplicação
prática · Benefícios · Prova social · Comparação · **Oferta** · Garantia · FAQ · CTA final.

## Como publicar na Shopify
Três caminhos (do mais simples ao mais flexível):

1. **App de landing page** (PageFly, Shogun, GemPages): crie uma página em branco,
   adicione um bloco “HTML/Custom Code” e cole o conteúdo do `<body>` + o `<style>` do
   `index.html`. Suba as imagens de `assets/` em **Configurações → Arquivos** e troque os
   caminhos `assets/xxx.jpg` pelas URLs geradas pela Shopify.
2. **Seção de tema custom**: crie uma section `.liquid` no seu tema e cole o HTML/CSS.
   Mesma troca de caminhos de imagem por URLs da Shopify (ou `{{ 'xxx.jpg' | asset_url }}`).
3. **Hospedar em um link** (Vercel/Netlify/GitHub Pages) e apontar para ele — a pasta
   `landing/` já funciona como está (basta servir `index.html` com a pasta `assets/`).

> Dica: a página inteira funciona abrindo `index.html` no navegador. Teste localmente
> antes de publicar.

## O que revisar antes de publicar
Todos os placeholders visuais já foram preenchidos e a página não exibe mais marcações
`[editar]`. Ainda assim, **confirme com dados reais** os pontos abaixo antes de vender:

- **Preço**: definido como **R$ 197 → R$ 97 (−51%)** no hero e na seção Oferta.
  Para mudar, edite esses valores nos dois pontos.
- **Números de prova social**: preenchidos com valores sugeridos — hero **4,7** e
  **"+2.000 profissionais"**; faixa de métricas **+2.000 / +5.000 / 40% / +5**. **Troque
  por dados reais** — não anuncie números que você não pode comprovar.
- **Depoimentos**: usam **fotos reais** (`assets/avatars/person-1…5.jpg`) e cargos, mas o
  texto é ilustrativo. Substitua por depoimentos reais (com autorização) antes de publicar.
- **Links de compra**: os CTAs de compra usam `href="#"` / `href="#oferta"`. Troque o
  CTA final da oferta pela **URL de checkout/produto da Shopify**. Os demais CTAs rolam
  até a oferta (funil) — pode manter.
- **Garantia** (seção 14): texto padrão de **7 dias** já escrito — ajuste conforme sua
  **política real** (ou remova a seção).
- **Rodapé**: adicione **CNPJ/razão social** (removido do texto) e aponte os links de
  Termos, Privacidade, Contato e Reembolso (`href="#"`) para as páginas reais.
- **Logos de clientes**: a faixa de logos foi **removida**. Se quiser, reinsira apenas
  com logos e permissões reais.

## Responsivo
- Desktop (>980px): hero em 2 colunas, grids 3+, tabela comparativa, clips lado a lado.
- Tablet (≤980px): grids em 2 colunas, timeline em 3, menu recolhe.
- Mobile (≤640px): coluna única, botões full-width, tabela comparativa vira blocos
  empilhados, cards um por vez.
- Respeita `prefers-reduced-motion` (pausa animações e scroll-clips).

## Observações de design
- Segue LEVVL Labs: fundo escuro, sinais roxo/ciano, Space Grotesk/Outfit/JetBrains Mono,
  cards com glow, gradiente 135°.
- **Sem `background-clip:text`** — acentos em cor sólida e heros com gradiente em SVG, para
  renderizar igual em qualquer navegador/dispositivo.
- As imagens de preview são exportações reais do e-book — se você atualizar o e-book,
  reexporte-as para manter a coerência.

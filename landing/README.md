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

## O que EDITAR antes de publicar (placeholders)
Tudo que precisa de dado real está marcado em **laranja** com a classe `.ph` (ou texto
`[editar]`). Procure por `[` no arquivo. Principais pontos:

- **Preço**: definido como **R$ 197 → R$ 97 (−51%)** no hero e na seção Oferta.
  Para mudar, edite esses valores nos dois pontos.
- **Prova social do hero**: usa **fotos reais** em `assets/avatars/person-1…5.jpg`
  (recortadas em círculo). Para trocar, substitua esses arquivos. A **nota 4,7** e o
  **"+2.000 profissionais já aplicam o método"** são **editáveis** — ajuste para números
  reais **antes de publicar**.
- **Botões de compra**: os CTAs de compra usam `href="#"` / `href="#oferta"`. Troque o
  CTA final da oferta pela **URL de checkout/produto da Shopify**. Os demais CTAs rolam
  até a oferta (funil) — pode manter.
- **Garantia** (seção 14): ajuste o texto conforme sua **política real** (ou remova).
- **Métricas de prova social** (`[X]+`, `[X]%`): coloque números reais ou remova a faixa.
- **Depoimentos**: estão marcados como “exemplo · editável”. Substitua por depoimentos
  reais (com autorização) antes de publicar.
- **Logos de clientes**: são placeholders `LOGO`. Só insira logos reais com permissão.
- **Rodapé**: CNPJ/razão social, links de Termos, Privacidade, Contato e Reembolso.

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

# Sua Equipe Invisível — Playbook de Agentes de IA para Negócios

E-book premium (41 páginas, pt-BR) sobre **Agentes de IA para Negócios**, escrito
para não programadores — empreendedores, gestores, autônomos, consultores e times
de operação. Estruturado como um **playbook acionável**: cada capítulo termina com
algo pronto para aplicar.

Todo o material segue rigorosamente o **LEVVL Labs Design System** (vácuo escuro,
sinais roxo/ciano com função, tipografia Space Grotesk / Outfit / JetBrains Mono,
cards com glassmorphism, glow semântico, motivo do grafo de automação).

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `agentes-de-ia-para-negocios.html` | **Fonte da verdade.** Documento completo, autossuficiente, pronto para diagramação/impressão. Cada `<section class="page">` é uma página A4. |
| `agentes-de-ia-para-negocios.pdf` | O e-book renderizado em A4, pronto para distribuir/vender. |
| `build-pdf.mjs` | Script opcional para regerar o PDF a partir do HTML. |

## Título e posicionamento

- **Título:** *Sua Equipe Invisível*
- **Subtítulo:** *O playbook prático dos Agentes de IA para Negócios — crie
  funcionários digitais que trabalham 24/7, sem escrever uma linha de código.*
- **Faixa de preço sugerida:** R$ 50 – R$ 119,90 (produto digital de ticket médio).

## O que tem dentro

- **Fundamentos** — o que são agentes, chatbot × automação × assistente × agente,
  por que empresas adotam, e os conceitos essenciais (prompt, contexto, memória,
  RAG, triggers, workflows, dados estruturados/não estruturados) explicados com
  analogias simples.
- **Ferramentas** — comparativo de 13 ferramentas no-code/low-code (ChatGPT,
  Custom GPTs, Make, Zapier, n8n, Notion, Airtable, Sheets, Typeform, Botpress,
  Flowise, Voiceflow, Relevance AI) com dificuldade, melhor uso e exemplos.
- **Método AGENTES™** — metodologia proprietária de 7 passos (a sigla é a própria
  palavra *AGENTES*): **A**nalisar · **G**uiar · **E**struturar · **N**omear ·
  **T**razer · **E**nsaiar · **S**upervisionar.
- **Canvas do Agente** — folha de planejamento preenchível.
- **5 agentes prontos** — cada um com capa/separador própria e os 15 campos
  obrigatórios (problema, perfil, benefícios, ferramentas, dificuldade, tempo,
  fluxo visual, passo a passo, prompt base, campos a preencher, checklist,
  exemplo, métricas, melhorias, cuidados):
  1. **Atende 24/7** — Atendimento e Triagem
  2. **Radar de Leads** — Vendas e Qualificação
  3. **Máquina de Conteúdo** — Conteúdo e Marketing
  4. **Copiloto de Operações** — Operações e Processos
  5. **Analista de Bolso** — Análise de Dados e Relatórios
- **Colocar em prática** — templates (tabela de priorização, mapa de processo,
  ficha do agente), roteiro de implementação 7·14·30 dias, plano de ação final,
  checklist de lançamento, glossário e próximos passos.

## Como gerar o PDF

**Opção A — sem ferramentas (recomendada):** abra o `.html` no Chrome →
`Imprimir` → *Salvar como PDF*, com **tamanho A4**, **margens "Nenhuma"** e a
opção **"Gráficos de plano de fundo" ligada** (senão o fundo escuro some).

**Opção B — script:**

```bash
npm i -D playwright-core
node ebook/build-pdf.mjs
```

## Notas de diagramação

- O documento usa **Google Fonts** via `<link>`. Para uso 100 % offline, baixe as
  fontes e embuta-as, ou gere o PDF (que já preserva a tipografia).
- Páginas de **trabalho/preenchimento** (Canvas, Templates, Plano de Ação) usam a
  **variante clara** do design system — sancionada para superfícies densas em
  dados e melhor para escrever/imprimir. O restante segue o fundo escuro.
- Cada página cabe exatamente em um A4; não há quebras no meio de seções.

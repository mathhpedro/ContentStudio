/**
 * Gera o PDF do e-book a partir do HTML, em A4 e com os fundos escuros preservados.
 *
 * Uso:
 *   npm i -D playwright-core        # ou playwright
 *   node ebook/build-pdf.mjs
 *
 * Requer um Chromium/Chrome instalado. Aponte o caminho pela variável
 * CHROME_PATH, ou deixe o Playwright localizar o navegador padrão.
 *
 * Alternativa sem Node: abra o .html no navegador → Imprimir → Salvar como PDF
 * (tamanho A4, margens "Nenhuma", opção "Gráficos de plano de fundo" ligada).
 */
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'agentes-de-ia-para-negocios.html');
const out = join(here, 'agentes-de-ia-para-negocios.pdf');

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.goto('file://' + src, { waitUntil: 'networkidle', timeout: 60000 });
try { await page.evaluate(() => document.fonts.ready); } catch {}
await page.waitForTimeout(500);
await page.pdf({
  path: out,
  width: '210mm',
  height: '297mm',
  printBackground: true,
  preferCSSPageSize: true,
});
console.log('PDF gerado em', out);
await browser.close();

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function htmlToPdf(html: string): Promise<Buffer> {
  let documentHtml = html;
  try {
    const font = await readFile(path.join(process.cwd(), 'public', 'fonts', 'Montserrat.woff2'));
    const embeddedFont = `<style>@font-face{font-family:'Montserrat';src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-style:normal;font-weight:100 900;font-display:block}</style>`;
    documentHtml = html.replace('</head>', `${embeddedFont}</head>`);
  } catch (error) {
    console.error('Unable to embed Montserrat in PDF:', error);
  }

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 1 });
    await page.setContent(documentHtml, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMediaType('print');

    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );

    const pdf = await page.pdf({
      width: '600px',
      height: `${scrollHeight + 48}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

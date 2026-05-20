import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 20000 });
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

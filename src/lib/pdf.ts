import puppeteer from 'puppeteer';

/**
 * Converts an HTML string to a PDF Buffer using headless Chrome.
 * Uses print media emulation so @media print CSS applies.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 900, deviceScaleFactor: 1 });

    // Load content and wait for network (fonts) to settle
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 20000 });

    // Switch to print media so @media print styles apply
    await page.emulateMediaType('print');

    // Measure actual content height in print layout
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

/** Branded errani e-mail container shared by dialogs, newsletters and notifications. */

export const BRAND_PRIMARY = '#f58bdc';
export const BRAND_SOFT = '#fde7f7';
export const BRANDED_MARKER = '<!--errani-branded-->';

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text → paragraphs; already-HTML input is passed through unchanged. */
export function textToHtml(body: string): string {
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  return body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function buildBrandedEmailHtml(innerHtml: string): string {
  const year = new Date().getFullYear();
  return `${BRANDED_MARKER}<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:36px 16px 48px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
        <tr><td style="padding:0 0 18px;text-align:center;">
          <span style="font-size:26px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;">errani</span>
        </td></tr>
        <tr>
          <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.09);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="height:4px;background:${BRAND_PRIMARY};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:28px 28px 24px;font-size:14px;line-height:1.8;color:#333;">${innerHtml}</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="height:1px;background:#f0f0f0;font-size:0;">&nbsp;</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:14px 28px 20px;font-size:11px;color:#bbb;line-height:1.7;">
                <a href="mailto:mail@errani.ru" style="color:${BRAND_PRIMARY};text-decoration:none;">mail@errani.ru</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:18px 0 0;text-align:center;font-size:11px;color:#bbb;">© ${year} errani.ru</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function isBrandedEmail(html: string): boolean {
  return html.startsWith(BRANDED_MARKER);
}

import { Resend } from 'resend';

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string;
  shippingMethod: string;
  totalAmount: number;
  items: { name: string; quantity: number; price: number }[];
}

const SHIPPING_LABELS: Record<string, string> = {
  ozon: 'OZON',
  cdek: 'СДЭК',
  russianpost: 'Почта России',
  dhl: 'DHL',
  fedex: 'FedEx',
};

export async function sendOrderConfirmation(data: OrderEmailData) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return;
  }

  const resend = new Resend(apiKey);

  const itemsHtml = data.items
    .map(
      item => `
      <tr>
        <td style="padding:10px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:500;color:#333;">${item.name}</td>
        <td style="padding:10px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;color:#666;">${item.quantity}</td>
        <td style="padding:10px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:700;color:#333;">${item.price.toLocaleString('ru-RU')} ₽</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:36px 16px 48px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

        <!-- Brand -->
        <tr>
          <td style="padding:0 0 18px;text-align:center;">
            <span style="font-size:26px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">errani</span>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.09);">

            <!-- Orange accent top bar -->
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:4px;background:#e8601c;font-size:0;line-height:0;">&nbsp;</td></tr></table>

            <!-- Header row -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:26px 28px 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;">
                        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#e8601c;letter-spacing:0.14em;text-transform:uppercase;">Подтверждение заказа</p>
                        <p style="margin:0;font-size:21px;font-weight:800;color:#1a1a1a;letter-spacing:-0.02em;">Заказ оформлен!</p>
                      </td>
                      <td style="text-align:right;vertical-align:top;padding-left:12px;">
                        <p style="margin:0;font-size:10px;color:#aaa;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Номер</p>
                        <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#e8601c;letter-spacing:-0.02em;">#${data.orderNumber}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:1px;background:#f0f0f0;font-size:0;">&nbsp;</td></tr></table>

            <!-- Customer info block -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:18px 28px 4px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:10px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;">Получатель</p>
                        <p style="margin:6px 0 0;font-size:14px;font-weight:700;color:#1a1a1a;">${data.customerName}</p>
                        <p style="margin:3px 0 0;font-size:13px;color:#555;">${data.customerPhone}&nbsp;&nbsp;·&nbsp;&nbsp;${data.customerEmail}</p>
                        <p style="margin:3px 0 0;font-size:12px;color:#999;">${data.city}&nbsp;&nbsp;·&nbsp;&nbsp;${SHIPPING_LABELS[data.shippingMethod] || data.shippingMethod}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Items -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:18px 28px 20px;">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;">Состав заказа</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr style="background:#f8f8f8;">
                      <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;text-align:left;">Товар</th>
                      <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;text-align:center;">Кол-во</th>
                      <th style="padding:8px 10px;font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;text-align:right;">Цена</th>
                    </tr>
                    ${itemsHtml}
                  </table>
                  <!-- Total -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #f0f0f0;">
                    <tr>
                      <td style="padding-top:12px;font-size:13px;font-weight:600;color:#888;">К оплате</td>
                      <td style="padding-top:12px;text-align:right;font-size:20px;font-weight:900;color:#1a1a1a;letter-spacing:-0.02em;">${data.totalAmount.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:1px;background:#f0f0f0;font-size:0;">&nbsp;</td></tr></table>

            <!-- Footer note -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:18px 28px 24px;">
                  <p style="margin:0;font-size:13px;color:#888;line-height:1.75;">
                    Мы свяжемся с вами после комплектации заказа.<br/>
                    По вопросам: <a href="mailto:info@errani.ru" style="color:#e8601c;font-weight:600;text-decoration:none;">info@errani.ru</a>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Page footer -->
        <tr>
          <td style="padding:22px 0 0;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;font-weight:500;">© ${new Date().getFullYear()} errani.ru</p>
            <p style="margin:0;font-size:11px;color:#bbb;">Вы получили это письмо, т.к. оформили заказ на errani.ru</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: 'errani <orders@errani.ru>',
      to: data.customerEmail,
      subject: `Заказ #${data.orderNumber} подтверждён — errani`,
      html,
    });
    console.log(`Order confirmation email sent to ${data.customerEmail}`);
  } catch (err) {
    console.error('Failed to send order confirmation email:', err);
  }
}

// ─── Receipt PDF email ────────────────────────────────────────────────────

interface ReceiptEmailData {
  orderNumber: string;
  customerEmail: string;
  receiptPdf: Buffer;
}

export async function sendReceiptEmail(data: ReceiptEmailData) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, skipping receipt email');
    return;
  }

  const resend = new Resend(apiKey);

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:36px 16px 48px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <!-- Brand -->
        <tr>
          <td style="padding:0 0 18px;text-align:center;">
            <span style="font-size:26px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">errani</span>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.09);">
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:4px;background:#e8601c;font-size:0;line-height:0;">&nbsp;</td></tr></table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:32px 28px 28px;">
                  <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#e8601c;letter-spacing:0.14em;text-transform:uppercase;">Заказ #${data.orderNumber}</p>
                  <p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-0.02em;">Спасибо за заказ!</p>
                  <p style="margin:0 0 6px;font-size:14px;color:#555;line-height:1.7;">
                    Чек на заказ <strong style="color:#1a1a1a;">#${data.orderNumber}</strong> во вложении.
                  </p>
                  <p style="margin:20px 0 0;font-size:14px;color:#555;line-height:1.7;">
                    С уважением,<br/>
                    <strong style="color:#1a1a1a;">Ekaterina Errani</strong>
                  </p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:1px;background:#f0f0f0;font-size:0;">&nbsp;</td></tr></table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:16px 28px 20px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.7;">
                    По вопросам: <a href="mailto:info@errani.ru" style="color:#e8601c;font-weight:600;text-decoration:none;">info@errani.ru</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 0 0;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#aaa;font-weight:500;">© ${new Date().getFullYear()} errani.ru</p>
            <p style="margin:0;font-size:11px;color:#bbb;">Вы получили это письмо, т.к. оформили заказ на errani.ru</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: 'errani <orders@errani.ru>',
      to: data.customerEmail,
      subject: `Чек на заказ #${data.orderNumber}`,
      html,
      attachments: [
        {
          filename: `receipt-${data.orderNumber}.pdf`,
          content: data.receiptPdf,
        },
      ],
    });
    console.log(`Receipt PDF email sent to ${data.customerEmail}`);
  } catch (err) {
    console.error('Failed to send receipt PDF email:', err);
  }
}

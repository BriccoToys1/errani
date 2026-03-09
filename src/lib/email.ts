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
        <td style="padding:8px 12px;border-bottom:1px solid #222;">${item.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #222;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #222;text-align:right;">${item.price.toLocaleString('ru-RU')} ₽</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#e8601c;padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">ERRANI</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;">Заказ подтверждён!</h1>
            <p style="margin:0 0 24px;color:#999;font-size:14px;">Номер заказа: <strong style="color:#fff;">#${data.orderNumber}</strong></p>

            <p style="margin:0 0 6px;font-size:14px;color:#999;">Получатель</p>
            <p style="margin:0 0 20px;font-size:15px;">${data.customerName} · ${data.customerPhone}</p>

            <p style="margin:0 0 6px;font-size:14px;color:#999;">Город / Доставка</p>
            <p style="margin:0 0 24px;font-size:15px;">${data.city} · ${SHIPPING_LABELS[data.shippingMethod] || data.shippingMethod}</p>

            <!-- Items -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
              <tr style="background:#1a1a1a;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;font-weight:500;">Товар</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;color:#666;font-weight:500;">Кол-во</th>
                <th style="padding:8px 12px;text-align:right;font-size:12px;color:#666;font-weight:500;">Цена</th>
              </tr>
              ${itemsHtml}
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:16px;font-weight:700;">Итого</td>
                <td style="text-align:right;font-size:16px;font-weight:700;color:#e8601c;">${data.totalAmount.toLocaleString('ru-RU')} ₽</td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #222;margin:28px 0;"/>
            <p style="margin:0;font-size:13px;color:#666;line-height:1.7;">
              Мы свяжемся с вами после комплектации заказа.<br/>
              По вопросам: <a href="mailto:info@errani.ru" style="color:#e8601c;text-decoration:none;">info@errani.ru</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;text-align:center;border-top:1px solid #1a1a1a;">
            <p style="margin:0;font-size:12px;color:#444;">© ${new Date().getFullYear()} errani.ru</p>
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

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'errani-admin-secret-key-change-me';

const SHIPPING_LABELS: Record<string, string> = {
  ozon: 'OZON',
  yandex: 'Яндекс Маркет',
  pochta_ru: 'Почта России',
  cdek: 'СДЭК',
  pochta_int: 'Почта России (международная)',
};

const PAYMENT_LABELS: Record<string, string> = {
  yukassa: 'ЮKassa (карта)',
  stripe: 'Банковская карта',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает оплаты',
  paid: 'Оплачен',
  assembling: 'Сборка',
  shipped: 'Отправлен',
  in_transit: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(n);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Auth via query token
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return new Response('Unauthorized', { status: 401 });
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: { include: { product: true } } },
  });

  if (!order) return new Response('Not found', { status: 404 });

  const createdAt = new Date(order.createdAt);
  const dateStr = createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const addressParts = [
    order.zipCode && `${order.zipCode}`,
    order.oblast && order.oblast,
    order.city && order.city,
    order.street && `ул. ${order.street}`,
    order.house && `д. ${order.house}`,
    order.apartment && `кв. ${order.apartment}`,
  ].filter(Boolean);

  const shippingLabel = SHIPPING_LABELS[order.shippingMethod] || order.shippingMethod || '—';
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '—';
  const statusLabel = STATUS_LABELS[order.status] || order.status;

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;">${item.product.name}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.price)}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${fmt(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Чек заказа ${order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 48px 56px; max-width: 760px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #1a1a1a; }
    .brand { font-size: 26px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
    .brand-sub { font-size: 11px; color: #888; letter-spacing: 0.05em; margin-top: 3px; }
    .order-meta { text-align: right; }
    .order-num { font-size: 17px; font-weight: 700; }
    .order-date { font-size: 12px; color: #666; margin-top: 4px; }
    .status-badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #f0f0f0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e0e0e0; }
    .row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
    .row .lbl { color: #666; white-space: nowrap; }
    .row .val { font-weight: 500; text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; border-bottom: 2px solid #e0e0e0; text-align: left; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3), th:nth-child(4) { text-align: right; }
    .total-section { margin-top: 20px; padding-top: 12px; border-top: 2px solid #1a1a1a; display: flex; justify-content: flex-end; }
    .total-inner { min-width: 220px; }
    .total-row { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; font-size: 13px; }
    .grand-total { font-size: 18px; font-weight: 900; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e0e0e0; }
    .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #aaa; line-height: 1.8; }
    .print-btn { display: block; margin: 0 auto 28px; padding: 10px 28px; background: #1a1a1a; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; letter-spacing: 0.04em; }
    @media print {
      .print-btn { display: none; }
      body { padding: 20px 24px; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Распечатать / Сохранить как PDF</button>

  <div class="header">
    <div>
      <div class="brand">ERRANI</div>
      <div class="brand-sub">errani.ru</div>
    </div>
    <div class="order-meta">
      <div class="order-num">Заказ #${order.orderNumber}</div>
      <div class="order-date">${dateStr} в ${timeStr}</div>
      <span class="status-badge">${statusLabel}</span>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="section-title">Покупатель</div>
      <div class="row"><span class="lbl">ФИО</span><span class="val">${order.customerName}</span></div>
      <div class="row"><span class="lbl">Email</span><span class="val">${order.customerEmail}</span></div>
      ${order.customerPhone ? `<div class="row"><span class="lbl">Телефон</span><span class="val">${order.customerPhone}</span></div>` : ''}
    </div>
    <div>
      <div class="section-title">Доставка и оплата</div>
      <div class="row"><span class="lbl">Способ доставки</span><span class="val">${shippingLabel}</span></div>
      <div class="row"><span class="lbl">Способ оплаты</span><span class="val">${paymentLabel}</span></div>
    </div>
  </div>

  <div style="margin-bottom:28px;">
    <div class="section-title">Адрес доставки</div>
    <div class="row"><span class="lbl">Страна</span><span class="val">${order.country}</span></div>
    ${order.oblast ? `<div class="row"><span class="lbl">Область / Регион</span><span class="val">${order.oblast}</span></div>` : ''}
    <div class="row"><span class="lbl">Город</span><span class="val">${order.city}</span></div>
    <div class="row"><span class="lbl">Полный адрес</span><span class="val">${addressParts.join(', ') || '—'}</span></div>
  </div>

  <div>
    <div class="section-title">Состав заказа</div>
    <table>
      <thead>
        <tr>
          <th>Наименование</th>
          <th>Кол-во</th>
          <th>Цена</th>
          <th>Сумма</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="total-section">
      <div class="total-inner">
        <div class="total-row grand-total"><span>Итого к оплате</span><span>${fmt(order.totalAmount)}</span></div>
      </div>
    </div>
  </div>

  ${order.notes ? `<div style="margin-top:24px;padding:12px 16px;background:#f9f9f9;border-radius:8px;font-size:12px;color:#555;"><strong>Заметки:</strong> ${order.notes}</div>` : ''}

  <div class="footer">
    Документ сформирован ${new Date().toLocaleString('ru-RU')}<br>
    ERRANI · errani.ru · Данный документ является подтверждением заказа
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

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

const STATUS_CLASS: Record<string, string> = {
  pending: 'status-pending',
  paid: 'status-paid',
  assembling: 'status-assembling',
  shipped: 'status-shipped',
  in_transit: 'status-in-transit',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(n);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return new Response('Unauthorized', { status: 401 });
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order) return new Response('Not found', { status: 404 });

  const createdAt = new Date(order.createdAt);
  const dateStr = createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const fileDate = dateStr.replace(/\./g, '-');
  const fileTime = timeStr.replace(/:/g, '-');
  const saveFilename = `${order.orderNumber}_${fileDate}_${fileTime}`;

  const addressParts = [
    order.zipCode,
    order.oblast,
    order.city,
    order.street && `ул. ${order.street}`,
    order.house && `д. ${order.house}`,
    order.apartment && `кв. ${order.apartment}`,
  ].filter(Boolean);

  const shippingLabel = SHIPPING_LABELS[order.shippingMethod] || order.shippingMethod || '—';
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '—';
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const statusCls = STATUS_CLASS[order.status] || 'status-pending';

  const itemsHtml = order.items.map(item => `
    <tr>
      <td>${item.product.name}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">${fmt(item.price)}</td>
      <td style="text-align:right;font-weight:700;">${fmt(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${saveFilename}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Montserrat', Arial, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #f0f0f0;
      padding: 28px 16px 40px;
    }
    .btn-row {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
    }
    .btn-print {
      padding: 9px 22px;
      background: #e3e3e3;
      color: #555;
      border: none;
      border-radius: 7px;
      font-family: 'Montserrat', Arial, sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: background 0.18s;
    }
    .btn-print:hover { background: #d5d5d5; }
    .btn-save {
      padding: 9px 22px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 7px;
      font-family: 'Montserrat', Arial, sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: background 0.18s;
    }
    .btn-save:hover { background: #333; }
    .receipt-wrap {
      max-width: 540px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 24px rgba(0,0,0,0.10);
    }
    .receipt-header {
      padding: 22px 26px 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 0.5px solid #e8e8e8;
    }
    .brand {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #1a1a1a;
      line-height: 1;
      text-transform: lowercase;
    }
    .brand-sub {
      font-size: 10px;
      color: #bbb;
      letter-spacing: 0.05em;
      margin-top: 4px;
      font-weight: 500;
    }
    .order-meta { text-align: right; }
    .order-num { font-size: 13px; font-weight: 700; }
    .order-date { font-size: 10px; color: #999; margin-top: 4px; font-weight: 500; }
    .status-badge {
      display: inline-block;
      margin-top: 7px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .status-pending  { background: #fff8e1; color: #b45309; }
    .status-paid     { background: #d1fae5; color: #065f46; }
    .status-assembling { background: #dbeafe; color: #1e40af; }
    .status-shipped  { background: #dbeafe; color: #1e40af; }
    .status-in-transit { background: #ede9fe; color: #5b21b6; }
    .status-delivered { background: #d1fae5; color: #065f46; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }

    .receipt-body { padding: 18px 26px 22px; display: flex; flex-direction: column; gap: 10px; }

    .info-block {
      background: #fafafa;
      border: 0.5px solid #e0e0e0;
      border-radius: 8px;
      padding: 13px 15px;
    }
    .section-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #bbb;
      margin-bottom: 9px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 2.5px 0;
      font-size: 11.5px;
    }
    .row .lbl { color: #999; white-space: nowrap; font-weight: 500; }
    .row .val { font-weight: 600; text-align: right; word-break: break-word; max-width: 65%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 6px 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #bbb;
      border-bottom: 0.5px solid #e8e8e8;
      text-align: left;
    }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3), th:nth-child(4) { text-align: right; }
    td {
      padding: 7px 4px;
      border-bottom: 0.5px solid #f2f2f2;
      font-size: 11.5px;
      font-weight: 500;
    }
    .total-section {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 0.5px solid #e8e8e8;
      display: flex;
      justify-content: flex-end;
    }
    .total-inner { min-width: 180px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 2px 0;
      font-size: 11.5px;
      font-weight: 500;
    }
    .grand-total {
      font-size: 15px;
      font-weight: 900;
      margin-top: 7px;
      padding-top: 7px;
      border-top: 0.5px solid #e0e0e0;
    }

    .receipt-footer {
      padding: 13px 26px;
      border-top: 0.5px solid #f0f0f0;
      text-align: center;
      font-size: 10px;
      color: #ccc;
      line-height: 1.9;
      font-weight: 500;
    }

    @media print {
      body { background: #fff; padding: 0; }
      .btn-row { display: none; }
      .receipt-wrap { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="btn-row">
    <button class="btn-print" onclick="window.print()">Распечатать</button>
    <button class="btn-save" onclick="savePdf()">Сохранить</button>
  </div>
  <script>
    function savePdf() {
      var orig = document.title;
      document.title = '${saveFilename}';
      window.print();
      setTimeout(function(){ document.title = orig; }, 2000);
    }
  </script>

  <div class="receipt-wrap">
    <div class="receipt-header">
      <div>
        <div class="brand">errani</div>
        <div class="brand-sub">errani.ru</div>
      </div>
      <div class="order-meta">
        <div class="order-num">Заказ #${order.orderNumber}</div>
        <div class="order-date">${dateStr} в ${timeStr}</div>
        <span class="status-badge ${statusCls}">${statusLabel}</span>
      </div>
    </div>

    <div class="receipt-body">
      <div class="two-col">
        <div class="info-block">
          <div class="section-title">Покупатель</div>
          <div class="row"><span class="lbl">ФИО</span><span class="val">${order.customerName}</span></div>
          <div class="row"><span class="lbl">Email</span><span class="val">${order.customerEmail}</span></div>
          ${order.customerPhone ? `<div class="row"><span class="lbl">Телефон</span><span class="val">${order.customerPhone}</span></div>` : ''}
        </div>
        <div class="info-block">
          <div class="section-title">Доставка и оплата</div>
          <div class="row"><span class="lbl">Доставка</span><span class="val">${shippingLabel}</span></div>
          <div class="row"><span class="lbl">Оплата</span><span class="val">${paymentLabel}</span></div>
        </div>
      </div>

      <div class="info-block">
        <div class="section-title">Адрес доставки</div>
        <div class="row"><span class="lbl">Страна</span><span class="val">${order.country}</span></div>
        ${order.oblast ? `<div class="row"><span class="lbl">Регион</span><span class="val">${order.oblast}</span></div>` : ''}
        ${order.city ? `<div class="row"><span class="lbl">Город</span><span class="val">${order.city}</span></div>` : ''}
        ${addressParts.length ? `<div class="row"><span class="lbl">Адрес</span><span class="val">${addressParts.join(', ')}</span></div>` : ''}
      </div>

      <div class="info-block">
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

      ${order.notes ? `<div class="info-block"><div class="section-title">Заметки</div><div style="font-size:11.5px;color:#555;font-weight:500;line-height:1.6;">${order.notes}</div></div>` : ''}
    </div>

    <div class="receipt-footer">
      Документ сформирован ${new Date().toLocaleString('ru-RU')}<br>
      errani · errani.ru · Подтверждение заказа
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

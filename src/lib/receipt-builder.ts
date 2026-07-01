// Shared receipt HTML builder — used by both the admin receipt API route and the email PDF generator

const SHIPPING_LABELS: Record<string, string> = {
  ozon: 'OZON',
  yandex: 'Яндекс Маркет',
  pochta_ru: 'Почта России',
  cdek: 'СДЭК',
  cdek_courier: 'СДЭК — курьером',
  cdek_pvz: 'СДЭК — пункт выдачи',
  pochta_int: 'Почта России (международная)',
};

const PAYMENT_LABELS: Record<string, string> = {
  yukassa: 'ЮKassa (карта)',
  tochka: 'СБП',
  card: 'Карта',
  sbp: 'СБП',
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
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(n);
}

export interface ReceiptOrderItem {
  quantity: number;
  price: number;
  productId: string;
  product: { name: string } | null;
}

export interface ReceiptOrder {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  oblast: string;
  city: string;
  zipCode: string;
  street: string;
  house: string;
  apartment: string;
  shippingMethod: string;
  cdekDeliveryPointAddress?: string;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  notes: string;
  createdAt: Date;
  items: ReceiptOrderItem[];
}

/**
 * Builds the full receipt HTML.
 * @param order   — order data
 * @param forPdf  — when true, strips interactive buttons/scripts (clean PDF output)
 */
export function buildReceiptHtml(order: ReceiptOrder, forPdf = false): string {
  const createdAt = new Date(order.createdAt);
  const dateStr = createdAt.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = createdAt.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const fileDate = dateStr.replace(/\./g, '-');
  const fileTime = timeStr.replace(/:/g, '-');
  const saveFilename = `${order.orderNumber}_${fileDate}_${fileTime}`;

  const now = new Date();
  const docDateStr = now.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Moscow',
    hour12: false,
  });

  const addressParts = (order.shippingMethod === 'cdek_pvz'
    ? [order.zipCode, order.city, order.cdekDeliveryPointAddress]
    : [
        order.zipCode,
        order.oblast,
        order.city,
        order.street && `ул. ${order.street}`,
        order.house && `д. ${order.house}`,
        order.apartment && `кв. ${order.apartment}`,
      ]).filter(Boolean);

  const shippingLabel = SHIPPING_LABELS[order.shippingMethod] || order.shippingMethod || '—';
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod || '—';
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const statusCls = STATUS_CLASS[order.status] || 'status-pending';

  const itemsSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost = Math.round(Math.max(0, order.totalAmount - itemsSubtotal));

  const itemsHtml = order.items
    .map(
      item => `
    <tr>
      <td>${item.product?.name ?? item.productId}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">${fmt(item.price)}</td>
      <td style="text-align:right;font-weight:700;">${fmt(item.price * item.quantity)}</td>
    </tr>`
    )
    .join('');

  const scriptBlock = forPdf
    ? ''
    : `<script>
    function savePdf() {
      var orig = document.title;
      document.title = '${saveFilename}';
      window.print();
      setTimeout(function(){ document.title = orig; }, 2000);
    }
  </script>`;

  const btnRow = forPdf
    ? ''
    : `<div class="btn-row">
    <button class="btn-print" onclick="window.print()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Распечатать</button>
    <button class="btn-save" onclick="savePdf()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Сохранить</button>
  </div>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${saveFilename}</title>
  <style>
    @font-face {
      font-family: 'Montserrat';
      src: url('/fonts/Montserrat.woff2') format('woff2');
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
    }
    @page { margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Montserrat', Arial, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #e4e4e4;
      padding: 28px 16px 40px;
    }

    .receipt-wrap {
      max-width: 520px;
      margin: 0 auto;
      background: #fff;
      border-radius: 14px;
      position: relative;
    }

    .receipt-header {
      padding: 22px 24px 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; color: #1a1a1a; line-height: 1; }
    .brand-sub { font-size: 10px; color: #bbb; letter-spacing: 0.04em; margin-top: 4px; font-weight: 500; }
    .order-meta { text-align: right; }
    .order-num { font-size: 13px; font-weight: 700; }
    .order-date { font-size: 10px; color: #999; margin-top: 4px; font-weight: 500; }
    .status-badge {
      display: inline-block; margin-top: 7px; padding: 3px 10px;
      border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
    }
    .status-pending   { background: #fff8e1; color: #b45309; }
    .status-paid      { background: #d1fae5; color: #065f46; }
    .status-assembling{ background: #dbeafe; color: #1e40af; }
    .status-shipped   { background: #dbeafe; color: #1e40af; }
    .status-in-transit{ background: #ede9fe; color: #5b21b6; }
    .status-delivered { background: #d1fae5; color: #065f46; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }

    .ticket-tear {
      position: relative; height: 0; border-top: 1.5px dashed #ccc; margin: 0; overflow: visible;
    }
    .ticket-notch {
      position: absolute; top: -12px; width: 24px; height: 24px;
      background: #e4e4e4; border-radius: 50%; z-index: 2;
    }
    .ticket-notch-left  { left: -12px; }
    .ticket-notch-right { right: -12px; }

    .receipt-body { padding: 18px 24px 18px; display: flex; flex-direction: column; gap: 10px; }

    .info-block {
      background: #fafafa; border: 1px dashed #d8d8d8; border-radius: 8px; padding: 12px 14px;
    }
    .section-title {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.12em; color: #c0c0c0; margin-bottom: 8px;
    }
    .row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; font-size: 11px; }
    .row .lbl { color: #aaa; white-space: nowrap; font-weight: 500; }
    .row .val { font-weight: 600; text-align: right; word-break: break-word; max-width: 68%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 5px 4px; font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #c0c0c0; border-bottom: 1px dashed #d8d8d8; text-align: left;
    }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3), th:nth-child(4) { text-align: right; }
    td { padding: 7px 4px; border-bottom: 1px dashed #eeeeee; font-size: 11px; font-weight: 500; }
    tbody tr:last-child td { border-bottom: none; }

    .total-section {
      margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d8d8d8;
      display: flex; justify-content: flex-end;
    }
    .total-inner { min-width: 160px; }
    .grand-total {
      display: flex; justify-content: space-between; gap: 16px; font-size: 15px; font-weight: 900;
    }

    .receipt-footer {
      padding: 14px 24px; text-align: center; font-size: 10px; color: #ccc; line-height: 1.9; font-weight: 500;
    }

    .btn-row {
      max-width: 520px; margin: 16px auto 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    }
    .btn-print {
      padding: 11px 0; background: #3a3a3a; color: #fff; border: none; border-radius: 8px;
      font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .btn-save {
      padding: 11px 0; background: #1a1a1a; color: #fff; border: none; border-radius: 8px;
      font-family: 'Montserrat', Arial, sans-serif; font-size: 12px; font-weight: 600; cursor: pointer;
    }

    @media print {
      @page { size: 150mm auto; margin: 0; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      html {
        background: #e4e4e4 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        background: #e4e4e4 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        margin: 0;
        padding: 14px 8px !important;
        width: 100%;
      }
      .btn-row { display: none !important; }
      .receipt-wrap { max-width: 100%; margin: 0 auto; box-shadow: none; }
      .ticket-notch {
        background: #e4e4e4 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      a { text-decoration: none !important; color: inherit !important; }
      a::after, a[href]::after, a[href]:after { content: none !important; display: none !important; }
    }
  </style>
</head>
<body>
  ${scriptBlock}

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

    <div class="ticket-tear">
      <div class="ticket-notch ticket-notch-left"></div>
      <div class="ticket-notch ticket-notch-right"></div>
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
            ${shippingCost > 0 ? `
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;font-weight:500;color:#aaa;margin-bottom:5px;"><span>Товары</span><span>${fmt(itemsSubtotal)}</span></div>
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;font-weight:500;color:#aaa;margin-bottom:8px;"><span>Доставка</span><span>${fmt(shippingCost)}</span></div>` : ''}
            <div class="grand-total"><span>Итого</span><span>${fmt(order.totalAmount)}</span></div>
          </div>
        </div>
      </div>

      ${order.notes ? `<div class="info-block"><div class="section-title">Заметки</div><div style="font-size:11px;color:#555;font-weight:500;line-height:1.6;">${order.notes}</div></div>` : ''}
    </div>

    <div class="ticket-tear" style="margin-bottom: 0;">
      <div class="ticket-notch ticket-notch-left"></div>
      <div class="ticket-notch ticket-notch-right"></div>
    </div>

    <div class="receipt-footer">
      Документ сформирован ${docDateStr} (GMT+3 МСК)<br>
      errani.ru · Подтверждение заказа
    </div>
  </div>

  ${btnRow}
</body>
</html>`;
}

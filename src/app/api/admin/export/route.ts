import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Export orders to CSV/XLS format
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const type = searchParams.get('type') || 'orders';

    let content: string;
    let filename: string;
    let contentType: string;

    if (type === 'orders') {
      const orders = await prisma.order.findMany({
        include: {
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'csv') {
        const headers = ['Номер заказа', 'Клиент', 'Email', 'Телефон', 'Страна', 'Город', 'Адрес', 'Сумма', 'Валюта', 'Статус', 'Способ доставки', 'Товары', 'Дата'];
        const rows = orders.map(o => [
          o.orderNumber,
          o.customerName,
          o.customerEmail,
          o.customerPhone,
          o.country,
          o.city,
          [o.zipCode, o.street, o.house, o.apartment].filter(Boolean).join(', '),
          o.totalAmount.toString(),
          o.currency,
          o.status,
          o.shippingMethod,
          o.items.map(i => `${i.product.name} x${i.quantity}`).join('; '),
          new Date(o.createdAt).toLocaleDateString('ru-RU'),
        ]);

        // CSV with BOM for Excel compatibility
        content = '\uFEFF' + [headers, ...rows].map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
        contentType = 'text/csv; charset=utf-8';
      } else if (format === 'xls') {
        // Simple HTML table that Excel can open
        const headers = ['Номер заказа', 'Клиент', 'Email', 'Телефон', 'Страна', 'Город', 'Адрес', 'Сумма', 'Валюта', 'Статус', 'Способ доставки', 'Товары', 'Дата'];
        const headerRow = headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:8px">${h}</th>`).join('');
        const dataRows = orders.map(o => {
          const cells = [
            o.orderNumber,
            o.customerName,
            o.customerEmail,
            o.customerPhone,
            o.country,
            o.city,
            [o.zipCode, o.street, o.house, o.apartment].filter(Boolean).join(', '),
            o.totalAmount.toLocaleString('ru-RU'),
            o.currency,
            o.status,
            o.shippingMethod,
            o.items.map(i => `${i.product.name} x${i.quantity}`).join('; '),
            new Date(o.createdAt).toLocaleDateString('ru-RU'),
          ];
          return `<tr>${cells.map(c => `<td style="border:1px solid #ccc;padding:6px">${c}</td>`).join('')}</tr>`;
        }).join('');

        content = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
          <head><meta charset="UTF-8"><style>table{border-collapse:collapse;}th,td{font-family:Arial;font-size:11px;}</style></head>
          <body><table>${headerRow}${dataRows}</table></body></html>
        `;
        filename = `orders_${new Date().toISOString().split('T')[0]}.xls`;
        contentType = 'application/vnd.ms-excel';
      } else {
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
      }
    } else if (type === 'products') {
      const products = await prisma.product.findMany({ orderBy: { sortOrder: 'asc' } });

      if (format === 'csv') {
        const headers = ['Название', 'Slug', 'Описание', 'Цена', 'Валюта', 'В наличии', 'Предзаказ', 'Хит', 'Авторская', 'Порядок'];
        const rows = products.map(p => [
          p.name,
          p.slug,
          p.description.substring(0, 200),
          p.price.toString(),
          p.currency,
          p.inStock ? 'Да' : 'Нет',
          p.isPreorder ? 'Да' : 'Нет',
          p.isHit ? 'Да' : 'Нет',
          p.isAuthor ? 'Да' : 'Нет',
          p.sortOrder.toString(),
        ]);

        content = '\uFEFF' + [headers, ...rows].map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        filename = `products_${new Date().toISOString().split('T')[0]}.csv`;
        contentType = 'text/csv; charset=utf-8';
      } else if (format === 'xls') {
        const headers = ['Название', 'Slug', 'Цена', 'Валюта', 'В наличии', 'Хит', 'Авторская'];
        const headerRow = headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:8px">${h}</th>`).join('');
        const dataRows = products.map(p => {
          const cells = [p.name, p.slug, p.price.toLocaleString('ru-RU'), p.currency, p.inStock ? 'Да' : 'Нет', p.isHit ? 'Да' : 'Нет', p.isAuthor ? 'Да' : 'Нет'];
          return `<tr>${cells.map(c => `<td style="border:1px solid #ccc;padding:6px">${c}</td>`).join('')}</tr>`;
        }).join('');

        content = `<html><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse">${headerRow}${dataRows}</table></body></html>`;
        filename = `products_${new Date().toISOString().split('T')[0]}.xls`;
        contentType = 'application/vnd.ms-excel';
      } else {
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
      }
    } else if (type === 'inquiries') {
      const inquiries = await prisma.inquiry.findMany({ orderBy: { createdAt: 'desc' } });

      const headers = ['Имя', 'Email', 'Телефон', 'Сообщение', 'Статус', 'Источник', 'Дата'];
      if (format === 'csv') {
        const rows = inquiries.map(i => [
          i.name, i.email, i.phone, i.message.substring(0, 200), i.status, i.source,
          new Date(i.createdAt).toLocaleDateString('ru-RU'),
        ]);

        content = '\uFEFF' + [headers, ...rows].map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        filename = `inquiries_${new Date().toISOString().split('T')[0]}.csv`;
        contentType = 'text/csv; charset=utf-8';
      } else if (format === 'xls') {
        const headerRow = headers.map(h => `<th style="background:#f0f0f0;font-weight:bold;border:1px solid #ccc;padding:8px">${h}</th>`).join('');
        const dataRows = inquiries.map(i => {
          const cells = [i.name, i.email, i.phone, i.message.substring(0, 100), i.status, i.source, new Date(i.createdAt).toLocaleDateString('ru-RU')];
          return `<tr>${cells.map(c => `<td style="border:1px solid #ccc;padding:6px">${c}</td>`).join('')}</tr>`;
        }).join('');

        content = `<html><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse">${headerRow}${dataRows}</table></body></html>`;
        filename = `inquiries_${new Date().toISOString().split('T')[0]}.xls`;
        contentType = 'application/vnd.ms-excel';
      } else {
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

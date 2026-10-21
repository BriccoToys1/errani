import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

interface SearchResult {
  type: string;
  label: string;
  sub: string;
  href: string;
}

/** Static admin sections/settings so navigation targets are searchable too. */
const ADMIN_SECTIONS: { label: string; keywords: string; href: string }[] = [
  { label: 'Аналитика', keywords: 'аналитика дашборд выручка прибыль конверсия статус seo', href: '/admin' },
  { label: 'Почта', keywords: 'почта письма диалоги email', href: '/admin/email' },
  { label: 'Рассылки', keywords: 'рассылка newsletter', href: '/admin/email?pane=newsletters' },
  { label: 'Заказы', keywords: 'заказы orders', href: '/admin/orders' },
  { label: 'Товары', keywords: 'товары products каталог', href: '/admin/products' },
  { label: 'Галерея', keywords: 'галерея медиа фото изображения', href: '/admin/media' },
  { label: 'Заявки', keywords: 'заявки обращения inquiries', href: '/admin/inquiries' },
  { label: 'В ожидании', keywords: 'ожидание waitlist лист ожидания', href: '/admin/waitlist' },
  { label: 'Клиенты', keywords: 'клиенты покупатели customers', href: '/admin/users' },
  { label: 'Отзывы', keywords: 'отзывы reviews', href: '/admin/reviews' },
  { label: 'Настройки → Основное', keywords: 'настройки основное оформление обои стекло прозрачность мобильная навигация', href: '/admin/settings?tab=general' },
  { label: 'Настройки → Интеграции', keywords: 'интеграции resend экспорт api токен', href: '/admin/settings?tab=integrations' },
  { label: 'Настройки → Уведомления', keywords: 'уведомления звук email оповещения', href: '/admin/settings?tab=notifications' },
  { label: 'Настройки → SEO', keywords: 'seo мета robots sitemap', href: '/admin/settings?tab=seo' },
  { label: 'Настройки → Сессии', keywords: 'сессии входы безопасность', href: '/admin/settings?tab=sessions' },
  { label: 'Пользователи', keywords: 'пользователь логин пароль аккаунт', href: '/admin/account' },
  { label: 'Файлы', keywords: 'файлы files filesystem', href: '/admin/files' },
  { label: 'База данных', keywords: 'база данных database prisma', href: '/admin/database' },
];

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 1 || q.length > 200) return NextResponse.json({ results: [] });

  const search = { contains: q, mode: 'insensitive' as const };
  const enc = encodeURIComponent(q);
  const lower = q.toLowerCase();

  const settled = await Promise.allSettled([
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: search },
          { customerName: search },
          { customerEmail: search },
          { customerPhone: search },
          { country: search },
          { oblast: search },
          { city: search },
          { zipCode: search },
          { street: search },
          { house: search },
          { apartment: search },
          { entrance: search },
          { floor: search },
          { intercom: search },
          { notes: search },
          { trackNumber: search },
          { paymentMethod: search },
          { shippingMethod: search },
          { deliveryService: search },
          { paymentId: search },
          { cdekDeliveryPointCode: search },
          { cdekDeliveryPointAddress: search },
          { cdekNumber: search },
          { cdekError: search },
          { status: search },
          { items: { some: { OR: [{ selectedColor: search }, { product: { OR: [{ name: search }, { nameRu: search }, { slug: search }] } }] } } },
        ],
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true, customerName: true, totalAmount: true },
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: search },
          { nameRu: search },
          { slug: search },
          { description: search },
          { descriptionRu: search },
          { limitedEditionText: search },
          { limitedEditionTextEn: search },
          { noticeText: search },
          { noticeTextEn: search },
          { characteristics: search },
          { colors: search },
          { customBadges: search },
          { avitoUrl: search },
          { image: search },
          { images: search },
        ],
      },
      take: 8,
      select: { name: true, nameRu: true, price: true },
    }),
    prisma.inquiry.findMany({
      where: {
        OR: [
          { name: search },
          { email: search },
          { phone: search },
          { message: search },
          { source: search },
          { notes: search },
          { status: search },
          { ip: search },
        ],
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { name: true, email: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { name: search },
          { email: search },
          { phone: search },
          { city: search },
          { country: search },
          { street: search },
          { house: search },
          { apartment: search },
          { zipCode: search },
        ],
      },
      take: 6,
      select: { name: true, email: true },
    }),
    prisma.waitlistRequest.findMany({
      where: {
        OR: [
          { name: search },
          { email: search },
          { productName: search },
          { productSlug: search },
          { requestTag: search },
          { selectedColor: search },
          { status: search },
        ],
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { name: true, email: true, productName: true },
    }),
    prisma.review.findMany({
      where: {
        OR: [
          { customerName: search },
          { customerEmail: search },
          { text: search },
          { status: search },
          { moderatedBy: search },
          { media: search },
          { approvedMedia: search },
        ],
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { customerName: true, customerEmail: true, rating: true },
    }),
    prisma.adminEmail.findMany({
      where: {
        OR: [
          { subject: search },
          { fromAddr: search },
          { toAddr: search },
          { textBody: search },
          { body: search },
          { contactEmail: search },
          { threadId: search },
          { kind: search },
          { status: search },
        ],
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: { subject: true, fromAddr: true, toAddr: true, direction: true, kind: true },
    }),
    prisma.mediaAsset.findMany({
      where: {
        deletedAt: null,
        OR: [
          { filename: search },
          { relativePath: search },
          { url: search },
          { mimeType: search },
          { source: search },
        ],
      },
      take: 6,
      orderBy: { updatedAt: 'desc' },
      select: { filename: true, size: true },
    }),
    prisma.customPage.findMany({
      where: {
        OR: [
          { title: search },
          { titleRu: search },
          { slug: search },
          { content: search },
          { contentRu: search },
        ],
      },
      take: 4,
      select: { title: true, titleRu: true, slug: true },
    }),
    prisma.expense.findMany({
      where: { OR: [{ description: search }, { category: search }, { date: search }] },
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: { description: true, amount: true, category: true },
    }),
    prisma.avitoProduct.findMany({
      where: {
        OR: [
          { title: search },
          { description: search },
          { avitoId: search },
          { category: search },
          { status: search },
        ],
      },
      take: 4,
      select: { title: true, price: true, avitoId: true },
    }),
    prisma.siteSettings.findMany({
      where: { OR: [{ key: search }, { value: search }] },
      take: 4,
      select: { key: true },
    }),
    prisma.siteContent.findMany({
      where: { OR: [{ key: search }, { value: search }] },
      take: 4,
      select: { key: true },
    }),
    prisma.reviewInvite.findMany({
      where: { OR: [{ email: search }, { customerName: search }, { status: search }] },
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: { email: true, customerName: true },
    }),
  ]);

  const pick = <T,>(i: number): T[] => {
    const r = settled[i];
    return r.status === 'fulfilled' ? (r.value as T[]) : [];
  };

  type OrderRow = { orderNumber: string; customerName: string; totalAmount: number };
  type ProductRow = { name: string; nameRu: string | null; price: number };
  type ContactRow = { name: string; email: string };
  type WaitRow = { name: string; email: string; productName: string };
  type ReviewRow = { customerName: string; customerEmail: string; rating: number };
  type MailRow = { subject: string; fromAddr: string; toAddr: string; direction: string; kind: string };
  type MediaRow = { filename: string; size: number };
  type PageRow = { title: string; titleRu: string; slug: string };
  type ExpenseRow = { description: string; amount: number; category: string };
  type AvitoRow = { title: string; price: number; avitoId: string };
  type KeyRow = { key: string };
  type InviteRow = { email: string; customerName: string };

  const results: SearchResult[] = [
    ...ADMIN_SECTIONS.filter((s) => s.label.toLowerCase().includes(lower) || s.keywords.includes(lower)).map((s) => ({
      type: 'section',
      label: s.label,
      sub: '',
      href: s.href,
    })),
    ...pick<OrderRow>(0).map((o) => ({ type: 'order', label: `${o.orderNumber} — ${o.customerName}`, sub: `${o.totalAmount} ₽`, href: `/admin/orders?q=${encodeURIComponent(o.orderNumber)}` })),
    ...pick<ProductRow>(1).map((p) => ({ type: 'product', label: p.nameRu || p.name, sub: `${p.price} ₽`, href: `/admin/products?q=${encodeURIComponent(p.nameRu || p.name)}` })),
    ...pick<ContactRow>(2).map((i) => ({ type: 'inquiry', label: i.name, sub: i.email, href: `/admin/inquiries?q=${encodeURIComponent(i.email || i.name)}` })),
    ...pick<ContactRow>(3).map((u) => ({ type: 'user', label: u.name, sub: u.email, href: `/admin/users?q=${encodeURIComponent(u.email)}` })),
    ...pick<WaitRow>(4).map((w) => ({ type: 'waitlist', label: `${w.name} — ${w.productName}`, sub: w.email, href: `/admin/waitlist?q=${encodeURIComponent(w.email)}` })),
    ...pick<ReviewRow>(5).map((r) => ({ type: 'review', label: r.customerName || r.customerEmail, sub: `★ ${r.rating}`, href: `/admin/reviews?q=${encodeURIComponent(r.customerEmail)}` })),
    ...pick<MailRow>(6).map((m) => {
      const counterpart = m.direction === 'inbound' ? m.fromAddr : m.toAddr;
      return {
        type: 'email',
        label: m.subject || counterpart,
        sub: m.kind === 'newsletter' ? 'рассылка' : counterpart,
        href: m.kind === 'newsletter' ? `/admin/email?pane=newsletters&q=${enc}` : `/admin/email?q=${enc}`,
      };
    }),
    ...pick<MediaRow>(7).map((f) => ({ type: 'media', label: f.filename, sub: `${Math.round(f.size / 1024)} КБ`, href: `/admin/media` })),
    ...pick<PageRow>(8).map((p) => ({ type: 'page', label: p.titleRu || p.title, sub: `/p/${p.slug}`, href: `/admin/settings?tab=seo` })),
    ...pick<ExpenseRow>(9).map((e) => ({ type: 'expense', label: e.description, sub: `${e.amount} ₽ · ${e.category || 'расход'}`, href: `/admin` })),
    ...pick<AvitoRow>(10).map((a) => ({ type: 'avito', label: a.title, sub: `${a.price} ₽`, href: `/admin/products?q=${encodeURIComponent(a.title)}` })),
    ...pick<KeyRow>(11).map((s) => ({ type: 'setting', label: s.key, sub: 'настройка', href: `/admin/settings` })),
    ...pick<KeyRow>(12).map((s) => ({ type: 'content', label: s.key, sub: 'контент', href: `/admin/settings` })),
    ...pick<InviteRow>(13).map((i) => ({ type: 'invite', label: i.customerName || i.email, sub: i.email, href: `/admin/reviews` })),
  ];

  return NextResponse.json({ results: results.slice(0, 60) });
}

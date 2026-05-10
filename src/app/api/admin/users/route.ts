import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

const CUSTOMER_META_KEY = 'customer_profiles_meta_v1';

type CustomerMetaEntry = {
  badges: string[];
  archived?: boolean;
  archivedAt?: string | null;
};

type CustomerMetaMap = Record<string, CustomerMetaEntry>;

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function parseMeta(raw: string | null | undefined): CustomerMetaMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CustomerMetaMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function loadMeta(): Promise<CustomerMetaMap> {
  const setting = await prisma.siteSettings.findUnique({ where: { key: CUSTOMER_META_KEY } });
  return parseMeta(setting?.value);
}

async function saveMeta(meta: CustomerMetaMap) {
  await prisma.siteSettings.upsert({
    where: { key: CUSTOMER_META_KEY },
    update: { value: JSON.stringify(meta) },
    create: { key: CUSTOMER_META_KEY, value: JSON.stringify(meta) },
  });
}

interface AggregatedOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: Array<{ productName: string; quantity: number; price: number }>;
}

interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  country: string;
  city: string;
  zipCode: string;
  street: string;
  house: string;
  apartment: string;
  createdAt: string;
  updatedAt: string;
  badges: string[];
  archived: boolean;
  archivedAt: string | null;
  totalSpent: number;
  _count: { orders: number };
  orders: AggregatedOrder[];
  cartItems: Array<{ productName: string; quantity: number; price: number }>;
}

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const view = (searchParams.get('view') || 'active') as 'active' | 'archived' | 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = 24;

    const [orders, users, meta] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          country: true,
          city: true,
          zipCode: true,
          street: true,
          house: true,
          apartment: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          email: true,
          name: true,
          phone: true,
          country: true,
          city: true,
          zipCode: true,
          street: true,
          house: true,
          apartment: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      loadMeta(),
    ]);

    const byEmail = new Map<string, Profile>();

    for (const order of orders) {
      const key = normalizeEmail(order.customerEmail);
      if (!key) continue;

      const metaEntry = meta[key] || { badges: [] };
      const current = byEmail.get(key);
      if (!current) {
        byEmail.set(key, {
          id: key,
          email: key,
          name: order.customerName || key,
          phone: order.customerPhone || '',
          country: order.country || 'RU',
          city: order.city || '',
          zipCode: order.zipCode || '',
          street: order.street || '',
          house: order.house || '',
          apartment: order.apartment || '',
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.createdAt.toISOString(),
          badges: Array.isArray(metaEntry.badges) ? metaEntry.badges : [],
          archived: Boolean(metaEntry.archived),
          archivedAt: metaEntry.archivedAt || null,
          totalSpent: 0,
          _count: { orders: 0 },
          orders: [],
          cartItems: [],
        });
      }

      const profile = byEmail.get(key)!;
      profile.orders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        items: [],
      });

      profile._count.orders += 1;
      profile.totalSpent += order.totalAmount;
    }

    for (const user of users) {
      const key = normalizeEmail(user.email);
      if (!key) continue;
      const metaEntry = meta[key] || { badges: [] };
      const current = byEmail.get(key);

      if (!current) {
        byEmail.set(key, {
          id: key,
          email: key,
          name: user.name || key,
          phone: user.phone || '',
          country: user.country || 'RU',
          city: user.city || '',
          zipCode: user.zipCode || '',
          street: user.street || '',
          house: user.house || '',
          apartment: user.apartment || '',
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          badges: Array.isArray(metaEntry.badges) ? metaEntry.badges : [],
          archived: Boolean(metaEntry.archived),
          archivedAt: metaEntry.archivedAt || null,
          totalSpent: 0,
          _count: { orders: 0 },
          orders: [],
          cartItems: [],
        });
      } else {
        const profile = byEmail.get(key)!;
        profile.name = profile.name || user.name || key;
        profile.phone = profile.phone || user.phone || '';
        profile.country = profile.country || user.country || 'RU';
        profile.city = profile.city || user.city || '';
        profile.zipCode = profile.zipCode || user.zipCode || '';
        profile.street = profile.street || user.street || '';
        profile.house = profile.house || user.house || '';
        profile.apartment = profile.apartment || user.apartment || '';
      }
    }

    let profiles = Array.from(byEmail.values())
      .map((profile) => {
        const metaEntry = meta[normalizeEmail(profile.email)] || { badges: [] };
        return {
          ...profile,
          badges: Array.isArray(metaEntry.badges) ? metaEntry.badges : profile.badges,
          archived: Boolean(metaEntry.archived),
          archivedAt: metaEntry.archivedAt || null,
        };
      })
      .sort((a, b) => {
        const ad = a.orders[0]?.createdAt || a.createdAt;
        const bd = b.orders[0]?.createdAt || b.createdAt;
        return bd.localeCompare(ad);
      });

    if (view === 'active') profiles = profiles.filter((p) => !p.archived);
    if (view === 'archived') profiles = profiles.filter((p) => p.archived);

    if (search) {
      profiles = profiles.filter((p) => {
        const haystack = [
          p.name,
          p.email,
          p.phone,
          p.city,
          p.country,
          ...p.badges,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    const total = profiles.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    const usersPage = profiles.slice(start, start + limit);

    // Load order items only for orders visible on current page (max 4 per profile)
    const orderIds = Array.from(
      new Set(
        usersPage.flatMap((profile) => profile.orders.slice(0, 4).map((order) => order.id))
      )
    );

    const itemsByOrderId = new Map<string, Array<{ productName: string; quantity: number; price: number }>>();
    if (orderIds.length > 0) {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: {
          orderId: true,
          quantity: true,
          price: true,
          product: { select: { name: true, nameRu: true } },
        },
      });

      for (const item of orderItems) {
        const normalized = {
          productName: item.product?.nameRu || item.product?.name || 'Товар удалён',
          quantity: item.quantity,
          price: item.price,
        };
        const existing = itemsByOrderId.get(item.orderId);
        if (existing) {
          existing.push(normalized);
        } else {
          itemsByOrderId.set(item.orderId, [normalized]);
        }
      }
    }

    for (const profile of usersPage) {
      for (const order of profile.orders.slice(0, 4)) {
        order.items = itemsByOrderId.get(order.id) || [];
      }
      profile.cartItems = profile.orders[0]?.items || [];
    }

    return NextResponse.json({ users: usersPage, total, page: safePage, pages });
  } catch (e) {
    console.error('Users API error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const meta = await loadMeta();
    const existing = meta[email] || { badges: [], archived: false, archivedAt: null };

    if (Array.isArray(body.badges)) {
      existing.badges = Array.from(
        new Set(
          body.badges
            .map((b: unknown) => String(b || '').trim())
            .filter(Boolean)
        )
      );
    }

    if (typeof body.archived === 'boolean') {
      existing.archived = body.archived;
      existing.archivedAt = body.archived ? new Date().toISOString() : null;
    }

    if (body.purge === true) {
      if (!existing.archived) {
        return NextResponse.json({ error: 'Profile must be archived before permanent deletion' }, { status: 409 });
      }

      const ordersToDelete = await prisma.order.findMany({
        where: { customerEmail: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });

      if (ordersToDelete.length > 0) {
        const orderIds = ordersToDelete.map((o) => o.id);
        await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }

      await prisma.user.deleteMany({ where: { email: { equals: email, mode: 'insensitive' } } });
      delete meta[email];
      await saveMeta(meta);

      return NextResponse.json({ ok: true, purged: true });
    }

    meta[email] = existing;
    await saveMeta(meta);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Users PATCH error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

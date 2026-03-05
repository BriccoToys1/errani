import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

// Avito API endpoints
const AVITO_API_BASE = 'https://api.avito.ru';
const AVITO_AUTH_URL = 'https://api.avito.ru/token';

interface AvitoItem {
  id: number;
  title: string;
  price: number;
  description: string;
  images: { main: { url: string }; additional: Array<{ url: string }> };
  category: { id: number; name: string };
  status: string;
  url: string;
}

// Get Avito credentials from environment or settings
async function getAvitoCredentials() {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { key: 'avito_config' }
    });
    if (settings?.value) {
      return JSON.parse(settings.value);
    }
  } catch (e) {
    console.error('Error reading Avito settings:', e);
  }
  
  return {
    clientId: process.env.AVITO_CLIENT_ID || '',
    clientSecret: process.env.AVITO_CLIENT_SECRET || '',
    userId: process.env.AVITO_USER_ID || '',
    accessToken: '',
  };
}

// Get access token from Avito
async function getAccessToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(AVITO_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      console.error('Avito auth error:', await res.text());
      return null;
    }

    const data = await res.json();
    return data.access_token;
  } catch (e) {
    console.error('Avito auth exception:', e);
    return null;
  }
}

// Fetch items from Avito
async function fetchAvitoItems(accessToken: string, userId: string): Promise<AvitoItem[]> {
  try {
    const res = await fetch(`${AVITO_API_BASE}/core/v1/items?user_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      console.error('Avito items fetch error:', await res.text());
      return [];
    }

    const data = await res.json();
    return data.resources || [];
  } catch (e) {
    console.error('Avito items fetch exception:', e);
    return [];
  }
}

// GET: Get sync status and current Avito products
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const credentials = await getAvitoCredentials();
    const hasCredentials = !!(credentials.clientId && credentials.clientSecret && credentials.userId);
    
    // Get stored Avito products
    const avitoProducts = await prisma.avitoProduct.findMany({
      include: { product: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      configured: hasCredentials,
      hasAccessToken: !!credentials.accessToken,
      products: avitoProducts,
      lastSync: avitoProducts.length > 0 ? avitoProducts[0].updatedAt : null,
    });
  } catch (error) {
    console.error('Avito sync status error:', error);
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
  }
}

// POST: Run sync with Avito
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const credentials = await getAvitoCredentials();
    
    if (!credentials.clientId || !credentials.clientSecret || !credentials.userId) {
      return NextResponse.json({
        error: 'Avito API не настроен',
        message: 'Добавьте client_id, client_secret и user_id в настройках',
      }, { status: 400 });
    }

    // Get access token
    const accessToken = await getAccessToken(credentials.clientId, credentials.clientSecret);
    if (!accessToken) {
      return NextResponse.json({
        error: 'Не удалось авторизоваться в Avito',
        message: 'Проверьте client_id и client_secret',
      }, { status: 401 });
    }

    // Fetch items from Avito
    const items = await fetchAvitoItems(accessToken, credentials.userId);
    
    // Sync to database
    let created = 0;
    let updated = 0;

    for (const item of items) {
      const existing = await prisma.avitoProduct.findUnique({
        where: { avitoId: String(item.id) },
      });

      const imageUrls = [
        item.images?.main?.url,
        ...(item.images?.additional?.map(img => img.url) || []),
      ].filter(Boolean).join(',');

      if (existing) {
        await prisma.avitoProduct.update({
          where: { avitoId: String(item.id) },
          data: {
            title: item.title,
            price: item.price,
            description: item.description,
            images: imageUrls,
            category: item.category?.name || '',
            status: item.status,
            rawData: JSON.stringify(item),
          },
        });
        updated++;
      } else {
        await prisma.avitoProduct.create({
          data: {
            avitoId: String(item.id),
            title: item.title,
            price: item.price,
            description: item.description,
            images: imageUrls,
            category: item.category?.name || '',
            status: item.status,
            rawData: JSON.stringify(item),
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Синхронизировано: ${created} создано, ${updated} обновлено`,
      created,
      updated,
      total: items.length,
    });
  } catch (error) {
    console.error('Avito sync error:', error);
    return NextResponse.json({ error: 'Ошибка синхронизации' }, { status: 500 });
  }
}

// PUT: Link Avito product to local product
export async function PUT(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { avitoId, productId } = body;

    if (!avitoId) {
      return NextResponse.json({ error: 'avitoId is required' }, { status: 400 });
    }

    const avitoProduct = await prisma.avitoProduct.update({
      where: { avitoId },
      data: { productId: productId || null },
    });

    return NextResponse.json({
      success: true,
      product: avitoProduct,
    });
  } catch (error) {
    console.error('Avito link error:', error);
    return NextResponse.json({ error: 'Failed to link product' }, { status: 500 });
  }
}

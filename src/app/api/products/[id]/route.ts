import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

interface Params {
  params: Promise<{ id: string }>;
}

function normalizeJsonArrayString(value: unknown, fallback = '[]'): string {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? JSON.stringify(parsed) : fallback;
    } catch {
      return fallback;
    }
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  return fallback;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

// GET single product
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const product = await withPrismaRetry(() =>
      prisma.product.findUnique({
        where: { id },
      })
    );

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

// PUT update product (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();
    const stock = Number(body.stock ?? 0);
    const inStock = Boolean(body.inStock ?? true) && stock > 0;
    const slug = String(body.slug || '').trim();
    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }
    const nameRu = String(body.nameRu || '').trim();
    const name = String(body.name || '').trim();
    const descriptionRu = String(body.descriptionRu || '').trim();
    const description = String(body.description || '').trim();

    const product = await withPrismaRetry(() =>
      prisma.product.update({
        where: { id },
        data: {
        name: name || nameRu || 'Untitled product',
        nameRu: nullableString(nameRu),
        slug,
        description: description || descriptionRu || 'No description',
        descriptionRu: nullableString(descriptionRu),
        price: Number(body.price) || 0,
        oldPrice: body.oldPrice !== null && body.oldPrice !== undefined && body.oldPrice !== ''
          ? Number(body.oldPrice)
          : null,
        discount: Number(body.discount) || 0,
        currency: String(body.currency || 'RUB'),
        image: String(body.image || ''),
        images: body.images !== undefined 
          ? normalizeJsonArrayString(body.images)
          : undefined,
        stock,
        inStock,
        isPreorder: Boolean(body.isPreorder),
        preorderClosed: body.preorderClosed ?? false,
        preorderAvailableDate: body.preorderAvailableDate ? new Date(body.preorderAvailableDate) : null,
        isAuthor: Boolean(body.isAuthor),
        isLimited: Boolean(body.isLimited),
        limitedEditionText: body.limitedEditionText ?? '',
        isActive: body.isActive ?? true,
        isSaleDisabled: body.isSaleDisabled ?? false,
        isSoldOut: body.isSoldOut ?? false,
        characteristics: normalizeJsonArrayString(body.characteristics),
        colors: normalizeJsonArrayString(body.colors),
        sortOrder: Number(body.sortOrder) || 0,
        },
      })
    );

    return NextResponse.json(product);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE product (admin only) — archive instead of permanent delete
export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const hardDelete = new URL(req.url).searchParams.get('hard') === 'true';
    const product = await withPrismaRetry(() =>
      prisma.product.findUnique({ where: { id } })
    );
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (hardDelete) {
      await withPrismaRetry(() => prisma.product.delete({ where: { id } }));
      return NextResponse.json({ success: true, deleted: true, hard: true });
    }

    if (product.isActive) {
      await withPrismaRetry(() =>
        prisma.product.update({
          where: { id },
          data: { isActive: false },
        })
      );
      return NextResponse.json({ success: true, archived: true });
    }

    await withPrismaRetry(() => prisma.product.delete({ where: { id } }));
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error archiving product:', error);
    return NextResponse.json({ error: 'Failed to archive product' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

interface Params {
  params: Promise<{ id: string }>;
}

// GET single product
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
    });

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

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        nameRu: body.nameRu ?? null,
        slug: body.slug,
        description: body.description,
        descriptionRu: body.descriptionRu ?? null,
        price: body.price,
        oldPrice: body.oldPrice ?? null,
        discount: body.discount ?? 0,
        currency: body.currency,
        image: body.image,
        images: body.images !== undefined 
          ? (typeof body.images === 'string' ? body.images : JSON.stringify(body.images)) 
          : undefined,
        stock,
        inStock,
        isPreorder: body.isPreorder,
        preorderClosed: body.preorderClosed ?? false,
        preorderAvailableDate: body.preorderAvailableDate ? new Date(body.preorderAvailableDate) : null,
        isAuthor: body.isAuthor,
        isLimited: body.isLimited,
        limitedEditionText: body.limitedEditionText ?? '',
        isActive: body.isActive ?? true,
        isSaleDisabled: body.isSaleDisabled ?? false,
        isSoldOut: body.isSoldOut ?? false,
        characteristics: body.characteristics ?? '[]',
        sortOrder: body.sortOrder,
      },
    });

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
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.isActive) {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, archived: true });
    }

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error archiving product:', error);
    return NextResponse.json({ error: 'Failed to archive product' }, { status: 500 });
  }
}

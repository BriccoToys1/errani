import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendStockAvailableEmail } from '@/lib/email';

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
  try {
    const { id } = await params;
    const body = await req.json();
    const currentProduct = await prisma.product.findUnique({ where: { id } });

    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

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
        stock: body.stock ?? 0,
        inStock: body.inStock,
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

    if (!currentProduct.inStock && body.inStock === true) {
      const pendingRequests = await prisma.waitlistRequest.findMany({
        where: { productId: id, status: 'pending' },
      });

      if (pendingRequests.length > 0) {
        await Promise.all(pendingRequests.map(async (request) => {
          await sendStockAvailableEmail({
            recipientEmail: request.email,
            recipientName: request.name,
            productName: product.nameRu || product.name,
            productSlug: product.slug,
          });
        }));

        await prisma.waitlistRequest.updateMany({
          where: { productId: id, status: 'pending' },
          data: { status: 'notified' },
        });
      }
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE product (admin only) — archive instead of permanent delete
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error archiving product:', error);
    return NextResponse.json({ error: 'Failed to archive product' }, { status: 500 });
  }
}

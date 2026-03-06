import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

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
        isHit: body.isHit,
        isAuthor: body.isAuthor,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder,
      },
    });
    
    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE product (admin only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

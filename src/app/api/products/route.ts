import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET all products
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // hits, author, all
    
    let where: Record<string, unknown> = { inStock: true };
    if (filter === 'hits') where = { ...where, isHit: true };
    if (filter === 'author') where = { ...where, isAuthor: true };
    
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isHit: 'desc' }, { sortOrder: 'asc' }],
    });
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST create product (admin only)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const product = await prisma.product.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        price: body.price,
        currency: body.currency || 'RUB',
        image: body.image,
        images: JSON.stringify(body.images || []),
        inStock: body.inStock ?? true,
        isPreorder: body.isPreorder ?? false,
        isHit: body.isHit ?? false,
        isAuthor: body.isAuthor ?? false,
        sortOrder: body.sortOrder || 0,
      },
    });
    
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

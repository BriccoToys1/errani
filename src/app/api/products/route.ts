import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET all products
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // hits, author, discount, preorder, all
    const showAll = searchParams.get('showAll') === 'true'; // include out of stock
    
    // Support both ?filter=hits and ?hits=true formats
    const isHits = filter === 'hits' || searchParams.get('hits') === 'true';
    const isAuthor = filter === 'author' || searchParams.get('author') === 'true';
    const isDiscount = filter === 'discount' || searchParams.get('discount') === 'true';
    const isPreorder = filter === 'preorder' || searchParams.get('preorder') === 'true';
    
    let where: Record<string, unknown> = showAll ? {} : { inStock: true };
    if (isHits) where = { ...where, isHit: true };
    if (isAuthor) where = { ...where, isAuthor: true };
    if (isDiscount) where = { ...where, discount: { gt: 0 } };
    if (isPreorder) where = { ...where, isPreorder: true };
    
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isHit: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
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
        nameRu: body.nameRu || null,
        slug: body.slug,
        description: body.description,
        descriptionRu: body.descriptionRu || null,
        price: body.price,
        oldPrice: body.oldPrice || null,
        discount: body.discount || 0,
        currency: body.currency || 'RUB',
        image: body.image,
        images: typeof body.images === 'string' ? body.images : JSON.stringify(body.images || []),
        stock: body.stock || 0,
        inStock: body.inStock ?? true,
        isPreorder: body.isPreorder ?? false,
        isHit: body.isHit ?? false,
        isAuthor: body.isAuthor ?? false,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder || 0,
      },
    });
    
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

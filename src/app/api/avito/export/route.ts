import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Avito XML export endpoint
// This generates an Avito Autoload XML feed for bulk product import

export async function GET(req: NextRequest) {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, inStock: true },
      orderBy: { sortOrder: 'asc' },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://errani.ru';
    
    // Build XML feed
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Ads formatVersion="3" target="Avito.ru">
${products.map((product, index) => {
  // Parse images array
  let images: string[] = [];
  try {
    images = JSON.parse(product.images);
  } catch {
    images = product.image ? [product.image] : [];
  }
  if (product.image && !images.includes(product.image)) {
    images.unshift(product.image);
  }
  
  // Build image elements
  const imageElements = images.slice(0, 10).map((img, i) => {
    const url = img.startsWith('http') ? img : `${siteUrl}${img}`;
    return `      <Image url="${escapeXml(url)}" />`;
  }).join('\n');
  
  return `  <Ad>
    <Id>${product.id}</Id>
    <Title>${escapeXml(product.nameRu || product.name)}</Title>
    <Description>${escapeXml(product.descriptionRu || product.description || '')}</Description>
    <Price>${Math.round(product.price)}</Price>
    <Category>Хобби и отдых/Коллекционирование/Другое</Category>
    <Condition>Новый</Condition>
    <AdType>Товар приобретён на продажу</AdType>
    <ProductType>Другое</ProductType>
    <Images>
${imageElements}
    </Images>
    <ContactMethod>По телефону и в сообщениях</ContactMethod>
    <AvailableInStore>Да</AvailableInStore>
  </Ad>`;
}).join('\n')}
</Ads>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="avito-feed.xml"',
      },
    });
  } catch (error) {
    console.error('Avito export error:', error);
    return NextResponse.json({ error: 'Failed to generate Avito feed' }, { status: 500 });
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

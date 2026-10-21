import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Lightweight DB probe for production outages.
 * Returns no secrets — only connectivity status and a short error code/message.
 */
export async function GET() {
  const started = Date.now();
  try {
    const products = await prisma.product.count();
    const media = await prisma.mediaAsset.count();
    return NextResponse.json({
      ok: true,
      ms: Date.now() - started,
      products,
      media,
      cacheHint: 'db-live',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
    return NextResponse.json(
      {
        ok: false,
        ms: Date.now() - started,
        code: code || undefined,
        error: message.slice(0, 300),
        cacheHint: 'db-error',
      },
      { status: 503 }
    );
  }
}

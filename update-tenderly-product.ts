import prisma from './src/lib/db';
async function main() {
  const product = await prisma.product.update({
    where: { slug: 'tenderly-vibe' },
    data: {
      price: 5690,
      oldPrice: null,
      isPreorder: false,
      inStock: true,
      isSaleDisabled: false,
      preorderClosed: false,
      preorderAvailableDate: null,
      isActive: true,
    },
  });
  console.log('Updated product:', JSON.stringify(product, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

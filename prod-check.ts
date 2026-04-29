import prisma from './src/lib/db';
async function main() {
  const product = await prisma.product.findUnique({
    where: { slug: 'tenderly-vibe' },
    select: { id: true, name: true, slug: true, price: true, inStock: true, isPreorder: true, isActive: true, oldPrice: true, discount: true, isSaleDisabled: true }
  });
  console.log(JSON.stringify(product, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

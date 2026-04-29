import prisma from './src/lib/db';
async function main() {
  const products = await prisma.product.findMany({ select: { id: true, name: true, slug: true, price: true, inStock: true, isPreorder: true, isActive: true, oldPrice: true, discount: true } });
  console.log(JSON.stringify(products, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

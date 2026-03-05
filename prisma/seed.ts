import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || '@jerryjerryjerry13', 12);
  await prisma.admin.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'jerry13@errani.ru' },
    update: {
      password: hashedPassword,
      name: 'jerry13',
    },
    create: {
      email: process.env.ADMIN_EMAIL || 'jerry13@errani.ru',
      password: hashedPassword,
      name: 'jerry13',
    },
  });

  // Create products - only card decks
  const products = [
    {
      name: 'Errani Tarot — Авторская колода',
      slug: 'errani-tarot-deck',
      description: 'Авторская колода Таро от Ekaterina Errani. 78 карт, созданных с глубоким пониманием символизма и эстетики. Каждая карта — произведение искусства, наполненное энергией и смыслом. Идеально подходит как для начинающих, так и для опытных тарологов.',
      price: 4900,
      currency: 'RUB',
      image: '/media/photo-1.jpeg',
      images: JSON.stringify(['/media/photo-1.jpeg', '/media/photo-2.jpeg', '/media/photo-3.jpeg']),
      inStock: true,
      isPreorder: true,
      isHit: true,
      isAuthor: true,
      sortOrder: 1,
    },
    {
      name: 'Tenderlyvibe — Колода нежности',
      slug: 'tenderlyvibe-deck',
      description: 'Коллаборация с брендом Tenderlyvibe. Уникальная колода, объединяющая мир Таро и нежную эстетику. 78 карт с авторскими иллюстрациями в пастельных тонах.',
      price: 3900,
      currency: 'RUB',
      image: '/media/photo-4.jpeg',
      images: JSON.stringify(['/media/photo-4.jpeg', '/media/photo-5.jpeg']),
      inStock: true,
      isPreorder: false,
      isHit: false,
      isAuthor: true,
      sortOrder: 2,
    },
    {
      name: 'Классическая колода Райдера-Уэйта',
      slug: 'rider-waite-classic',
      description: 'Классическая колода Таро Райдера-Уэйта — золотой стандарт для изучения и практики. 78 карт с традиционными иллюстрациями.',
      price: 2500,
      currency: 'RUB',
      image: '/media/photo-6.jpeg',
      images: JSON.stringify(['/media/photo-6.jpeg', '/media/photo-7.jpeg']),
      inStock: true,
      isPreorder: false,
      isHit: true,
      isAuthor: false,
      sortOrder: 3,
    },
    {
      name: 'Колода Таро Тота',
      slug: 'thoth-tarot-deck',
      description: 'Колода Таро Тота Алистера Кроули — для опытных практиков. Глубокий символизм, каббалистические и астрологические соответствия.',
      price: 3200,
      currency: 'RUB',
      image: '/media/photo-8.jpeg',
      images: JSON.stringify(['/media/photo-8.jpeg']),
      inStock: true,
      isPreorder: false,
      isHit: false,
      isAuthor: false,
      sortOrder: 4,
    },
    {
      name: 'Марсельское Таро',
      slug: 'marseille-tarot',
      description: 'Историческая колода Марсельского Таро — одна из старейших традиций. Простые, но выразительные иллюстрации с глубоким символизмом.',
      price: 2800,
      currency: 'RUB',
      image: '/media/photo-9.jpeg',
      images: JSON.stringify(['/media/photo-9.jpeg', '/media/photo-10.jpeg']),
      inStock: true,
      isPreorder: false,
      isHit: false,
      isAuthor: false,
      sortOrder: 5,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product,
    });
  }

  // Create site content
  const contents = [
    {
      key: 'hero',
      value: JSON.stringify({
        title: 'errani',
        description: 'Авторская колода таро уже доступна для предзаказа. Каждая карта создана с любовью и глубоким пониманием символизма.',
        ctaText: 'Предзаказ',
        ctaLink: '/catalog/errani-tarot-deck',
        backgroundImage: '/media/photo-1.jpeg',
      }),
    },
    {
      key: 'about',
      value: JSON.stringify({
        title: 'Ekaterina Errani',
        subtitle: 'Таролог · Автор',
        text: 'Я — Ekaterina Errani, профессиональный таролог с многолетним опытом. Мой путь в мире Таро начался более 10 лет назад, и с тех пор я помогла тысячам людей найти ответы на важнейшие вопросы. Мои авторские расклады и уникальный подход к интерпретации карт помогают клиентам по всему миру обрести ясность и уверенность.',
        image: '/media/photo-2.jpeg',
      }),
    },
    {
      key: 'privacy_policy',
      value: JSON.stringify({
        title: 'Политика конфиденциальности',
        content: `<h2>1. Общие положения</h2>
<p>Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сайта errani.ru (далее — Сайт), принадлежащего ИП Эррани Е.А. (далее — Оператор).</p>

<h2>2. Сбор персональных данных</h2>
<p>Оператор собирает следующие персональные данные: имя, адрес электронной почты, номер телефона, адрес доставки, данные об оплате (обрабатываются платёжным провайдером).</p>

<h2>3. Цели обработки</h2>
<p>Персональные данные обрабатываются для: оформления и исполнения заказов, связи с клиентом, улучшения качества обслуживания, информирования об акциях и новинках (с согласия пользователя).</p>

<h2>4. Защита данных</h2>
<p>Оператор принимает необходимые организационные и технические меры для защиты персональных данных от неправомерного доступа, изменения, раскрытия или уничтожения.</p>

<h2>5. Передача данных третьим лицам</h2>
<p>Оператор не передаёт персональные данные третьим лицам, за исключением случаев, предусмотренных законодательством РФ, а также при передаче данных платёжным системам для обработки оплаты.</p>

<h2>6. Cookies</h2>
<p>Сайт использует файлы cookies для обеспечения корректной работы и улучшения пользовательского опыта.</p>

<h2>7. Права пользователя</h2>
<p>Пользователь имеет право на получение информации об обработке своих данных, их изменение или удаление. Для этого необходимо связаться с Оператором по электронной почте: info@errani.ru.</p>

<h2>8. Контакты</h2>
<p>По всем вопросам, связанным с обработкой персональных данных, обращайтесь: info@errani.ru</p>`,
      }),
    },
    {
      key: 'public_offer',
      value: JSON.stringify({
        title: 'Публичная оферта',
        content: `<h2>1. Общие положения</h2>
<p>Настоящий документ является официальным предложением (публичной офертой) ИП Эррани Е.А. (далее — Продавец) и содержит все существенные условия продажи товаров через сайт errani.ru.</p>

<h2>2. Предмет оферты</h2>
<p>Продавец обязуется передать в собственность Покупателю товар, а Покупатель обязуется оплатить и принять товар в соответствии с условиями настоящей оферты.</p>

<h2>3. Оформление заказа</h2>
<p>Покупатель оформляет заказ на сайте errani.ru путём добавления товаров в корзину и заполнения формы заказа. Оформление заказа означает полное и безоговорочное принятие условий настоящей оферты.</p>

<h2>4. Цены и оплата</h2>
<p>Цены на товары указаны на сайте в рублях РФ. Оплата производится через платёжную систему ЮKassa (для России) или банковской картой/Apple Pay/Google Pay (для других стран).</p>

<h2>5. Доставка</h2>
<p>Доставка по России: OZON, Яндекс Доставка, Почта России, СДЭК. Доставка за рубеж: Почта России (международная). Сроки и условия доставки согласуются с Покупателем после оформления и оплаты заказа.</p>

<h2>6. Возврат и обмен</h2>
<p>Возврат товара надлежащего качества возможен в течение 14 дней с момента получения.</p>

<h2>7. Предзаказ</h2>
<p>Товары, доступные для предзаказа, будут отправлены в сроки, указанные на странице товара. При задержке Продавец обязуется уведомить Покупателя.</p>

<h2>8. Контакты</h2>
<p>ИП Эррани Е.А.<br>Email: info@errani.ru<br>Сайт: errani.ru</p>`,
      }),
    },
  ];

  for (const content of contents) {
    await prisma.siteContent.upsert({
      where: { key: content.key },
      update: { value: content.value },
      create: content,
    });
  }

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

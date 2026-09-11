'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

type OfferSection = {
  title: string;
  text: string[];
};

const SECTIONS_RU: OfferSection[] = [
  {
    title: '1. Стороны договора',
    text: [
      'Продавец: Индивидуальный предприниматель Вахрушева Екатерина Михайловна, ИНН 325402793102, ОГРНИП 326320000033790 от 25 июня 2026 г., дата регистрации 25.06.2026.',
      'Покупатель: любое физическое лицо, принявшее условия настоящей публичной оферты путём оформления заказа на сайте errani.ru.',
    ],
  },
  {
    title: '2. Предмет договора',
    text: [
      'Продавец обязуется передать Покупателю товар (колоды таро, авторские и иные), выбранный на сайте errani.ru, а Покупатель обязуется принять и оплатить его в соответствии с условиями настоящей оферты.',
      'Информация о товарах, ценах и наличии отражена на сайте и является публичным предложением.',
    ],
  },
  {
    title: '3. Акцепт оферты',
    text: [
      'Акцептом настоящей оферты является оформление Покупателем заказа на сайте errani.ru, включая нажатие кнопки «Перейти к оплате» с установленными флажками согласия.',
      'Заказ считается принятым с момента подтверждения Продавцом по электронной почте.',
    ],
  },
  {
    title: '4. Цена товаров и порядок оплаты',
    text: [
      'Цены на товары указаны на страницах товаров на сайте в рублях (₽), включают все применимые налоги.',
      'Оплата производится безналичным способом через интернет-эквайринг Точка Банка. На сайте доступна оплата только через СБП.',
      'Продавец не хранит реквизиты банковских карт и платёжные данные Покупателя — все платёжные операции выполняются на стороне платёжного сервиса.',
    ],
  },
  {
    title: '5. Предзаказ',
    text: [
      'Часть товаров доступна в статусе «Предзаказ». Это означает, что товар ещё не произведён или находится в производстве; отправка производится по готовности в заявленные сроки.',
      'При оформлении предзаказа Покупатель принимает условия предоплаты и возможности изменения сроков доставки.',
      'Срок изготовления является ориентировочным и может быть изменён по причинам, не зависящим от Продавца. Продавец информирует Покупателя об изменении сроков по электронной почте.',
    ],
  },
  {
    title: '6. Доставка',
    text: [
      'Доставка осуществляется по территории России и ряда зарубежных стран.',
      'Доставка по России осуществляется компанией СДЭК: курьером до двери или до выбранного пункта выдачи.',
      'Международная доставка: Почта России и международные курьерские службы.',
      'Сроки и стоимость доставки зависят от выбранного способа и региона. Актуальная информация отображается при оформлении заказа.',
      'Обязанность Продавца по передаче товара считается исполненной с момента передачи товара перевозчику. Переход риска случайной гибели товара определяется в соответствии с законодательством Российской Федерации.',
      'Покупатель обязан проверить целостность упаковки при получении. Претензии по внешним повреждениям, возникшим при доставке, принимаются при оформлении акта с представителем службы доставки.',
    ],
  },
  {
    title: '7. Возврат и обмен товара',
    text: [
      'Покупатель вправе отказаться от товара надлежащего качества в порядке и сроки, предусмотренные ст. 26.1 Закона РФ «О защите прав потребителей». Возврат возможен при сохранении товарного вида, потребительских свойств и документов, подтверждающих покупку, за исключением случаев, предусмотренных законодательством РФ.',
      'При обнаружении недостатков товара Покупатель вправе предъявить требования в соответствии с Законом РФ «О защите прав потребителей». Требования могут быть предъявлены в пределах гарантийного срока, срока службы или разумного срока.',
      'Заказ может быть отправлен несколькими отправлениями, если это необходимо по условиям упаковки или доставки.',
      'Для инициирования возврата или предъявления претензии свяжитесь с нами по адресу mail@errani.ru, указав номер заказа и приложив фотографии.',
    ],
  },
  {
    title: '8. Ответственность сторон',
    text: [
      'Продавец несёт ответственность за соответствие товара описанию на сайте и его качество.',
      'Покупатель несёт ответственность за достоверность предоставленных при заказе данных (адрес, телефон, email).',
      'Продавец не несёт ответственности за задержки доставки, обусловленные работой транспортных или почтовых служб.',
      'Стороны освобождаются от ответственности при наступлении обстоятельств непреодолимой силы (форс-мажор). Сторона обязана уведомить другую сторону о наступлении таких обстоятельств в разумный срок.',
      'Продавец вправе отказаться от исполнения заказа при выявлении технической ошибки в цене товара или иной невозможности его исполнения с обязательным возвратом денежных средств Покупателю в полном объёме.',
    ],
  },
  {
    title: '9. Обработка персональных данных',
    text: [
      'Оформляя заказ, Покупатель соглашается на обработку своих персональных данных в соответствии с Федеральным законом №152-ФЗ «О персональных данных» и Политикой обработки персональных данных сайта errani.ru.',
      'Обработка персональных данных осуществляется в объёме, необходимом для исполнения настоящего договора.',
    ],
  },
  {
    title: '10. Контактные данные Продавца',
    text: [
      'Индивидуальный предприниматель Вахрушева Екатерина Михайловна',
      'ИНН: 325402793102',
      'ОГРНИП: 326320000033790 от 25 июня 2026 г.',
      'Дата регистрации: 25.06.2026',
      'Адрес регистрации: 242504, Россия, Брянская область, Карачевское городское поселение, деревня Масловка, Первомайская улица, 76',
      'Электронная почта: mail@errani.ru',
      'Сайт: https://errani.ru',
    ],
  },
  {
    title: '11. Банковские реквизиты Продавца',
    text: [
      'Расчётный счёт: 40802810320001046707',
      'Банк: ООО "Банк Точка"',
      'БИК: 044525104',
      'Корреспондентский счёт: 30101810745374525104',
      'Наименование получателя: Индивидуальный предприниматель Вахрушева Екатерина Михайловна',
      'ИНН получателя: 325402793102',
      'Beneficiary customer: IE Vahrusheva Ekaterina Mihaylovna',
      'Account number (RUB): 40802810320001046707',
      'SWIFT: LCTCRUMMXXX',
      'Bank identifier code: 044525104',
      'Correspondent account: 30101810745374525104',
      'Beneficiary bank: LIMITED LIABILITY COMPANY BANK TOCHKA',
      'City, country: Lane. 3rd Krutitsky, bld 11, premises 7N, Moscow, Russia, 109044',
    ],
  },
  {
    title: '12. Заключительные положения',
    text: [
      'Настоящая оферта вступает в силу с момента публикации на сайте и действует бессрочно.',
      'Продавец вправе вносить изменения в оферту. Актуальная версия всегда размещена по адресу: errani.ru/oferta. Изменения применяются только к заказам, оформленным после вступления новой редакции в силу и не затрагивают уже принятые и оплаченные заказы.',
      'Документы, направленные сторонами посредством электронной почты, имеют юридическую силу. Уведомления Продавца направляются на электронную почту, указанную Покупателем при оформлении заказа.',
      'К настоящему договору применяется законодательство Российской Федерации.',
    ],
  },
];

const SECTIONS_EN: OfferSection[] = [
  {
    title: '1. Parties to the Agreement',
    text: [
      'Seller: Individual Entrepreneur Ekaterina Mikhailovna Vakhrusheva (Вахрушева Екатерина Михайловна), TIN 325402793102, Primary State Registration Number of Individual Entrepreneur (OGRNIP) 326320000033790 dated June 25, 2026, registration date June 25, 2026.',
      'Buyer: any individual who accepts this Public Offer by placing an order on errani.ru.',
    ],
  },
  {
    title: '2. Subject of the Agreement',
    text: [
      'The Seller agrees to transfer to the Buyer the goods selected on errani.ru, including tarot decks, original works and other products, and the Buyer agrees to accept and pay for them in accordance with this Offer.',
      'Information about products, prices and availability published on the Website constitutes a public offer.',
    ],
  },
  {
    title: '3. Acceptance of the Offer',
    text: [
      'This Offer is accepted when the Buyer places an order on errani.ru, including clicking the “Proceed to Payment” button after selecting the required consent checkboxes.',
      'An order is considered accepted once the Seller confirms it by email.',
    ],
  },
  {
    title: '4. Prices and Payment',
    text: [
      'Product prices are shown on the relevant product pages in Russian rubles (RUB) and include all applicable taxes.',
      'Payment is made cashlessly through Tochka Bank online acquiring. Only the Faster Payments System (SBP) is available on the site.',
      'The Seller does not store the Buyer’s bank card details or payment credentials. All payment transactions are processed by the payment service provider.',
    ],
  },
  {
    title: '5. Pre-orders',
    text: [
      'Some products may be offered as a “Pre-order”. This means that the product has not yet been manufactured or is currently in production and will be dispatched when ready within the stated timeframe.',
      'By placing a pre-order, the Buyer accepts the prepayment terms and acknowledges that delivery dates may change.',
      'The manufacturing timeline is indicative and may change for reasons beyond the Seller\'s control. The Seller will notify the Buyer of any changes by email.',
    ],
  },
  {
    title: '6. Delivery',
    text: [
      'Delivery is available within Russia and to selected foreign countries.',
      'Delivery services within Russia include CDEK, Russian Post, Ozon Logistics and Yandex Delivery.',
      'International delivery is provided by Russian Post and international courier services.',
      'Delivery times and costs depend on the selected method and destination. Current information is displayed during checkout.',
      'The Seller\'s obligation to deliver the goods is considered fulfilled upon handover to the carrier. The transfer of risk of accidental loss or damage is governed by the laws of the Russian Federation.',
      'The Buyer must inspect the packaging upon receipt. Claims for external damage incurred during delivery must be submitted together with an inspection report drawn up with the delivery service representative.',
    ],
  },
  {
    title: '7. Returns and Exchanges',
    text: [
      'The Buyer may return goods of proper quality in accordance with the procedure and timeframes set out in Article 26.1 of the Russian Federation Law "On Consumer Rights Protection". Return is possible where the goods retain their original appearance, consumer properties and proof of purchase, except as otherwise provided by Russian law.',
      'If the goods are found to have defects, the Buyer may submit a claim in accordance with the Russian Federation Law "On Consumer Rights Protection". Claims may be made within the warranty period, service life or a reasonable period.',
      'An order may be dispatched in multiple shipments where required by packaging or delivery conditions.',
      'To initiate a return or submit a claim, email mail@errani.ru with the order number and photographs.',
    ],
  },
  {
    title: '8. Liability of the Parties',
    text: [
      'The Seller is responsible for the quality of the goods and their conformity with the description published on the Website.',
      'The Buyer is responsible for the accuracy of the information provided when placing an order, including address, telephone number and email address.',
      'The Seller is not responsible for delivery delays caused by courier, transport or postal services.',
      'Neither party is liable for failure to perform its obligations due to force majeure circumstances. A party shall notify the other party of force majeure circumstances within a reasonable time.',
      'The Seller reserves the right to cancel an order if a pricing error is discovered or fulfilment is otherwise impossible, and will refund the full amount paid by the Buyer.',
    ],
  },
  {
    title: '9. Personal Data Processing',
    text: [
      'By placing an order, the Buyer consents to the processing of personal data in accordance with Russian Federal Law No. 152-FZ “On Personal Data” and the Privacy Policy of errani.ru.',      'Personal data is processed to the extent necessary for the performance of this agreement.',    ],
  },
  {
    title: '10. Seller Contact Details',
    text: [
      'Individual Entrepreneur Ekaterina Mikhailovna Vakhrusheva (Вахрушева Екатерина Михайловна)',
      'TIN: 325402793102',
      'OGRNIP: 326320000033790 dated June 25, 2026',
      'Registration date: June 25, 2026',
      'Registered address: 242504, Russia, Bryansk region, Karachev urban settlement, village Maslovka, Pervomayskaya str., 76',
      'Email: mail@errani.ru',
      'Website: https://errani.ru',
    ],
  },
  {
    title: '11. Seller’s Bank Details',
    text: [
      'Beneficiary: IE Vahrusheva Ekaterina Mihaylovna',
      'TIN: 325402793102',
      'Account number (RUB): 40802810320001046707',
      'Beneficiary bank: LIMITED LIABILITY COMPANY BANK TOCHKA',
      'SWIFT: LCTCRUMMXXX',
      'Bank identifier code (BIC): 044525104',
      'Correspondent account: 30101810745374525104',
      'Bank address: Lane. 3rd Krutitsky, bld 11, premises 7N, Moscow, Russia, 109044',
    ],
  },
  {
    title: '12. Final Provisions',
    text: [
      'This Offer takes effect when published on the Website and remains valid indefinitely.',
      'The Seller may amend this Offer. The current version is always available at errani.ru/oferta. Amendments apply only to orders placed after the new version takes effect and do not affect orders already accepted and paid for.',
      'Documents exchanged between the parties by email have legal effect. Notifications from the Seller are sent to the email address provided by the Buyer when placing the order.',
      'This Agreement is governed by the laws of the Russian Federation.',
    ],
  },
];

export function OfertaContent() {
  const { lang } = useLanguage();
  const sections = lang === 'ru' ? SECTIONS_RU : SECTIONS_EN;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '5rem 1.5rem 6rem' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          ← {lang === 'ru' ? 'На главную' : 'Back to home'}
        </Link>
      </p>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, marginBottom: '0.5rem' }}>
        {lang === 'ru' ? 'Публичная оферта' : 'Public Offer'}
      </h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '3rem' }}>
        {lang === 'ru'
          ? 'Договор купли-продажи товаров между продавцом и покупателем.'
          : 'Sales agreement for goods between the Seller and the Buyer.'}
        <br />
        {lang === 'ru' ? 'Редакция от 26 июня 2026 г.' : 'Effective June 26, 2026.'}
      </p>

      {sections.map((section) => (
        <section key={section.title} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{section.title}</h2>
          {section.text.map((paragraph, index) => (
            <p key={index} style={{ fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <Link href="/privacy" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
          {lang === 'ru' ? 'Политика обработки персональных данных' : 'Personal Data Processing Policy'}
        </Link>
        <Link href="/catalog" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
          {lang === 'ru' ? 'Каталог товаров' : 'Product Catalog'}
        </Link>
      </div>
    </main>
  );
}

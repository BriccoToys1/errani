'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

type PrivacySection = {
  title: string;
  items: string[];
};

const PRIVACY_SECTIONS_RU: PrivacySection[] = [
  {
    title: '1. Общие положения',
    items: [
      '1.1. Настоящая Политика в отношении обработки персональных данных (далее — Политика) направлена на защиту прав и свобод физических лиц, персональные данные которых обрабатывает ИП Вахрушева Екатерина Михайловна (далее — Оператор), владелец интернет-магазина errani.ru.',
      '1.2. Политика разработана в соответствии с п. 2 ч. 1 ст. 18.1 Федерального закона от 27 июля 2006 г. № 152-ФЗ «О персональных данных» и является общедоступным документом.',
      '1.3. Используя сайт errani.ru и предоставляя персональные данные, пользователь подтверждает, что ознакомился с настоящей Политикой. В случаях, предусмотренных законодательством Российской Федерации, обработка персональных данных осуществляется на основании отдельного согласия пользователя.',
    ],
  },
  {
    title: '2. Сведения об операторе',
    items: [
      'Наименование: Индивидуальный предприниматель Вахрушева Екатерина Михайловна',
      'ИНН: 325402793102',
      'ОГРНИП: 326320000033790 от 25 июня 2026 г.',
      'Адрес регистрации: 242504, Россия, Брянская область, Карачевское городское поселение, д. Масловка, ул. Первомайская, 76',
      'Сайт: https://errani.ru',
      'Электронная почта для обращений по вопросам персональных данных: mail@errani.ru',
      '2.1. База данных информации, содержащей персональные данные граждан Российской Федерации, находится на серверах, расположенных на территории Российской Федерации.',
    ],
  },
  {
    title: '3. Принципы обработки персональных данных',
    items: [
      '3.1. Мы обрабатываем персональные данные на законной и справедливой основе.',
      '3.2. Мы собираем только те данные, которые действительно нужны для конкретной цели — никаких избыточных полей.',
      '3.3. Данные хранятся не дольше, чем это необходимо для достижения заявленной цели или требуется законодательством.',
      '3.4. Мы не продаём персональные данные третьим лицам в коммерческих целях.',
      '3.5. Оператор обрабатывает персональные данные следующих категорий субъектов: покупателей интернет-магазина; посетителей сайта; лиц, направивших обращения через формы обратной связи; лиц, оставивших отзывы на товары; лиц, подписавшихся на уведомления о поступлении товара (лист ожидания).',
      '3.6. Обработка персональных данных осуществляется с использованием средств автоматизации, а также без их использования, посредством сбора, записи, систематизации, накопления, хранения, уточнения (обновления, изменения), использования, передачи, обезличивания, блокирования, удаления и уничтожения персональных данных.',
      '3.7. В случаях, предусмотренных законодательством Российской Федерации, предоставление отдельных персональных данных является обязательным условием для заключения и исполнения договора купли-продажи.',
      '3.8. Оператор не принимает решений, порождающих юридические последствия для субъекта персональных данных, исключительно на основании автоматизированной обработки.',
      '3.9. По достижении целей обработки либо при наступлении иных оснований, предусмотренных законодательством Российской Федерации, персональные данные уничтожаются либо обезличиваются в разумные сроки.',
    ],
  },
  {
    title: '4. Что мы собираем при оформлении заказа',
    items: [
      'Когда вы оформляете заказ в нашем магазине, мы запрашиваем и обрабатываем следующие данные:',
      '— Имя и фамилия (для оформления заказа и доставки)',
      '— Адрес электронной почты (для отправки подтверждения заказа, чека и статуса доставки)',
      '— Номер телефона (для связи по вопросам доставки)',
      '— Адрес доставки: страна, город, улица, дом, квартира, подъезд, этаж, домофон (для оформления отправки через службу доставки)',
      '— Состав заказа, количество, сумма (для исполнения договора купли-продажи)',
      '— Статус оплаты и доставки (для информирования о ходе заказа)',
      'Цель обработки: исполнение договора купли-продажи — оформление, оплата, передача в доставку и сопровождение заказа.',
      'Правовое основание: договор розничной купли-продажи (ст. 6 № 152-ФЗ), а также согласие субъекта персональных данных.',
      'Срок хранения: данные заказов и связанные с ними документы хранятся не менее 5 лет в соответствии с требованиями налогового и бухгалтерского законодательства.',
    ],
  },
  {
    title: '5. Что мы собираем при оплате',
    items: [
      'Оплата заказов осуществляется через платёжный сервис ООО «Банк Точка» (эквайринг). Реквизиты банковских карт вводятся непосредственно на защищённой странице платёжного сервиса и не передаются нам — мы их не видим и не храним.',
      'Мы получаем только уведомление об успешной или неуспешной оплате и идентификатор платежа.',
      'Для заказов с оплатой через СБП (Систему быстрых платежей) данные также обрабатываются на стороне банка.',
    ],
  },
  {
    title: '6. Что мы собираем при оставлении отзыва',
    items: [
      'Когда вы оставляете отзыв о товаре или магазине, мы собираем:',
      '— Адрес электронной почты (для идентификации отзыва, не публикуется)',
      '— Оценку (1–5 звёзд)',
      '— Текст отзыва',
      '— Фотографии или видео, если вы их прикрепили',
      '— Технические сведения отправки (дата, IP-адрес — для защиты от спама)',
      'Публично на сайте отображается только: оценка, текст отзыва и медиафайлы. Имя и email не публикуются.',
      'Цель обработки: публикация отзывов на сайте для информирования других покупателей.',
      'Правовое основание: согласие субъекта персональных данных.',
      'Срок хранения: до отзыва согласия или удаления отзыва по вашему запросу.',
    ],
  },
  {
    title: '7. Что мы собираем при обращении и заявках',
    items: [
      'Если вы отправляете нам сообщение через форму обратной связи или контактный запрос, мы получаем:',
      '— Имя',
      '— Адрес электронной почты',
      '— Номер телефона (если вы его указали)',
      '— Текст вашего сообщения',
      'Цель обработки: ответ на ваш запрос, консультация, решение возникшего вопроса.',
      'Правовое основание: согласие субъекта персональных данных.',
      'Срок хранения: до достижения цели обработки, но не более 3 лет с момента получения обращения.',
    ],
  },
  {
    title: '8. Что мы собираем при подписке на лист ожидания',
    items: [
      'Если вы оставляете заявку на уведомление о появлении товара (лист ожидания), мы запрашиваем:',
      '— Адрес электронной почты (для отправки уведомления о поступлении товара)',
      '— Имя (необязательно, для персонализации письма)',
      'Цель обработки: отправить вам уведомление, когда интересующий товар снова появится в продаже.',
      'Правовое основание: согласие субъекта персональных данных.',
      'Срок хранения: до отправки уведомления или до отзыва согласия.',
    ],
  },
  {
    title: '9. Технические данные и аналитика (cookie)',
    items: [
      '9.1. Обязательные cookie и локальное хранилище браузера.',
      'Для корректной работы сайта мы используем технические cookie и локальное хранилище — без них сайт работать не будет:',
      '— Корзина: список добавленных товаров хранится локально в вашем браузере',
      '— Языковые настройки: выбранный язык интерфейса',
      '— Сессия: временный токен для защиты от CSRF-атак',
      'Эти данные не передаются на внешние серверы и удаляются при очистке браузера.',
      '9.2. Аналитика (только с вашего согласия).',
      'После того как вы нажимаете «Принять» в баннере о cookie, мы можем собирать технические сведения об использовании сайта:',
      '— IP-адрес (обезличивается)',
      '— Тип браузера и устройства',
      '— Страна и язык',
      '— Страницы, которые вы посещали',
      '— Источник перехода на сайт',
      '— Действия на сайте (клики, прокрутка)',
      'Цель: улучшение работы сайта, понимание потребностей пользователей.',
      'Вы можете отозвать согласие в любой момент, удалив cookie errani_consent через настройки браузера или повторно взаимодействуя с баннером cookie (очистка куки-файлов для errani.ru). Часть функций сайта при этом будет недоступна.',
      'Срок хранения аналитических данных: не более 1 года.',
    ],
  },
  {
    title: '10. Кому мы передаём ваши данные',
    items: [
      'Мы передаём персональные данные третьим лицам строго в объёме, необходимом для конкретной цели:',
      '— ООО «Банк Точка» — для проведения платежей по заказам',
      '— ООО «СДЭК-Глобал» (CDEK) — для организации курьерской доставки и доставки в пункты выдачи на территории России',
      '— Международные почтовые и курьерские службы — для доставки за рубеж',
      '— Хостинг-провайдер и провайдер базы данных — для хранения и обработки данных на серверах в РФ',
      '— Сервис email-рассылки — для отправки уведомлений по заказу',
      '— Государственные органы — в случаях, прямо предусмотренных законодательством РФ',
      'Все перечисленные получатели обрабатывают данные строго в рамках своих функций и не вправе использовать их в иных целях.',
      'Мы не продаём и не передаём ваши данные рекламным сетям, агрегаторам или другим третьим лицам в коммерческих целях.',
    ],
  },
  {
    title: '11. Локализация данных и трансграничная передача',
    items: [
      '11.1. Первичная запись, систематизация, накопление, хранение и извлечение персональных данных граждан Российской Федерации осуществляются с использованием баз данных, расположенных на территории Российской Федерации (ч. 5 ст. 18 № 152-ФЗ).',
      '11.2. При международной доставке заказов данные (ФИО, адрес, телефон) передаются зарубежным почтовым операторам и службам доставки в объёме, необходимом для оформления отправки. Такая передача является необходимым условием исполнения договора.',
      '11.3. Иная передача данных за пределы РФ осуществляется только при наличии соответствующего правового основания и с соблюдением требований ст. 12 № 152-ФЗ.',
    ],
  },
  {
    title: '12. Безопасность персональных данных',
    items: [
      'Для защиты ваших данных мы применяем следующие меры:',
      '— Весь обмен данными между вашим браузером и нашим сервером зашифрован по протоколу HTTPS/TLS',
      '— Административная панель сайта защищена авторизацией с JWT-токенами и ограничением прав доступа',
      '— Доступ к базе данных ограничен и не открыт в публичную сеть',
      '— Реквизиты банковских карт на нашем сервере не хранятся — все платёжные операции проходят через сертифицированный платёжный шлюз',
      '— Ежедневное резервное копирование данных',
      '— Журналирование критически важных действий в административной части',
      '— Формы защищены от SQL-инъекций и XSS-атак на уровне архитектуры приложения',
    ],
  },
  {
    title: '13. Ваши права как субъекта персональных данных',
    items: [
      'В соответствии с законодательством РФ вы имеете право:',
      '— Получить информацию о том, какие ваши данные обрабатываются, откуда они получены, для каких целей и как долго хранятся',
      '— Потребовать исправления неточных или устаревших данных',
      '— Отозвать согласие на обработку в любой момент — это не влияет на законность уже проведённой обработки',
      '— Потребовать удаления («забвения») ваших данных — при условии, что отсутствуют законные основания для дальнейшего хранения',
      '— Потребовать ограничения обработки (блокирования) на период рассмотрения ваших возражений',
      '— Обжаловать наши действия или бездействие в Роскомнадзор (rkn.gov.ru) или в суд',
      'Как воспользоваться правами: направьте запрос на mail@errani.ru. Укажите ваше ФИО, контактные данные и суть обращения. Мы рассматриваем запросы в сроки, предусмотренные ст. 20–22 № 152-ФЗ.',
    ],
  },
  {
    title: '14. Срок действия и изменение Политики',
    items: [
      '14.1. Настоящая Политика действует бессрочно с момента её публикации на сайте.',
      '14.2. Оператор вправе вносить изменения в Политику. Актуальная редакция всегда размещается по адресу errani.ru/privacy.',
      '14.3. Новая редакция Политики вступает в силу с момента её размещения на сайте, если иное не предусмотрено законодательством Российской Федерации.',
      'Дата актуальной редакции: 26 июля 2026 г.',
    ],
  },
];

const PRIVACY_SECTIONS_EN: PrivacySection[] = [
  {
    title: '1. General Provisions',
    items: [
      '1.1. This Personal Data Processing Policy (the "Policy") is aimed at protecting the rights and freedoms of individuals whose personal data is processed by IE Ekaterina Vakhrusheva (the "Operator"), owner of the errani.ru online store.',
      '1.2. The Policy has been developed in accordance with clause 2, part 1, article 18.1 of Federal Law No. 152-FZ of 27 July 2006 "On Personal Data" and is a publicly available document.',
      '1.3. By using errani.ru and submitting personal data, the user confirms that they have read this Policy. Where required by Russian law, processing of personal data is carried out on the basis of a separate consent from the user.',
    ],
  },
  {
    title: '2. Data Controller Details',
    items: [
      'Name: Individual Entrepreneur Ekaterina Mikhailovna Vakhrusheva',
      'TIN: 325402793102',
      'OGRNIP: 326320000033790 dated June 25, 2026',
      'Registered address: 242504, Russia, Bryansk region, Karachev urban settlement, village Maslovka, Pervomayskaya str., 76',
      'Website: https://errani.ru',
      'Email for personal data enquiries: mail@errani.ru',
      '2.1. Databases containing personal data of Russian citizens are located on servers situated in the Russian Federation.',
    ],
  },
  {
    title: '3. Data Processing Principles',
    items: [
      '3.1. We process personal data on a lawful and fair basis.',
      '3.2. We collect only the data that is genuinely necessary for a specific purpose — no excessive fields.',
      '3.3. Data is not retained longer than necessary to achieve the stated purpose or as required by law.',
      '3.4. We do not sell personal data to third parties for commercial purposes.',
      '3.5. The Operator processes personal data of the following categories of data subjects: online store customers; website visitors; individuals who submitted enquiries via contact forms; individuals who left product reviews; individuals who subscribed to back-in-stock notifications (waitlist).',
      '3.6. Personal data is processed both by automated means and without the use of automation, through collection, recording, systematisation, accumulation, storage, updating (modification), use, transfer, depersonalisation, blocking, deletion and destruction.',
      '3.7. Where required by Russian law, providing certain personal data is a necessary condition for entering into and performing the purchase agreement.',
      '3.8. The Operator does not make decisions that have legal consequences for a data subject solely on the basis of automated processing.',
      '3.9. When processing purposes are achieved or other grounds provided by Russian law arise, personal data is destroyed or depersonalised within a reasonable period.',
    ],
  },
  {
    title: '4. Data Collected When Placing an Order',
    items: [
      'When you place an order in our store, we request and process the following data:',
      '— Name and surname (for order processing and delivery)',
      '— Email address (for order confirmation, receipt and delivery status notifications)',
      '— Phone number (for delivery-related communication)',
      '— Delivery address: country, city, street, building, apartment, entrance, floor, intercom (to arrange shipment via the delivery service)',
      '— Order contents, quantities and total amount (to fulfil the purchase agreement)',
      '— Payment and delivery status (to keep you informed about your order)',
      'Purpose: fulfilment of the retail purchase agreement — order processing, payment, handover to delivery, and order support.',
      'Legal basis: retail sale contract (Art. 6, Federal Law No. 152-FZ) and data subject consent.',
      'Retention period: order data and related documents are retained for at least 5 years in accordance with tax and accounting legislation.',
    ],
  },
  {
    title: '5. Data Processed During Payment',
    items: [
      'Payments are processed by Tochka Bank LLC. Card details are not used on this site; payments are made through the Faster Payments System (SBP).',
      'We only receive a notification of successful or unsuccessful payment and a payment identifier.',
      'For orders paid via the Faster Payments System (SBP), data is also processed solely by the bank.',
    ],
  },
  {
    title: '6. Data Collected When Leaving a Review',
    items: [
      'When you submit a product or store review, we collect:',
      '— Email address (for review identification, not published publicly)',
      '— Rating (1–5 stars)',
      '— Review text',
      '— Photos or videos, if you attach them',
      '— Technical submission details (date, IP address — for spam protection)',
      'Published publicly on the website: rating, review text, and media files only. Your name and email are never shown.',
      'Purpose: publishing reviews on the website to inform other customers.',
      'Legal basis: data subject consent.',
      'Retention period: until consent is withdrawn or the review is deleted upon your request.',
    ],
  },
  {
    title: '7. Data Collected via Contact Forms',
    items: [
      'If you send us a message via the contact or enquiry form, we receive:',
      '— Name',
      '— Email address',
      '— Phone number (if provided)',
      '— Message text',
      'Purpose: responding to your enquiry, providing consultation, resolving your question.',
      'Legal basis: data subject consent.',
      'Retention period: until the purpose is achieved, but no longer than 3 years from receipt of the enquiry.',
    ],
  },
  {
    title: '8. Data Collected for the Waitlist',
    items: [
      'If you sign up to be notified when a product is back in stock (waitlist), we request:',
      '— Email address (to send you a back-in-stock notification)',
      '— Name (optional, for personalising the email)',
      'Purpose: sending you a notification when the product becomes available again.',
      'Legal basis: data subject consent.',
      'Retention period: until the notification is sent or consent is withdrawn.',
    ],
  },
  {
    title: '9. Technical Data and Analytics (Cookies)',
    items: [
      '9.1. Essential cookies and browser local storage.',
      'For the website to function correctly we use technical cookies and local storage — the site cannot work without them:',
      '— Shopping cart: the list of added items is stored locally in your browser',
      '— Language preference: your selected interface language',
      '— Session: a temporary token for CSRF protection',
      'This data is not transmitted to external servers and is deleted when you clear your browser.',
      '9.2. Analytics (only with your consent).',
      'After you click "Accept" in the cookie banner, we may collect technical information about how you use the website:',
      '— IP address (anonymised)',
      '— Browser and device type',
      '— Country and language',
      '— Pages you visited',
      '— Traffic source (how you arrived at the site)',
      '— On-site behaviour (clicks, scrolling)',
      'Purpose: improving the website and understanding user needs.',
      'You may withdraw consent at any time by deleting the errani_consent cookie via your browser settings or by clearing cookies for errani.ru. Some website features may become unavailable.',
      'Analytics data retention: up to 1 year.',
    ],
  },
  {
    title: '10. Who We Share Your Data With',
    items: [
      'We share personal data with third parties strictly to the extent required for a specific purpose:',
      '— Tochka Bank LLC — for processing order payments',
      '— CDEK (СДЭК-Глобал LLC) — for arranging courier and pickup-point delivery within Russia',
      '— International postal and courier services — for delivery abroad',
      '— Hosting provider and database provider — for data storage and processing on servers in Russia',
      '— Email notification service — for sending order status emails',
      '— Government authorities — in cases expressly provided for by Russian law',
      'All listed recipients process data strictly within the scope of their functions and may not use it for any other purpose.',
      'We do not sell or share your data with advertising networks, data brokers or any other third parties for commercial purposes.',
    ],
  },
  {
    title: '11. Data Localisation and Cross-Border Transfers',
    items: [
      '11.1. Primary recording, systematisation, accumulation, storage and retrieval of personal data of Russian citizens is performed using databases located in the Russian Federation (Art. 18, part 5, Federal Law No. 152-FZ).',
      '11.2. For international deliveries, data (name, address, phone) is shared with overseas postal operators and delivery services to the extent required for the shipment. Such transfer is a necessary condition for fulfilling the purchase agreement.',
      '11.3. Any other transfer of data outside the Russian Federation is performed only where a legal basis exists and in compliance with Art. 12 of Federal Law No. 152-FZ.',
    ],
  },
  {
    title: '12. Data Security',
    items: [
      'To protect your data we apply the following measures:',
      '— All data exchange between your browser and our server is encrypted using HTTPS/TLS',
      '— The website admin panel is protected by JWT-token authentication with role-based access control',
      '— Database access is restricted and not exposed to the public network',
      '— Bank card credentials are never stored on our server — all payment operations go through a certified payment gateway',
      '— Daily data backups',
      '— Audit logging of critical administrative actions',
      '— Forms are protected against SQL injection and XSS attacks at the application architecture level',
    ],
  },
  {
    title: '13. Your Rights as a Data Subject',
    items: [
      'Under Russian law you have the right to:',
      '— Receive information about which of your data is being processed, where it came from, for what purposes and for how long it is retained',
      '— Request correction of inaccurate or outdated data',
      '— Withdraw consent to processing at any time — this does not affect the lawfulness of processing already carried out',
      '— Request deletion ("right to be forgotten") of your data — provided there are no legal grounds for further retention',
      '— Request restriction (blocking) of processing while your objections are being considered',
      '— Lodge a complaint with Roskomnadzor (rkn.gov.ru) or a court',
      'How to exercise your rights: send a request to mail@errani.ru. Please state your full name, contact details and the nature of your request. We handle requests within the timeframes set out in Articles 20–22 of Federal Law No. 152-FZ.',
    ],
  },
  {
    title: '14. Duration and Updates to This Policy',
    items: [
      '14.1. This Policy is effective indefinitely from the date of its publication on the website.',
      '14.2. The Operator may amend this Policy. The current version is always available at errani.ru/privacy.',
      '14.3. An updated version of the Policy takes effect upon its publication on the website, unless otherwise required by Russian law.',
      'Current version date: July 26, 2026.',
    ],
  },
];

export default function PrivacyPage() {
  const { lang } = useLanguage();
  const sections = lang === 'ru' ? PRIVACY_SECTIONS_RU : PRIVACY_SECTIONS_EN;

  return (
    <main className="privacy-page">
      <div className="privacy-container">
        <h1 className="privacy-heading anim-fade-up">{t(lang, 'privacy.title')}</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
          {lang === 'ru' ? 'Соответствует 152-ФЗ · Редакция от 26 июля 2026 г.' : 'Complies with FZ-152 · Effective July 26, 2026'}
        </p>

        <div className="privacy-content">
          {sections.map((section, i) => (
            <div key={i} className="privacy-section anim-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <h2 className="privacy-section-title">{section.title}</h2>
              <div className="privacy-section-text">
                {section.items.map((item, j) => (
                  <p key={j} style={{ marginBottom: '0.5rem' }}>{item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Link href="/oferta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
            {lang === 'ru' ? 'Публичная оферта' : 'Public Offer'}
          </Link>
          <Link href="/catalog" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
            {lang === 'ru' ? 'Каталог товаров' : 'Product Catalog'}
          </Link>
        </div>

        <div className="privacy-back anim-fade-up" style={{ marginTop: '1.5rem' }}>
          <Link href="/" className="privacy-back-link">
            ← {lang === 'ru' ? 'На главную' : 'Back to home'}
          </Link>
        </div>
      </div>
    </main>
  );
}


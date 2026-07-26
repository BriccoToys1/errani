'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

const PRIVACY_SECTIONS_RU = [
  {
    title: '1. Оператор персональных данных',
    text: 'Оператором персональных данных является Индивидуальный предприниматель Вахрушева Екатерина Михайловна, ИНН 325402793102, ОГРНИП 326320000033790 от 25.06.2026, адрес регистрации: 242504, Россия, Брянская область, Карачевское городское поселение, деревня Масловка, Первомайская улица, 76, сайт: errani.ru, email для обращений субъектов персональных данных: mail@errani.ru. Настоящая Политика определяет порядок и условия обработки персональных данных Оператором в соответствии с Федеральным законом от 27.07.2006 №152-ФЗ «О персональных данных».',
  },
  {
    title: '2. Категории субъектов персональных данных',
    text: 'Оператор обрабатывает персональные данные посетителей сайта, покупателей, получателей заказов, лиц, оставивших заявку, обращение, подписку или отзыв, а также представителей контрагентов, если такие данные предоставлены через сайт или при исполнении заказа.',
  },
  {
    title: '3. Цели обработки и состав персональных данных',
    text: 'Для оформления, оплаты, доставки и сопровождения заказа обрабатываются: фамилия, имя, отчество при наличии, email, телефон, адрес доставки, состав заказа, сумма заказа, статус оплаты и доставки. Для обратной связи и заявок обрабатываются: имя, email, телефон при наличии и содержание сообщения. Для отзывов обрабатываются: email, оценка, текст отзыва, прикреплённые медиа, технические сведения отправки; публичная публикация отзывов осуществляется без имени. Для работы сайта и аналитики после согласия на cookie могут обрабатываться: IP-адрес, cookie-идентификатор, сведения о браузере, устройстве, языке, часовой зоне, страницах, источнике перехода и действиях на сайте.',
  },
  {
    title: '4. Правовые основания обработки',
    text: 'Правовыми основаниями обработки являются согласие субъекта персональных данных, договор розничной купли-продажи и действия до заключения договора, Федеральный закон №152-ФЗ «О персональных данных», законодательство о бухгалтерском учёте, налогах, защите прав потребителей, связи и электронной коммерции, а также иные применимые нормативные акты Российской Федерации.',
  },
  {
    title: '5. Действия с персональными данными и способы обработки',
    text: 'Оператор совершает следующие действия с персональными данными: сбор, запись, систематизация, накопление, хранение, уточнение, обновление, изменение, извлечение, использование, передача в случаях, указанных в Политике, обезличивание, блокирование, удаление и уничтожение. Обработка ведётся смешанным способом: автоматизированно с использованием сайта, CRM/административной панели, базы данных и сервисов доставки/оплаты, а также без использования средств автоматизации при обработке обращений и документов.',
  },
  {
    title: '6. Передача персональных данных третьим лицам',
    text: 'Персональные данные могут передаваться только в объёме, необходимом для заявленных целей: платёжным провайдерам и банкам для оплаты; службам доставки, включая СДЭК, для доставки; почтовым и email-сервисам для уведомлений; хостинг-провайдерам, провайдерам базы данных и техническим подрядчикам для обеспечения работы сайта; государственным органам в случаях, предусмотренных законом. Оператор не продаёт персональные данные.',
  },
  {
    title: '7. Локализация, трансграничная передача и хранение',
    text: 'Первичная запись, систематизация, накопление, хранение, уточнение и извлечение персональных данных граждан Российской Федерации осуществляются с использованием баз данных, находящихся на территории Российской Федерации, если иное не допускается законодательством. При использовании отдельных технических сервисов возможна передача данных за пределы РФ только при наличии правового основания и соблюдении требований закона. Сроки хранения: данные заказов и документы, связанные с исполнением договора, хранятся не менее сроков, установленных законодательством; обращения — до достижения цели обработки и не более 3 лет; аналитические cookie-данные — до 1 года; отзывы — до отзыва согласия или удаления публикации, если иной срок не требуется законом.',
  },
  {
    title: '8. Защита персональных данных',
    text: 'Оператор принимает необходимые правовые, организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, предоставления, распространения и иных неправомерных действий. В частности используются HTTPS/TLS, разграничение прав доступа, авторизация администраторов, ограничение доступа к базе данных, резервное копирование и журналирование значимых действий. Платёжные реквизиты банковских карт не хранятся на сервере сайта.',
  },
  {
    title: '9. Права субъекта персональных данных',
    text: 'Субъект персональных данных вправе получать сведения об обработке своих персональных данных, требовать их уточнения, блокирования или уничтожения, отзывать согласие на обработку, требовать прекращения обработки, а также обжаловать действия или бездействие Оператора в Роскомнадзор или суд. Для реализации прав направьте запрос на mail@errani.ru. Оператор рассматривает обращения в сроки, предусмотренные законодательством РФ.',
  },
  {
    title: '10. Cookie-файлы',
    text: 'Сайт использует необходимые cookie и локальное хранилище для работы корзины, языковых настроек и сессии. Аналитические cookie и техническая аналитика используются после согласия пользователя. Пользователь может отключить или удалить cookie в настройках браузера, однако часть функций сайта может работать некорректно.',
  },
  {
    title: '11. Актуализация, блокирование и уничтожение',
    text: 'При достижении целей обработки, отзыве согласия, выявлении неправомерной обработки или истечении срока хранения персональные данные подлежат блокированию, удалению, уничтожению или обезличиванию в порядке и сроки, предусмотренные законодательством РФ, если дальнейшее хранение не требуется законом или договором.',
  },
  {
    title: '12. Изменение Политики',
    text: 'Оператор вправе изменять настоящую Политику. Актуальная редакция размещается в свободном доступе по адресу errani.ru/privacy. Дата актуальной редакции: 26 июля 2026 г.',
  },
];

const PRIVACY_SECTIONS_EN = [
  {
    title: '1. Data Controller',
    text: 'The data controller is Individual Entrepreneur Ekaterina Vakhrusheva, TIN 325402793102, OGRNIP 326320000033790 dated June 25, 2026, registered address: 242504, Russia, Bryansk region, Karachev urban settlement, village Maslovka, Pervomayskaya str., 76, website: errani.ru, contact email: mail@errani.ru. This Policy describes the processing of personal data under Russian Federal Law No. 152-FZ "On Personal Data".',
  },
  {
    title: '2. Data Subjects',
    text: 'The Operator processes personal data of website visitors, customers, order recipients, people submitting requests, messages, subscriptions or reviews, and representatives of counterparties where such data is provided through the website or during order fulfilment.',
  },
  {
    title: '3. Purposes and Data Categories',
    text: 'For order placement, payment, delivery and support, the Operator processes name, email, phone, delivery address, order contents, payment and delivery status. For requests, the Operator processes name, email, phone if provided and message contents. Reviews are published without names. Technical analytics may include IP address, cookie identifier, browser, device, language, timezone, pages, referrer and website actions after cookie consent.',
  },
  {
    title: '4. Legal Basis',
    text: 'Processing is based on consent, the retail sale contract or steps prior to entering into it, Russian Federal Law No. 152-FZ and applicable Russian consumer protection, accounting, tax, communications and e-commerce laws.',
  },
  {
    title: '5. Processing Operations',
    text: 'The Operator may collect, record, systematise, accumulate, store, update, retrieve, use, transfer where permitted, depersonalise, block, delete and destroy personal data by automated and non-automated means.',
  },
  {
    title: '6. Third-Party Transfers',
    text: 'Personal data may be transferred only as required for the stated purposes: payment providers and banks, delivery providers including CDEK, email services, hosting/database/technical providers and public authorities where required by law. The Operator does not sell personal data.',
  },
  {
    title: '7. Storage and Cross-Border Transfers',
    text: 'Primary recording, systematisation, accumulation, storage, updating and retrieval of Russian citizens\' personal data are performed using databases located in Russia where required by law. Cross-border transfers may occur only where legally permitted. Retention depends on the processing purpose and applicable legal obligations.',
  },
  {
    title: '8. Data Protection',
    text: 'The Operator applies legal, organisational and technical measures including HTTPS/TLS, access control, administrator authentication, restricted database access, backups and logging. Bank card credentials are not stored on the website server.',
  },
  {
    title: '9. Your Rights',
    text: 'You may request information about processing, correction, blocking or deletion of your personal data, withdraw consent, request termination of processing, and complain to Roskomnadzor or a court. Send requests to mail@errani.ru.',
  },
  {
    title: '10. Cookies',
    text: 'The website uses necessary cookies and local storage for cart, language preferences and session functionality. Analytics cookies are used after consent. You can disable or delete cookies in browser settings.',
  },
  {
    title: '11. Updates and Deletion',
    text: 'When processing purposes are achieved, consent is withdrawn, unlawful processing is identified or retention periods expire, personal data is blocked, deleted, destroyed or depersonalised unless further retention is required by law or contract.',
  },
  {
    title: '12. Policy Updates',
    text: 'The Operator may update this Policy. The current version is available at errani.ru/privacy. Current version date: July 26, 2026.',
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
              <p className="privacy-section-text">{section.text}</p>
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

'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

const PRIVACY_SECTIONS_RU = [
  {
    title: '1. Оператор персональных данных',
    text: 'Оператором персональных данных на сайте errani.ru является самозанятый Вахрушева Екатерина Михайловна, ИНН 325402793102 (далее — «Оператор»). Настоящая Политика разработана в соответствии с Федеральным законом №152-ФЗ «О персональных данных».',
  },
  {
    title: '2. Какие данные мы собираем',
    text: 'При оформлении заказа или заполнении форм на сайте мы собираем: имя и фамилию, адрес электронной почты, номер телефона, адрес доставки (страна, регион, город, индекс, улица, дом, квартира). Автоматически собираются технические данные: IP-адрес, тип и язык браузера, дата и время визита, просмотренные страницы, cookie-файлы.',
  },
  {
    title: '3. Цели обработки данных',
    text: 'Персональные данные обрабатываются исключительно для: оформления, подтверждения и доставки заказов; связи с покупателем по вопросам заказа; улучшения работы Сайта; соблюдения требований законодательства РФ.',
  },
  {
    title: '4. Основание обработки',
    text: 'Обработка персональных данных осуществляется на основании согласия субъекта персональных данных (ст. 6 ФЗ-152), а также в целях исполнения договора купли-продажи, стороной которого является субъект персональных данных.',
  },
  {
    title: '5. Cookie-файлы',
    text: 'Сайт использует cookie-файлы для корректной работы, сохранения языковых предпочтений и содержимого корзины. Cookie не содержат персональных данных в явном виде. Вы можете отключить cookie в настройках браузера, однако это может повлиять на функциональность сайта.',
  },
  {
    title: '6. Передача данных третьим лицам',
    text: 'Мы не продаём и не передаём персональные данные третьим лицам, за исключением: служб доставки — для исполнения заказа; платёжного сервиса ЮKassa — для проведения платежа; органов государственной власти — по основаниям, предусмотренным законодательством.',
  },
  {
    title: '7. Хранение данных',
    text: 'Персональные данные хранятся на серверах, расположенных на территории Российской Федерации и в Европейском Союзе (Neon.tech, соответствует GDPR). Срок хранения: данные заказов — 5 лет; данные аналитики — 1 год.',
  },
  {
    title: '8. Защита данных',
    text: 'Оператор принимает технические и организационные меры для защиты персональных данных: соединение зашифровано по протоколу HTTPS/TLS; доступ к базе данных ограничен; платёжные реквизиты не хранятся на сервере сайта.',
  },
  {
    title: '9. Права субъекта персональных данных',
    text: 'Вы вправе: получить информацию об обрабатываемых персональных данных; потребовать их уточнения, блокирования или уничтожения; отозвать согласие на обработку; обжаловать действия Оператора в Роскомнадзор. Для реализации прав направьте запрос на mail@errani.ru.',
  },
  {
    title: '10. Изменения в Политике',
    text: 'Оператор вправе вносить изменения в настоящую Политику. Актуальная версия всегда доступна по адресу errani.ru/privacy. Продолжая пользоваться сайтом после изменений, вы выражаете согласие с обновлённой редакцией.',
  },
  {
    title: '11. Контактная информация',
    text: 'По вопросам обработки персональных данных: mail@errani.ru. Самозанятый Вахрушева Екатерина Михайловна, ИНН 325402793102.',
  },
];

const PRIVACY_SECTIONS_EN = [
  {
    title: '1. Data Controller',
    text: 'The data controller for errani.ru is self-employed Ekaterina Vakhrusheva (Вахрушева Екатерина Михайловна), TIN 325402793102 ("Operator"). This Policy is developed in accordance with Russian Federal Law No. 152-FZ "On Personal Data".',
  },
  {
    title: '2. Data We Collect',
    text: 'When placing an order or filling out forms, we collect: full name, email address, phone number, delivery address (country, region, city, postal code, street, house, apartment). Technical data is collected automatically: IP address, browser type and language, visit date and time, pages viewed, cookies.',
  },
  {
    title: '3. Purpose of Processing',
    text: 'Personal data is processed exclusively for: processing, confirming and delivering orders; contacting customers about orders; improving the Website; compliance with applicable law.',
  },
  {
    title: '4. Legal Basis',
    text: 'Data processing is based on the user\'s consent (Art. 6 FZ-152) and the necessity to perform the sales contract to which the user is a party.',
  },
  {
    title: '5. Cookies',
    text: 'The website uses cookies for correct operation, saving language preferences and cart contents. Cookies do not contain personal data in plain form. You can disable cookies in your browser settings, but this may affect website functionality.',
  },
  {
    title: '6. Third-Party Sharing',
    text: 'We do not sell or transfer personal data to third parties, except: delivery services — to fulfil the order; YuKassa payment service — to process payment; government authorities — as required by law.',
  },
  {
    title: '7. Data Storage',
    text: 'Personal data is stored on servers located in Russia and the EU (Neon.tech, GDPR-compliant). Retention: order data — 5 years; analytics data — 1 year.',
  },
  {
    title: '8. Data Protection',
    text: 'The Operator applies technical and organisational measures: HTTPS/TLS encryption; restricted database access; payment credentials are not stored on the website server.',
  },
  {
    title: '9. Your Rights',
    text: 'You have the right to: access your personal data; request correction, blocking or deletion; withdraw consent; file a complaint with a supervisory authority. To exercise your rights, send a request to mail@errani.ru.',
  },
  {
    title: '10. Policy Updates',
    text: 'The Operator may update this Policy. The current version is always available at errani.ru/privacy. Continued use of the website after changes constitutes acceptance of the updated Policy.',
  },
  {
    title: '11. Contact',
    text: 'For data protection queries: mail@errani.ru. Self-employed Ekaterina Vakhrusheva, TIN 325402793102.',
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
          {lang === 'ru' ? 'Соответствует 152-ФЗ · Редакция от 9 марта 2026 г.' : 'Complies with FZ-152 · Effective March 9, 2026'}
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

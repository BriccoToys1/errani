'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';

const PRIVACY_SECTIONS_RU = [
  {
    title: '1. Общие положения',
    text: 'Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сайта errani.ru (далее — «Сайт»), принадлежащего индивидуальному предпринимателю Ekaterina Errani (далее — «Оператор»). Используя Сайт, вы соглашаетесь с условиями данной Политики.',
  },
  {
    title: '2. Какие данные мы собираем',
    text: 'Мы можем собирать следующие персональные данные: имя, адрес электронной почты, номер телефона, адрес доставки, страна и город проживания. Также автоматически собираются технические данные: IP-адрес, тип браузера, язык браузера, дата и время визита, просмотренные страницы.',
  },
  {
    title: '3. Цели обработки данных',
    text: 'Персональные данные обрабатываются для: оформления и доставки заказов, связи с клиентами по вопросам заказов, улучшения работы Сайта и пользовательского опыта, выполнения требований законодательства.',
  },
  {
    title: '4. Cookie-файлы',
    text: 'Сайт использует cookie-файлы для обеспечения корректной работы, сохранения языковых предпочтений и содержимого корзины. Вы можете отключить cookie в настройках браузера, однако это может повлиять на функциональность Сайта.',
  },
  {
    title: '5. Передача данных третьим лицам',
    text: 'Мы не продаём, не обмениваем и не передаём ваши персональные данные третьим лицам, за исключением случаев, необходимых для доставки заказа (курьерские службы) или выполнения требований законодательства.',
  },
  {
    title: '6. Защита данных',
    text: 'Мы принимаем организационные и технические меры для защиты персональных данных от несанкционированного доступа, изменения, раскрытия или уничтожения. Данные хранятся на защищённых серверах.',
  },
  {
    title: '7. Права пользователей',
    text: 'Вы имеете право: запросить информацию о ваших персональных данных, потребовать их исправления или удаления, отозвать согласие на обработку данных. Для этого свяжитесь с нами по электронной почте.',
  },
  {
    title: '8. Срок хранения данных',
    text: 'Персональные данные хранятся в течение срока, необходимого для достижения целей обработки, но не менее срока, установленного законодательством.',
  },
  {
    title: '9. Изменения в Политике',
    text: 'Оператор оставляет за собой право вносить изменения в настоящую Политику. Актуальная версия всегда доступна на данной странице.',
  },
  {
    title: '10. Контакты',
    text: 'По вопросам, связанным с обработкой персональных данных, обращайтесь: errani.site@gmail.com',
  },
];

const PRIVACY_SECTIONS_EN = [
  {
    title: '1. General Provisions',
    text: 'This Privacy Policy outlines how personal data of users of errani.ru ("Website") is processed and protected by Ekaterina Errani ("Operator"). By using the Website, you agree to this Policy.',
  },
  {
    title: '2. Data We Collect',
    text: 'We may collect the following personal data: name, email address, phone number, shipping address, country and city of residence. Technical data is also collected automatically: IP address, browser type, browser language, visit date and time, pages viewed.',
  },
  {
    title: '3. Purpose of Data Processing',
    text: 'Personal data is processed for: placing and delivering orders, contacting customers regarding orders, improving the Website and user experience, compliance with legal requirements.',
  },
  {
    title: '4. Cookies',
    text: 'The Website uses cookies to ensure proper functionality, save language preferences and cart contents. You can disable cookies in your browser settings, but this may affect Website functionality.',
  },
  {
    title: '5. Third-Party Data Sharing',
    text: 'We do not sell, exchange, or transfer your personal data to third parties, except when necessary for order delivery (courier services) or compliance with legal requirements.',
  },
  {
    title: '6. Data Protection',
    text: 'We implement organizational and technical measures to protect personal data from unauthorized access, alteration, disclosure, or destruction. Data is stored on secure servers.',
  },
  {
    title: '7. User Rights',
    text: 'You have the right to: request information about your personal data, request its correction or deletion, withdraw consent for data processing. Please contact us via email.',
  },
  {
    title: '8. Data Retention',
    text: 'Personal data is retained for the period necessary to achieve processing purposes, but not less than the period established by legislation.',
  },
  {
    title: '9. Policy Changes',
    text: 'The Operator reserves the right to amend this Policy. The current version is always available on this page.',
  },
  {
    title: '10. Contact',
    text: 'For questions related to personal data processing, please contact: errani.site@gmail.com',
  },
];

export default function PrivacyPage() {
  const { lang } = useLanguage();
  const sections = lang === 'ru' ? PRIVACY_SECTIONS_RU : PRIVACY_SECTIONS_EN;

  return (
    <main className="privacy-page">
      <div className="privacy-container">
        <h1 className="privacy-heading anim-fade-up">{t(lang, 'privacy.title')}</h1>

        <div className="privacy-content">
          {sections.map((section, i) => (
            <div key={i} className="privacy-section anim-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <h2 className="privacy-section-title">{section.title}</h2>
              <p className="privacy-section-text">{section.text}</p>
            </div>
          ))}
        </div>

        <div className="privacy-back anim-fade-up">
          <Link href="/" className="privacy-back-link">
            ← {lang === 'ru' ? 'На главную' : 'Back to home'}
          </Link>
        </div>
      </div>
    </main>
  );
}

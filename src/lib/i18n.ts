export type Lang = 'ru' | 'en';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

type Translations = Record<Lang, Record<string, string>>;

const translations: Translations = {
  ru: {
    // Nav
    'nav.home': 'Главная',
    'nav.catalog': 'Каталог',
    'nav.cart': 'Корзина',
    'nav.product': 'Колода',
    'nav.lang': 'Язык',

    // Homepage
    'home.title': 'Сайт в\u00A0разработке',
    'home.subtitle': 'Пока доступен только предзаказ авторской колоды Таро\u00A0«Tenderly\u00A0Vibe»',
    'home.cta': 'К предзаказу',

    // Product page
    'product.badge': 'Предзаказ',
    'product.title': 'Tenderly Vibe Tarot',
    'product.subtitle': 'Колода о мягкости, которую мы так часто прячем',
    'product.price': '4 590 ₽',
    'product.addToCart': 'Добавить в корзину',
    'product.added': '✓ Добавлено',
    'product.goToCart': 'Перейти в корзину',
    'product.specs': 'Характеристики',
    'product.backToCatalog': '← Каталог',
    'product.description.title': 'О колоде',
    'product.description.p1': 'Когда я создавала её, мне хотелось передать ту тёплую, добрую атмосферу и ту искреннюю нежность, которые живут внутри каждого из нас. Но в суете дней, в задачах, дедлайнах, бытовых сложностях мы постепенно перестаём это чувствовать. Становимся строже к себе.',
    'product.description.p2': 'Эта колода — напоминание нам, что можно быть мягкой, что можно чувствовать.',
    'product.description.p3': 'Tenderly Vibe помогает не просто получить ответ, а прикоснуться к своему внутреннему состоянию.',
    'product.description.p4': 'Колода создана на основе RWS, вы можете следовать этой системе.',
    'product.limited.title': 'Лимитированный тираж',
    'product.limited.text': 'Тираж ограничен — всего 30 экземпляров. Каждая колода будет сопровождаться номерным сертификатом, подтверждающим её уникальность и принадлежность к первому выпуску. Tenderly Vibe — это не массовая история.',

    // Specs
    'spec.count': 'Количество карт',
    'spec.count.value': '80 карт (две Императрицы)',
    'spec.size': 'Размер карты, мм',
    'spec.size.value': '128 × 78 (увеличенный формат)',
    'spec.material': 'Покрытие',
    'spec.material.value': 'Матовое — бархатистое и комфортное',
    'spec.edge': 'Срез',
    'spec.edge.value': 'Розовый матовый',
    'spec.box': 'Упаковка',
    'spec.box.value': 'Прочная коробка «крышка-дно»',
    'spec.tradition': 'Традиция Таро',
    'spec.tradition.value': 'На основе RWS',
    'spec.edition': 'Тираж',
    'spec.edition.value': '30 экземпляров',
    'spec.certificate': 'Сертификат',
    'spec.certificate.value': 'Номерной, первый выпуск',

    // Cart
    'cart.title': 'Корзина',
    'cart.empty': 'Корзина пуста',
    'cart.preorder': 'Предзаказ',
    'cart.total': 'Итого',
    'cart.checkout': 'Оформить заказ',
    'cart.checkout.heading': 'Оформление заказа',
    'cart.name': 'Имя',
    'cart.email': 'Email',
    'cart.phone': 'Телефон',
    'cart.country': 'Страна',
    'cart.city': 'Город',
    'cart.address': 'Адрес доставки',
    'cart.notes': 'Комментарий к заказу',
    'cart.submit': 'Оформить заказ',
    'cart.submitting': 'Оформляем...',
    'cart.goHome': 'Вернуться на главную',

    // Cart success
    'cart.success.title': 'Заказ оформлен!',
    'cart.success.text': 'Спасибо за заказ. Мы свяжемся с вами для подтверждения.',

    // Footer
    'footer.rights': 'Все права защищены.',
    'footer.contact': 'Связаться',

    // Contact modal
    'contact.title': 'Связаться с нами',
    'contact.subtitle': 'Оставьте ваши контакты и мы свяжемся с вами',
    'contact.name': 'Ваше имя',
    'contact.email': 'Email',
    'contact.message': 'Сообщение',
    'contact.send': 'Отправить',
    'contact.success.title': 'Сообщение отправлено!',
    'contact.success.text': 'Спасибо за обращение! Мы свяжемся с вами в ближайшее время.',

    // 404
    'error.title': 'Страница не найдена',
    'error.back': 'На главную',

    // Catalog
    'catalog.title': 'Каталог',
    'catalog.preorder': 'Предзаказ',
    'catalog.view': 'В корзину',

    // Cookie consent
    'cookie.text': 'Мы используем cookie для улучшения работы сайта.',
    'cookie.accept': 'Принять',
    'cookie.privacy': 'Политика конфиденциальности',

    // Privacy
    'privacy.title': 'Политика конфиденциальности',
  },

  en: {
    'nav.home': 'Home',
    'nav.catalog': 'Catalog',
    'nav.cart': 'Cart',
    'nav.product': 'Deck',    'nav.lang': 'Language',
    'home.title': 'Website under\u00A0construction',
    'home.subtitle': 'Currently only pre-order is available for the author\'s Tarot deck\u00A0"Tenderly\u00A0Vibe"',
    'home.cta': 'Pre-order now',

    'product.badge': 'Pre-order',
    'product.title': 'Tenderly Vibe Tarot',
    'product.subtitle': 'A deck about the softness we so often hide',
    'product.price': '4 590 ₽',
    'product.addToCart': 'Add to cart',
    'product.added': '✓ Added',
    'product.goToCart': 'Go to cart',
    'product.specs': 'Specifications',
    'product.backToCatalog': '← Catalog',
    'product.description.title': 'About the deck',
    'product.description.p1': 'When I created it, I wanted to convey that warm, kind atmosphere and sincere tenderness that lives inside each of us. But in the rush of days, tasks, deadlines, everyday difficulties, we gradually stop feeling it. We become stricter with ourselves.',
    'product.description.p2': 'This deck is a reminder that it\'s okay to be soft, that it\'s okay to feel.',
    'product.description.p3': 'Tenderly Vibe helps not just to get an answer, but to touch your inner state.',
    'product.description.p4': 'The deck is based on RWS tradition, you can follow this system.',
    'product.limited.title': 'Limited Edition',
    'product.limited.text': 'Limited run — only 30 copies. Each deck comes with a numbered certificate confirming its uniqueness and belonging to the first edition. Tenderly Vibe is not a mass-produced story.',

    'spec.count': 'Number of cards',
    'spec.count.value': '80 cards (two Empresses)',
    'spec.size': 'Card size, mm',
    'spec.size.value': '128 × 78 (larger format)',
    'spec.material': 'Finish',
    'spec.material.value': 'Matte — velvety and comfortable',
    'spec.edge': 'Edge',
    'spec.edge.value': 'Pink matte',
    'spec.box': 'Packaging',
    'spec.box.value': 'Sturdy lid-bottom box',
    'spec.tradition': 'Tarot tradition',
    'spec.tradition.value': 'Based on RWS',
    'spec.edition': 'Edition',
    'spec.edition.value': '30 copies',
    'spec.certificate': 'Certificate',
    'spec.certificate.value': 'Numbered, first edition',

    'cart.title': 'Cart',
    'cart.empty': 'Your cart is empty',
    'cart.preorder': 'Pre-order',
    'cart.total': 'Total',
    'cart.checkout': 'Checkout',
    'cart.checkout.heading': 'Checkout',
    'cart.name': 'Name',
    'cart.email': 'Email',
    'cart.phone': 'Phone',
    'cart.country': 'Country',
    'cart.city': 'City',
    'cart.address': 'Shipping address',
    'cart.notes': 'Order notes',
    'cart.submit': 'Place order',
    'cart.submitting': 'Placing...',
    'cart.goHome': 'Back to home',

    'cart.success.title': 'Order placed!',
    'cart.success.text': 'Thank you for your order. We will contact you for confirmation.',

    'footer.rights': 'All rights reserved.',
    'footer.contact': 'Contact',

    'contact.title': 'Contact us',
    'contact.subtitle': 'Leave your details and we will get in touch',
    'contact.name': 'Your name',
    'contact.email': 'Email',
    'contact.message': 'Message',
    'contact.send': 'Send',
    'contact.success.title': 'Message sent!',
    'contact.success.text': 'Thank you for reaching out! We will contact you soon.',

    'error.title': 'Page not found',
    'error.back': 'Go home',

    'catalog.title': 'Catalog',
    'catalog.preorder': 'Pre-order',
    'catalog.view': 'Add to cart',

    'cookie.text': 'We use cookies to improve your experience.',
    'cookie.accept': 'Accept',
    'cookie.privacy': 'Privacy Policy',

    'privacy.title': 'Privacy Policy',
  },
};

export function t(lang: Lang, key: string): string {
  return translations[lang]?.[key] ?? translations.ru[key] ?? key;
}

export const SPEC_KEYS = [
  'spec.count',
  'spec.size',
  'spec.material',
  'spec.edge',
  'spec.box',
  'spec.tradition',
  'spec.edition',
  'spec.certificate',
] as const;

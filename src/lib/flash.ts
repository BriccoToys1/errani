import type { Lang } from '@/lib/i18n';

export type FlashLang = Lang;

type Dict = Record<string, { ru: string; en: string }>;

const FLASH: Dict = {
  // Network / generic
  'network': {
    ru: 'Ошибка сети',
    en: 'Network error',
  },
  'network.retry': {
    ru: 'Ошибка сети. Попробуйте ещё раз.',
    en: 'Network error. Please try again.',
  },
  'server': {
    ru: 'Ошибка сервера',
    en: 'Server error',
  },
  'unauthorized': {
    ru: 'Нет доступа',
    en: 'Unauthorized',
  },
  'not_found': {
    ru: 'Не найдено',
    en: 'Not found',
  },
  'failed': {
    ru: 'Ошибка',
    en: 'Failed',
  },

  // Contact / inquiries
  'contact.send_failed': {
    ru: 'Не удалось отправить сообщение',
    en: 'Could not send the message',
  },
  'inquiry.required': {
    ru: 'Укажите имя, email и сообщение',
    en: 'Name, email and message are required',
  },
  'inquiry.create_failed': {
    ru: 'Не удалось отправить обращение',
    en: 'Failed to create inquiry',
  },
  'inquiry.not_found': {
    ru: 'Обращение не найдено',
    en: 'Inquiry not found',
  },
  'inquiry.email_not_configured': {
    ru: 'Email не настроен',
    en: 'Email not configured',
  },
  'inquiry.body_required': {
    ru: 'Текст ответа обязателен',
    en: 'Body is required',
  },
  'inquiry.send_email_failed': {
    ru: 'Не удалось отправить письмо',
    en: 'Failed to send email',
  },

  // Cart / orders
  'order.rate_limit': {
    ru: 'Слишком много попыток оформления. Попробуйте позже.',
    en: 'Too many checkout attempts. Please try again later.',
  },
  'order.missing_fields': {
    ru: 'Заполните обязательные поля',
    en: 'Missing required fields',
  },
  'order.invalid_data': {
    ru: 'Некорректные данные заказа',
    en: 'Invalid order data',
  },
  'order.ru_only': {
    ru: 'Онлайн-заказ доступен только для доставки по России.',
    en: 'Online checkout is available for Russia delivery only.',
  },
  'order.shipping_unavailable': {
    ru: 'Этот способ доставки больше недоступен. Обновите страницу и оформите заказ с ручным адресом.',
    en: 'This shipping method is no longer available. Refresh the page and place the order with a manual address.',
  },
  'order.address_required': {
    ru: 'Укажите адрес доставки.',
    en: 'Enter the delivery address.',
  },
  'order.blocked': {
    ru: 'Проверка по идентичности ФИО и номера телефона',
    en: 'Order blocked pending identity verification',
  },
  'order.invalid_cart': {
    ru: 'Некорректный состав корзины',
    en: 'Invalid cart items',
  },
  'order.products_missing': {
    ru: 'Некоторые товары не найдены',
    en: 'Some products not found',
  },
  'order.products_unavailable': {
    ru: 'Эти товары сейчас недоступны: {names}',
    en: 'These products are currently unavailable: {names}',
  },
  'order.not_enough_stock': {
    ru: 'Недостаточно остатков: {names}',
    en: 'Not enough stock for: {names}',
  },
  'order.color_stock': {
    ru: 'Недостаточно остатков цвета «{color}» для товара «{product}» (доступно: {stock})',
    en: 'Not enough stock of color “{color}” for “{product}” (available: {stock})',
  },
  'order.payment_failed': {
    ru: 'Не удалось создать платёж. Попробуйте ещё раз или свяжитесь с нами.',
    en: 'Could not create payment. Try again or contact us.',
  },
  'order.create_failed': {
    ru: 'Не удалось создать заказ',
    en: 'Failed to create order',
  },
  'order.not_found': {
    ru: 'Заказ не найден',
    en: 'Order not found',
  },
  'order.status_failed': {
    ru: 'Не удалось получить статус заказа',
    en: 'Failed to get status',
  },
  'order.too_many_requests': {
    ru: 'Слишком много запросов',
    en: 'Too many requests',
  },
  'order.missing_number': {
    ru: 'Не указан номер заказа',
    en: 'Missing order number',
  },
  'order.place_failed': {
    ru: 'Ошибка при оформлении заказа. Попробуйте ещё раз.',
    en: 'Could not place the order. Try again.',
  },
  'order.unavailable_in_cart': {
    ru: 'Некоторые товары в корзине сейчас недоступны. Удалите их, чтобы продолжить оформление.',
    en: 'Some products in your cart are currently unavailable. Remove them to continue.',
  },
  'receipt.rate_limit': {
    ru: 'Слишком много запросов чека',
    en: 'Too many receipt requests',
  },
  'receipt.already_sent': {
    ru: 'Чек уже был отправлен недавно',
    en: 'Receipt was already sent recently',
  },
  'receipt.after_payment': {
    ru: 'Чек доступен после успешной оплаты',
    en: 'Receipt is available after successful payment',
  },
  'receipt.send_failed': {
    ru: 'Не удалось отправить чек',
    en: 'Failed to send receipt',
  },
  'receipt.sent': {
    ru: 'Чек отправлен',
    en: 'Receipt sent',
  },

  // Waitlist
  'waitlist.required': {
    ru: 'Укажите имя, email и товар',
    en: 'Name, email and product are required',
  },
  'waitlist.consent': {
    ru: 'Нужно согласие на обработку персональных данных',
    en: 'Personal data consent is required',
  },
  'waitlist.invalid_email': {
    ru: 'Некорректный email',
    en: 'Invalid email',
  },
  'waitlist.already': {
    ru: 'Вы уже в списке ожидания',
    en: 'Already on waitlist',
  },
  'waitlist.create_failed': {
    ru: 'Не удалось записаться в лист ожидания',
    en: 'Failed to create waitlist request',
  },
  'waitlist.join_failed': {
    ru: 'Не удалось добавить в список.',
    en: 'Failed to join the waitlist.',
  },

  // Reviews
  'review.token_required': {
    ru: 'Токен обязателен',
    en: 'Token is required',
  },
  'review.token_missing': {
    ru: 'Токен не указан',
    en: 'Token is missing',
  },
  'review.link_not_found': {
    ru: 'Ссылка не найдена',
    en: 'Link not found',
  },
  'review.link_expired': {
    ru: 'Срок действия ссылки истёк',
    en: 'This link has expired',
  },
  'review.link_used': {
    ru: 'Ссылка уже использована',
    en: 'This link has already been used',
  },
  'review.rating_range': {
    ru: 'Оценка должна быть от 1 до 5',
    en: 'Rating must be from 1 to 5',
  },
  'review.need_content': {
    ru: 'Добавьте текст или медиа',
    en: 'Add text or media',
  },
  'review.submit_failed': {
    ru: 'Ошибка отправки отзыва',
    en: 'Failed to submit review',
  },
  'review.check_failed': {
    ru: 'Ошибка проверки ссылки',
    en: 'Failed to verify link',
  },
  'review.upload_rate': {
    ru: 'Слишком много загрузок. Попробуйте позже.',
    en: 'Too many uploads. Please try again later.',
  },
  'review.file_missing': {
    ru: 'Файл не найден',
    en: 'File not found',
  },
  'review.file_type': {
    ru: 'Поддерживаются JPG/PNG/WEBP/MP4/WEBM/MOV',
    en: 'Allowed: JPG/PNG/WEBP/MP4/WEBM/MOV',
  },
  'review.image_too_large': {
    ru: 'Изображение слишком большое (макс. 12 MB)',
    en: 'Image is too large (max 12 MB)',
  },
  'review.video_too_large': {
    ru: 'Видео слишком большое (макс. 40 MB)',
    en: 'Video is too large (max 40 MB)',
  },
  'review.upload_failed': {
    ru: 'Ошибка загрузки файла',
    en: 'File upload failed',
  },
  'review.submitted': {
    ru: 'Спасибо! Отзыв отправлен',
    en: 'Thank you! Your review has been submitted!',
  },

  // Products
  'product.not_found': {
    ru: 'Товар не найден',
    en: 'Product not found',
  },
  'product.slug_required': {
    ru: 'Slug обязателен',
    en: 'Slug is required',
  },
  'product.image_required': {
    ru: 'Для публикации товара нужна валидная картинка (/media/… или /api/media/…)',
    en: 'A valid product image is required to publish (/media/… or /api/media/…)',
  },
  'product.slug_exists': {
    ru: 'Товар с таким slug уже существует',
    en: 'A product with this slug already exists',
  },

  // Upload
  'upload.no_file': {
    ru: 'Файл не передан',
    en: 'No file provided',
  },
  'upload.empty': {
    ru: 'Пустой файл',
    en: 'Empty file',
  },
  'upload.too_large': {
    ru: 'Файл слишком большой. Максимум: 10 MB',
    en: 'File too large. Max size: 10MB',
  },
  'upload.type': {
    ru: 'Разрешены только JPEG, PNG, WEBP',
    en: 'Invalid file type. Allowed: JPEG, PNG, WEBP',
  },
  'upload.invalid_image': {
    ru: 'Файл не является корректным изображением',
    en: 'Invalid image file',
  },
  'upload.unsupported': {
    ru: 'Недопустимый формат изображения',
    en: 'Unsupported image format',
  },
  'upload.failed': {
    ru: 'Ошибка загрузки',
    en: 'Upload failed',
  },

  // CDEK
  'cdek.not_configured': {
    ru: 'Расчёт СДЭК ещё не настроен. Обратитесь к администратору магазина.',
    en: 'CDEK shipping is not configured yet. Please contact the store admin.',
  },
  'cdek.timeout': {
    ru: 'СДЭК не ответил вовремя. Попробуйте ещё раз.',
    en: 'CDEK did not respond in time. Please try again.',
  },
  'cdek.unreachable': {
    ru: 'Не удалось связаться со СДЭК. Попробуйте ещё раз.',
    en: 'Could not reach CDEK. Please try again.',
  },
  'cdek.auth_failed': {
    ru: 'Не удалось авторизоваться в СДЭК. Обратитесь к администратору магазина.',
    en: 'Could not authenticate with CDEK. Please contact the store admin.',
  },
  'cdek.full_address': {
    ru: 'Укажите полный адрес: город, улицу и дом.',
    en: 'Enter the full address: city, street and house number.',
  },
  'cdek.address_check_failed': {
    ru: 'Не удалось проверить адрес. Попробуйте ещё раз.',
    en: 'Could not verify the address. Please try again.',
  },
  'cdek.address_unavailable': {
    ru: 'Сервис проверки адреса временно недоступен. Попробуйте ещё раз.',
    en: 'Address verification is temporarily unavailable. Please try again.',
  },
  'cdek.address_not_found_detail': {
    ru: 'Адрес не найден. Проверьте город, улицу и номер дома. Доставка доступна только по России.',
    en: 'Address not found. Check city, street and house number. Delivery is available in Russia only.',
  },
  'cdek.pvz_not_found': {
    ru: 'Выбранный пункт выдачи СДЭК не найден.',
    en: 'The selected CDEK pickup point was not found.',
  },
  'cdek.check_order': {
    ru: 'Проверьте адрес и состав заказа.',
    en: 'Check the address and order contents.',
  },
  'cdek.select_pvz': {
    ru: 'Выберите пункт выдачи СДЭК.',
    en: 'Select a CDEK pickup point.',
  },
  'cdek.address_not_found': {
    ru: 'Адрес не найден',
    en: 'Address not found',
  },
  'cdek.bad_price': {
    ru: 'СДЭК вернул некорректную стоимость доставки.',
    en: 'CDEK returned an invalid shipping price.',
  },
  'cdek.tariff_failed': {
    ru: 'СДЭК не смог рассчитать доставку для указанного адреса.',
    en: 'CDEK could not calculate shipping for this address.',
  },
  'cdek.cities_failed': {
    ru: 'Не удалось загрузить справочник населённых пунктов.',
    en: 'Could not load the city directory.',
  },
  'cdek.points_failed': {
    ru: 'Не удалось получить пункты выдачи СДЭК.',
    en: 'Could not load CDEK pickup points.',
  },
  'cdek.city_code_missing': {
    ru: 'СДЭК не вернул код города.',
    en: 'CDEK did not return a city code.',
  },
  'cdek.order_data_missing': {
    ru: 'Недостаточно данных для создания заказа СДЭК.',
    en: 'Not enough data to create a CDEK shipment.',
  },
  'cdek.order_rejected': {
    ru: 'СДЭК не принял заказ.',
    en: 'CDEK rejected the shipment.',
  },
  'cdek.calc_invalid': {
    ru: 'Некорректные данные для расчёта доставки.',
    en: 'Invalid data for shipping calculation.',
  },
  'cdek.cart_check_failed': {
    ru: 'Не удалось проверить товары в корзине.',
    en: 'Could not verify cart products.',
  },
  'cdek.calc_failed': {
    ru: 'Не удалось рассчитать доставку СДЭК.',
    en: 'Could not calculate CDEK shipping.',
  },
  'cdek.enter_city': {
    ru: 'Введите город.',
    en: 'Enter a city.',
  },
  'cdek.load_points_failed': {
    ru: 'Не удалось загрузить пункты выдачи СДЭК.',
    en: 'Could not load CDEK pickup points.',
  },
  'cdek.locations_failed': {
    ru: 'Не удалось выполнить поиск адреса.',
    en: 'Could not search for this address.',
  },
  'cdek.suggestions_failed': {
    ru: 'Не удалось загрузить подсказки.',
    en: 'Could not load address suggestions.',
  },
  'cdek.map_failed': {
    ru: 'Не удалось загрузить Яндекс Карты.',
    en: 'Could not load Yandex Maps.',
  },
  'cdek.find_address_failed': {
    ru: 'Не удалось найти адрес.',
    en: 'Could not find this address.',
  },
  'cdek.load_pvz_failed': {
    ru: 'Не удалось загрузить пункты выдачи.',
    en: 'Could not load pickup points.',
  },
  'cdek.geo_unsupported': {
    ru: 'Ваш браузер не поддерживает определение местоположения.',
    en: 'Your browser does not support location detection.',
  },
  'cdek.geo_failed': {
    ru: 'Не удалось определить адрес.',
    en: 'Could not determine your address.',
  },
  'cdek.geo_denied': {
    ru: 'Нет доступа к геолокации. Разрешите доступ в настройках браузера.',
    en: 'Location access denied. Allow it in your browser settings.',
  },

  // Avito (admin — still bilingual for consistency)
  'avito.not_configured': {
    ru: 'Avito API не настроен',
    en: 'Avito API is not configured',
  },
  'avito.not_configured_hint': {
    ru: 'Добавьте client_id, client_secret и user_id в настройках',
    en: 'Add client_id, client_secret and user_id in settings',
  },
  'avito.auth_failed': {
    ru: 'Не удалось авторизоваться в Avito',
    en: 'Could not authenticate with Avito',
  },
  'avito.auth_hint': {
    ru: 'Проверьте client_id и client_secret',
    en: 'Check client_id and client_secret',
  },
  'avito.sync_ok': {
    ru: 'Синхронизировано: {created} создано, {updated} обновлено',
    en: 'Synced: {created} created, {updated} updated',
  },
  'avito.sync_failed': {
    ru: 'Ошибка синхронизации',
    en: 'Sync failed',
  },
  'avito.status_failed': {
    ru: 'Не удалось получить статус синхронизации',
    en: 'Failed to get sync status',
  },
  'avito.feed_failed': {
    ru: 'Не удалось сформировать фид Avito',
    en: 'Failed to generate Avito feed',
  },
  'avito.id_required': {
    ru: 'avitoId обязателен',
    en: 'avitoId is required',
  },
  'avito.link_failed': {
    ru: 'Не удалось привязать товар',
    en: 'Failed to link product',
  },
  'avito.settings_saved': {
    ru: 'Настройки Avito сохранены',
    en: 'Avito settings saved',
  },
};

export function parseLang(value: unknown, fallback: FlashLang = 'ru'): FlashLang {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'en' || raw.startsWith('en-')) return 'en';
  if (raw === 'ru' || raw.startsWith('ru-')) return 'ru';
  return fallback;
}

export function langFromRequest(
  req: { headers: { get(name: string): string | null }; nextUrl?: { searchParams: URLSearchParams } },
  bodyLang?: unknown,
): FlashLang {
  if (bodyLang != null && String(bodyLang).trim()) return parseLang(bodyLang);
  const q = req.nextUrl?.searchParams?.get('lang') || req.nextUrl?.searchParams?.get('language');
  if (q) return parseLang(q);
  const accept = req.headers.get('accept-language') || '';
  if (accept.toLowerCase().startsWith('en')) return 'en';
  return 'ru';
}

/** Localized user-facing flash string. Missing keys fall back to the key itself. */
export function flash(
  lang: FlashLang | string | null | undefined,
  key: keyof typeof FLASH | string,
  params?: Record<string, string | number>,
): string {
  const l: FlashLang = parseLang(lang, 'ru');
  const entry = FLASH[key];
  let text = entry ? entry[l] : String(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function flashPair(key: keyof typeof FLASH | string): { ru: string; en: string } {
  const entry = FLASH[key];
  if (entry) return entry;
  return { ru: String(key), en: String(key) };
}

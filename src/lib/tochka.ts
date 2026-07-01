import { importJWK, jwtVerify, type JWK } from 'jose';

const DEFAULT_API_BASE_URL = 'https://enter.tochka.com/uapi';
const PUBLIC_KEY_URL = 'https://enter.tochka.com/doc/openapi/static/keys/public';
const DEFAULT_PAYMENT_MODES = ['sbp'];

export interface TochkaPaymentOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
}

export interface TochkaPaymentResult {
  operationId: string;
  paymentLink: string;
  status?: string;
  raw: unknown;
}

export interface TochkaPaymentOperation {
  customerCode: string;
  amount: number;
  operationId: string;
  paymentLinkId: string;
  paymentType?: string;
  status: string;
}

export interface TochkaWebhookPayload {
  customerCode?: string;
  amount?: string | number;
  paymentType?: string;
  operationId?: string;
  purpose?: string;
  webhookType?: string;
  merchantId?: string;
  consumerId?: string;
  status?: string;
  paymentLinkId?: string;
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://errani.ru').replace(/\/+$/, '');
}

function getPaymentModes() {
  const raw = process.env.TOCHKA_PAYMENT_MODES || DEFAULT_PAYMENT_MODES.join(',');
  return raw
    .split(',')
    .map((mode) => mode.trim())
    .filter(Boolean);
}

export function getTochkaConfig() {
  const token = process.env.TOCHKA_JWT_TOKEN;
  const customerCode = process.env.TOCHKA_CUSTOMER_CODE || '305666194';
  const merchantId = process.env.TOCHKA_MERCHANT_ID || '';
  const clientId = process.env.TOCHKA_CLIENT_ID || process.env.Client_ID || '';

  if (!token || !customerCode) return null;

  return {
    token,
    clientId,
    customerCode,
    merchantId,
    apiBaseUrl: (process.env.TOCHKA_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
  };
}

function extractTochkaData(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== 'object') return {};
  const objectResponse = response as Record<string, unknown>;
  const data = objectResponse.Data;
  return data && typeof data === 'object' ? data as Record<string, unknown> : objectResponse;
}

export async function createTochkaPayment(order: TochkaPaymentOrder): Promise<TochkaPaymentResult | null> {
  const config = getTochkaConfig();
  if (!config) return null;

  const siteUrl = getSiteUrl();
  const data: Record<string, unknown> = {
    customerCode: config.customerCode,
    amount: Number(order.totalAmount.toFixed(2)),
    purpose: 'Оплата заказа',
    redirectUrl: `${siteUrl}/cart/success?order=${encodeURIComponent(order.orderNumber)}`,
    failRedirectUrl: `${siteUrl}/cart`,
    paymentMode: getPaymentModes(),
    saveCard: false,
    paymentLinkId: order.orderNumber,
    ttl: Number(process.env.TOCHKA_PAYMENT_TTL_MINUTES || 10080),
  };

  if (config.merchantId) {
    data.merchantId = config.merchantId;
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/acquiring/v1.0/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ Data: data }),
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;

    if (!response.ok) {
      console.error('Tochka payment error:', response.status, text);
      return { operationId: '', paymentLink: '', raw: { __error: `Tochka ${response.status}: ${text}` } };
    }

    const resultData = extractTochkaData(parsed);
    const operationId = String(resultData.operationId || '');
    const paymentLink = String(resultData.paymentLink || '');

    if (!operationId || !paymentLink) {
      console.error('Tochka payment response missing operationId/paymentLink:', parsed);
      return { operationId, paymentLink, raw: parsed };
    }

    return {
      operationId,
      paymentLink,
      status: resultData.status ? String(resultData.status) : undefined,
      raw: parsed,
    };
  } catch (error) {
    console.error('Tochka payment request error:', error);
    return null;
  }
}

export async function getTochkaPaymentOperation(operationId: string): Promise<TochkaPaymentOperation | null> {
  const config = getTochkaConfig();
  if (!config || !operationId) return null;

  try {
    const url = new URL(`${config.apiBaseUrl}/acquiring/v1.0/payments/${encodeURIComponent(operationId)}`);
    url.searchParams.set('customerCode', config.customerCode);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
    });
    const text = await response.text();

    if (!response.ok) {
      console.error('Tochka payment status error:', response.status, text);
      return null;
    }

    const parsed = text ? JSON.parse(text) as Record<string, unknown> : {};
    const data = extractTochkaData(parsed);
    const operations = Array.isArray(data.Operation) ? data.Operation : [];
    const rawOperation = operations[0];

    if (!rawOperation || typeof rawOperation !== 'object') return null;

    const operation = rawOperation as Record<string, unknown>;
    return {
      customerCode: String(operation.customerCode || ''),
      amount: Number(operation.amount),
      operationId: String(operation.operationId || ''),
      paymentLinkId: String(operation.paymentLinkId || ''),
      paymentType: operation.paymentType ? String(operation.paymentType) : undefined,
      status: String(operation.status || ''),
    };
  } catch (error) {
    console.error('Tochka payment status request error:', error);
    return null;
  }
}

export async function verifyTochkaWebhookToken(token: string): Promise<TochkaWebhookPayload> {
  const response = await fetch(PUBLIC_KEY_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load Tochka public key: ${response.status}`);
  }

  const jwk = await response.json() as JWK;
  const publicKey = await importJWK(jwk, 'RS256');
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ['RS256'],
  });

  return payload as TochkaWebhookPayload;
}

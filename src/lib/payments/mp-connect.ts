// ==================== MERCADO PAGO CONNECT (Marketplace/OAuth) ====================
// Permite que cada hotel conecte SU PROPIA cuenta de Mercado Pago, para que
// los cobros de seña de sus reservas caigan directo en su cuenta — no en la
// cuenta de la plataforma (esa es otra, usada solo para cobrar suscripciones).

import crypto from 'crypto';
import { db } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/crypto';

const OAUTH_AUTHORIZE_URL = 'https://auth.mercadopago.com/authorization';
const OAUTH_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos

function getClientId(): string {
  const id = process.env.MP_CONNECT_CLIENT_ID;
  if (!id) throw new Error('MP_CONNECT_CLIENT_ID no configurado');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.MP_CONNECT_CLIENT_SECRET;
  if (!secret) throw new Error('MP_CONNECT_CLIENT_SECRET no configurado');
  return secret;
}

function getSigningSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET no configurado');
  return secret;
}

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${appUrl}/api/configuracion/mercadopago/callback`;
}

/** Firma un state anti-CSRF que incluye el tenantId y un timestamp. */
export function signState(tenantId: string): string {
  const payload = `${tenantId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

/** Verifica el state devuelto por MP. Devuelve el tenantId si es válido y no expiró. */
export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [tenantId, tsStr, hmac] = decoded.split(':');
    if (!tenantId || !tsStr || !hmac) return null;

    const expected = crypto.createHmac('sha256', getSigningSecret()).update(`${tenantId}:${tsStr}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;

    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;

    return tenantId;
  } catch {
    return null;
  }
}

/** URL a la que redirigir al owner para que conecte su cuenta de Mercado Pago. */
export function buildAuthorizationUrl(tenantId: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: getRedirectUri(),
    state: signState(tenantId),
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

interface MpOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key?: string;
  live_mode: boolean;
}

async function requestToken(body: Record<string, string>): Promise<MpOAuthTokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mercado Pago respondió ${res.status}: ${text}`);
  }
  return res.json();
}

/** Intercambia el "code" de la autorización por los tokens del hotel, y los guarda cifrados. */
export async function connectTenantMercadoPago(tenantId: string, code: string): Promise<void> {
  const data = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
  });

  await db.tenantMercadoPago.upsert({
    where: { tenantId },
    create: {
      tenantId,
      mpUserId: String(data.user_id),
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      publicKey: data.public_key || null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
    update: {
      mpUserId: String(data.user_id),
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      publicKey: data.public_key || null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
}

/** Devuelve un access_token válido del hotel (lo refresca si está por vencer). Null si no está conectado. */
export async function getValidAccessToken(tenantId: string): Promise<string | null> {
  const conn = await db.tenantMercadoPago.findUnique({ where: { tenantId } });
  if (!conn) return null;

  const vencePronto = !conn.expiresAt || conn.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  if (!vencePronto) {
    return decrypt(conn.accessToken);
  }

  try {
    const data = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: decrypt(conn.refreshToken),
    });
    await db.tenantMercadoPago.update({
      where: { tenantId },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: encrypt(data.refresh_token),
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });
    return data.access_token;
  } catch (err) {
    console.error('[mp-connect] Error al refrescar token:', err);
    return decrypt(conn.accessToken); // último recurso: usar el que había, puede estar vencido
  }
}

export async function disconnectTenantMercadoPago(tenantId: string): Promise<void> {
  await db.tenantMercadoPago.deleteMany({ where: { tenantId } });
}

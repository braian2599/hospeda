// ── Cifrado de credenciales sensibles con AES-256-GCM ──
//
// Se usa para cifrar credenciales de Mercado Pago (access_token, webhook_secret)
// antes de guardarlas en PlatformConfig (BD).
//
// Algoritmo: AES-256-GCM (autenticado, previene tampering)
// Key: 32 bytes (64 hex chars) desde ENCRYPTION_KEY env var
//
// Formato del valor cifrado: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
// (el prefijo "enc:" permite distinguir valores cifrados de plaintext)

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recomienda 12 bytes
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe ser un hex string de 64 caracteres (32 bytes). Generá uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Cifra un valor usando AES-256-GCM.
 * Retorna el valor con prefijo "enc:" para distinguirlo de plaintext.
 * Si el valor ya está cifrado (empieza con "enc:"), lo retorna sin cambios.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.startsWith(PREFIX)) return plaintext; // ya cifrado

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra un valor cifrado con AES-256-GCM.
 * Si el valor no está cifrado (no empieza con "enc:"), lo retorna sin cambios.
 * Esto permite migración gradual: valores plaintext viejos siguen funcionando.
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // no cifrado, retornar como está

  const key = getKey();
  const parts = ciphertext.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de valor cifrado inválido');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Verifica si un valor está cifrado (empieza con "enc:").
 */
export function isEncrypted(value: string): boolean {
  return !!value && value.startsWith(PREFIX);
}

/**
 * Enmascara un valor para mostrar en UI (sin exponerlo).
 * Si está cifrado, lo descifra primero, luego enmascara.
 */
export function maskSensitive(encryptedValue: string): string {
  const value = decrypt(encryptedValue);
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

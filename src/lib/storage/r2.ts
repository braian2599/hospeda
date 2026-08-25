// ==================== Cloudflare R2 (S3-compatible) — fotos de hotel/habitaciones ====================

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_TYPES.has(contentType);
}

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 no está configurado (faltan variables de entorno)');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('R2_BUCKET no configurado');
  return bucket;
}

/** URL firmada de subida (PUT directo del navegador a R2, sin pasar por nuestro servidor). */
export async function getPresignedUploadUrl(key: string, contentType: string, size: number): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export function buildPublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) throw new Error('R2_PUBLIC_URL no configurado');
  return `${base.replace(/\/$/, '')}/${key}`;
}

/** Inverso de buildPublicUrl: recupera la key de R2 a partir de la URL pública guardada en la DB. */
export function extractKeyFromPublicUrl(url: string): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  const prefix = `${base.replace(/\/$/, '')}/`;
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

/** Extensión segura a partir de un content-type de imagen permitido. */
export function extForContentType(contentType: string): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType] || 'jpg';
}

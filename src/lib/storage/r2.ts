// ==================== Cloudflare R2 (S3-compatible) — fotos de hotel/habitaciones ====================

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
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

/**
 * Borra de R2, en paralelo y best-effort, un conjunto de fotos a partir de
 * sus URLs públicas guardadas en la base — para cuando se borran filas que
 * las referenciaban (una habitación, fotos sacadas de una galería, etc.) y
 * hay que limpiar el storage detrás, no solo el registro en la base.
 *
 * "Best-effort" a propósito: nunca tira — si R2 no está configurado o falla
 * una key puntual, se loguea y se sigue. El caller ya confirmó el cambio en
 * la base; que un objeto quede sin borrar en R2 es recuperable a mano
 * después, pero bloquear la operación principal por eso no lo es.
 */
export async function deleteObjectsBestEffort(urls: string[], tenantId: string, context: string): Promise<void> {
  if (urls.length === 0) return;
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const key = extractKeyFromPublicUrl(url);
      if (!key || !key.startsWith(`tenants/${tenantId}/`)) return;
      await deleteObject(key);
    })
  );
  const fallidas = results.filter((r) => r.status === 'rejected').length;
  if (fallidas > 0) {
    console.error(`[R2] ${fallidas}/${urls.length} fotos no se pudieron borrar (${context})`);
  }
}

/**
 * Borra TODO lo que un tenant tiene en R2, de una sola vez, listando por su
 * prefijo (`tenants/{tenantId}/`) en vez de ir campo por campo de la base
 * (fotos de hotel, fotos de cada habitación, logo de factura, lo que sea
 * que se suba a futuro bajo ese prefijo — presign/route.ts arma TODAS las
 * keys de este tenant con ese mismo prefijo, así que alcanza con este uno
 * para no dejar nada afuera). Se usa al borrar un hotel entero.
 *
 * Best-effort igual que deleteObjectsBestEffort: nunca tira. El tenant ya
 * se borró de la base cuando esto se llama — un objeto que quede sin
 * borrar en R2 es recuperable a mano después, pero no hay ninguna fila
 * apuntando a él, así que tampoco es urgente.
 */
export async function deleteAllTenantObjects(tenantId: string): Promise<void> {
  const prefix = `tenants/${tenantId}/`;
  let borradas = 0;
  let fallidas = 0;
  try {
    const client = getR2Client();
    const bucket = getBucket();
    let continuationToken: string | undefined;
    do {
      const listed = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      const keys = (listed.Contents || []).map((o) => o.Key).filter((k): k is string => !!k);
      if (keys.length > 0) {
        // DeleteObjects acepta hasta 1000 keys por llamada — ListObjectsV2
        // también pagina de a 1000, así que cada tanda ya entra justa.
        const result = await client.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }));
        fallidas += result.Errors?.length || 0;
        borradas += keys.length - (result.Errors?.length || 0);
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err) {
    console.error(`[R2] Error al borrar el storage del tenant ${tenantId}:`, err);
    return;
  }
  if (fallidas > 0) {
    console.error(`[R2] ${fallidas} objetos no se pudieron borrar del storage del tenant ${tenantId}`);
  }
  if (borradas > 0 || fallidas > 0) {
    console.log(`[R2] Storage del tenant ${tenantId} limpiado: ${borradas} objetos borrados, ${fallidas} fallidos`);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import forge from 'node-forge';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { encrypt } from '@/lib/crypto';

// POST /api/configuracion/afip/certificado — Carga certificado (.crt/.pem) + clave privada (.key/.pem)
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    const body = await req.json();
    const { certificadoPem, clavePrivadaPem } = body as { certificadoPem?: string; clavePrivadaPem?: string };

    if (!certificadoPem?.trim() || !clavePrivadaPem?.trim()) {
      return NextResponse.json({ error: 'Faltan el certificado o la clave privada' }, { status: 400 });
    }

    let cert: forge.pki.Certificate;
    let key: forge.pki.rsa.PrivateKey;
    try {
      cert = forge.pki.certificateFromPem(certificadoPem);
    } catch {
      return NextResponse.json({ error: 'El certificado no es un PEM válido (formato X.509 esperado)' }, { status: 400 });
    }
    try {
      key = forge.pki.privateKeyFromPem(clavePrivadaPem) as forge.pki.rsa.PrivateKey;
    } catch {
      return NextResponse.json({ error: 'La clave privada no es un PEM válido' }, { status: 400 });
    }

    // Verifica que la clave privada corresponda realmente a este
    // certificado (mismo módulo RSA) — evita guardar una combinación que
    // parsea bien pero nunca va a poder firmar nada.
    const pubKey = cert.publicKey as forge.pki.rsa.PublicKey;
    if (!pubKey?.n || !key?.n || !pubKey.n.equals(key.n)) {
      return NextResponse.json({ error: 'La clave privada no corresponde a este certificado' }, { status: 400 });
    }

    const vencimiento = cert.validity.notAfter;
    if (vencimiento && vencimiento.getTime() < Date.now()) {
      return NextResponse.json({ error: `El certificado ya venció (${vencimiento.toLocaleDateString('es-AR')})` }, { status: 400 });
    }

    await db.tenantAfip.upsert({
      where: { tenantId },
      create: {
        tenantId,
        cuit: '', // se completa en el PUT de /api/configuracion/afip si todavía no está
        certificadoPem: certificadoPem.trim(),
        clavePrivadaPem: encrypt(clavePrivadaPem.trim()),
        activo: true,
        wsaaToken: null, wsaaSign: null, wsaaExpiracion: null,
        ultimoError: null,
      },
      update: {
        certificadoPem: certificadoPem.trim(),
        clavePrivadaPem: encrypt(clavePrivadaPem.trim()),
        activo: true,
        // Un certificado nuevo invalida cualquier ticket firmado con el anterior.
        wsaaToken: null, wsaaSign: null, wsaaExpiracion: null,
        ultimoError: null,
      },
    });

    return NextResponse.json({ success: true, vencimiento: vencimiento?.toISOString() || null });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('POST /api/configuracion/afip/certificado:', error);
    return NextResponse.json({ error: 'Error al guardar el certificado' }, { status: 500 });
  }
}

// DELETE /api/configuracion/afip/certificado — Quita el certificado (desactiva la integración)
export async function DELETE() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    await db.tenantAfip.updateMany({
      where: { tenantId },
      data: {
        certificadoPem: null,
        clavePrivadaPem: null,
        activo: false,
        wsaaToken: null, wsaaSign: null, wsaaExpiracion: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('DELETE /api/configuracion/afip/certificado:', error);
    return NextResponse.json({ error: 'Error al eliminar el certificado' }, { status: 500 });
  }
}

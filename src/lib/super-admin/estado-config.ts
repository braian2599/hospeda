// ==================== ESTADO DE LA CONFIGURACIÓN DE LA PLATAFORMA ====================
// Qué grupos de Super Admin → Configuración están completos y qué falta.
// Lo usan la pantalla (debajo de cada grupo) y el contador del menú.
// Pura: recibe los valores ya leídos.

export type TonoConfig = 'ok' | 'warn' | 'gris';
export interface EstadoGrupo { tono: TonoConfig; texto: string }

export interface DatosConfig {
  /** Hay clave de acceso de Mercado Pago (en la base o en Vercel). */
  tieneToken: boolean;
  /** Hay clave secreta de los avisos (en la base o en Vercel). */
  tieneSecreto: boolean;
  valores: Record<string, string | undefined>;
}

export interface EstadoConfig {
  mercadopago: EstadoGrupo;
  transferencia: EstadoGrupo;
  contacto: EstadoGrupo;
  creditos: EstadoGrupo;
  /** Grupos con algo para completar (los amarillos). */
  incompletos: number;
}

const lleno = (v: string | undefined) => !!v && v.trim() !== '';

export function estadoDeConfig({ tieneToken, tieneSecreto, valores: v }: DatosConfig): EstadoConfig {
  const mercadopago: EstadoGrupo = !tieneToken
    ? { tono: 'warn', texto: 'Sin conectar' }
    : !tieneSecreto
      ? { tono: 'warn', texto: 'Falta la clave secreta' }
      : { tono: 'ok', texto: 'Conectado' };

  // Transferencia: si no se cargó nada, no se ofrece (no es un error).
  const camposBanco = ['bank_banco', 'bank_titular', 'bank_cbu', 'bank_alias', 'bank_cuit',
    'bank_comprobante_email', 'bank_comprobante_whatsapp', 'bank_comprobante_telefono'];
  let transferencia: EstadoGrupo;
  if (!camposBanco.some(k => lleno(v[k]))) {
    transferencia = { tono: 'gris', texto: 'No se ofrece' };
  } else {
    const falta: string[] = [];
    if (!lleno(v.bank_titular)) falta.push('titular');
    if (!lleno(v.bank_cbu) && !lleno(v.bank_alias)) falta.push('CBU o alias');
    if (!lleno(v.bank_comprobante_email) && !lleno(v.bank_comprobante_whatsapp) && !lleno(v.bank_comprobante_telefono)) {
      falta.push('dónde mandar el comprobante');
    }
    transferencia = falta.length
      ? { tono: 'warn', texto: `Falta ${falta.join(', ')}` }
      : { tono: 'ok', texto: 'Completo' };
  }

  const faltaContacto = !lleno(v.plataforma_email);
  const faltaSoporte = !lleno(v.support_email);
  const contacto: EstadoGrupo = faltaContacto && faltaSoporte
    ? { tono: 'warn', texto: 'Faltan los dos emails' }
    : faltaContacto
      ? { tono: 'warn', texto: 'Falta email de contacto' }
      : faltaSoporte
        ? { tono: 'warn', texto: 'Falta email de contraseñas' }
        : { tono: 'ok', texto: 'Completo' };

  const creditos: EstadoGrupo = lleno(v.dev_company_nombre) || lleno(v.dev_company_logo_url)
    ? { tono: 'ok', texto: 'Se muestra' }
    : { tono: 'gris', texto: 'No se muestra' };

  const incompletos = [mercadopago, transferencia, contacto].filter(g => g.tono === 'warn').length;
  return { mercadopago, transferencia, contacto, creditos, incompletos };
}

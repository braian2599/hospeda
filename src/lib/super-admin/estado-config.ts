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

  // Las redes sociales son opcionales: solo el email es obligatorio.
  const contacto: EstadoGrupo = lleno(v.plataforma_email)
    ? { tono: 'ok', texto: 'Completo' }
    : { tono: 'warn', texto: 'Falta email de contacto' };

  const creditos: EstadoGrupo = lleno(v.dev_company_nombre) || lleno(v.dev_company_logo_url)
    ? { tono: 'ok', texto: 'Se muestra' }
    : { tono: 'gris', texto: 'No se muestra' };

  const incompletos = [mercadopago, contacto].filter(g => g.tono === 'warn').length;
  return { mercadopago, contacto, creditos, incompletos };
}

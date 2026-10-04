'use client';

// Configuración del Super Admin: 3 grupos en un menú a la izquierda, con lo
// que falta completar debajo de cada uno. Cada grupo se guarda solo: guardar
// el contacto no toca las claves de Mercado Pago.

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { EstadoConfig, EstadoGrupo } from '@/lib/super-admin/estado-config';
import {
  DEV_COMPANY_LOGO_DEFAULT_SIZE as DEV_LOGO_DEFAULT,
  DEV_COMPANY_LOGO_MIN_SIZE as DEV_LOGO_MIN,
  DEV_COMPANY_LOGO_MAX_SIZE as DEV_LOGO_MAX,
} from '@/lib/dev-company-constants';
import { useSuperAdminSection } from './SuperAdminContext';
import { Cabecera, Chip } from './comun';

const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const RUTA_WEBHOOK = '/api/payments/mercadopago/webhook';

type GrupoId = 'mercadopago' | 'contacto' | 'creditos';

/** Las claves de cada grupo (las que se mandan al guardar ese grupo). */
const CLAVES: Record<GrupoId, string[]> = {
  mercadopago: ['mp_access_token', 'mp_public_key', 'mp_webhook_secret'],
  contacto: ['plataforma_email', 'plataforma_instagram', 'plataforma_facebook', 'plataforma_whatsapp'],
  creditos: ['dev_company_nombre', 'dev_company_logo_url', 'dev_company_logo_width', 'dev_company_logo_height'],
};

const GRUPOS: { id: GrupoId; titulo: string }[] = [
  { id: 'mercadopago', titulo: 'Mercado Pago' },
  { id: 'contacto', titulo: 'Contacto y soporte' },
  { id: 'creditos', titulo: 'Créditos en la web' },
];

const SENSIBLES = new Set(['mp_access_token', 'mp_webhook_secret']);
/** Las claves guardadas llegan enmascaradas ("APP_...cdef"). */
const enmascarado = (v: string) => v.includes('...');

async function subirLogo(file: File): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) throw new Error('Formato no permitido (solo jpg, png, webp)');
  if (file.size > MAX_LOGO_BYTES) throw new Error(`El archivo debe pesar menos de ${MAX_LOGO_BYTES / 1024 / 1024} MB`);
  const presignRes = await fetch('/api/super-admin/upload-logo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || 'Error al preparar la subida');
  const putRes = await fetch(presignData.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!putRes.ok) throw new Error('Error al subir el archivo');
  return presignData.publicUrl as string;
}

function ChipEstado({ e }: { e: EstadoGrupo }) {
  return <Chip tono={e.tono} punto={e.tono !== 'gris'}>{e.texto}</Chip>;
}

export default function SuperAdminConfig() {
  const { recargarAvisos } = useSuperAdminSection();
  const [cargando, setCargando] = useState(true);
  const [grupo, setGrupo] = useState<GrupoId>('mercadopago');
  /** Lo guardado (para saber qué cambió) y lo que está en pantalla. */
  const [guardado, setGuardado] = useState<Record<string, string>>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<EstadoConfig | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ver, setVer] = useState<Record<string, boolean>>({});
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [direccion, setDireccion] = useState(RUTA_WEBHOOK);

  // La dirección del webhook es la de este mismo sitio.
  useEffect(() => { setDireccion(`${window.location.origin}${RUTA_WEBHOOK}`); }, []);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/config');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const v: Record<string, string> = {};
      for (const claves of Object.values(CLAVES)) for (const k of claves) v[k] = data.config?.[k] ?? '';
      setGuardado(v);
      setValores(v);
      setEstado(data.estado ?? null);
    } catch {
      toast.error('Error al cargar la configuración');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const val = (k: string) => valores[k] ?? '';
  const poner = (k: string, v: string) => setValores(prev => ({ ...prev, [k]: v }));
  const cambio = (g: GrupoId) => CLAVES[g].some(k => (valores[k] ?? '') !== (guardado[k] ?? ''));

  const guardar = async (g: GrupoId) => {
    setGuardando(true);
    try {
      const config: Record<string, string> = {};
      for (const k of CLAVES[g]) config[k] = valores[k] ?? '';
      // El servidor conserva una clave guardada si llega enmascarada o vacía.
      const res = await fetch('/api/super-admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Guardado');
      // Se recarga todo para ver las claves enmascaradas y el estado nuevo,
      // pero sin perder lo que se esté escribiendo en otros grupos.
      const otros = Object.fromEntries(
        (Object.keys(CLAVES) as GrupoId[]).filter(x => x !== g).flatMap(x => CLAVES[x]).map(k => [k, valores[k] ?? '']),
      );
      await cargar();
      setValores(prev => ({ ...prev, ...otros }));
      recargarAvisos();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(direccion);
      toast.success('Dirección copiada');
    } catch {
      toast.error('No se pudo copiar. Seleccionala y copiala a mano.');
    }
  };

  const onLogo = async (file: File) => {
    setSubiendoLogo(true);
    try {
      poner('dev_company_logo_url', await subirLogo(file));
      toast.success('Logo subido. Tocá Guardar para que quede.');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error al subir el logo');
    } finally {
      setSubiendoLogo(false);
    }
  };

  /** Un campo de texto común. */
  const campo = (k: string, label: string, opciones: { placeholder?: string; ayuda?: string; mono?: boolean; tipo?: string; className?: string } = {}) => (
    <div className={`space-y-1.5 min-w-0 ${opciones.className ?? ''}`}>
      <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
      <Input
        type={opciones.tipo ?? 'text'}
        value={val(k)}
        onChange={e => poner(k, e.target.value)}
        placeholder={opciones.placeholder}
        className={opciones.mono ? 'font-mono text-[12.5px]' : ''}
      />
      {opciones.ayuda && <p className="text-xs text-muted-foreground">{opciones.ayuda}</p>}
    </div>
  );

  /** Un campo de clave secreta, oculto, con "Ver". */
  const clave = (k: string, label: string, placeholder: string) => (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
      <div className="relative">
        <Input
          type={ver[k] ? 'text' : 'password'}
          value={val(k)}
          onChange={e => poner(k, e.target.value)}
          placeholder={placeholder}
          className="pr-9 font-mono text-[12.5px]"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVer(v => ({ ...v, [k]: !v[k] }))}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={ver[k] ? 'Ocultar' : 'Ver'}
        >
          {ver[k] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  const cabeceraPanel = (g: GrupoId, titulo: string) => (
    <div className="flex flex-wrap items-center gap-2.5">
      <h3 className="text-sm font-bold">{titulo}</h3>
      {estado && <ChipEstado e={estado[g]} />}
      {cambio(g) && <Chip tono="warn">Sin guardar</Chip>}
      <Button className="ml-auto" size="sm" onClick={() => guardar(g)} disabled={!cambio(g) || guardando}>
        {guardando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar
      </Button>
    </div>
  );

  const ancho = Number(val('dev_company_logo_width')) || DEV_LOGO_DEFAULT;
  const alto = Number(val('dev_company_logo_height')) || DEV_LOGO_DEFAULT;
  const logo = val('dev_company_logo_url');

  return (
    <div className="flex flex-col gap-4">
      <Cabecera titulo="Configuración" bajada="Cobros, contacto y datos de la plataforma" />

      {cargando ? (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
          {/* ─── Menú de grupos, con lo que falta ─── */}
          <nav className="rounded-xl border bg-card p-2 flex flex-col gap-0.5">
            {GRUPOS.map(g => {
              const on = g.id === grupo;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGrupo(g.id)}
                  className={`rounded-lg px-3 py-2 text-left flex flex-col gap-1 transition-colors ${
                    on ? 'bg-[#0F766E0F] shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-muted/60'
                  }`}
                >
                  <span className={`text-[13.5px] font-semibold ${on ? 'text-primary' : ''}`}>{g.titulo}</span>
                  <span className="flex flex-wrap gap-1">
                    {estado && <ChipEstado e={estado[g.id]} />}
                    {cambio(g.id) && <Chip tono="warn">Sin guardar</Chip>}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="rounded-xl border bg-card px-5 py-4 flex flex-col gap-3.5 min-w-0">
            {grupo === 'mercadopago' && (
              <>
                {cabeceraPanel('mercadopago', 'Mercado Pago')}
                <p className="text-xs text-muted-foreground">Con esto los hoteles pagan la suscripción con débito automático.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clave('mp_access_token', 'Clave de acceso (Access Token)', 'APP_USR-…')}
                  {campo('mp_public_key', 'Clave pública (Public Key)', { placeholder: 'APP_USR-…', mono: true })}
                </div>
                <div className="border-t" />
                <h4 className="text-[13px] font-bold">Avisos de pago (webhook)</h4>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-semibold">Dirección para pegar en Mercado Pago</Label>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/60 px-3 h-9 min-w-0">
                    <span className="font-mono text-[12.5px] text-muted-foreground truncate select-all">{direccion}</span>
                    <button type="button" onClick={copiar} className="ml-auto shrink-0 text-xs font-semibold text-primary hover:underline">Copiar</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clave('mp_webhook_secret', 'Clave secreta de los avisos', 'La da Mercado Pago')}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-semibold">Qué marcar en Mercado Pago</Label>
                    <div className="flex items-center rounded-md border bg-muted/60 px-3 h-9 text-[13px] text-muted-foreground">&quot;Pagos&quot; y &quot;Planes y suscripciones&quot;</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {enmascarado(val('mp_access_token')) || enmascarado(val('mp_webhook_secret'))
                    ? 'Las claves guardadas se ven ocultas (solo el principio y el final). Para cambiar una, borrala y pegá la nueva.'
                    : 'Si una clave también está cargada en Vercel, manda la de acá.'}
                </p>
              </>
            )}

            {grupo === 'contacto' && (
              <>
                {cabeceraPanel('contacto', 'Contacto y soporte')}
                {campo('plataforma_email', 'Email de contacto', {
                  tipo: 'email', placeholder: 'soporte@hospi.com',
                  ayuda: 'Aparece en la página web (pie y /contacto) y en "Contactar soporte" y "Reportar error" dentro del sistema. Vacío: esos botones no se muestran.',
                })}
                <p className="text-xs text-muted-foreground -mt-1.5">Las respuestas a los emails que el sistema les manda a los hoteles también llegan a este email.</p>
                <div className="border-t" />
                <h4 className="text-[13px] font-bold">Redes sociales <span className="text-xs font-normal text-muted-foreground">(opcionales)</span></h4>
                <p className="text-xs text-muted-foreground -mt-1.5">Se muestran en la página web de Hospi (pie y /contacto) y en Configuración → Soporte dentro del sistema. Vacío: no se muestra.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {campo('plataforma_instagram', 'Instagram', { tipo: 'url', placeholder: 'https://instagram.com/…' })}
                  {campo('plataforma_facebook', 'Facebook', { tipo: 'url', placeholder: 'https://facebook.com/…' })}
                  {campo('plataforma_whatsapp', 'Enlace de WhatsApp', { tipo: 'url', placeholder: 'https://wa.me/549…' })}
                </div>
              </>
            )}

            {grupo === 'creditos' && (
              <>
                {cabeceraPanel('creditos', 'Créditos en la web')}
                <p className="text-xs text-muted-foreground">La empresa desarrolladora sale en el pie de la página de Hospi y de cada hotel. Vacío: no se muestra nada.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {campo('dev_company_nombre', 'Nombre', { placeholder: 'Ej: tu estudio o empresa' })}
                  {campo('dev_company_logo_width', 'Ancho del logo (px)', { tipo: 'number', placeholder: String(DEV_LOGO_DEFAULT) })}
                  {campo('dev_company_logo_height', 'Alto del logo (px)', { tipo: 'number', placeholder: String(DEV_LOGO_DEFAULT) })}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {logo ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      <img src={logo} alt="Logo de la empresa desarrolladora" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => poner('dev_company_logo_url', '')} title="Quitar logo"
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted text-muted-foreground">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-[13px] font-medium hover:bg-muted">
                    {subiendoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {logo ? 'Cambiar logo' : 'Subir logo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={subiendoLogo}
                      onChange={e => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ''; }} />
                  </label>
                  <span className="text-xs text-muted-foreground">JPG, PNG o WEBP, hasta 4 MB. Tamaño entre {DEV_LOGO_MIN} y {DEV_LOGO_MAX} px.</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-semibold">Así se ve</Label>
                  <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-dashed bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                    <span>© {new Date().getFullYear()} Tu hotel</span>
                    {val('dev_company_nombre') || logo ? (
                      <span className="ml-auto flex items-center gap-2">
                        Desarrollado por
                        {logo && <img src={logo} alt="" className="rounded" style={{ width: ancho, height: alto }} />}
                        {val('dev_company_nombre') && <b className="text-foreground">{val('dev_company_nombre')}</b>}
                      </span>
                    ) : (
                      <span className="ml-auto">(no se muestra nada)</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

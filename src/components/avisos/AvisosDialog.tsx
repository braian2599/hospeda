'use client';

// ==================== LA VENTANA DE BIENVENIDA ====================
//
// LO QUE ERA Y POR QUÉ SE CAMBIÓ
// Mostraba once tarjetas, una por módulo, agrupadas por área. Se veía bien,
// pero era el menú lateral repetido: le decía a la persona lo que ya tenía a
// la izquierda. Y el día que alguien la ve, el hotel tiene cero habitaciones,
// cero tarifas y cero equipo — o sea que de esos once módulos no puede usar
// ninguno todavía, y la ventana no le decía por dónde empezar.
//
// AHORA SON TRES CAMINOS, y la persona elige:
//   mini   — una pregunta corta, tres botones. Se muestra UNA vez.
//   pasos  — el checklist de arranque, marcado con lo que el hotel ya cargó.
//   guia   — el recorrido por áreas (ver GuiaRapida).
//
// Cerrar con la X se comporta igual que "Mirar solo": deja la notificación.
// Nunca se pierden los tres caminos en silencio.
//
// La ventana de NOVEDADES no cambió: sigue siendo la lista de mejoras, con su
// propio contador. Son dos cosas distintas que comparten este componente.

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as Icons from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { useNotificationStore } from '@/lib/notification-store';
import { modulosVisiblesPara } from '@/lib/plan-config';
import { api } from '@/lib/api-client';
import type { ModuloId } from '@/lib/types';
import GuiaRapida from '@/components/avisos/GuiaRapida';
import {
  avisoParaMostrar,
  pasosDeGuia,
  valeLaPenaLaGuia,
  primerosPasos,
  pasosHechos,
  pasoActual,
  parseAvisosVistos,
  diasRestantes,
  CLAVE_BIENVENIDA,
  type AvisoAMostrar,
  type Novedad,
  type TipoNovedad,
  type PasoInicial,
} from '@/lib/avisos';

const ETIQUETAS: Record<TipoNovedad, { texto: string; clase: string }> = {
  nuevo: { texto: 'Nuevo', clase: 'bg-[#0F766E16] text-primary border-[#0F766E40]' },
  mejora: { texto: 'Mejora', clase: 'bg-muted text-muted-foreground border-border' },
  arreglo: { texto: 'Arreglo', clase: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
};

/** La notificación que queda cuando alguien elige mirar solo. */
const CLAVE_NOTIFICACION = 'bienvenida-pendiente';

/**
 * Marca de "ya se mostró en esta pestaña", por usuario.
 *
 * Va en sessionStorage y no en una variable del módulo porque el layout se
 * remonta solo (al cambiar de hotel, al volver de Configuración) y la ventana
 * se reabriría.
 *
 * Es un refuerzo, no la fuente de verdad: la cuenta real vive en la ficha del
 * usuario. Si el navegador no deja usar sessionStorage, lo peor que pasa es
 * que la ventana reaparezca tras un remontaje.
 */
function claveSesion(tenantUserId: string): string {
  return `hospi:aviso-mostrado:${tenantUserId}`;
}

function yaSeMostro(tenantUserId: string): boolean {
  try {
    return sessionStorage.getItem(claveSesion(tenantUserId)) === '1';
  } catch {
    return false;
  }
}

function marcarMostrado(tenantUserId: string): void {
  try {
    sessionStorage.setItem(claveSesion(tenantUserId), '1');
  } catch {
    // Sin sessionStorage se sigue funcionando.
  }
}

export default function AvisosDialog() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);
  const planesCargados = useHotelStore(s => s._planesCargados);
  const bienvenidaPedida = useHotelStore(s => s.bienvenidaPedida);
  const bienvenidaAtendida = useHotelStore(s => s.bienvenidaAtendida);
  const setAvisosVistos = useHotelStore(s => s.setAvisosVistos);
  const addNotification = useNotificationStore(s => s.addNotification);

  // Memoizado: modulosVisiblesPara devuelve un array nuevo cada vez, y un
  // array nuevo en cada render deja sin efecto al useMemo de los pasos.
  const modulos = useMemo(
    () => modulosVisiblesPara(usuarioActual, planActual, planes),
    [usuarioActual, planActual, planes],
  );

  const [cerrado, setCerrado] = useState(false);
  const tenantUserId = usuarioActual?.tenantUserId;

  // ── Qué mostrar ──
  // Se decide UNA sola vez, al montar, con el inicializador perezoso de
  // useState. No va en un efecto a propósito: el estado del usuario se
  // re-sincroniza con el servidor cada tanto, así que un efecto volvería a
  // correr con datos nuevos y podría reabrir la ventana encima de alguien que
  // ya la cerró.
  const [aviso] = useState<AvisoAMostrar>(() => {
    if (!tenantUserId || yaSeMostro(tenantUserId)) return null;
    return avisoParaMostrar(parseAvisosVistos(usuarioActual?.avisosVistos), new Date());
  });

  // El pedido explícito (campanita o perfil) abre la ventana aunque ya se haya
  // visto. Es el único camino de vuelta después de la única vez automática.
  const abierto = bienvenidaPedida || (!!aviso && !cerrado);

  const cerrar = useCallback(async (dejarPendiente: boolean) => {
    setCerrado(true);
    bienvenidaAtendida();
    if (!tenantUserId) return;
    marcarMostrado(tenantUserId);

    // Un pedido explícito no consume nada: la persona ya había visto la
    // ventana y volvió a mirarla. Solo cuenta la automática.
    if (!aviso) return;

    const esBienvenida = aviso.tipo === 'bienvenida';

    if (esBienvenida) {
      if (dejarPendiente) {
        // UNA sola entrada, y reabre la ventana con los tres botones: no manda
        // directo a un camino, para que la persona vuelva a elegir.
        //
        // Dura lo que dura el turno: la campanita se borra al cerrar sesión
        // (ver notification-store, "nadie hereda las notificaciones del turno
        // anterior"). Por eso la puerta de vuelta de verdad es la línea
        // "Guía del sistema" del diálogo de perfil.
        addNotification({
          clave: CLAVE_NOTIFICACION,
          type: 'info',
          category: 'sistema',
          priority: 'info',
          title: 'Te queda pendiente la bienvenida',
          message: 'Podés dejar el hotel listo en tres pasos o dar una vuelta rápida por el sistema.',
          accion: 'abrir-bienvenida',
          actionLabel: 'Ver',
          persisted: true,
        });
      }
    } else {
      // A la campanita, para que queden a mano toda la semana.
      for (const n of aviso.novedades) {
        addNotification({
          clave: `novedad:${n.id}`,
          type: 'info',
          category: 'sistema',
          priority: 'info',
          title: n.titulo,
          message: n.texto,
          persisted: true,
        });
      }
    }

    const claves = esBienvenida ? [CLAVE_BIENVENIDA] : aviso.novedades.map(n => n.id);

    // Se guarda en la ficha del usuario. Si falla (sin red, sesión vencida),
    // no se rompe nada: el aviso vuelve a aparecer en el próximo ingreso, que
    // es el error correcto — mejor mostrarlo de más que perderlo.
    try {
      const res = await fetch('/api/avisos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claves }),
      });
      const data = await res.json();
      if (res.ok && data?.avisosVistos) setAvisosVistos(data.avisosVistos);
    } catch {
      // Silencio a propósito: un aviso no justifica molestar al recepcionista.
    }
  }, [aviso, tenantUserId, addNotification, setAvisosVistos, bienvenidaAtendida]);

  if (!abierto) return null;

  // Un pedido explícito manda sobre lo automático: si alguien toca "Ver guía"
  // en su perfil y además tenía novedades pendientes, quiere la guía, no las
  // novedades. Sin esta guarda veía la ventana equivocada.
  const esNovedades = !bienvenidaPedida && !!aviso && aviso.tipo === 'novedades';

  return (
    <Dialog open={abierto} onOpenChange={(v) => { if (!v) cerrar(true); }}>
      <DialogContent size={esNovedades ? 'grande' : 'medio'}>
        {esNovedades ? (
          <Novedades aviso={aviso} onCerrar={() => cerrar(true)} />
        ) : (
          <Bienvenida
            // Remontar al abrirse de nuevo: así vuelve a empezar en la mini
            // ventana en vez de quedarse donde la habían dejado. Resetear con
            // un efecto sería un setState durante el render de otro lado.
            key={bienvenidaPedida ? 'pedida' : 'auto'}
            nombre={usuarioActual?.nombre}
            planesCargados={planesCargados}
            modulos={modulos}
            onMirarSolo={() => cerrar(true)}
            onTerminarGuia={() => cerrar(false)}
            onSaltarGuia={() => cerrar(true)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════ BIENVENIDA ══════════════════════════

type Vista = 'mini' | 'pasos' | 'guia';

function Bienvenida({
  nombre,
  planesCargados,
  modulos,
  onMirarSolo,
  onTerminarGuia,
  onSaltarGuia,
}: {
  nombre?: string;
  planesCargados: boolean;
  modulos: readonly ModuloId[];
  onMirarSolo: () => void;
  /** Llegó al final. Ya vio todo: no hace falta dejarle nada pendiente. */
  onTerminarGuia: () => void;
  /** La abandonó a mitad de camino. Se le deja la notificación igual. */
  onSaltarGuia: () => void;
}) {
  const [vista, setVista] = useState<Vista>('mini');
  const pasos = useMemo(() => pasosDeGuia(modulos), [modulos]);

  // Mientras el catálogo real de planes no llegó, `modulos` sale de la tabla
  // estática del código y puede no coincidir con lo contratado. Ofrecer la
  // guía ahí sería prometerle al hotel módulos que no tiene, así que el botón
  // espera. Y si a esta persona le quedan menos de tres pasos, tampoco se
  // ofrece: dos pantallas no son un recorrido.
  const hayGuia = planesCargados && valeLaPenaLaGuia(modulos);

  if (vista === 'guia') {
    return <GuiaRapida pasos={pasos} onTerminar={onTerminarGuia} onSaltar={onSaltarGuia} />;
  }
  if (vista === 'pasos') {
    return <PrimerosPasos nombre={nombre} onPendiente={onMirarSolo} onListo={onTerminarGuia} />;
  }

  return (
    <div className="text-center px-1.5 pt-2.5">
      <div className="w-[52px] h-[52px] rounded-2xl bg-[#0F766E1A] flex items-center justify-center mx-auto mb-3.5">
        <Icons.Hand className="w-6 h-6 text-primary" />
      </div>
      <h2 className="text-[22px] font-semibold leading-tight tracking-tight">
        ¡Bienvenido a Hospi{nombre ? ', ' + nombre : ''}!
      </h2>
      <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-2 max-w-[44ch] mx-auto">
        Tu hotel todavía está vacío. Podés dejarlo listo en tres pasos
        {hayGuia ? ', o dar una vuelta rápida por el sistema antes de arrancar.' : '.'}
      </p>

      <div className="flex gap-2 justify-center mt-5 flex-wrap">
        <Button variant="ghost" onClick={onMirarSolo} className="text-muted-foreground">
          Mirar solo
        </Button>
        {hayGuia && (
          <Button variant="outline" onClick={() => setVista('guia')}>
            Guía rápida
          </Button>
        )}
        <Button onClick={() => setVista('pasos')} className="gap-1.5">
          Primeros pasos
          <Icons.ArrowRight className="w-[15px] h-[15px]" />
        </Button>
      </div>

      <p className="text-[11.5px] text-muted-foreground mt-4">
        Esto se muestra una sola vez. Después queda en tu perfil, abajo del menú.
      </p>
    </div>
  );
}

// ══════════════════════════ PRIMEROS PASOS ══════════════════════════

function PrimerosPasos({
  nombre,
  onPendiente,
  onListo,
}: {
  nombre?: string;
  /** Se va con pasos sin hacer: le queda la notificación. */
  onPendiente: () => void;
  /** Ya completó todo: dejarle un "te queda pendiente" sería mentirle. */
  onListo: () => void;
}) {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const tarifas = useHotelStore(s => s.tarifas);
  const setModulo = useHotelStore(s => s.setModulo);

  // Los usuarios no viven en el store (los maneja UsuariosModule con su propia
  // API), así que hay que pedirlos. Se pide UNA vez, y solo cuando alguien
  // abre este checklist — que es algo que pasa un puñado de veces por hotel,
  // durante el alta. Mientras no llega, el paso se muestra sin tilde: es
  // preferible pedirle de más a alguien que ya lo hizo antes que dar por hecho
  // algo que no sabemos.
  const [usuarios, setUsuarios] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    api.usuarios.list()
      .then(lista => { if (vivo && Array.isArray(lista)) setUsuarios(lista.length); })
      .catch(() => { /* queda en null: el paso se muestra sin tilde */ });
    return () => { vivo = false; };
  }, []);

  const pasos = useMemo(
    () => primerosPasos({
      habitaciones: Object.keys(habitaciones).length,
      tarifas: Object.keys(tarifas).length,
      usuarios,
    }),
    [habitaciones, tarifas, usuarios],
  );

  const hechos = pasosHechos(pasos);
  const siguiente = pasoActual(pasos);
  const listo = !siguiente;

  const cerrar = () => (listo ? onListo() : onPendiente());

  const irAlModulo = (paso: PasoInicial) => {
    setModulo(paso.modulo);
    // Va a hacer el paso, así que todavía le queda algo pendiente.
    onPendiente();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#0F766E1A] flex items-center justify-center shrink-0">
          <Icons.Hand className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold leading-tight">
            {listo
              ? '¡Ya está todo listo!'
              : hechos > 0
                ? `Vas bien${nombre ? ', ' + nombre : ''}`
                : `¡Bienvenido a Hospi${nombre ? ', ' + nombre : ''}!`}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {listo
              ? 'Tu hotel ya puede recibir reservas.'
              : 'Estos pasos dejan el hotel listo para recibir su primera reserva.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
            // Un hilito visible desde el arranque: una barra en cero se lee
            // como "algo no cargó".
            style={{ width: `${Math.max(4, (hechos / pasos.length) * 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
          {hechos} de {pasos.length}
        </span>
      </div>

      <div className="grid gap-2.5">
        {pasos.map((p, i) => {
          const esElSiguiente = siguiente?.id === p.id;
          return (
            <div
              key={p.id}
              className={`flex gap-3 items-start rounded-[10px] border p-3.5 ${
                esElSiguiente ? 'border-[#0F766E40] bg-[#0F766E12]' : p.hecho ? 'opacity-70' : ''
              }`}
            >
              <div
                className={`w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-xs font-bold mt-px ${
                  p.hecho
                    ? 'bg-success text-white'
                    : esElSiguiente
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {p.hecho ? <Icons.Check className="w-3.5 h-3.5" /> : i + 1}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight flex items-center gap-2 flex-wrap">
                  {p.hecho ? p.tituloHecho : p.titulo}
                  {p.hecho && p.detalle && (
                    <Badge variant="outline" className="h-[18px] px-1.5 text-[10px] font-bold uppercase tracking-wide border-[#05966940] bg-[#05966918] text-success">
                      {p.detalle}
                    </Badge>
                  )}
                  {!p.hecho && p.opcional && (
                    <Badge variant="outline" className="h-[18px] px-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Opcional
                    </Badge>
                  )}
                </p>
                {!p.hecho && (
                  <p className="text-[12.5px] text-muted-foreground leading-snug mt-1">{p.texto}</p>
                )}
              </div>

              {!p.hecho && (
                <Button
                  size="sm"
                  variant={esElSiguiente ? 'default' : 'outline'}
                  className="shrink-0 self-center gap-1.5"
                  onClick={() => irAlModulo(p)}
                >
                  {p.accion}
                  {esElSiguiente && <Icons.ArrowRight className="w-3.5 h-3.5" />}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap border-t pt-4 mt-5">
        <p className="text-xs text-muted-foreground">
          Podés volver a esto desde tu perfil, abajo del menú.
        </p>
        <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={cerrar}>
          {listo ? 'Cerrar' : 'Lo hago después'}
        </Button>
        {siguiente && (
          <Button onClick={() => irAlModulo(siguiente)}>{siguiente.accion}</Button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════ NOVEDADES ══════════════════════════

function Novedades({ aviso, onCerrar }: { aviso: AvisoAMostrar; onCerrar: () => void }) {
  if (!aviso || aviso.tipo !== 'novedades') return null;

  const nota = aviso.vecesRestantes > 0
    ? 'Te lo mostramos una vez más al próximo ingreso, y después queda en la campanita.'
    : 'Esto queda en la campanita por una semana.';

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0F766E1A] flex items-center justify-center shrink-0">
          <Icons.Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold leading-tight">Novedades</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {aviso.novedades.length} {aviso.novedades.length === 1 ? 'mejora nueva' : 'mejoras nuevas'} en el sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-2.5">
        {aviso.novedades.map((n: Novedad) => {
          const et = ETIQUETAS[n.tipo];
          const dias = diasRestantes(n, new Date());
          return (
            <div key={n.id} className="flex gap-3 rounded-lg border bg-card p-3.5">
              <Badge variant="outline" className={`shrink-0 h-fit mt-0.5 text-[10.5px] font-bold uppercase tracking-wide ${et.clase}`}>
                {et.texto}
              </Badge>
              <div className="min-w-0">
                <p className="text-sm font-medium mb-0.5">{n.titulo}</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{n.texto}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  {dias === 1 ? 'Queda visible hasta mañana' : `Queda visible ${dias} días más`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap border-t pt-4">
        <p className="text-xs text-muted-foreground">{nota}</p>
        <Button className="ml-auto" onClick={onCerrar}>Entendido</Button>
      </div>
    </>
  );
}

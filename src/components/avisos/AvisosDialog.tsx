'use client';

// Ventana de bienvenida y de novedades al iniciar sesión.
//
// Se muestra una sola vez por sesión del navegador, aunque el layout se
// vuelva a montar: el aviso es del momento de entrar, no de cada re-render.
//
// Reglas y contenido viven en src/lib/avisos.ts (módulo puro). Acá solo hay
// pantalla y el guardado de "ya lo vio".

import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as Icons from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { useNotificationStore } from '@/lib/notification-store';
import { modulosVisiblesPara } from '@/lib/plan-config';
import { MODULOS_SISTEMA } from '@/lib/types';
import {
  avisoParaMostrar,
  gruposDeBienvenida,
  parseAvisosVistos,
  diasRestantes,
  CLAVE_BIENVENIDA,
  type AvisoAMostrar,
  type Novedad,
  type TipoNovedad,
} from '@/lib/avisos';

const ETIQUETAS: Record<TipoNovedad, { texto: string; clase: string }> = {
  nuevo: { texto: 'Nuevo', clase: 'bg-[#0F766E16] text-primary border-[#0F766E40]' },
  mejora: { texto: 'Mejora', clase: 'bg-muted text-muted-foreground border-border' },
  arreglo: { texto: 'Arreglo', clase: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
};

/**
 * Marca de "ya se mostró en esta pestaña", por usuario.
 *
 * Va en sessionStorage y no en una variable del módulo porque el layout se
 * remonta solo (al cambiar de hotel, al volver de Configuración) y la ventana
 * se reabriría. Lleva el tenantUserId adentro para que un cambio de turno en
 * la misma pestaña sí vea lo suyo.
 *
 * Es un refuerzo, no la fuente de verdad: la cuenta real vive en la ficha del
 * usuario. Si el navegador no deja usar sessionStorage, lo peor que pasa es
 * que la ventana reaparezca tras un remontaje, y el contador del servidor la
 * frena igual al ingreso siguiente.
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

function IconoModulo({ nombre }: { nombre: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nombre];
  if (!Cmp) return null;
  return <Cmp className="w-[18px] h-[18px] text-primary" />;
}

export default function AvisosDialog() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);
  const setAvisosVistos = useHotelStore(s => s.setAvisosVistos);
  const addNotification = useNotificationStore(s => s.addNotification);

  const [cerrado, setCerrado] = useState(false);
  const tenantUserId = usuarioActual?.tenantUserId;

  // ── Qué mostrar ──
  // Se decide UNA sola vez, al montar, con el inicializador perezoso de
  // useState. No va en un efecto a propósito: el estado del usuario se
  // re-sincroniza con el servidor cada tanto, así que un efecto volvería a
  // correr con datos nuevos y podría reabrir la ventana encima de alguien que
  // ya la cerró.
  //
  // Cuando este componente se monta, usuarioActual ya existe: la pantalla que
  // lo contiene devuelve null sin sesión (ver app/page.tsx).
  const [aviso] = useState<AvisoAMostrar>(() => {
    if (!tenantUserId || yaSeMostro(tenantUserId)) return null;
    return avisoParaMostrar(parseAvisosVistos(usuarioActual?.avisosVistos), new Date());
  });
  const abierto = !!aviso && !cerrado;

  // Módulos que este hotel REALMENTE tiene: no se le prometen los de un plan
  // que no contrató.
  const grupos = useMemo(() => {
    return gruposDeBienvenida(modulosVisiblesPara(usuarioActual, planActual, planes));
  }, [planActual, planes, usuarioActual]);

  const cerrar = useCallback(async () => {
    setCerrado(true);
    if (!aviso || !tenantUserId) return;
    // Se marca acá, en el evento, no durante el render.
    marcarMostrado(tenantUserId);

    const claves = aviso.tipo === 'bienvenida'
      ? [CLAVE_BIENVENIDA]
      : aviso.novedades.map(n => n.id);

    // A la campanita, para que quede a mano toda la semana. La clave evita
    // que el segundo ingreso deje una entrada duplicada.
    if (aviso.tipo === 'novedades') {
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

    // Se guarda en la ficha del usuario. Si falla (sin red, sesión vencida),
    // no se rompe nada: el aviso vuelve a aparecer en el próximo ingreso,
    // que es el error correcto — mejor mostrarlo de más que perderlo.
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
  }, [aviso, tenantUserId, addNotification, setAvisosVistos]);

  if (!aviso) return null;

  const esBienvenida = aviso.tipo === 'bienvenida';
  const nota = aviso.vecesRestantes > 0
    ? 'Te lo mostramos una vez más al próximo ingreso, y después queda en la campanita.'
    : 'Esto queda en la campanita por una semana.';

  return (
    <Dialog open={abierto} onOpenChange={(v) => { if (!v) cerrar(); }}>
      <DialogContent size={esBienvenida ? 'trabajo' : 'grande'}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F766E1A] flex items-center justify-center shrink-0">
            {esBienvenida
              ? <Icons.Hand className="w-5 h-5 text-primary" />
              : <Icons.Sparkles className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <h2 className="text-xl font-semibold leading-tight">
              {esBienvenida ? `¡Bienvenido a Hospi${usuarioActual?.nombre ? ', ' + usuarioActual.nombre : ''}!` : 'Novedades'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {esBienvenida
                ? 'Esto es lo que vas a encontrar en el sistema.'
                : `${aviso.novedades.length} ${aviso.novedades.length === 1 ? 'mejora nueva' : 'mejoras nuevas'} en el sistema.`}
            </p>
          </div>
        </div>

        {esBienvenida ? (
          <div className="grid gap-4">
            {grupos.map(g => (
              <div key={g.grupo}>
                {g.titulo && (
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                    {g.titulo}
                  </p>
                )}
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.modulos.map(m => (
                    <div key={m.id} className="flex gap-2.5 items-start rounded-lg border bg-card p-3">
                      <div className="w-8 h-8 rounded-lg bg-[#0F766E12] flex items-center justify-center shrink-0">
                        <IconoModulo nombre={m.icon} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium leading-tight">{m.label}</p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{m.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
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
        )}

        <div className="flex items-center gap-3 flex-wrap border-t pt-4">
          <p className="text-xs text-muted-foreground">{nota}</p>
          <Button className="ml-auto" onClick={cerrar}>
            {esBienvenida ? 'Empezar' : 'Entendido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

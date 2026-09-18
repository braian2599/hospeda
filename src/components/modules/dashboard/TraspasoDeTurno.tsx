'use client';

// La tarjeta de "qué pasó mientras no estabas". Las reglas están en
// src/lib/traspaso-turno.ts, que es donde se pueden probar sin levantar nada.

import { useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHotelStore } from '@/lib/store';
import { modulosVisiblesPara } from '@/lib/plan-config';
import { traspasoDeTurno, ICONO_POR_TIPO, HORAS_DE_TRASPASO } from '@/lib/traspaso-turno';

/** Si está plegado o no. Es una comodidad de cada uno, no un dato del hotel. */
function claveDePliegue(perfil: string): string {
  return `hospi:traspaso-plegado:${perfil}`;
}

function leerPlegado(perfil: string | null | undefined): boolean {
  if (!perfil) return false;
  try {
    return localStorage.getItem(claveDePliegue(perfil)) === '1';
  } catch {
    // Incógnito o cookies bloqueadas: se muestra abierto, que es lo útil.
    return false;
  }
}

function guardarPlegado(perfil: string | null | undefined, plegado: boolean): void {
  if (!perfil) return;
  try {
    localStorage.setItem(claveDePliegue(perfil), plegado ? '1' : '0');
  } catch {
    // Sin storage se sigue funcionando, solo no se recuerda.
  }
}

function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nombre];
  if (!Cmp) return <Icons.Circle className={className} />;
  return <Cmp className={className} />;
}

const soloHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function TraspasoDeTurno() {
  const auditoria = useHotelStore(s => s.auditoria);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);
  const setModulo = useHotelStore(s => s.setModulo);

  const perfil = usuarioActual?.tenantUserId;
  const [plegado, setPlegado] = useState(() => leerPlegado(perfil));

  // Se recalcula con cada sincronización, que es justo lo que se quiere: es
  // una vista de los datos, no una foto guardada en ningún lado.
  const traspaso = useMemo(
    () => traspasoDeTurno(auditoria, { miPerfil: perfil }),
    [auditoria, perfil],
  );

  // El link a la auditoría completa solo se ofrece si esta persona la puede
  // abrir: Reportes es Premium/Elite y además necesita su permiso. Mandar a
  // alguien a una pantalla que no tiene es peor que no ofrecer nada.
  const puedeVerAuditoria = useMemo(
    () => modulosVisiblesPara(usuarioActual, planActual, planes).includes('reportes'),
    [usuarioActual, planActual, planes],
  );

  const alternar = () => {
    const nuevo = !plegado;
    setPlegado(nuevo);
    guardarPlegado(perfil, nuevo);
  };

  const hayAlgo = traspaso.eventos.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Icons.History className="w-4 h-4 text-muted-foreground" />
            Mientras no estabas
          </CardTitle>

          {hayAlgo && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {traspaso.eventos.length + traspaso.restantes}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={alternar}
            className="ml-auto h-7 text-xs text-muted-foreground gap-1"
            aria-expanded={!plegado}
          >
            {plegado ? 'Mostrar' : 'Ocultar'}
            <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${plegado ? '' : 'rotate-180'}`} />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {traspaso.seSabeCuandoEntraste
            ? `Lo que pasó en el hotel antes de que entraras, a las ${soloHora(traspaso.hasta.toISOString())}.`
            : `Lo que pasó en el hotel en las últimas ${HORAS_DE_TRASPASO} horas.`}
          {traspaso.personas.length > 0 && (
            <> Estuvieron: <span className="text-foreground font-medium">{traspaso.personas.join(', ')}</span>.</>
          )}
        </p>
      </CardHeader>

      {!plegado && (
        <CardContent className="space-y-1.5">
          {!hayAlgo && (
            <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-[#0F766E1A] text-primary">
              <Icons.CheckCircle className="w-4 h-4 shrink-0" />
              Sin novedades. No se registró ningún movimiento.
            </div>
          )}

          {traspaso.eventos.map(ev => (
            <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-[#0F766E12] flex items-center justify-center shrink-0 mt-px">
                <Icono nombre={ICONO_POR_TIPO[ev.tipo] || 'Circle'} className="w-[15px] h-[15px] text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug">{ev.detalle}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  <span className="font-mono">{soloHora(ev.fecha)}</span>
                  {' · '}
                  {ev.empleado}
                </p>
              </div>
            </div>
          ))}

          {traspaso.restantes > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                y {traspaso.restantes} {traspaso.restantes === 1 ? 'movimiento más' : 'movimientos más'}
              </p>
              {puedeVerAuditoria && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs ml-auto"
                  onClick={() => setModulo('reportes')}
                >
                  Ver todo
                  <Icons.ChevronRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

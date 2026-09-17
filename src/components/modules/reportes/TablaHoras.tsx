'use client';

// ==================== HORAS TRABAJADAS, EN TRES NIVELES ====================
//
// EL PROBLEMA: el detalle por día es mucha información. Un mes de cuatro
// personas son casi cien filas, y nadie lee cien filas en una pantalla.
//
// LA SOLUCIÓN: nunca se muestra todo junto.
//   Nivel 1 — una fila por persona (son cuatro). Es lo que se ve al entrar.
//   Nivel 2 — se toca una persona y se abren SUS DÍAS. Solo los días que
//             trabajó: los francos no ocupan lugar.
//   Nivel 3 — se toca un día y se ven los turnos con hora de entrada y salida.
//             Eso es lo que sirve para resolver un reclamo.
//
// El detalle completo, para sumar y filtrar, va al CSV. Nadie lee cien filas
// en una pantalla; todo el mundo las lee en una planilla.

import { Fragment, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { comoHoras, HORAS_SOSPECHOSAS, type HorasDeEmpleado, type DiaTrabajado } from '@/lib/horas-trabajadas';

const soloHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const diaLegible = (fecha: string) =>
  new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'short', day: '2-digit', month: 'short',
  });

/** Nivel 3: los turnos de un día. */
function Turnos({ dia }: { dia: DiaTrabajado }) {
  return (
    <div className="space-y-1 py-1">
      {dia.turnos.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="font-mono">{soloHora(t.entrada)}</span>
          <span className="text-muted-foreground">→</span>
          {t.salida ? (
            <>
              <span className="font-mono">{soloHora(t.salida)}</span>
              <span className="ml-1 font-medium">{comoHoras(t.minutos)}</span>
              {t.sospechoso && (
                <Badge variant="outline" className="h-4 border-[#F59E0B80] px-1 text-[10px] text-warning">
                  revisar: más de {HORAS_SOSPECHOSAS} h
                </Badge>
              )}
            </>
          ) : (
            // No se inventa una hora de salida. Se dice que falta, que es lo
            // único honesto y lo que le da al encargado algo que preguntar.
            <span className="text-destructive">sin cierre registrado — no se cuenta</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Nivel 2: los días de una persona. */
function Dias({ dias }: { dias: DiaTrabajado[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="space-y-0.5 py-1 pl-2">
      {dias.map(d => {
        const esteAbierto = abierto === d.fecha;
        return (
          <div key={d.fecha}>
            <button
              type="button"
              onClick={() => setAbierto(esteAbierto ? null : d.fecha)}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted"
            >
              <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${esteAbierto ? 'rotate-90' : ''}`} />
              <span className="w-24 shrink-0 capitalize">{diaLegible(d.fecha)}</span>
              <span className="w-20 shrink-0 font-medium">{comoHoras(d.minutos)}</span>
              <span className="text-muted-foreground">
                {d.turnos.length} {d.turnos.length === 1 ? 'turno' : 'turnos'}
              </span>
              {d.sinCerrar > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {d.sinCerrar} sin cierre
                </Badge>
              )}
            </button>
            {esteAbierto && <div className="pl-7"><Turnos dia={d} /></div>}
          </div>
        );
      })}
    </div>
  );
}

export interface TablaHorasProps {
  filas: HorasDeEmpleado[];
  cargando: boolean;
  error: string | null;
  recortado: boolean;
}

/** Nivel 1: una fila por persona. */
export default function TablaHoras({ filas, cargando, error, recortado }: TablaHorasProps) {
  const [abierta, setAbierta] = useState<string | null>(null);

  if (cargando) {
    return (
      <Card className="space-y-2 p-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    );
  }

  const totalSinCerrar = filas.reduce((s, f) => s + f.sinCerrar, 0);

  return (
    <Card>
      {/* Si el resumen está incompleto o tiene turnos abiertos, se dice ARRIBA
          y no en una nota al pie: es lo que define cuánto confiar en el total. */}
      {(totalSinCerrar > 0 || recortado) && (
        <div className="flex items-start gap-2 border-b bg-[#F59E0B14] px-4 py-2.5 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <div>
            {totalSinCerrar > 0 && (
              <p>
                <span className="font-medium">
                  {totalSinCerrar} {totalSinCerrar === 1 ? 'turno' : 'turnos'} sin cierre registrado.
                </span>{' '}
                No se suman a las horas. Pasa cuando se cierra la pestaña o se apaga la máquina
                sin salir del sistema: revisalo con la persona antes de pagar.
              </p>
            )}
            {recortado && (
              <p className="mt-1">
                El período tiene demasiados registros y se mostró solo una parte.
                Acortá el rango de fechas para ver el total correcto.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead className="text-center">Horas</TableHead>
              <TableHead className="text-center">Días</TableHead>
              <TableHead className="hidden text-center sm:table-cell">Promedio</TableHead>
              <TableHead className="text-center">Sin cierre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No hay inicios de sesión registrados en este período.
                </TableCell>
              </TableRow>
            ) : (
              filas.map(f => {
                const estaAbierta = abierta === f.clave;
                const promedio = f.diasTrabajados > 0 ? Math.round(f.minutos / f.diasTrabajados) : 0;
                return (
                  // Fragment CON key: sin ella React no puede seguir las filas
                  // al abrir y cerrar el detalle, y reusa la fila equivocada.
                  <Fragment key={f.clave}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setAbierta(estaAbierta ? null : f.clave)}
                    >
                      <TableCell className="text-xs font-medium sm:text-sm">
                        <span className="flex items-center gap-1.5">
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${estaAbierta ? 'rotate-90' : ''}`} />
                          {f.nombre}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium sm:text-sm">{comoHoras(f.minutos)}</TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">{f.diasTrabajados}</TableCell>
                      <TableCell className="hidden text-center text-xs sm:table-cell sm:text-sm">{comoHoras(promedio)}</TableCell>
                      <TableCell className="text-center">
                        {f.sinCerrar > 0
                          ? <Badge variant="destructive" className="text-xs">{f.sinCerrar}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                    {estaAbierta && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-0">
                          <Dias dias={f.dias} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

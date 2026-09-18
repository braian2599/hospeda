'use client';

// ==================== GUÍA RÁPIDA ====================
//
// Un recorrido por áreas, adentro de la ventana. Adentro y no señalando la
// pantalla real (estilo "spotlight"), por tres motivos concretos de ESTE
// sistema:
//
//   1. La sidebar está oculta en celular (es un cajón que además se cierra
//      solo al elegir un módulo) y arranca colapsada en escritorio. Un tour
//      anclado a ella tendría que abrir y cerrar el cajón en cada paso.
//   2. El día 1 todos los módulos están vacíos. Un recorrido que aterriza en
//      un Reservas sin nada no enseña nada y parece roto.
//   3. Anclar a elementos del DOM se rompe en silencio con cualquier cambio de
//      layout: no lo agarra tsc, ni eslint, ni el build. Un tour roto que
//      nadie nota es peor que no tener tour.
//
// Lo que se pierde: no le muestra la pantalla de verdad, la describe.

import { useCallback, useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PasoDeGuia } from '@/lib/avisos';

function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[nombre];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}

interface Props {
  pasos: PasoDeGuia[];
  /** Llegó al final. */
  onTerminar: () => void;
  /**
   * La abandonó a mitad de camino. Es distinto de terminarla: el que la deja
   * por la mitad no vio todo, así que el que llama le puede dejar algo
   * pendiente.
   */
  onSaltar: () => void;
}

export default function GuiaRapida({ pasos, onTerminar, onSaltar }: Props) {
  const total = pasos.length;
  const [indice, setIndice] = useState(0);
  // Hacia dónde entra el paso nuevo. La animación tiene que seguir la
  // dirección del movimiento: si "atrás" entrara desde la derecha, se sentiría
  // que avanzaste.
  const [haciaAdelante, setHaciaAdelante] = useState(true);

  const ir = useCallback((destino: number) => {
    if (destino < 0 || destino >= total || destino === indice) return;
    // La dirección se calcula ACÁ y no adentro del updater de setIndice:
    // meter un setState dentro de otro es un efecto colateral en un reducer,
    // y React lo puede ejecutar dos veces.
    setHaciaAdelante(destino > indice);
    setIndice(destino);
  }, [indice, total]);

  // Flechas del teclado. Va en window y no en un onKeyDown del contenedor
  // porque el foco arranca en un botón del pie: con el handler en el div, las
  // flechas solo andarían después de clickear el fondo.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(indice + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(indice - 1); }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [ir, indice]);

  if (total === 0) return null;

  const paso = pasos[indice];
  const esUltimo = indice === total - 1;

  return (
    <div className="flex flex-col">
      {/* Progreso */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${((indice + 1) / total) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
          {indice + 1} de {total}
        </span>
      </div>

      {/*
        Alto mínimo fijo, calculado sobre el paso más alto (tres módulos).
        Sin esto la ventana se encoge y se estira en cada click, que es lo
        primero que delata un carrusel mal hecho. En celular el texto envuelve
        más, por eso el mínimo es mayor.
      */}
      <div className="min-h-[26rem] sm:min-h-[20rem]">
        <div
          // La key fuerza el remontaje del bloque: sin ella React reusa los
          // nodos y la animación no vuelve a dispararse.
          key={paso.id}
          className={haciaAdelante ? 'paso-adelante' : 'paso-atras'}
        >
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#0F766E1A] flex items-center justify-center shrink-0">
              <Icono nombre={paso.icono} className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Paso {indice + 1} de {total}
              </p>
              <h3 className="text-lg sm:text-xl font-semibold leading-tight">{paso.titulo}</h3>
            </div>
          </div>

          <p className="text-[13px] text-muted-foreground leading-relaxed mb-4 max-w-[60ch]">
            {paso.entrada}
          </p>

          <div className="grid gap-2.5">
            {paso.modulos.map(m => (
              <div key={m.id} className="flex gap-3 items-start rounded-lg border bg-background p-3">
                <div className="w-8 h-8 rounded-lg bg-[#0F766E12] flex items-center justify-center shrink-0">
                  <Icono nombre={m.icono} className="w-[18px] h-[18px] text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold leading-tight">{m.label}</p>
                  <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">{m.descripcion}</p>
                </div>
              </div>
            ))}

            {esUltimo && (
              <div className="flex gap-3 items-start rounded-lg border border-dashed p-3">
                <div className="w-8 h-8 rounded-lg bg-[#0F766E12] flex items-center justify-center shrink-0">
                  <Icons.Check className="w-[18px] h-[18px] text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold leading-tight">Eso es todo</p>
                  <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">
                    Podés volver a ver esta guía cuando quieras desde tu perfil, abajo del menú.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pie */}
      <div className="flex items-center gap-2 flex-wrap border-t pt-4 mt-5">
        <Button variant="ghost" size="sm" onClick={onSaltar} className="text-muted-foreground">
          Saltar guía
        </Button>

        <div className="flex gap-1.5 items-center mx-auto">
          {pasos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => ir(i)}
              aria-label={`Paso ${i + 1}: ${p.titulo}`}
              aria-current={i === indice ? 'step' : undefined}
              className={`h-[7px] rounded-full transition-all duration-200 ${
                i === indice ? 'w-5 bg-primary' : 'w-[7px] bg-border hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => ir(indice - 1)}
          disabled={indice === 0}
          className="gap-1.5"
        >
          <Icons.ArrowLeft className="w-3.5 h-3.5" />
          Atrás
        </Button>
        <Button
          size="sm"
          onClick={() => (esUltimo ? onTerminar() : ir(indice + 1))}
          className="gap-1.5"
        >
          {esUltimo ? 'Empezar a usar Hospi' : 'Siguiente'}
          {!esUltimo && <Icons.ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

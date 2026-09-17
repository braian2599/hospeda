'use client';

// ==================== HOSPI, EL ASISTENTE ====================
// Hospi vive flotando en la esquina de TODAS las pantallas del sistema, no en
// un módulo del menú. La razón: el recepcionista necesita leer cómo hacer algo
// SIN salir de la pantalla donde lo tiene que hacer. Un módulo lo obligaría a
// irse justo de donde está el problema.
//
// Al tocarlo, Hospi vuela hasta el encabezado del chat. No es un adorno: el
// panel aparece vacío y el avatar se enciende recién cuando Hospi llega, así
// queda claro de dónde salió la ventana.
//
// Solo aparece si el hotel tiene la integración 'asistente' habilitada. El
// chequeo de verdad está en el servidor (/api/asistente usa requireFeatureFlag);
// esto es nada más para no mostrar un botón que va a dar 403.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHotelStore } from '@/lib/store';
import { modulosVisiblesPara } from '@/lib/plan-config';
import { sugerenciasDe, nombreDeModulo } from '@/lib/ai/sugerencias';
import type { MensajeAsistente } from '@/lib/ai/asistente';
import { crearLector } from '@/lib/ai/asistente-stream';
import HospiCara from './HospiCara';
import TextoFormateado from './TextoFormateado';
import BotonCopiar from './BotonCopiar';
import estilos from './hospi.module.css';

/** Tope del historial que se manda. El servidor rechaza más de 20. */
const MAX_MENSAJES = 20;

const MS_VUELO_IDA = 460;
const MS_VUELO_VUELTA = 360;

/** El saludo aparece una vez por inicio de sesión, por usuario. */
function claveSaludo(tenantUserId: string) {
  return `hospi:saludado:${tenantUserId}`;
}

function yaSaludo(tenantUserId: string): boolean {
  try { return sessionStorage.getItem(claveSaludo(tenantUserId)) === '1'; } catch { return false; }
}

function marcarSaludado(tenantUserId: string): void {
  try { sessionStorage.setItem(claveSaludo(tenantUserId), '1'); } catch { /* sin storage, se muestra de nuevo */ }
}

export default function AsistenteBurbuja() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const moduloActivo = useHotelStore(s => s.moduloActivo);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);

  const [abierto, setAbierto] = useState(false);
  const [enVuelo, setEnVuelo] = useState(false);
  const [retratoListo, setRetratoListo] = useState(false);
  const [saludoVisible, setSaludoVisible] = useState(false);
  const [historial, setHistorial] = useState<MensajeAsistente[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  /** Lo que va llegando de la respuesta todavía sin terminar. */
  const [parcial, setParcial] = useState('');
  /** Cuántos píxeles del fondo de la pantalla tapa el teclado del celular. */
  const [teclado, setTeclado] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const burbujaRef = useRef<HTMLButtonElement>(null);
  const retratoRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLTextAreaElement>(null);
  const voladorRef = useRef<HTMLDivElement | null>(null);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);

  const habilitado = !!usuarioActual?.featureFlags?.asistente;
  const tenantUserId = usuarioActual?.tenantUserId;

  const sugerencias = useMemo(() => sugerenciasDe(moduloActivo), [moduloActivo]);
  // Qué módulos ve ESTA persona. Va en la consulta para que Hospi pueda
  // contestar "no lo ves porque…" en vez de explicarle cómo usar algo que no
  // tiene en el menú. El servidor lo valida contra la lista real de módulos.
  const modulosVisibles = useMemo(
    () => modulosVisiblesPara(usuarioActual, planActual, planes),
    [usuarioActual, planActual, planes],
  );
  const nombreModulo = useMemo(() => nombreDeModulo(moduloActivo), [moduloActivo]);

  // ── Saludo: una vez por inicio de sesión ──
  useEffect(() => {
    if (!habilitado || !tenantUserId || yaSaludo(tenantUserId)) return;
    const aparecer = setTimeout(() => {
      setSaludoVisible(true);
      marcarSaludado(tenantUserId);
    }, 1200);
    const irse = setTimeout(() => setSaludoVisible(false), 10_200);
    return () => { clearTimeout(aparecer); clearTimeout(irse); };
  }, [habilitado, tenantUserId]);

  // Los temporizadores del vuelo se cancelan al desmontar: si el layout se
  // remonta a mitad de camino, un setTimeout suelto tocaría un nodo muerto.
  useEffect(() => {
    const lista = temporizadores.current;
    return () => {
      for (const t of lista) clearTimeout(t);
      voladorRef.current?.remove();
      voladorRef.current = null;
    };
  }, []);

  const programar = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    temporizadores.current.push(t);
    return t;
  };

  /**
   * Lleva una copia de Hospi de un lugar al otro.
   *
   * Las posiciones NO se calculan con números a mano: se miden las CABEZAS de
   * los dos dibujos en pantalla y de ahí sale el recorrido. Así el vuelo cae
   * justo aunque después se cambie el tamaño de Hospi o del avatar.
   */
  const volar = useCallback((haciaElChat: boolean, desfase: number, alTerminar: () => void) => {
    const origen = haciaElChat ? burbujaRef.current : retratoRef.current;
    const destino = haciaElChat ? retratoRef.current : burbujaRef.current;
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!origen || !destino || sinMovimiento) { alTerminar(); return; }

    const cabezaOrigen = origen.querySelector<HTMLElement>(`.${estilos.cabeza}`);
    const cabezaDestino = destino.querySelector<HTMLElement>(`.${estilos.cabeza}`);
    const caraOrigen = origen.querySelector<HTMLElement>(`.${estilos.cara}`);
    if (!cabezaOrigen || !cabezaDestino || !caraOrigen) { alTerminar(); return; }

    const cajaOrigen = origen.getBoundingClientRect();
    const cO = cabezaOrigen.getBoundingClientRect();
    const cD = cabezaDestino.getBoundingClientRect();
    if (!cO.width || !cD.width) { alTerminar(); return; }

    const volador = document.createElement('div');
    volador.className = estilos.volador;
    volador.style.left = `${cajaOrigen.left}px`;
    volador.style.top = `${cajaOrigen.top}px`;
    volador.style.width = `${cajaOrigen.width}px`;
    volador.style.height = `${cajaOrigen.height}px`;

    // La escala la da un selector distinto en cada lugar, así que se copia el
    // transform ya calculado en vez de confiar en las clases.
    const copia = caraOrigen.cloneNode(true) as HTMLElement;
    const calculado = getComputedStyle(caraOrigen);
    copia.style.transform = calculado.transform;
    copia.style.filter = calculado.filter;
    volador.appendChild(copia);
    document.body.appendChild(volador);
    voladorRef.current = volador;

    const escala = cD.width / cO.width;
    const tx = cD.left - cajaOrigen.left - escala * (cO.left - cajaOrigen.left);
    const ty = cD.top - cajaOrigen.top - escala * (cO.top - cajaOrigen.top);
    const arco = haciaElChat ? -26 : -18;

    const animacion = volador.animate([
      { transform: `translate(0px, ${desfase}px) scale(1)` },
      { transform: `translate(${tx * .5}px, ${(desfase + ty) * .5 + arco}px) scale(${(1 + escala) / 2})`, offset: .55 },
      { transform: `translate(${tx}px, ${ty}px) scale(${escala})` },
    ], {
      duration: haciaElChat ? MS_VUELO_IDA : MS_VUELO_VUELTA,
      easing: 'cubic-bezier(.34,.9,.3,1)',
      fill: 'forwards',
    });

    animacion.onfinish = () => {
      alTerminar();
      if (haciaElChat) {
        // Contra el avatar, que está quieto, un fundido disimula el cambio.
        volador.style.transition = 'opacity .16s ease';
        volador.style.opacity = '0';
        programar(() => { volador.remove(); if (voladorRef.current === volador) voladorRef.current = null; }, 180);
      } else {
        // De vuelta en la esquina el cambio va instantáneo: el Hospi real
        // retoma el flote apenas aparece, y si la copia siguiera un rato
        // encima se verían los dos separándose.
        volador.remove();
        if (voladorRef.current === volador) voladorRef.current = null;
      }
    };
  }, []);

  const abrir = useCallback(() => {
    if (enVuelo || abierto) return;
    setEnVuelo(true);
    setSaludoVisible(false);
    if (tenantUserId) marcarSaludado(tenantUserId);

    const boton = burbujaRef.current;
    let desfase = 0;
    if (boton) {
      // Hospi está flotando: en el momento del clic puede estar hasta 5px
      // arriba de su reposo. Si la copia saliera del reposo, se vería un
      // saltito justo al tocarlo. Se mide cuánto está levantado.
      const capa = boton.querySelector<HTMLElement>(`.${estilos.flota}`);
      const antes = capa?.getBoundingClientRect().top ?? 0;
      boton.classList.add(estilos.volando);
      desfase = antes - (capa?.getBoundingClientRect().top ?? 0);
    }

    setRetratoListo(false);
    setAbierto(true);

    requestAnimationFrame(() => volar(true, desfase, () => {
      setRetratoListo(true);
      setEnVuelo(false);
      entradaRef.current?.focus();
    }));
  }, [enVuelo, abierto, tenantUserId, volar]);

  const cerrar = useCallback(() => {
    if (enVuelo || !abierto) return;
    setEnVuelo(true);
    volar(false, 0, () => {
      burbujaRef.current?.classList.remove(estilos.volando);
      setEnVuelo(false);
      burbujaRef.current?.focus();
    });
    setRetratoListo(false);
    setAbierto(false);
  }, [enVuelo, abierto, volar]);

  // ── El teclado del celular tapaba el cuadro de escribir ──
  // En Android el teclado NO achica la ventana: se dibuja encima. Así que un
  // panel pegado al borde de abajo queda justo debajo del teclado, y el
  // recepcionista escribe a ciegas o directamente no ve dónde tocar.
  //
  // visualViewport es lo único que reporta cuánto quedó tapado de verdad. Ese
  // número se pasa como variable CSS y el panel se despega del piso esa misma
  // cantidad. En una pantalla grande vale siempre cero y no cambia nada.
  useEffect(() => {
    if (!abierto) { setTeclado(0); return; }
    const vv = window.visualViewport;
    if (!vv) return; // navegador viejo: queda como estaba, sin empeorar nada
    const medir = () => {
      setTeclado(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    };
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => {
      vv.removeEventListener('resize', medir);
      vv.removeEventListener('scroll', medir);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, cerrar]);

  // ── Conversación ──
  // La respuesta llega en vivo: el servidor manda una línea JSON por pedazo de
  // texto ({"t":"…"}), y cierra con {"fin":true}. Ese {"fin":true} es lo que
  // deja distinguir una respuesta terminada de una cortada por el camino: sin
  // él, media instrucción se mostraría como si estuviera completa.
  const preguntar = useCallback(async (texto: string) => {
    const limpio = texto.trim();
    if (!limpio || cargando) return;

    // Se recorta al tope que acepta el servidor, dejando siempre la pregunta
    // nueva: sin esto, una charla larga empezaría a dar 400 sin explicación.
    const siguiente: MensajeAsistente[] = [...historial, { role: 'user' as const, content: limpio }].slice(-MAX_MENSAJES);
    setHistorial(siguiente);
    setPregunta('');
    setError(null);
    setParcial('');
    setCargando(true);

    // Ante cualquier falla la charla vuelve a como estaba y la pregunta al
    // cuadro de texto, para no obligar a reescribirla.
    const deshacer = (mensaje: string) => {
      setError(mensaje);
      setHistorial(historial);
      setPregunta(limpio);
      setParcial('');
    };

    try {
      const res = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historial: siguiente, modulo: moduloActivo, plan: planActual, modulos: modulosVisibles }),
      });

      // Los errores previos a la respuesta (sin plan, tope de gasto, demasiadas
      // consultas) siguen llegando como JSON con su código de estado.
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        deshacer(data?.error || 'No pude responder. Probá de nuevo en un rato.');
        return;
      }
      if (!res.body) {
        deshacer('No se pudo leer la respuesta.');
        return;
      }

      // getReader() y no `for await (… of res.body)`: iterar el cuerpo así no
      // existe en Chrome, y el personal del hotel usa Chrome.
      const flujo = res.body.getReader();
      const decodificador = new TextDecoder();
      const lector = crearLector(setParcial);

      for (;;) {
        const { done, value } = await flujo.read();
        if (done) break;
        // stream:true para que no se parta una letra con acento entre dos
        // pedazos y salga un rombito negro en la mitad de una palabra.
        lector.empujar(decodificador.decode(value, { stream: true }));
      }
      lector.empujar(decodificador.decode());
      lector.cerrar();

      if (lector.fallo) { deshacer(lector.fallo); return; }
      if (!lector.termino || !lector.texto.trim()) {
        deshacer('Se cortó la respuesta. Probá de nuevo.');
        return;
      }

      setHistorial([...siguiente, { role: 'assistant' as const, content: lector.texto }]);
      setParcial('');
    } catch {
      deshacer('No se pudo conectar. Revisá la conexión.');
    } finally {
      setCargando(false);
    }
  }, [historial, cargando, moduloActivo, planActual, modulosVisibles]);

  // El chat baja solo a medida que se escribe la respuesta, no solo al final.
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [historial, parcial, cargando]);

  if (!habilitado || !usuarioActual) return null;

  return (
    <>
      {/* Cartelito de saludo */}
      {saludoVisible && !abierto && (
        <div
          role="status"
          className="fixed right-[95px] bottom-6 z-50 max-w-[250px] rounded-xl border bg-popover text-popover-foreground shadow-lg py-2.5 pl-3.5 pr-8 animate-in fade-in slide-in-from-right-2 duration-300"
        >
          <button
            type="button"
            onClick={() => setSaludoVisible(false)}
            aria-label="Cerrar saludo"
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded text-muted-foreground hover:bg-muted flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
          <p className="text-[13.5px] font-semibold leading-tight">¡Hola! Soy Hospi 👋</p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">¿En qué puedo ayudarte?</p>
        </div>
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Asistente Hospi"
        aria-hidden={!abierto}
        style={{ ['--teclado' as string]: `${teclado}px` }}
        className={`fixed z-[49] flex flex-col overflow-hidden border bg-background shadow-2xl transition-opacity duration-200
          right-6 bottom-[82px] w-[370px] h-[min(560px,calc(100vh-130px))] rounded-xl
          max-sm:right-0 max-sm:left-0 max-sm:w-auto max-sm:rounded-b-none
          max-sm:top-[12vh] max-sm:h-auto max-sm:bottom-[var(--teclado,0px)]
          ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="relative flex items-center justify-center gap-3 px-11 py-4 border-b bg-gradient-to-b from-muted/40 to-background">
          <div ref={retratoRef} className={`${estilos.retrato} ${retratoListo ? estilos.retratoListo : ''}`}>
            <HospiCara />
          </div>
          <div className="text-left">
            <p className="text-[15px] font-semibold leading-tight">Hospi</p>
            <p className="text-xs text-muted-foreground mt-0.5">Estás en {nombreModulo}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5">
          {historial.length === 0 && (
            <div className="max-w-[84%] self-start rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-[13.5px] leading-relaxed">
              ¡Hola! Soy Hospi 👋 ¿En qué puedo ayudarte?
            </div>
          )}
          {/* Lo que escribe el usuario va tal cual. Lo que contesta Hospi pasa
              por el formateador (el prompt le pide pasos numerados y negritas,
              y sin esto se veían los asteriscos crudos) y lleva el botón de
              copiar: son instrucciones para hacer en otra pantalla. */}
          {historial.map((m, i) => m.role === 'user' ? (
            <div
              key={i}
              className="max-w-[84%] self-end rounded-xl rounded-br-sm bg-primary px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap text-primary-foreground"
            >
              {m.content}
            </div>
          ) : (
            <div key={i} className="flex max-w-[84%] flex-col items-start gap-0.5 self-start">
              <div className="rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-[13.5px] leading-relaxed">
                <TextoFormateado texto={m.content} />
              </div>
              <BotonCopiar texto={m.content} />
            </div>
          ))}
          {parcial && (
            <div className="max-w-[84%] self-start bg-muted rounded-xl rounded-bl-sm px-3 py-2 text-[13.5px] leading-relaxed">
              <TextoFormateado texto={parcial} />
            </div>
          )}
          {cargando && !parcial && (
            <div className="self-start flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Pensando…
            </div>
          )}
          {error && <p className="text-xs text-destructive px-1">{error}</p>}
        </div>

        {sugerencias.length > 0 && historial.length === 0 && (
          <div className="px-3.5 pb-2.5">
            <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">
              Sugerencias para {nombreModulo}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sugerencias.map(s => (
                <button
                  key={s}
                  type="button"
                  disabled={cargando}
                  onClick={() => preguntar(s)}
                  className="text-xs px-2.5 py-1.5 rounded-full border bg-background hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); preguntar(pregunta); }}
          className="flex gap-2 p-2.5 border-t bg-background"
        >
          <Textarea
            ref={entradaRef}
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(pregunta); }
            }}
            placeholder="Escribí tu pregunta…"
            rows={1}
            aria-label="Tu pregunta"
            className="resize-none min-h-[38px] max-h-24 text-[13.5px]"
          />
          <Button type="submit" size="icon" disabled={cargando || !pregunta.trim()} aria-label="Enviar">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Hospi */}
      <button
        ref={burbujaRef}
        type="button"
        onClick={abrir}
        aria-label="Abrir el asistente Hospi"
        aria-expanded={abierto}
        className={estilos.burbuja}
      >
        <div className={estilos.flota}>
          <HospiCara />
        </div>
      </button>
    </>
  );
}

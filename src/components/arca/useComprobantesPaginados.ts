'use client';

// Una página de comprobantes (Facturas, Notas, Presupuestos), pedida al
// servidor. Antes se traían hasta 100 de una y se mostraban todos: con
// muchos comprobantes la lista no terminaba nunca y el sistema se ponía
// lento, y los más viejos directamente no aparecían. Ahora se trae solo la
// página que se ve, y la búsqueda también la hace el servidor (así encuentra
// cualquier comprobante, no solo los últimos 100).
//
// La usan ARCA (DocumentosTab) y Comprobantes → Comprobantes emitidos. Si el
// tipo cambia en la misma pantalla, quien lo cambia vuelve a la página 1.

import { useEffect, useState } from 'react';
import type { ComprobanteListado, TipoListado } from '@/components/modules/ComprobantesModule';

/** Filas por página. */
export const POR_PAGINA = 15;

/** Cuánto se espera después de la última tecla antes de buscar. */
const ESPERA_BUSQUEDA_MS = 350;

export function useComprobantesPaginados({ tipo, q, version = 0 }: {
  tipo: TipoListado;
  /** Lo escrito en el buscador. */
  q: string;
  /** Cambia cuando hay que volver a traer (se emitió o anuló algo). */
  version?: number | string;
}) {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState(q.trim());
  // Lo último que llegó del servidor, con el pedido al que corresponde: si
  // no coincide con el pedido de ahora, está cargando (y mientras tanto se
  // sigue viendo la página anterior, sin parpadeo).
  const [resultado, setResultado] = useState<{ clave: string; items: ComprobanteListado[]; total: number } | null>(null);

  // La búsqueda se manda un instante después de dejar de escribir, y
  // vuelve a la página 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(prev => {
        const nueva = q.trim();
        if (nueva !== prev) setPagina(1);
        return nueva;
      });
    }, ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(t);
  }, [q]);

  const clave = `${tipo}|${pagina}|${busqueda}|${version}`;

  useEffect(() => {
    let cancelado = false;
    const params = new URLSearchParams({ tipo, pagina: String(pagina), take: String(POR_PAGINA) });
    // Facturas: solo las autorizadas por ARCA. Una "Factura" sin CAE es el
    // recibo interno de una reserva, que se ve en el historial de pagos.
    if (tipo === 'Factura') params.set('conCae', '1');
    if (busqueda) params.set('q', busqueda);
    fetch(`/api/comprobantes?${params.toString()}`)
      .then(r => r.json())
      .then((data: { items?: ComprobanteListado[]; total?: number }) => {
        if (cancelado || !Array.isArray(data.items)) return;
        const total = data.total ?? 0;
        const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
        // Si se anuló el último de la última página, esa página quedó vacía:
        // se pasa a la anterior en vez de mostrar una lista vacía.
        if (data.items.length === 0 && pagina > totalPaginas) { setPagina(totalPaginas); return; }
        setResultado({ clave, items: data.items, total });
      })
      .catch(() => {
        // Sin conexión: se deja de mostrar "cargando" con lo que había.
        if (!cancelado) setResultado(prev => ({ clave, items: prev?.items ?? [], total: prev?.total ?? 0 }));
      });
    return () => { cancelado = true; };
  }, [tipo, pagina, busqueda, version, clave]);

  const total = resultado?.total ?? 0;
  return {
    items: resultado?.items ?? [],
    total,
    pagina,
    setPagina,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    cargando: resultado?.clave !== clave,
    /** true si lo que se ve corresponde a una búsqueda. */
    buscando: !!busqueda,
  };
}

'use client';

// Módulo ARCA: todo lo que se emite. Facturas (desde "Para facturar"), notas
// de crédito y débito y presupuestos. Tiene su propio permiso,
// aparte de Comprobantes: se puede cobrar sin poder facturar (decisión del
// dueño, 28/09). Comprobantes quedó para cobrar y ver.

import { useCallback, useState } from 'react';
import { Landmark, Zap, FileText, FileMinus, FilePlus, ClipboardList } from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFilterState } from '@/hooks/use-filter-state';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/format';
import { useDatosFiscales } from '@/components/modules/ComprobantesModule';
import ParaFacturarTab from '@/components/arca/ParaFacturarTab';
import DocumentosTab from '@/components/arca/DocumentosTab';

type Pestana = 'para-facturar' | 'facturas' | 'nc' | 'nd' | 'presupuestos';

const CLASE_TAB = 'data-[state=active]:bg-primary data-[state=active]:text-white transition-all';

export default function ArcaModule() {
  const conArca = useHotelStore(s => !!s.usuarioActual?.featureFlags?.facturacionArca);
  const fiscal = useDatosFiscales();
  const [pestana, setPestana] = useFilterState<Pestana>('arca_pestana', conArca ? 'para-facturar' : 'presupuestos');
  const [resumen, setResumen] = useState<{ cantidad: number; importe: number; facturadoEsteMes: { cantidad: number; importe: number } } | null>(null);
  // Sube cada vez que se factura algo: la pestaña Facturas vuelve a traer.
  const [version, setVersion] = useState(0);
  const onFacturado = useCallback(() => setVersion(v => v + 1), []);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Landmark} title="ARCA" subtitle="Facturas, notas de crédito y débito y presupuestos">
        {fiscal?.iva && (
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs">
            <span className={`w-2 h-2 rounded-full ${conArca ? 'bg-success' : 'bg-muted-foreground'}`} />
            {conArca ? 'Facturación con ARCA activa' : 'Sin facturación con ARCA'} · {fiscal.iva}
          </span>
        )}
      </ModuleHeader>

      {conArca && resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#0F766E4D] bg-[#0F766E14] p-4">
            <p className="text-2xl font-bold text-primary">{resumen.cantidad}</p>
            <p className="text-sm text-muted-foreground">Reservas cobradas sin facturar · {formatMoney(resumen.importe)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-bold">{formatMoney(resumen.facturadoEsteMes.importe)}</p>
            <p className="text-sm text-muted-foreground">Facturado este mes · {resumen.facturadoEsteMes.cantidad} factura{resumen.facturadoEsteMes.cantidad !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {!conArca && (
        <div className="rounded-lg border border-[#0284C733] bg-[#0284C70D] px-3.5 py-2.5 text-sm">
          <span className="font-medium">Tu hotel todavía no factura con ARCA.</span>{' '}
          <span className="text-muted-foreground">Los presupuestos se usan igual. Para facturar, el dueño lo activa en Configuración → Facturación.</span>
        </div>
      )}

      <Tabs value={pestana} onValueChange={v => setPestana(v as Pestana)}>
        <TabsList className="bg-[#F1F5F980] flex-wrap h-auto">
          {conArca && <TabsTrigger value="para-facturar" className={CLASE_TAB}><Zap className="w-4 h-4 mr-1" />Para facturar{resumen ? ` (${resumen.cantidad})` : ''}</TabsTrigger>}
          <TabsTrigger value="facturas" className={CLASE_TAB}><FileText className="w-4 h-4 mr-1" />Facturas</TabsTrigger>
          <TabsTrigger value="nc" className={CLASE_TAB}><FileMinus className="w-4 h-4 mr-1" />Notas de crédito</TabsTrigger>
          <TabsTrigger value="nd" className={CLASE_TAB}><FilePlus className="w-4 h-4 mr-1" />Notas de débito</TabsTrigger>
          <TabsTrigger value="presupuestos" className={CLASE_TAB}><ClipboardList className="w-4 h-4 mr-1" />Presupuestos</TabsTrigger>
        </TabsList>

        {conArca && (
          <TabsContent value="para-facturar" className="mt-4" forceMount hidden={pestana !== 'para-facturar'}>
            <ParaFacturarTab onResumen={setResumen} onFacturado={onFacturado} />
          </TabsContent>
        )}
        <TabsContent value="facturas" className="mt-4"><DocumentosTab tipo="Factura" fiscal={fiscal} version={version} /></TabsContent>
        <TabsContent value="nc" className="mt-4"><DocumentosTab tipo="NotaCredito" fiscal={fiscal} version={version} /></TabsContent>
        <TabsContent value="nd" className="mt-4"><DocumentosTab tipo="NotaDebito" fiscal={fiscal} version={version} /></TabsContent>
        <TabsContent value="presupuestos" className="mt-4"><DocumentosTab tipo="Presupuesto" fiscal={fiscal} version={version} /></TabsContent>
      </Tabs>
    </div>
  );
}

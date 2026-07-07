'use client';

import { useState, useMemo } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SprayCan, Wrench, Check, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from 'sonner';
import { BILLETES } from '@/lib/types';

const FILAS_POR_PAGINA = 15;

const formatFechaHora = (f: string) => {
  const d = new Date(f);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

export default function LimpiezaModule() {
  const { habitaciones, marcarComoLimpia, reportarMantenimiento, resolverMantenimiento, historialMantenimiento } = useHotelStore();
  const [modalResolver, setModalResolver] = useState<string | null>(null);
  const [reparacion, setReparacion] = useState('');
  const [monto, setMonto] = useState('0');

  // Maintenance history filters
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [fHab, setFHab] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fMonto, setFMonto] = useState('');
  const [pagina, setPagina] = useState(1);

  const porLimpiar = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Limpieza');
  const enMantenimiento = Object.entries(habitaciones).filter(([, h]) => h.estado === 'Mantenimiento');
  const habDisponibles = Object.entries(habitaciones).filter(([, h]) => h.estado !== 'Mantenimiento' && h.estado !== 'Fuera de servicio');

  // Filtered history
  const listaFiltrada = useMemo(() => {
    let lista = [...historialMantenimiento].reverse();
    if (fDesde) lista = lista.filter(i => i.fecha.split('T')[0] >= fDesde);
    if (fHasta) lista = lista.filter(i => i.fecha.split('T')[0] <= fHasta);
    if (fHab) lista = lista.filter(i => i.habitacion.toLowerCase().includes(fHab.toLowerCase()));
    if (fDesc) lista = lista.filter(i => i.problema.toLowerCase().includes(fDesc.toLowerCase()) || i.reparacion.toLowerCase().includes(fDesc.toLowerCase()));
    if (fMonto) lista = lista.filter(i => i.monto >= parseFloat(fMonto));
    return lista;
  }, [historialMantenimiento, fDesde, fHasta, fHab, fDesc, fMonto]);

  const totalPaginas = Math.ceil(listaFiltrada.length / FILAS_POR_PAGINA) || 1;
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
  const listaPaginada = listaFiltrada.slice(inicio, inicio + FILAS_POR_PAGINA);

  const limpiarFiltros = () => { setFDesde(''); setFHasta(''); setFHab(''); setFDesc(''); setFMonto(''); setPagina(1); };
  const handleResolver = () => {
    if (!modalResolver || !reparacion.trim()) return;
    resolverMantenimiento(modalResolver, reparacion.trim(), parseFloat(monto) || 0);
    setModalResolver(null);
    setReparacion('');
    setMonto('0');
  };

  const handleMarcarLimpia = (num: string) => {
    marcarComoLimpia(num);
    toast.success('Habitación marcada como limpia', { description: num });
  };

  // Reportar mantenimiento
  const [repHab, setRepHab] = useState('');
  const [repDesc, setRepDesc] = useState('');
  const handleReportar = () => {
    if (!repHab || !repDesc.trim()) return;
    reportarMantenimiento(repHab, repDesc.trim());
    setRepHab('');
    setRepDesc('');
  };

  let _pgNoRender = totalPaginas <= 1;
  const _pgBotones: (number | string)[] = [];
  if (!(_pgNoRender as boolean)) {
    const _start = Math.max(1, paginaActual - 2);
    const _end = Math.min(totalPaginas, paginaActual + 2);
    if (_start > 1) { _pgBotones.push(1); if (_start > 2) _pgBotones.push('...'); }
    for (let _i = _start; _i <= _end; _i++) _pgBotones.push(_i);
    if (_end < totalPaginas) { if (_end < totalPaginas - 1) _pgBotones.push('...'); _pgBotones.push(totalPaginas); }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"><SprayCan className="w-5 h-5 text-amber-500" /></div> Limpieza y Mantenimiento</h2>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Para limpiar */}
        <Card className="border-yellow-300 dark:border-yellow-700/50">
          <CardHeader className="bg-yellow-50 dark:bg-yellow-950/30 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><SprayCan className="w-4 h-4 text-yellow-600 dark:text-yellow-400" /> Para limpiar</CardTitle>
              <Badge variant="secondary">{porLimpiar.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {porLimpiar.length === 0 ? <p className="text-sm text-muted-foreground py-2">Todo limpio <Check className="w-4 h-4 inline text-emerald-600 dark:text-emerald-400 ml-1" /></p> : porLimpiar.map(([num, h]) => (
              <div key={num} className="flex items-center justify-between p-2 rounded-lg border">
                <div><p className="text-sm font-medium">Habitación {num}</p><p className="text-xs text-muted-foreground">{h.tipo} · Capacidad: {h.capacidad}</p></div>
                <Button size="sm" onClick={() => handleMarcarLimpia(num)}><Check className="w-4 h-4 mr-1" />Limpia</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* En mantenimiento */}
        <Card className="border-red-300 dark:border-red-700/50">
          <CardHeader className="bg-red-50 dark:bg-red-950/30 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4 text-red-600 dark:text-red-400" /> En mantenimiento</CardTitle>
              <Badge variant="secondary">{enMantenimiento.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {enMantenimiento.length === 0 ? <p className="text-sm text-muted-foreground py-2">Sin problemas.</p> : enMantenimiento.map(([num, h]) => (
              <div key={num} className="border rounded-lg p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Habitación {num}</p><p className="text-xs text-muted-foreground">{h.tipo} · Capacidad: {h.capacidad}</p></div>
                  <Button size="sm" variant="outline" onClick={() => setModalResolver(num)}><Check className="w-4 h-4 mr-1" />Resuelto</Button>
                </div>
                <div className="bg-muted rounded p-1.5"><span className="text-xs"><strong>Problema:</strong> {h.problema || 'Sin descripción'}</span></div>
              </div>
            ))}
            <div className="pt-3 border-t mt-2">
              <p className="text-sm font-semibold mb-2">Reportar mantenimiento</p>
              <div className="space-y-2">
                <Select value={repHab} onValueChange={setRepHab}>
                  <SelectTrigger><SelectValue placeholder="-- Elegir habitación --" /></SelectTrigger>
                  <SelectContent>{habDisponibles.map(([num, h]) => <SelectItem key={num} value={num}>{num} - {h.tipo}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea placeholder="Problema detectado..." value={repDesc} onChange={e => setRepDesc(e.target.value)} rows={2} />
                <Button onClick={handleReportar} variant="destructive"><Wrench className="w-4 h-4 mr-1" />Reportar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial */}
      <Card>
        <CardHeader className="bg-muted/50"><CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4" /> Historial de Mantenimiento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={fDesde} onChange={e => { setFDesde(e.target.value); setPagina(1); }} /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={fHasta} onChange={e => { setFHasta(e.target.value); setPagina(1); }} /></div>
            <div className="space-y-1"><Label className="text-xs">Habitación</Label><Input placeholder="Ej: 101" value={fHab} onChange={e => { setFHab(e.target.value); setPagina(1); }} /></div>
            <div className="space-y-1"><Label className="text-xs">Descripción</Label><Input placeholder="Buscar..." value={fDesc} onChange={e => { setFDesc(e.target.value); setPagina(1); }} /></div>
            <div className="flex gap-2"><div className="space-y-1 flex-1"><Label className="text-xs">Monto desde</Label><Input type="number" placeholder="$" value={fMonto} onChange={e => { setFMonto(e.target.value); setPagina(1); }} /></div><Button variant="outline" size="icon" className="h-9 w-9 mt-auto" onClick={limpiarFiltros} title="Limpiar"><Search className="w-4 h-4" /></Button></div>
          </div>
          {listaPaginada.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No hay reparaciones registradas.</p> : (
            <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Habitación</TableHead><TableHead>Problema</TableHead><TableHead className="hidden md:table-cell">Reparación</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="hidden sm:table-cell">Empleado</TableHead></TableRow></TableHeader>
              <TableBody>{listaPaginada.map(item => (
                <TableRow key={item.id}><TableCell className="text-xs">{formatFechaHora(item.fecha)}</TableCell><TableCell>{item.habitacion}</TableCell><TableCell>{item.problema}</TableCell><TableCell className="hidden md:table-cell">{item.reparacion}</TableCell><TableCell className="text-right">${item.monto.toLocaleString('es-AR')}</TableCell><TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{item.empleado}</TableCell></TableRow>
              ))}</TableBody></Table>
          )}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Mostrando {inicio + 1}-{Math.min(inicio + FILAS_POR_PAGINA, listaFiltrada.length)} de {listaFiltrada.length}</span>
            <span>Página {paginaActual} de {totalPaginas}</span>
          </div>
          {!(_pgNoRender as boolean) && (
            <div className="flex items-center justify-center gap-1 mt-3">
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={paginaActual <= 1} onClick={() => setPagina(1)}><ChevronsLeft className="w-4 h-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              {_pgBotones.map((b, i) => typeof b === 'string' ? (
                <span key={`dots-${i}`} className="px-2 text-muted-foreground">...</span>
              ) : (
                <Button key={b} size="icon" variant={b === paginaActual ? 'default' : 'outline'} className="h-8 w-8" onClick={() => setPagina(b as number)}>{b}</Button>
              ))}
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}><ChevronRight className="w-4 h-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(totalPaginas)}><ChevronsRight className="w-4 h-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Resolver */}
      <Dialog open={!!modalResolver} onOpenChange={() => setModalResolver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Resolver Mantenimiento - Habitación {modalResolver}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {modalResolver && habitaciones[modalResolver] && (
              <p className="text-sm"><strong>Problema reportado:</strong> {habitaciones[modalResolver].problema || 'Sin descripción'}</p>
            )}
            <div className="space-y-2"><Label>Descripción de la reparación *</Label><Textarea value={reparacion} onChange={e => setReparacion(e.target.value)} rows={3} placeholder="Ej: Se reemplazó la placa controladora..." /></div>
            <div className="space-y-2"><Label>Monto de la reparación</Label><Input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Dejar en 0 si no tuvo costo" /><p className="text-xs text-muted-foreground">Si no tuvo costo, dejá en $0.</p></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleResolver}><Check className="w-4 h-4 mr-1" />Marcar como Resuelto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
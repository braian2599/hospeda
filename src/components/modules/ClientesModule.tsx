'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Users, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';

function formatFecha(fecha: string) {
  if (!fecha) return '—';
  const d = new Date(fecha + 'T12:00:00');
  return d.toLocaleDateString('es-AR');
}

export default function ClientesModule() {
  const { clientes, agregarCliente, actualizarCliente, eliminarCliente, buscarCliente } = useHotelStore();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'crear' | 'editar' | 'detalle' | 'eliminar' | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '', preferencias: '' });

  const lista = busqueda.length >= 2 ? buscarCliente(busqueda) : clientes;

  const openNew = () => { setForm({ nombre: '', dni: '', telefono: '', email: '', preferencias: '' }); setSelId(null); setModal('crear'); };
  const openEdit = (id: number) => {
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    setSelId(id);
    setForm({ nombre: c.nombre, dni: c.dni, telefono: c.telefono || '', email: c.email || '', preferencias: c.preferencias || '' });
    setModal('editar');
  };
  const openDetail = (id: number) => { setSelId(id); setModal('detalle'); };
  const openDelete = (id: number) => { setSelId(id); setModal('eliminar'); };

  const handleSave = () => {
    if (!form.nombre.trim() || !form.dni.trim()) return;
    if (modal === 'crear') agregarCliente(form);
    else if (modal === 'editar' && selId) actualizarCliente(selId, form);
    toast.success('Cliente guardado', { description: form.nombre });
    setModal(null);
  };
  const handleDelete = () => { if (selId) { toast.success('Cliente eliminado', { description: `Cliente #${selId}` }); eliminarCliente(selId); } setModal(null); };

  const selected = clientes.find(c => c.id === selId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center"><Users className="w-5 h-5 text-rose-500" /></div> Clientes</h2>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Agregar Cliente</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, DNI o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
      </div>

      {lista.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No se encontraron clientes.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>DNI</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead className="hidden md:table-cell">Teléfono</TableHead><TableHead className="hidden sm:table-cell">Estadías</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {lista.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => openDetail(c.id)}>{c.nombre}</TableCell>
                  <TableCell>{c.dni}</TableCell>
                  <TableCell className="hidden md:table-cell">{c.email || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">{c.telefono || '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="secondary">{c.historialEstadias.length}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDetail(c.id)}><Eye className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal Crear/Editar */}
      <Dialog open={modal === 'crear' || modal === 'editar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{modal === 'crear' ? 'Nuevo Cliente' : 'Editar Cliente'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Nombre completo *</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
              <div className="grid gap-2"><Label>DNI / Pasaporte *</Label><Input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Teléfono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Preferencias</Label><Input value={form.preferencias} onChange={e => setForm({ ...form, preferencias: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle */}
      <Dialog open={modal === 'detalle'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>Detalle del cliente</DialogTitle></DialogHeader>
              <div className="space-y-2 py-2">
                <h3 className="text-lg font-bold">{selected.nombre}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">DNI:</span> {selected.dni}</div>
                  <div><span className="text-muted-foreground">Teléfono:</span> {selected.telefono || '—'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selected.email || '—'}</div>
                  <div><span className="text-muted-foreground">Nacionalidad:</span> {selected.nacionalidad || '—'}</div>
                  <div><span className="text-muted-foreground">Preferencias:</span> {selected.preferencias || '—'}</div>
                  <div><span className="text-muted-foreground">Desde:</span> {formatFecha(selected.fechaCreacion)}</div>
                </div>
                {selected.historialEstadias.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Historial de estadías</h4>
                    <div className="max-h-48 overflow-y-auto">
                    <Table><TableHeader><TableRow><TableHead>Check-in</TableHead><TableHead>Check-out</TableHead><TableHead>Hab</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {selected.historialEstadias.map((h, i) => (
                          <TableRow key={i}><TableCell>{formatFecha(h.fechaCheckin)}</TableCell><TableCell>{formatFecha(h.fechaCheckout)}</TableCell><TableCell>{h.habitacion}</TableCell><TableCell className="text-right">${h.gastoTotal}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { openEdit(selected.id); }}>Editar</Button>
                <Button variant="outline" className="text-destructive" onClick={() => { setModal('eliminar'); }}>Eliminar</Button>
                <DialogClose asChild><Button variant="secondary">Cerrar</Button></DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar */}
      <Dialog open={modal === 'eliminar'} onOpenChange={() => setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Eliminar cliente</DialogTitle></DialogHeader>
          {selected && (
            <>
              <p>¿Está seguro de eliminar a <strong>{selected.nombre}</strong>?</p>
              <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
            </>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
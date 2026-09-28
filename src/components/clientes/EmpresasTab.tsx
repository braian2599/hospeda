'use client';

// La pestaña "Empresas" de Clientes: las empresas (y las personas con CUIT
// que no son huéspedes) a las que el hotel les factura o les lleva cuenta
// corriente. Es el único lugar donde se cargan: Comprobantes → Cuenta
// corriente solo muestra quién debe y cobra (decisión del dueño, 28/09).
//
// Son los titulares de src/lib/cuenta-corriente.ts. Lo que debe cada uno
// solo lo ve quien maneja la cuenta corriente: la API no lo manda a los demás.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, User, Search, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type DbTitular } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';
import { notifySuccess } from '@/lib/notify';
import { useHotelStore } from '@/lib/store';
import { aPesos, manejaCuentaCorriente, normalizarCuit } from '@/lib/cuenta-corriente';
import FormTitular from '@/components/cuenta-corriente/FormTitular';

interface Props {
  /** "Nueva empresa" se toca en el encabezado de Clientes. */
  nuevaAbierta: boolean;
  onNuevaAbiertaChange: (abierta: boolean) => void;
}

export default function EmpresasTab({ nuevaAbierta, onNuevaAbiertaChange }: Props) {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const maneja = manejaCuentaCorriente(usuarioActual);
  const [titulares, setTitulares] = useState<DbTitular[]>([]);
  const [completo, setCompleto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [verDesactivadas, setVerDesactivadas] = useState(false);
  const [editando, setEditando] = useState<DbTitular | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api.cuentaCorriente.buscar({ incluirInactivos: verDesactivadas });
      setTitulares(r.titulares);
      setCompleto(r.completo);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron traer las empresas.');
    } finally {
      setCargando(false);
    }
  }, [verDesactivadas]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Las personas con ficha de huésped ya están en "Personas", con sus datos
  // fiscales en la ficha: acá no se repiten.
  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const digitos = normalizarCuit(q);
    return titulares
      .filter(t => t.tipo === 'empresa' || !t.clienteId)
      .filter(t => !texto || t.nombre.toLowerCase().includes(texto) || (!!digitos && t.cuit.includes(digitos)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [titulares, q]);

  const cerrarForm = () => { setEditando(null); onNuevaAbiertaChange(false); };
  const formAbierto = nuevaAbierta || !!editando;

  return (
    <div className="space-y-4">
      <Card className="py-0 gap-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por razón social o CUIT" className="pl-8" aria-label="Buscar empresa" />
            </div>
            {maneja && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={verDesactivadas} onCheckedChange={setVerDesactivadas} />
                Ver desactivadas
              </label>
            )}
          </div>

          {cargando ? (
            <div className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Trayendo las empresas…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive p-4">{error}</p>
          ) : visibles.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground space-y-1">
              {q.trim() ? <p>Ninguna coincide con la búsqueda.</p> : (
                <>
                  <p>Todavía no hay empresas cargadas.</p>
                  <p>Tocá “Nueva empresa”: con el CUIT, “Traer de ARCA” completa el resto.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F1F5F94D]">
                    <TableHead>Razón social</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead>Condición de IVA</TableHead>
                    <TableHead className="hidden lg:table-cell">Domicilio fiscal</TableHead>
                    <TableHead className="hidden md:table-cell">Contacto</TableHead>
                    {completo && <TableHead className="text-right">Cuenta corriente</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map(t => {
                    const debe = aPesos(t.saldo ?? 0);
                    return (
                      <TableRow
                        key={t.id}
                        className={`cursor-pointer hover:bg-[#0F766E0D] ${t.activo ? '' : 'opacity-60'}`}
                        onClick={() => setEditando(t)}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditando(t); } }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {t.tipo === 'empresa' ? <Building2 className="w-4 h-4 text-primary shrink-0" /> : <User className="w-4 h-4 text-primary shrink-0" />}
                            <span className="font-medium">{t.nombre}</span>
                            {t.tipo === 'persona' && <Badge variant="secondary" className="text-[10px]">Persona</Badge>}
                            {!t.activo && <Badge variant="secondary" className="text-[10px]">Desactivada</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{t.cuitFormateado}</TableCell>
                        <TableCell className="text-sm">
                          {t.condicionIva ?? <span className="text-destructive">Falta cargarla</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[260px] truncate">{t.domicilioFiscal ?? '—'}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {t.contactoNombre || t.contactoTelefono || t.contactoEmail ? (
                            <div className="leading-tight">
                              <div>{t.contactoNombre ?? '—'}</div>
                              <div className="text-xs text-muted-foreground">{t.contactoTelefono ?? t.contactoEmail}</div>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        {completo && (
                          <TableCell className="text-right whitespace-nowrap">
                            {debe > 0
                              ? <span className="font-mono font-semibold text-destructive">Debe {formatMoney(debe)}</span>
                              : <span className="text-sm text-muted-foreground">Al día</span>}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formAbierto} onOpenChange={o => { if (!o) cerrarForm(); }}>
        <DialogContent size="grande">
          <DialogHeader>
            <DialogTitle>{editando ? editando.nombre : 'Nueva empresa'}</DialogTitle>
            <DialogDescription>
              {editando
                ? 'Sus datos fiscales y de contacto. Si cambió algo en ARCA, “Traer de ARCA” lo actualiza.'
                : 'Escribí el CUIT y traé los datos de ARCA. Lo que falte se completa a mano.'}
            </DialogDescription>
          </DialogHeader>
          {formAbierto && (
            <FormTitular
              key={editando?.id ?? 'nueva'}
              titular={editando ?? undefined}
              tipoFijo={editando ? undefined : 'empresa'}
              manejaCuenta={maneja}
              enDosColumnas
              onGuardado={t => {
                notifySuccess(editando ? 'Datos guardados' : 'Empresa cargada', t.nombre);
                cerrarForm();
                void cargar();
              }}
              onCancelar={cerrarForm}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

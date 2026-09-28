'use client';

// La pestaña "Cuenta corriente" de Comprobantes: quién debe y cuánto. Las
// empresas no se cargan acá sino en Clientes → Empresas.
// Vive dentro de Comprobantes a propósito: es la zona de lo fiscal, que solo
// ven algunos empleados (el permiso 'comprobantes'), igual que las facturas y
// las notas de crédito y débito. Ver docs/cuenta-corriente.md.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, User, Search, Loader2, AlertTriangle, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type DbTitular } from '@/lib/api-client';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/format';
import { aPesos, normalizarCuit } from '@/lib/cuenta-corriente';
import EstadoDeCuenta from './EstadoDeCuenta';

export default function CuentaCorrienteTab() {
  const [titulares, setTitulares] = useState<DbTitular[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [verDesactivados, setVerDesactivados] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api.cuentaCorriente.buscar({ incluirInactivos: verDesactivados });
      setTitulares(r.titulares);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron traer las cuentas.');
    } finally {
      setCargando(false);
    }
  }, [verDesactivados]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Las empresas se cargan en Clientes → Empresas (decisión del dueño, 28/09):
  // acá solo se ve quién debe y se cobra. El botón abre Clientes en esa pestaña.
  const setModulo = useHotelStore(s => s.setModulo);
  const irAEmpresas = () => {
    const params = new URLSearchParams(window.location.search);
    params.set('clientes_pestana', JSON.stringify('empresas'));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setModulo('clientes');
  };

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const digitos = normalizarCuit(q);
    const lista = texto
      ? titulares.filter(t => t.nombre.toLowerCase().includes(texto) || (digitos && t.cuit.includes(digitos)))
      : titulares;
    // Primero los que deben, de mayor a menor: es lo que se viene a mirar.
    return [...lista].sort((a, b) => (b.saldo ?? 0) - (a.saldo ?? 0) || a.nombre.localeCompare(b.nombre));
  }, [titulares, q]);

  const resumen = useMemo(() => {
    const conDeuda = titulares.filter(t => (t.saldo ?? 0) > 0);
    return {
      total: aPesos(conDeuda.reduce((s, t) => s + (t.saldo ?? 0), 0)),
      conDeuda: conDeuda.length,
      pasados: titulares.filter(t => t.superaLimite).length,
    };
  }, [titulares]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total a cobrar</p>
          <p className="text-2xl font-bold text-destructive">{formatMoney(resumen.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Cuentas con deuda</p>
          <p className="text-2xl font-bold">{resumen.conDeuda}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pasaron su límite</p>
          <p className={`text-2xl font-bold ${resumen.pasados > 0 ? 'text-warning' : ''}`}>{resumen.pasados}</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" /> Cuentas corrientes
            </CardTitle>
            <div className="ml-auto">
              <Button size="sm" variant="outline" onClick={irAEmpresas}>
                <Building2 className="w-4 h-4 mr-1" /> Cargar empresas en Clientes
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o CUIT" className="pl-8" aria-label="Buscar cuenta" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={verDesactivados} onCheckedChange={setVerDesactivados} />
              Ver desactivadas
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Trayendo las cuentas…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-4">{error}</p>
          ) : visibles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground space-y-1">
              {titulares.length === 0 ? (
                <>
                  <p>Todavía no hay cuentas corrientes.</p>
                  <p>Se crean al pasar el saldo de una reserva a cuenta corriente. Las empresas se cargan en Clientes → Empresas.</p>
                </>
              ) : (
                <p>Ninguna coincide con la búsqueda.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F1F5F94D]">
                    <TableHead>Nombre</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead className="hidden md:table-cell">IVA</TableHead>
                    <TableHead className="text-right">Debe</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map(t => {
                    const debe = aPesos(t.saldo ?? 0);
                    return (
                      <TableRow key={t.id} className={`cursor-pointer hover:bg-[#0F766E0D] ${t.activo ? '' : 'opacity-60'}`} onClick={() => setAbierto(t.id)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {t.tipo === 'empresa' ? <Building2 className="w-4 h-4 text-primary shrink-0" /> : <User className="w-4 h-4 text-primary shrink-0" />}
                            <span className="font-medium">{t.nombre}</span>
                            {!t.activo && <Badge variant="secondary" className="text-[10px]">Desactivada</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{t.cuitFormateado}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{t.condicionIva ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold ${debe > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatMoney(debe)}</span>
                          {t.superaLimite && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-warning"><AlertTriangle className="w-3 h-3" />límite</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setAbierto(t.id); }}>
                            Ver cuenta
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EstadoDeCuenta titularId={abierto} onCerrar={() => setAbierto(null)} onCambio={() => void cargar()} />
    </div>
  );
}

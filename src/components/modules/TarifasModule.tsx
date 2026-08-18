'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Tags, Plus, Trash2, CreditCard, ListChecks, Users, Pencil, Info, Home, UsersRound,
  Star, Zap, Sparkles, Baby, Copy, Download, MoreVertical, ChevronRight, ChevronLeft,
  Check, GitCompareArrows, X, Crown,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney } from '@/lib/format';
import type {
  CampoPersonalizado, MetodoPago, Cuota, ModoCobro, RangoPrecio, PromocionesTarifa,
  AcompananteSinCargo, NinosDiferenciado, NochesCortesia, ModalidadNochesCortesia, TarifaPrecios,
} from '@/lib/types';

// ==================== COMPONENTES AUXILIARES ====================

function CampoFila({ campo, onRemove, onUpdate }: {
  campo: CampoPersonalizado;
  onRemove: () => void;
  onUpdate: (c: CampoPersonalizado) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Nombre del campo"
        value={campo.nombre}
        onChange={e => onUpdate({ ...campo, nombre: e.target.value })}
        className="flex-1 h-8"
      />
      <Select value={campo.tipo} onValueChange={v => onUpdate({ ...campo, tipo: v as CampoPersonalizado['tipo'] })}>
        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="texto">Texto</SelectItem>
          <SelectItem value="numero">Número</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5 px-2">
        <Checkbox
          id={`req-${campo.nombre}`}
          checked={campo.requerido}
          onCheckedChange={v => onUpdate({ ...campo, requerido: !!v })}
        />
        <Label htmlFor={`req-${campo.nombre}`} className="text-xs whitespace-nowrap">Req.</Label>
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function CuotaFila({ cuota, onRemove, onUpdate }: {
  cuota: Cuota;
  onRemove: () => void;
  onUpdate: (c: Cuota) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">Cantidad</Label>
        <Input type="number" min={1} className="w-20 h-8" value={cuota.cantidad} onChange={e => onUpdate({ ...cuota, cantidad: parseInt(e.target.value) || 1 })} />
      </div>
      <div className="space-y-0.5">
        <Label className="text-[10px] text-muted-foreground">% recargo</Label>
        <Input type="number" step="0.1" className="w-20 h-8" value={cuota.porcentaje} onChange={e => onUpdate({ ...cuota, porcentaje: parseFloat(e.target.value) || 0 })} />
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0 mt-4" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function RangoFila({ rango, index, onRemove, onUpdate, modoCobro, totalRangos }: {
  rango: RangoPrecio;
  index: number;
  onRemove: () => void;
  onUpdate: (r: RangoPrecio) => void;
  modoCobro: ModoCobro;
  totalRangos: number;
}) {
  const esInfinito = rango.maxPersonas === null;
  // Etiqueta legible del rango: "1 persona", "2 personas", "3+ personas", "2-4 personas"
  const rangoLabel = esInfinito
    ? `${rango.minPersonas}+ persona${rango.minPersonas > 1 ? 's' : ''}`
    : rango.minPersonas === rango.maxPersonas
      ? `${rango.minPersonas} persona${rango.minPersonas > 1 ? 's' : ''}`
      : `${rango.minPersonas} a ${rango.maxPersonas} personas`;

  return (
    <div className="flex items-end gap-2">
      <div className="w-28 shrink-0 flex items-center h-8 text-sm font-medium text-foreground">
        {modoCobro === 'porHabitacion' ? 'Por noche' : modoCobro === 'porCama' ? 'Por cama/noche' : rangoLabel}
      </div>
      <div className="space-y-0.5 flex-1">
        <Label className="text-[10px] text-muted-foreground">
          {modoCobro === 'porCama' ? 'Precio c/u' : 'Precio'}
        </Label>
        <Input
          type="number" min={0} step="0.01"
          className="h-8 text-right"
          value={rango.precio}
          onChange={e => onUpdate({ ...rango, precio: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <Button
        size="icon" variant="ghost"
        className="h-8 w-8 text-destructive shrink-0 mb-0.5"
        onClick={onRemove}
        disabled={modoCobro === 'porHabitacion' || modoCobro === 'porCama' || totalRangos <= 1}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ==================== HELPERS ====================

const MODO_OPTIONS: { value: ModoCobro; label: string; description: string; icon: typeof Home }[] = [
  { value: 'porGrupo', label: 'Por grupo', description: 'El precio es el total del grupo por noche', icon: UsersRound },
  { value: 'porHabitacion', label: 'Por habitación', description: 'Precio fijo por habitación, sin importar la cantidad de personas', icon: Home },
  { value: 'porCama', label: 'Por cama', description: 'Cada persona paga un precio fijo por noche (ideal para compartidas)', icon: Users },
];

function formatoRango(r: RangoPrecio): string {
  if (r.maxPersonas === null) return `${r.minPersonas}+`;
  if (r.minPersonas === r.maxPersonas) return `${r.minPersonas}`;
  return `${r.minPersonas}-${r.maxPersonas}`;
}

function modoLabel(m: ModoCobro): string {
  return MODO_OPTIONS.find(o => o.value === m)?.label || m;
}

// Single uniform color for all tariff types — no per-mode differentiation
function modoBadgeColor(_m: ModoCobro): string {
  return 'bg-primary/10 text-primary border-0';
}

// Uniform subtle tint for all rate cards
function modoGradient(_m: ModoCobro): string {
  return 'bg-primary/5';
}

// Uniform icon circle color for all rate cards
function modoIconCircle(_m: ModoCobro): string {
  return 'bg-primary/10 text-primary';
}

function crearRangoDefault(modo: ModoCobro, minPersonas: number = 1): RangoPrecio {
  if (modo === 'porHabitacion') {
    return { minPersonas: 1, maxPersonas: null, precio: 0 };
  }
  return { minPersonas, maxPersonas: minPersonas, precio: 0 };
}

// Count active promotions on a tariff
function countPromos(promos?: PromocionesTarifa | null): number {
  if (!promos) return 0;
  let n = 0;
  if (promos.acompananteSinCargo?.activo) n++;
  if (promos.ninosDiferenciado?.activo) n++;
  if (promos.nochesCortesia?.activo) n++;
  return n;
}

// Compute "Desde" price (min positive price, fallback to first range)
function precioDesde(rangos: RangoPrecio[]): number {
  const preciosPositivos = rangos.map(r => r.precio).filter(p => p > 0);
  return preciosPositivos.length > 0 ? Math.min(...preciosPositivos) : (rangos[0]?.precio || 0);
}

// Build a label describing a noches cortesía modalidad
function describeNochesCortesia(mod: ModalidadNochesCortesia): string {
  if (mod.tipo === 'cadaX') return `Cada ${mod.cada} noches, 1 gratis`;
  if (mod.tipo === 'aPartirDe') return `Desde ${mod.minNoches} noches, ${mod.nochesGratis} gratis`;
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${dias[mod.dia]} gratis`;
}

// Export a single tariff as CSV (client-side download)
function exportTariffCSV(tipo: string, t: TarifaPrecios) {
  const rows: (string | number)[][] = [];
  rows.push(['Campo', 'Valor']);
  rows.push(['Nombre', tipo]);
  rows.push(['Modo de cobro', t.modoCobro || 'porGrupo']);
  const rangos = t.rangos || [];
  rows.push(['Cantidad de rangos', rangos.length]);
  rangos.forEach((r, i) => {
    rows.push([`Rango ${i + 1} (${formatoRango(r)} pers.)`, r.precio]);
  });
  rows.push(['Acompañante sin cargo', t.promociones?.acompananteSinCargo?.activo ? 'Sí' : 'No']);
  if (t.promociones?.acompananteSinCargo?.activo) {
    rows.push(['  Etiqueta', t.promociones.acompananteSinCargo.etiqueta || '—']);
    rows.push(['  Cantidad', t.promociones.acompananteSinCargo.cantidad ?? 1]);
  }
  rows.push(['Niños diferenciado', t.promociones?.ninosDiferenciado?.activo ? 'Sí' : 'No']);
  if (t.promociones?.ninosDiferenciado?.activo) {
    rows.push(['  Precio niño/noche', t.promociones.ninosDiferenciado.precioNino || 0]);
  }
  rows.push(['Noches cortesía', t.promociones?.nochesCortesia?.activo ? 'Sí' : 'No']);
  if (t.promociones?.nochesCortesia?.activo) {
    rows.push(['  Modalidad', describeNochesCortesia(t.promociones.nochesCortesia.modalidad)]);
  }
  const campos = t.camposPersonalizados || [];
  rows.push(['Cantidad de campos personalizados', campos.length]);
  campos.forEach((c, i) => {
    rows.push([`  Campo ${i + 1}`, `${c.nombre} (${c.tipo}${c.requerido ? ', requerido' : ''})`]);
  });

  const csv = rows.map(r => r.map(cell => {
    const s = String(cell);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tarifa_${tipo.toLowerCase().replace(/\s+/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== WIZARD STEPPER ====================

function WizardStepper({ current, onSelect }: { current: 1 | 2 | 3; onSelect: (s: 1 | 2 | 3) => void }) {
  const steps: { n: 1 | 2 | 3; label: string; icon: typeof Info }[] = [
    { n: 1, label: 'Información básica', icon: Info },
    { n: 2, label: 'Rangos de precios', icon: Tags },
    { n: 3, label: 'Promociones', icon: Sparkles },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isDone = current > s.n;
          const isActive = current === s.n;
          return (
            <div key={s.n} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => onSelect(s.n)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : isDone
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  isActive ? 'bg-white/20' : isDone ? 'bg-primary text-white' : 'bg-background'
                }`}>
                  {isDone ? <Check className="w-3 h-3" /> : s.n}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
                <Icon className="w-3.5 h-3.5 sm:hidden" />
              </button>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded ${isDone ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          );
        })}
      </div>
      <Progress value={(current / 3) * 100} className="h-1 bg-muted" />
    </div>
  );
}

// ==================== LIVE PREVIEW CARD (Wizard) ====================

function TariffMiniPreview({ nombre, modoCobro, rangos, promociones, camposCount }: {
  nombre: string;
  modoCobro: ModoCobro;
  rangos: RangoPrecio[];
  promociones?: PromocionesTarifa;
  camposCount: number;
}) {
  const modo = modoCobro;
  const ModoIcon = MODO_OPTIONS.find(o => o.value === modo)?.icon || UsersRound;
  const desde = precioDesde(rangos);
  const tieneAcomp = promociones?.acompananteSinCargo?.activo;
  const tieneNinos = promociones?.ninosDiferenciado?.activo;
  const tieneNoches = promociones?.nochesCortesia?.activo;
  const tienePromo = !!(tieneAcomp || tieneNinos || tieneNoches);
  const CardIcon = tienePromo ? Sparkles : ModoIcon;
  const promoCount = countPromos(promociones);

  return (
    <Card className={`border border-border ${modoGradient(modo)} overflow-hidden`}>
      <CardContent className="p-2.5">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />Vista previa
        </div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${modoIconCircle(modo)}`}>
            <CardIcon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{nombre || 'Sin nombre'}</h4>
            <p className="text-[9px] text-muted-foreground">{modoLabel(modo)}</p>
          </div>
        </div>

        {/* Desde */}
        <div className="mb-1.5 pb-1.5 border-b border-primary/20">
          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Desde</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-primary tabular-nums">{formatMoney(desde)}</span>
            <span className="text-[9px] text-muted-foreground">/noche</span>
          </div>
        </div>

        {/* Rangos */}
        <div className="space-y-0.5 mb-1.5">
          {rangos.slice(0, 4).map((r, i) => (
            <div key={i} className="flex justify-between text-[10px] px-1.5 py-0.5 rounded border-l-26 border-primary/30">
              <span className="text-muted-foreground font-mono">
                {formatoRango(r)} {modo === 'porHabitacion' ? 'hab.' : modo === 'porCama' ? 'cama' : 'pers.'}
              </span>
              <span className="font-bold text-primary tabular-nums">{formatMoney(r.precio)}</span>
            </div>
          ))}
          {rangos.length > 4 && (
            <p className="text-[9px] text-muted-foreground text-center">+{rangos.length - 4} más</p>
          )}
        </div>

        {/* Promo badges */}
        {(tieneAcomp || tieneNinos || tieneNoches) && (
          <div className="flex gap-1 flex-wrap mb-1.5">
            {tieneAcomp && (
              <Badge className="bg-primary/10 text-primary border-0 text-[9px] py-0 h-4">
                <Star className="w-2.5 h-2.5 mr-0.5" />Acompañante
              </Badge>
            )}
            {tieneNinos && (
              <Badge className="bg-primary/10 text-primary border-0 text-[9px] py-0 h-4">
                <Baby className="w-2.5 h-2.5 mr-0.5" />Niños
              </Badge>
            )}
            {tieneNoches && (
              <Badge className="bg-primary/10 text-primary border-0 text-[9px] py-0 h-4">
                <Zap className="w-2.5 h-2.5 mr-0.5" />Cortesía
              </Badge>
            )}
          </div>
        )}

        {/* Stats footer */}
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground pt-1.5 border-t border-primary/20">
          <span className="flex items-center gap-0.5"><Tags className="w-2.5 h-2.5" />{rangos.length}</span>
          <span className="flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />{promoCount}</span>
          <span className="flex items-center gap-0.5"><Info className="w-2.5 h-2.5" />{camposCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== COMPARISON MODAL ====================

function ComparisonRow({ label, differs, children }: { label: string; differs: boolean; children: React.ReactNode }) {
  return (
    <TableRow className={differs ? 'bg-primary/5' : ''}>
      <TableCell className="font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">{label}</TableCell>
      {children}
    </TableRow>
  );
}

function ComparisonModal({ tariffs, onClose }: {
  tariffs: { tipo: string; t: TarifaPrecios }[];
  onClose: () => void;
}) {
  // Compute base price per person for each tariff (min positive price)
  const basePrices = tariffs.map(({ t }) => {
    const rangos = t.rangos || [];
    const pos = rangos.map(r => r.precio).filter(p => p > 0);
    return pos.length > 0 ? Math.min(...pos) : (rangos[0]?.precio || 0);
  });

  // Determine which rows have differing values for highlighting
  const modos = tariffs.map(({ t }) => t.modoCobro || 'porGrupo');
  const modoDiffers = new Set(modos).size > 1;
  const priceDiffers = new Set(basePrices).size > 1;
  const rangoCounts = tariffs.map(({ t }) => (t.rangos || []).length);
  const rangoDiffers = new Set(rangoCounts).size > 1;
  const promoCounts = tariffs.map(({ t }) => countPromos(t.promociones));
  const promoDiffers = new Set(promoCounts).size > 1;
  const campoCounts = tariffs.map(({ t }) => (t.camposPersonalizados || []).length);
  const campoDiffers = new Set(campoCounts).size > 1;

  return (
    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <GitCompareArrows className="w-5 h-5 text-primary" />
          Comparación de tarifas
        </DialogTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Comparando {tariffs.length} tarifas. Las filas con diferencias están resaltadas.
        </p>
      </DialogHeader>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-40 sticky left-0 bg-muted/40 z-10">Característica</TableHead>
              {tariffs.map(({ tipo }) => (
                <TableHead key={tipo} className="font-bold text-primary min-w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-primary" />
                    {tipo}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <ComparisonRow label="Modo de cobro" differs={modoDiffers}>
              {modos.map((m, i) => {
                const ModoIcon = MODO_OPTIONS.find(o => o.value === m)?.icon || UsersRound;
                return (
                  <TableCell key={i}>
                    <Badge className={modoBadgeColor(m)}>
                      <ModoIcon className="w-3 h-3 mr-0.5" />{modoLabel(m)}
                    </Badge>
                  </TableCell>
                );
              })}
            </ComparisonRow>

            <ComparisonRow label="Precio desde" differs={priceDiffers}>
              {basePrices.map((p, i) => (
                <TableCell key={i}>
                  <span className="text-lg font-extrabold text-primary tabular-nums">{formatMoney(p)}</span>
                  <span className="text-xs text-muted-foreground ml-1">/noche</span>
                </TableCell>
              ))}
            </ComparisonRow>

            <ComparisonRow label="Cant. de rangos" differs={rangoDiffers}>
              {rangoCounts.map((c, i) => (
                <TableCell key={i}>
                  <Badge variant="secondary">{c} rango{c !== 1 ? 's' : ''}</Badge>
                </TableCell>
              ))}
            </ComparisonRow>

            <ComparisonRow label="Rangos detallados" differs={rangoDiffers}>
              {tariffs.map(({ tipo, t }) => (
                <TableCell key={tipo}>
                  <div className="space-y-1">
                    {(t.rangos || []).slice(0, 5).map((r, i) => (
                      <div key={i} className="flex justify-between text-xs gap-2">
                        <span className="text-muted-foreground font-mono">
                          {formatoRango(r)} {t.modoCobro === 'porHabitacion' ? 'hab.' : t.modoCobro === 'porCama' ? 'cama' : 'pers.'}
                        </span>
                        <span className="font-bold text-primary tabular-nums">{formatMoney(r.precio)}</span>
                      </div>
                    ))}
                    {(t.rangos || []).length > 5 && (
                      <p className="text-[10px] text-muted-foreground">+{(t.rangos || []).length - 5} más</p>
                    )}
                  </div>
                </TableCell>
              ))}
            </ComparisonRow>

            <ComparisonRow label="Acompañante sin cargo" differs={promoDiffers}>
              {tariffs.map(({ tipo, t }) => {
                const a = t.promociones?.acompananteSinCargo;
                return (
                  <TableCell key={tipo}>
                    {a?.activo ? (
                      <Badge className="bg-primary/10 text-primary border-0">
                        <Star className="w-3 h-3 mr-0.5" />{a.etiqueta || 'Sí'}
                        {a.cantidad > 1 && ` ×${a.cantidad}`}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                );
              })}
            </ComparisonRow>

            <ComparisonRow label="Niños diferenciado" differs={promoDiffers}>
              {tariffs.map(({ tipo, t }) => {
                const n = t.promociones?.ninosDiferenciado;
                return (
                  <TableCell key={tipo}>
                    {n?.activo ? (
                      <Badge className="bg-primary/10 text-primary border-0">
                        <Baby className="w-3 h-3 mr-0.5" />{formatMoney(n.precioNino || 0)}/noche
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                );
              })}
            </ComparisonRow>

            <ComparisonRow label="Noches cortesía" differs={promoDiffers}>
              {tariffs.map(({ tipo, t }) => {
                const nc = t.promociones?.nochesCortesia;
                return (
                  <TableCell key={tipo}>
                    {nc?.activo ? (
                      <Badge className="bg-primary/10 text-primary border-0">
                        <Zap className="w-3 h-3 mr-0.5" />{describeNochesCortesia(nc.modalidad)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                );
              })}
            </ComparisonRow>

            <ComparisonRow label="Campos personalizados" differs={campoDiffers}>
              {campoCounts.map((c, i) => (
                <TableCell key={i}>
                  {c > 0 ? (
                    <Badge variant="outline">{c} campo{c !== 1 ? 's' : ''}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              ))}
            </ComparisonRow>
          </TableBody>
        </Table>
      </div>

      <DialogFooter>
        <Button onClick={onClose} variant="secondary">Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ==================== MODULO PRINCIPAL ====================

export default function TarifasModule() {
  const tarifas = useHotelStore(s => s.tarifas);
  const tiposTarifa = useHotelStore(s => s.tiposTarifa);
  const metodosPago = useHotelStore(s => s.metodosPago);
  const categoriasGastos = useHotelStore(s => s.categoriasGastos);
  const gastos = useHotelStore(s => s.gastos);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const reservas = useHotelStore(s => s.reservas);
  const pagos = useHotelStore(s => s.pagos);
  const guardarTarifaCompleta = useHotelStore(s => s.guardarTarifaCompleta);
  const eliminarTipoTarifa = useHotelStore(s => s.eliminarTipoTarifa);
  const agregarMetodoPago = useHotelStore(s => s.agregarMetodoPago);
  const editarMetodoPago = useHotelStore(s => s.editarMetodoPago);
  const eliminarMetodoPago = useHotelStore(s => s.eliminarMetodoPago);
  const agregarCategoriaGasto = useHotelStore(s => s.agregarCategoriaGasto);
  const editarCategoriaGasto = useHotelStore(s => s.editarCategoriaGasto);
  const eliminarCategoriaGasto = useHotelStore(s => s.eliminarCategoriaGasto);

  const [tab, setTab] = useState('tarifas');

  // --- Modal Tarifa ---
  const [modalTarifa, setModalTarifa] = useState(false);
  const [editandoTarifa, setEditandoTarifa] = useState<string | null>(null); // null = nueva
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [tarifaForm, setTarifaForm] = useState({
    nombre: '',
    modoCobro: 'porGrupo' as ModoCobro,
    rangos: [{ minPersonas: 1, maxPersonas: 1, precio: 0 }] as RangoPrecio[],
    camposPersonalizados: [] as CampoPersonalizado[],
    promociones: undefined as PromocionesTarifa | undefined,
  });

  // --- Comparison Tool ---
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // --- Modal Método Pago ---
  const [modalMetodo, setModalMetodo] = useState(false);
  const [editandoMetodo, setEditandoMetodo] = useState<string | null>(null);
  const [metForm, setMetForm] = useState<{ nombre: string; tipo: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro'; recargo: boolean; cuotas: Cuota[] }>({ nombre: '', tipo: 'efectivo', recargo: false, cuotas: [] });

  // --- Modal Categoría ---
  const [modalCategoria, setModalCategoria] = useState(false);
  const [editandoCat, setEditandoCat] = useState<string | null>(null);
  const [catForm, setCatForm] = useState('');

  // --- Confirm Dialog ---
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; titulo: string; msg: string; onConfirm: () => void | Promise<void> }>({ open: false, titulo: '', msg: '', onConfirm: () => {} });

  // ==================== TARIFAS TAB ====================

  const todasHabitaciones = Object.entries(habitaciones)
    .sort(([a], [b]) => a.localeCompare(b));

  // Helpers para actualizar promociones
  const updatePromocion = (patch: Partial<PromocionesTarifa>) => {
    setTarifaForm(prev => ({
      ...prev,
      promociones: { ...prev.promociones, ...patch },
    }));
  };

  const promos = tarifaForm.promociones;
  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const openModalTarifa = (tipo: string | null) => {
    if (tipo === null) {
      setEditandoTarifa(null);
      setTarifaForm({
        nombre: '',
        modoCobro: 'porGrupo',
        rangos: [
          { minPersonas: 1, maxPersonas: 1, precio: 0 },
          { minPersonas: 2, maxPersonas: 2, precio: 0 },
          { minPersonas: 3, maxPersonas: 3, precio: 0 },
          { minPersonas: 4, maxPersonas: 4, precio: 0 },
        ],
        camposPersonalizados: [],
        promociones: undefined,
      });
    } else {
      const t = tarifas[tipo];
      if (!t) return;
      setEditandoTarifa(tipo);
      // Migrar choferCortesia viejo a promociones si no tiene
      let promos = t.promociones;
      if (!promos && t.choferCortesia) {
        promos = {
          acompananteSinCargo: {
            activo: true,
            etiqueta: 'Chofer de cortesía',
            habitacionAsignada: t.habitacionChofer || undefined,
            cantidad: 1,
          },
        };
      }
      // Migración: agregar cantidad default si no existe
      if (promos?.acompananteSinCargo?.activo && promos.acompananteSinCargo.cantidad == null) {
        promos = { ...promos, acompananteSinCargo: { ...promos.acompananteSinCargo!, cantidad: 1 } };
      }
      setTarifaForm({
        nombre: tipo,
        modoCobro: t.modoCobro || 'porGrupo',
        rangos: t.rangos && t.rangos.length > 0
          ? t.rangos.map(r => ({ ...r }))
          : [
              { minPersonas: 1, maxPersonas: 1, precio: 0 },
              { minPersonas: 2, maxPersonas: 2, precio: 0 },
              { minPersonas: 3, maxPersonas: 3, precio: 0 },
              { minPersonas: 4, maxPersonas: 4, precio: 0 },
            ],
        camposPersonalizados: [...(t.camposPersonalizados || [])],
        promociones: promos ? JSON.parse(JSON.stringify(promos)) : undefined,
      });
    }
    setWizardStep(1);
    setModalTarifa(true);
  };

  // Duplicar tarifa: abre el modal en modo creación con los datos copiados
  const handleDuplicarTarifa = (tipo: string) => {
    const t = tarifas[tipo];
    if (!t) return;
    let promosCopy = t.promociones;
    if (!promosCopy && t.choferCortesia) {
      promosCopy = {
        acompananteSinCargo: {
          activo: true,
          etiqueta: 'Chofer de cortesía',
          habitacionAsignada: t.habitacionChofer || undefined,
          cantidad: 1,
        },
      };
    }
    if (promosCopy?.acompananteSinCargo?.activo && promosCopy.acompananteSinCargo.cantidad == null) {
      promosCopy = { ...promosCopy, acompananteSinCargo: { ...promosCopy.acompananteSinCargo!, cantidad: 1 } };
    }
    setEditandoTarifa(null);
    setTarifaForm({
      nombre: `${tipo} (copia)`,
      modoCobro: t.modoCobro || 'porGrupo',
      rangos: t.rangos && t.rangos.length > 0
        ? t.rangos.map(r => ({ ...r }))
        : [{ minPersonas: 1, maxPersonas: 1, precio: 0 }],
      camposPersonalizados: [...(t.camposPersonalizados || [])],
      promociones: promosCopy ? JSON.parse(JSON.stringify(promosCopy)) : undefined,
    });
    setWizardStep(1);
    setModalTarifa(true);
    toast.info(`Tarifa "${tipo}" duplicada. Modificá el nombre y guardá.`);
  };

  const handleExportCSV = (tipo: string) => {
    const t = tarifas[tipo];
    if (!t) { toast.error('No se pudo exportar la tarifa.'); return; }
    try {
      exportTariffCSV(tipo, t);
      toast.success(`Tarifa "${tipo}" exportada como CSV.`);
    } catch (e) {
      toast.error('Error al exportar CSV.');
    }
  };

  // Comparison selection handlers
  const toggleCompareSelection = (tipo: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(tipo)) {
        return prev.filter(t => t !== tipo);
      }
      if (prev.length >= 3) {
        toast.warning('Podés comparar hasta 3 tarifas a la vez.');
        return prev;
      }
      return [...prev, tipo];
    });
  };

  const openComparison = () => {
    if (selectedForCompare.length < 2) {
      toast.warning('Seleccioná al menos 2 tarifas para comparar.');
      return;
    }
    setShowComparison(true);
  };

  const clearComparison = () => {
    setSelectedForCompare([]);
    setShowComparison(false);
  };

  const handleModoCobroChange = (nuevoModo: ModoCobro) => {
    if (nuevoModo === 'porHabitacion' || nuevoModo === 'porCama') {
      // En modo habitación o porCama: un solo rango con precio fijo
      setTarifaForm(prev => ({
        ...prev,
        modoCobro: nuevoModo,
        rangos: [{ minPersonas: 1, maxPersonas: null, precio: prev.rangos[0]?.precio || 0 }],
      }));
    } else if (tarifaForm.modoCobro === 'porHabitacion' || tarifaForm.modoCobro === 'porCama') {
      // Cambiando DE porHabitacion/porCama A otro modo: expandir a rangos individuales
      const precioBase = tarifaForm.rangos[0]?.precio || 0;
      setTarifaForm(prev => ({
        ...prev,
        modoCobro: nuevoModo,
        rangos: [
          { minPersonas: 1, maxPersonas: 1, precio: precioBase },
          { minPersonas: 2, maxPersonas: 2, precio: 0 },
          { minPersonas: 3, maxPersonas: 3, precio: 0 },
          { minPersonas: 4, maxPersonas: 4, precio: 0 },
        ],
      }));
    } else {
      setTarifaForm(prev => ({ ...prev, modoCobro: nuevoModo }));
    }
  };

  const addRango = () => {
    if (tarifaForm.modoCobro === 'porHabitacion' || tarifaForm.modoCobro === 'porCama') return;
    const rangos = [...tarifaForm.rangos];
    const lastRango = rangos[rangos.length - 1];
    // If the last range is open (maxPersonas === null), close it first
    if (lastRango && lastRango.maxPersonas === null) {
      rangos[rangos.length - 1] = { ...lastRango, maxPersonas: lastRango.minPersonas };
    }
    const newMin = lastRango ? (lastRango.maxPersonas !== null ? lastRango.maxPersonas + 1 : lastRango.minPersonas + 1) : 1;
    rangos.push({ minPersonas: newMin, maxPersonas: null, precio: 0 });
    setTarifaForm(prev => ({ ...prev, rangos }));
  };

  const updateRango = (index: number, rango: RangoPrecio) => {
    setTarifaForm(prev => {
      const nuevos = [...prev.rangos];
      nuevos[index] = rango;
      return { ...prev, rangos: nuevos };
    });
  };

  const removeRango = (index: number) => {
    setTarifaForm(prev => ({
      ...prev,
      rangos: prev.rangos.filter((_, i) => i !== index),
    }));
  };

  const handleGuardarTarifa = async () => {
    const nombre = tarifaForm.nombre.trim();
    if (!nombre) { toast.warning('El nombre de la tarifa no puede estar vacío.'); return; }
    const tipoKey = editandoTarifa || 'nueva';
    if (editandoTarifa === null && tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) {
      toast.warning(`Ya existe una tarifa llamada "${nombre}".`); return;
    }
    if (editandoTarifa !== null && nombre !== editandoTarifa && tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) {
      toast.warning(`Ya existe una tarifa llamada "${nombre}".`); return;
    }
    if (tarifaForm.rangos.length === 0) {
      toast.warning('Debe agregar al menos un rango de precios.'); return;
    }
    const ok = await guardarTarifaCompleta(tipoKey, {
      nombre,
      modoCobro: tarifaForm.modoCobro,
      rangos: tarifaForm.rangos,
      camposPersonalizados: tarifaForm.camposPersonalizados,
      promociones: tarifaForm.promociones,
    });
    if (ok) {
      setModalTarifa(false);
      toast.success(editandoTarifa ? 'Cambios guardados con éxito.' : `Tarifa "${nombre}" creada con éxito.`);
    } else {
      toast.error('No se pudo guardar la tarifa.');
    }
  };

  // Wizard navigation
  const canAdvanceStep1 = tarifaForm.nombre.trim().length > 0;
  const canAdvanceStep2 = tarifaForm.rangos.length > 0;
  const handleNextStep = () => {
    if (wizardStep === 1 && !canAdvanceStep1) {
      toast.warning('Ingresá un nombre para la tarifa.');
      return;
    }
    if (wizardStep === 2 && !canAdvanceStep2) {
      toast.warning('Agregá al menos un rango de precios.');
      return;
    }
    if (wizardStep < 3) setWizardStep((wizardStep + 1) as 1 | 2 | 3);
  };
  const handlePrevStep = () => {
    if (wizardStep > 1) setWizardStep((wizardStep - 1) as 1 | 2 | 3);
  };

  const handleEliminarTarifa = (tipo: string) => {
    const reservasActivas = reservas.filter(r => r.tipoTarifa === tipo && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
    if (reservasActivas.length > 0) {
      toast.warning(`No se puede eliminar la tarifa "${tipo}". Hay ${reservasActivas.length} reserva(s) activa(s) que la están usando.`);
      return;
    }
    setConfirmDialog({
      open: true,
      titulo: 'Eliminar tarifa',
      msg: `¿Eliminar la tarifa "${tipo}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        const ok = await eliminarTipoTarifa(tipo);
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setModalTarifa(false);
        // Remove from comparison selection if present
        setSelectedForCompare(prev => prev.filter(t => t !== tipo));
        if (ok) {
          toast.success(`Tarifa "${tipo}" eliminada correctamente.`);
        } else {
          toast.error('No se pudo eliminar la tarifa. Verificá que no tenga reservas activas.');
        }
      },
    });
  };

  // ==================== MÉTODOS TAB ====================

  const openModalMetodo = (id: string | null) => {
    if (id === null) {
      setEditandoMetodo(null);
      setMetForm({ nombre: '', tipo: 'efectivo', recargo: false, cuotas: [] });
    } else {
      const m = metodosPago.find(met => met.id === id);
      if (!m) return;
      setEditandoMetodo(id);
      setMetForm({ nombre: m.nombre, tipo: m.tipo as 'efectivo', recargo: m.recargo, cuotas: [...m.cuotas] });
    }
    setModalMetodo(true);
  };

  const handleGuardarMetodo = () => {
    const nombre = metForm.nombre.trim();
    if (!nombre) { toast.warning('Ingrese un nombre.'); return; }

    if (editandoMetodo === null) {
      const nuevoId = nombre.toLowerCase().replace(/\s+/g, '_');
      if (metodosPago.some(m => m.id === nuevoId)) { toast.warning('Ya existe un método con ese nombre.'); return; }
      agregarMetodoPago({ id: nuevoId, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    } else {
      editarMetodoPago(editandoMetodo, { id: editandoMetodo, nombre, tipo: metForm.tipo, recargo: metForm.recargo, cuotas: metForm.cuotas });
    }
    setModalMetodo(false);
  };

  const handleEliminarMetodo = (id: string) => {
    if (id === 'efectivo') { toast.warning('No se puede eliminar el método Efectivo.'); return; }
    const metodo = metodosPago.find(m => m.id === id);
    if (!metodo) return;
    if (pagos.some(p => p.metodo === metodo.id)) {
      toast.warning(`No se puede eliminar "${metodo.nombre}". Hay pago(s) registrado(s) con este método.`); return;
    }
    if (reservas.some(r => r.metodoPagoId === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'))) {
      toast.warning(`No se puede eliminar "${metodo.nombre}". Hay reserva(s) activa(s) que lo están usando.`); return;
    }
    setConfirmDialog({
      open: true, titulo: 'Eliminar método de pago', msg: `¿Eliminar este método de pago?`,
      onConfirm: () => {
        eliminarMetodoPago(id);
        setConfirmDialog({ ...confirmDialog, open: false });
        toast.success('Método de pago eliminado.');
      },
    });
  };

  // ==================== CATEGORÍAS TAB ====================

  const openModalCategoria = (nombre: string | null) => {
    if (nombre === null) {
      setEditandoCat(null);
      setCatForm('');
    } else {
      setEditandoCat(nombre);
      setCatForm(nombre);
    }
    setModalCategoria(true);
  };

  const handleGuardarCategoria = () => {
    const nombre = catForm.trim();
    if (!nombre) { toast.warning('Ingrese un nombre.'); return; }
    if (editandoCat === null) {
      if (categoriasGastos.includes(nombre)) { toast.warning('Ya existe una categoría con ese nombre.'); return; }
      agregarCategoriaGasto(nombre);
    } else {
      editarCategoriaGasto(editandoCat, nombre);
    }
    setModalCategoria(false);
  };

  const handleEliminarCategoria = (nombre: string) => {
    const gastosAsociados = gastos.filter(g => g.tipo === nombre);
    if (gastosAsociados.length > 0) {
      toast.warning(`No se puede eliminar "${nombre}". Hay ${gastosAsociados.length} gasto(s) registrado(s) con esta categoría.`); return;
    }
    setConfirmDialog({
      open: true, titulo: 'Eliminar categoría', msg: `¿Eliminar la categoría "${nombre}"?`,
      onConfirm: () => {
        eliminarCategoriaGasto(nombre);
        setConfirmDialog({ ...confirmDialog, open: false });
        toast.success('Categoría eliminada.');
      },
    });
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Tags} title="Tarifas y Métodos de Pago" subtitle="Configurá precios y formas de cobro" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="tarifas" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all"><Tags className="w-4 h-4 mr-1" />Tarifas</TabsTrigger>
          <TabsTrigger value="metodos" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all"><CreditCard className="w-4 h-4 mr-1" />Métodos de Pago</TabsTrigger>
          <TabsTrigger value="categorias" className="data-[state=active]:bg-primary data-[state=active]:text-white transition-all"><ListChecks className="w-4 h-4 mr-1" />Categorías de Gastos</TabsTrigger>
        </TabsList>

        {/* ==================== TAB: TARIFAS ==================== */}
        <TabsContent value="tarifas" className="space-y-5">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">Tarifas</h3>
              {selectedForCompare.length > 0 && (
                <Badge className="bg-primary text-white border-0">
                  {selectedForCompare.length} seleccionada{selectedForCompare.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedForCompare.length >= 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectedForCompare.length >= 2 ? openComparison : () => toast.info('Seleccioná al menos 2 tarifas para comparar.')}
                  className="border-primary/30 text-primary hover:bg-primary/20 hover:text-white"
                >
                  <GitCompareArrows className="w-4 h-4 mr-1" />
                  Comparar {selectedForCompare.length > 0 && `(${selectedForCompare.length})`}
                </Button>
              )}
              {selectedForCompare.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearComparison}>
                  <X className="w-4 h-4 mr-1" />Limpiar
                </Button>
              )}
              <Button onClick={() => openModalTarifa(null)}><Plus className="w-4 h-4 mr-1" />Nueva Tarifa</Button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border-primary/30 text-primary text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            Haga clic en una tarifa para editarla. Usá las casillas para seleccionar 2-3 tarifas y compararlas. Los cambios se guardan automáticamente al confirmar.
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tiposTarifa.map(tipo => {
              const t = tarifas[tipo];
              if (!t) return null;
              const modo = t.modoCobro || 'porGrupo';
              const rangos = t.rangos || [];
              const campos = (t.camposPersonalizados || []).length;
              const tarifaPromos = (t.promociones || (t.choferCortesia ? { acompananteSinCargo: { activo: true, etiqueta: 'Chofer de cortesía' } } : undefined)) as PromocionesTarifa | undefined;
              const tieneAcompanante = tarifaPromos?.acompananteSinCargo?.activo;
              const tieneNinos = tarifaPromos?.ninosDiferenciado?.activo;
              const tieneNoches = tarifaPromos?.nochesCortesia?.activo;
              const promoCount = countPromos(tarifaPromos);
              const ModoIcon = MODO_OPTIONS.find(o => o.value === modo)?.icon || UsersRound;
              const precioDesdeVal = precioDesde(rangos);
              const tienePromo = !!(tieneAcompanante || tieneNinos || tieneNoches);
              const CardIcon = tienePromo ? Sparkles : ModoIcon;
              const isSelected = selectedForCompare.includes(tipo);
              return (
                <Card
                  key={tipo}
                  className={`card-hover cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border group relative overflow-hidden ${modoGradient(modo)} ${
                    isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => openModalTarifa(tipo)}
                >
                  {/* Selection checkbox (top-left, always visible) */}
                  <div
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCompareSelection(tipo)}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-primary border-primary text-white'
                          : 'bg-card/80 border-border text-transparent hover:border-primary'
                      }`}
                      aria-label={isSelected ? 'Quitar de comparación' : 'Seleccionar para comparar'}
                      aria-pressed={isSelected}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Shine overlay — animates in on hover */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    aria-hidden="true"
                  />

                  {/* Quick actions menu (top-right) */}
                  <div
                    className="absolute top-1.5 right-1.5 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-60 group-hover:opacity-100 hover:bg-card/80 transition-opacity"
                          aria-label="Acciones rápidas"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openModalTarifa(tipo)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicarTarifa(tipo)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportCSV(tipo)}>
                          <Download className="w-3.5 h-3.5 mr-2" />Exportar CSV
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleEliminarTarifa(tipo)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Quick action buttons (reveal on hover, below dropdown) */}
                  <div
                    className="absolute bottom-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 text-xs shadow-sm bg-card hover:bg-muted"
                      onClick={() => openModalTarifa(tipo)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 text-xs shadow-sm bg-card hover:bg-muted"
                      onClick={() => handleDuplicarTarifa(tipo)}
                    >
                      <Copy className="w-3 h-3 mr-1" />Duplicar
                    </Button>
                  </div>

                  <CardContent className="p-2.5 pt-8 relative">
                    {/* Top row: icon circle + title + modo badge */}
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${modoIconCircle(modo)}`}>
                          <CardIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm group-hover:text-primary transition-colors truncate">{tipo}</h4>
                          <p className="text-[10px] text-muted-foreground">{modoLabel(modo)}</p>
                        </div>
                      </div>
                      <Badge className={`${modoBadgeColor(modo)} shrink-0 text-[10px] py-0 h-5`}>
                        <ModoIcon className="w-2.5 h-2.5 mr-0.5" />{modoLabel(modo)}
                      </Badge>
                    </div>

                    {/* Prominent "Desde" price */}
                    <div className="mb-1.5 pb-1.5 border-b border-primary/20">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Desde</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-primary tabular-nums">{formatMoney(precioDesdeVal)}</span>
                        <span className="text-[10px] text-muted-foreground">/noche</span>
                      </div>
                    </div>

                    {/* Range visualization — zebra striping, hover, mono labels, bold green prices, left border */}
                    <div className="space-y-0.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Tags className="w-2.5 h-2.5" />Rangos de precio
                      </p>
                      {rangos.map((r, i) => (
                        <div
                          key={i}
                          className={`flex justify-between items-center text-xs px-1.5 py-1 rounded-md border-l-26 border-primary/30 transition-colors ${
                            i % 2 === 1 ? 'bg-primary/5' : ''
                          } hover:bg-primary/10`}
                        >
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {formatoRango(r)} {modo === 'porHabitacion' ? 'hab.' : modo === 'porCama' ? 'cama' : 'pers.'}
                          </span>
                          <span className="font-bold text-primary tabular-nums text-xs">
                            {formatMoney(r.precio)}
                            {modo === 'porCama' && <span className="text-[10px] font-normal text-muted-foreground"> c/cama</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Footer: promo badges + quick stats */}
                    <div className="mt-1.5 pt-1.5 border-t border-primary/20 space-y-1">
                      {/* Promotion indicators with icons */}
                      {(tieneAcompanante || tieneNinos || tieneNoches) && (
                        <div className="flex gap-1 flex-wrap">
                          {tieneAcompanante && (
                            <Badge className="bg-primary/10 text-primary border-0 text-[10px] py-0 h-5" title={tarifaPromos!.acompananteSinCargo!.etiqueta || 'Acompañante sin cargo'}>
                              <Star className="w-2.5 h-2.5 mr-0.5" />{tarifaPromos!.acompananteSinCargo!.etiqueta || 'Acompañante gratis'}
                              {tarifaPromos!.acompananteSinCargo!.cantidad > 1 && (
                                <span className="ml-0.5 opacity-75">×{tarifaPromos!.acompananteSinCargo!.cantidad}</span>
                              )}
                            </Badge>
                          )}
                          {tieneNinos && (
                            <Badge className="bg-primary/10 text-primary border-0 text-[10px] py-0 h-5">
                              <Baby className="w-2.5 h-2.5 mr-0.5" />Niños {formatMoney(tarifaPromos!.ninosDiferenciado!.precioNino || 0)}/noche
                            </Badge>
                          )}
                          {tieneNoches && (
                            <Badge className="bg-primary/10 text-primary border-0 text-[10px] py-0 h-5" title={describeNochesCortesia(tarifaPromos!.nochesCortesia!.modalidad)}>
                              <Zap className="w-2.5 h-2.5 mr-0.5" />{describeNochesCortesia(tarifaPromos!.nochesCortesia!.modalidad)}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Quick stats: ranges, custom fields, promotions count */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted/50" title={`${rangos.length} rango(s) de precio`}>
                          <Tags className="w-2.5 h-2.5 text-primary/60" />{rangos.length} rango{rangos.length !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted/50" title={`${promoCount} promoción(es) activa(s)`}>
                          <Sparkles className={`w-2.5 h-2.5 ${promoCount > 0 ? 'text-primary' : 'text-muted-foreground/60'}`} />{promoCount} promo{promoCount !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted/50" title={`${campos} campo(s) personalizado(s)`}>
                          <Info className="w-2.5 h-2.5 text-primary/60" />{campos} campo{campos !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {tiposTarifa.length === 0 && (
              <div className="col-span-full">
                <Card className="border-dashed border-2 bg-muted/20">
                  <CardContent className="p-2">
                    <EmptyState
                      variant="generic"
                      title="No hay tarifas definidas"
                      description="Creá tu primera tarifa para empezar a configurar precios por noche, modos de cobro y promociones."
                      action={
                        <Button onClick={() => openModalTarifa(null)}>
                          <Plus className="w-4 h-4 mr-1" />Crear primera tarifa
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>


        </TabsContent>

        {/* ==================== TAB: MÉTODOS DE PAGO ==================== */}
        <TabsContent value="metodos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Métodos de Pago</h3>
            <Button onClick={() => openModalMetodo(null)}><Plus className="w-4 h-4 mr-1" />Agregar Método</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Recargo</TableHead>
                  <TableHead className="hidden md:table-cell">Cuotas</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metodosPago.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No hay métodos de pago definidos.</TableCell></TableRow>
                ) : metodosPago.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nombre}</TableCell>
                    <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell">{m.recargo ? <Badge className="bg-primary/10 text-primary border-0">Sí</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">
                      {m.recargo && m.cuotas.length > 0
                        ? m.cuotas.map(c => `${c.cantidad} ctas (${c.porcentaje}%)`).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openModalMetodo(m.id)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {m.id !== 'efectivo' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleEliminarMetodo(m.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== TAB: CATEGORÍAS DE GASTOS ==================== */}
        <TabsContent value="categorias" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Categorías de Gastos</h3>
            <Button onClick={() => openModalCategoria(null)}><Plus className="w-4 h-4 mr-1" />Agregar Categoría</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Gastos asociados</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriasGastos.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No hay categorías definidas.</TableCell></TableRow>
                ) : categoriasGastos.map(cat => {
                  const cantidad = gastos.filter(g => g.tipo === cat).length;
                  return (
                    <TableRow key={cat}>
                      <TableCell className="font-medium">{cat}</TableCell>
                      <TableCell>{cantidad} gasto(s)</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openModalCategoria(cat)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleEliminarCategoria(cat)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== MODAL: TARIFA (CREAR/EDITAR — WIZARD) ==================== */}
      <Dialog open={modalTarifa} onOpenChange={setModalTarifa}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-5">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {editandoTarifa ? <><Pencil className="w-5 h-5" />Editar - {editandoTarifa}</> : <><Sparkles className="w-5 h-5 text-primary" />Nueva Tarifa</>}
            </DialogTitle>
          </DialogHeader>

          {/* Wizard stepper */}
          <WizardStepper current={wizardStep} onSelect={setWizardStep} />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 mt-2">
            {/* ═══ MAIN: Step content ═══ */}
            <div className="space-y-4">
              {/* STEP 1: Basic info */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1.5">
                    <Label>Nombre de la tarifa *</Label>
                    <Input
                      value={tarifaForm.nombre}
                      onChange={e => setTarifaForm({ ...tarifaForm, nombre: e.target.value })}
                      placeholder="Ej: Corporativo, Promoción fin de semana..."
                      autoFocus
                    />
                    {tarifaForm.nombre.trim().length === 0 && (
                      <p className="text-[11px] text-primary flex items-center gap-1">
                        <Info className="w-3 h-3" />El nombre es obligatorio
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Modo de cobro *</Label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {MODO_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const selected = tarifaForm.modoCobro === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleModoCobroChange(opt.value)}
                            className={`flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-lg border-2 transition-all text-center ${
                              selected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                : 'border-border hover:border-primary/30 text-muted-foreground'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-semibold">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/30 text-primary">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <p className="text-[11px]">{MODO_OPTIONS.find(o => o.value === tarifaForm.modoCobro)?.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Price ranges */}
              {wizardStep === 2 && (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <Label className="text-sm font-medium">
                      Precios por rango
                      {tarifaForm.modoCobro === 'porHabitacion' && <span className="text-muted-foreground font-normal"> (precio por habitación)</span>}
                      {tarifaForm.modoCobro === 'porCama' && <span className="text-muted-foreground font-normal"> (precio por cama/noche)</span>}
                    </Label>

                    {/* Visual range builder — interactive tiered view */}
                    {tarifaForm.modoCobro !== 'porHabitacion' && tarifaForm.modoCobro !== 'porCama' && (
                      <div className="mt-2 mb-3 p-3 rounded-lg bg-muted/30 border border-border">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                          <Users className="w-3 h-3" />Vista por escalones
                        </p>
                        <div className="flex items-end gap-1 h-20">
                          {tarifaForm.rangos.map((r, i) => {
                            const max = Math.max(...tarifaForm.rangos.map(rr => rr.precio), 1);
                            const heightPct = Math.max((r.precio / max) * 100, 8);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                                <span className="text-[10px] font-bold text-primary tabular-nums">{formatMoney(r.precio)}</span>
                                <div
                                  className="w-full rounded-t bg-gradient-to-t from-primary to-primary transition-all duration-300"
                                  style={{ height: `${heightPct}%` }}
                                  title={`${formatoRango(r)} pers. — ${formatMoney(r.precio)}`}
                                />
                                <span className="text-[10px] text-muted-foreground font-mono">{formatoRango(r)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mt-2">
                      {tarifaForm.rangos.map((r, i) => (
                        <RangoFila
                          key={i}
                          rango={r}
                          index={i}
                          modoCobro={tarifaForm.modoCobro}
                          totalRangos={tarifaForm.rangos.length}
                          onRemove={() => removeRango(i)}
                          onUpdate={r => updateRango(i, r)}
                        />
                      ))}
                    </div>
                    {tarifaForm.modoCobro !== 'porHabitacion' && tarifaForm.modoCobro !== 'porCama' && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={addRango}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Agregar rango
                      </Button>
                    )}
                    {tarifaForm.rangos.length === 0 && (
                      <p className="text-[11px] text-primary flex items-center gap-1 mt-2">
                        <Info className="w-3 h-3" />Agregá al menos un rango de precios
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Promotions + custom fields */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />Promociones</h3>

                    {/* 1. Acompañante sin cargo */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="acompanante-check"
                          checked={promos?.acompananteSinCargo?.activo || false}
                          onCheckedChange={v => {
                            if (v) {
                              updatePromocion({ acompananteSinCargo: { activo: true, etiqueta: promos?.acompananteSinCargo?.etiqueta || '', cantidad: promos?.acompananteSinCargo?.cantidad || 1, personasHospedan: promos?.acompananteSinCargo?.personasHospedan } });
                            } else {
                              updatePromocion({ acompananteSinCargo: undefined });
                            }
                          }}
                        />
                        <Label htmlFor="acompanante-check" className="text-sm font-medium flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-primary" />Acompañante sin cargo
                        </Label>
                      </div>
                      {promos?.acompananteSinCargo?.activo && (
                        <div className="ml-6 space-y-2 border-l-26 border-primary/30 pl-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Etiqueta (nombre del beneficio)</Label>
                            <Input
                              placeholder="Ej: Chofer de cortesía, Guía turístico..."
                              value={promos.acompananteSinCargo.etiqueta || ''}
                              onChange={e => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, etiqueta: e.target.value } })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Cantidad</Label>
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                value={promos.acompananteSinCargo.cantidad ?? 1}
                                onChange={e => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, cantidad: Math.max(1, parseInt(e.target.value) || 1) } })}
                                className="h-8 text-sm"
                              />
                              <p className="text-[10px] text-muted-foreground">Acompañantes sin cargo</p>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Personas que hospedan (opcional)</Label>
                              <Input
                                type="number"
                                min={1}
                                placeholder="Ej: 4"
                                value={promos.acompananteSinCargo.personasHospedan ?? ''}
                                onChange={e => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, personasHospedan: parseInt(e.target.value) || undefined } })}
                                className="h-8 text-sm"
                              />
                              <p className="text-[10px] text-muted-foreground">Valida la búsqueda</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="acom-hab-check"
                              checked={!!promos!.acompananteSinCargo!.habitacionAsignada}
                              onCheckedChange={v => updatePromocion({ acompananteSinCargo: { ...promos!.acompananteSinCargo!, habitacionAsignada: v ? (promos!.acompananteSinCargo!.habitacionAsignada || todasHabitaciones[0]?.[0] || '') : undefined } })}
                            />
                            <Label htmlFor="acom-hab-check" className="text-xs">Asignar habitación gratis</Label>
                          </div>
                          {promos.acompananteSinCargo.habitacionAsignada && (
                            <Select
                              value={promos.acompananteSinCargo.habitacionAsignada}
                              onValueChange={v => updatePromocion({ acompananteSinCargo: { ...promos.acompananteSinCargo!, habitacionAsignada: v } })}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="-- Seleccione --" /></SelectTrigger>
                              <SelectContent>
                                {todasHabitaciones.map(([num, hab]) => (
                                  <SelectItem key={num} value={num}>{num} ({hab.tipo} - {hab.capacidad} pers.)</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>

                    <hr className="border-muted" />

                    {/* 2. Niños con precio diferenciado */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="ninos-check"
                          checked={promos?.ninosDiferenciado?.activo || false}
                          onCheckedChange={v => {
                            if (v) {
                              updatePromocion({ ninosDiferenciado: { activo: true, precioNino: promos?.ninosDiferenciado?.precioNino || 0 } });
                            } else {
                              updatePromocion({ ninosDiferenciado: undefined });
                            }
                          }}
                        />
                        <Label htmlFor="ninos-check" className="text-sm font-medium flex items-center gap-1.5">
                          <Baby className="w-3.5 h-3.5 text-primary" />Niños con precio diferenciado
                        </Label>
                      </div>
                      {promos?.ninosDiferenciado?.activo && (
                        <div className="ml-6 space-y-2 border-l-26 border-primary/30 pl-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Precio por niño / noche</Label>
                              <Input
                                type="number"
                                min={0}
                                value={promos.ninosDiferenciado.precioNino || 0}
                                onChange={e => updatePromocion({ ninosDiferenciado: { ...promos.ninosDiferenciado!, precioNino: parseFloat(e.target.value) || 0 } })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Edad máxima (informativo)</Label>
                              <Input
                                type="number"
                                min={0}
                                placeholder="Ej: 12"
                                value={promos.ninosDiferenciado.edadMaxima ?? ''}
                                onChange={e => updatePromocion({ ninosDiferenciado: { ...promos.ninosDiferenciado!, edadMaxima: parseInt(e.target.value) || undefined } })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <hr className="border-muted" />

                    {/* 3. Noches de cortesía */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="noches-check"
                          checked={promos?.nochesCortesia?.activo || false}
                          onCheckedChange={v => {
                            if (v) {
                              updatePromocion({ nochesCortesia: { activo: true, modalidad: promos?.nochesCortesia?.modalidad || { tipo: 'cadaX', cada: 3 } } });
                            } else {
                              updatePromocion({ nochesCortesia: undefined });
                            }
                          }}
                        />
                        <Label htmlFor="noches-check" className="text-sm font-medium flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-primary" />Noches de cortesía
                        </Label>
                      </div>
                      {promos?.nochesCortesia?.activo && (
                        <div className="ml-6 space-y-2 border-l-26 border-primary/30 pl-3">
                          <Select
                            value={promos.nochesCortesia.modalidad.tipo}
                            onValueChange={v => {
                              let mod: ModalidadNochesCortesia;
                              if (v === 'cadaX') mod = { tipo: 'cadaX', cada: 3 };
                              else if (v === 'aPartirDe') mod = { tipo: 'aPartirDe', minNoches: 5, nochesGratis: 1 };
                              else mod = { tipo: 'diaSemana', dia: 3 };
                              updatePromocion({ nochesCortesia: { ...promos.nochesCortesia!, modalidad: mod } });
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cadaX">Cada X noches, 1 gratis</SelectItem>
                              <SelectItem value="aPartirDe">A partir de X noches, Y gratis</SelectItem>
                              <SelectItem value="diaSemana">Día de la semana gratis</SelectItem>
                            </SelectContent>
                          </Select>

                          {promos.nochesCortesia.modalidad.tipo === 'cadaX' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Cada cuántas noches</Label>
                              <Input
                                type="number"
                                min={2}
                                value={promos.nochesCortesia.modalidad.cada}
                                onChange={e => updatePromocion({ nochesCortesia: { ...promos.nochesCortesia!, modalidad: { tipo: 'cadaX', cada: parseInt(e.target.value) || 3 } } })}
                                className="h-8 text-sm"
                              />
                            </div>
                          )}

                          {promos.nochesCortesia.modalidad.tipo === 'aPartirDe' && (
                            (() => {
                              const mod = promos.nochesCortesia.modalidad as Extract<ModalidadNochesCortesia, { tipo: 'aPartirDe' }>;
                              return (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Mínimo de noches</Label>
                                  <Input
                                    type="number"
                                    min={2}
                                    value={mod.minNoches}
                                    onChange={e => updatePromocion({ nochesCortesia: { ...promos!.nochesCortesia!, modalidad: { tipo: 'aPartirDe', minNoches: parseInt(e.target.value) || 5, nochesGratis: mod.nochesGratis } } })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Noches gratis</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={mod.nochesGratis}
                                    onChange={e => updatePromocion({ nochesCortesia: { ...promos!.nochesCortesia!, modalidad: { tipo: 'aPartirDe', minNoches: mod.minNoches, nochesGratis: parseInt(e.target.value) || 1 } } })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                              );
                            })()
                          )}

                          {promos.nochesCortesia.modalidad.tipo === 'diaSemana' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Día de la semana gratis</Label>
                              <Select
                                value={String(promos.nochesCortesia.modalidad.dia)}
                                onValueChange={v => updatePromocion({ nochesCortesia: { ...promos.nochesCortesia!, modalidad: { tipo: 'diaSemana', dia: parseInt(v) } } })}
                              >
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {DIAS_SEMANA.map((dia, i) => (
                                    <SelectItem key={i} value={String(i)}>{dia}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <hr className="border-muted" />

                    {/* Campos adicionales */}
                    <div>
                      <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-primary/60" />Campos adicionales
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">Se pedirán al elegir esta tarifa en la reserva.</p>
                      <div className="space-y-2">
                        {tarifaForm.camposPersonalizados.length === 0 && (
                          <p className="text-xs text-muted-foreground">Sin campos definidos.</p>
                        )}
                        {tarifaForm.camposPersonalizados.map((c, i) => (
                          <CampoFila
                            key={i}
                            campo={c}
                            onRemove={() => setTarifaForm({ ...tarifaForm, camposPersonalizados: tarifaForm.camposPersonalizados.filter((_, j) => j !== i) })}
                            onUpdate={nuevo => {
                              const nuevos = [...tarifaForm.camposPersonalizados];
                              nuevos[i] = nuevo;
                              setTarifaForm({ ...tarifaForm, camposPersonalizados: nuevos });
                            }}
                          />
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => setTarifaForm({ ...tarifaForm, camposPersonalizados: [...tarifaForm.camposPersonalizados, { nombre: '', tipo: 'texto', requerido: false }] })}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Agregar campo
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ═══ RIGHT: Live preview ═══ */}
            <div className="lg:sticky lg:top-0 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />Vista previa en vivo
              </p>
              <TariffMiniPreview
                nombre={tarifaForm.nombre}
                modoCobro={tarifaForm.modoCobro}
                rangos={tarifaForm.rangos}
                promociones={tarifaForm.promociones}
                camposCount={tarifaForm.camposPersonalizados.length}
              />
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Así se verá tu tarifa en el listado.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-wrap justify-between sm:justify-between gap-2 mt-2">
            <div className="flex gap-2">
              {editandoTarifa && (
                <Button variant="destructive" onClick={() => handleEliminarTarifa(editandoTarifa)}>
                  <Trash2 className="w-4 h-4 mr-1" />Eliminar
                </Button>
              )}
              {wizardStep > 1 && (
                <Button variant="outline" onClick={handlePrevStep}>
                  <ChevronLeft className="w-4 h-4 mr-1" />Atrás
                </Button>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
              {wizardStep < 3 ? (
                <Button onClick={handleNextStep}>
                  Siguiente<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleGuardarTarifa}>
                  {editandoTarifa ? <><Pencil className="w-4 h-4 mr-1" />Guardar Cambios</> : <><Sparkles className="w-4 h-4 mr-1" />Crear Tarifa</>}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: COMPARACIÓN ==================== */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        {selectedForCompare.length >= 2 ? (
          <ComparisonModal
            tariffs={selectedForCompare.map(tipo => ({ tipo, t: tarifas[tipo] })).filter(x => x.t) as { tipo: string; t: TarifaPrecios }[]}
            onClose={() => setShowComparison(false)}
          />
        ) : (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Comparación de tarifas</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Seleccioná al menos 2 tarifas para comparar.</p>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowComparison(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ==================== MODAL: MÉTODO DE PAGO ==================== */}
      <Dialog open={modalMetodo} onOpenChange={setModalMetodo}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoMetodo ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={metForm.nombre} onChange={e => setMetForm({ ...metForm, nombre: e.target.value })} placeholder="Ej: Mercado Pago" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={metForm.tipo} onValueChange={v => setMetForm({ ...metForm, tipo: v as 'efectivo' | 'tarjeta' | 'transferencia' | 'otro' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="met-recargo" checked={metForm.recargo} onCheckedChange={v => setMetForm({ ...metForm, recargo: !!v, cuotas: !v ? [] : metForm.cuotas })} />
              <Label htmlFor="met-recargo">Permite recargo (cuotas)</Label>
            </div>

            {metForm.recargo && (
              <div className="space-y-2">
                <Label>Cuotas</Label>
                {metForm.cuotas.length === 0 && <p className="text-xs text-muted-foreground">Sin cuotas definidas.</p>}
                <div className="space-y-2">
                  {metForm.cuotas.map((c, i) => (
                    <CuotaFila
                      key={i}
                      cuota={c}
                      onRemove={() => setMetForm({ ...metForm, cuotas: metForm.cuotas.filter((_, j) => j !== i) })}
                      onUpdate={nuevo => {
                        const nuevos = [...metForm.cuotas];
                        nuevos[i] = nuevo;
                        setMetForm({ ...metForm, cuotas: nuevos });
                      }}
                    />
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => setMetForm({ ...metForm, cuotas: [...metForm.cuotas, { cantidad: 1, porcentaje: 0 }] })}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Agregar cuota
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleGuardarMetodo}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: CATEGORÍA DE GASTO ==================== */}
      <Dialog open={modalCategoria} onOpenChange={setModalCategoria}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editandoCat ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre de la categoría *</Label>
              <Input value={catForm} onChange={e => setCatForm(e.target.value)} placeholder="Ej: Proveedores" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button onClick={handleGuardarCategoria}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG: CONFIRMACIÓN ==================== */}
      <Dialog open={confirmDialog.open} onOpenChange={v => setConfirmDialog({ ...confirmDialog, open: v })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.titulo}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDialog.msg}</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={confirmDialog.onConfirm}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

// Cargar o editar un titular de cuenta corriente (empresa o persona).
// Se usa en tres lugares: al pasar un saldo a cuenta corriente, en la pestaña
// Cuenta corriente de Comprobantes, y en los datos fiscales de un cliente.
// Las reglas están en src/lib/cuenta-corriente.ts y las vuelve a chequear la API.

import { useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, type DbTitular, type TipoTitular } from '@/lib/api-client';
import { CONDICIONES_IVA, validarCuit, normalizarCuit, aPesos, aCentavos, esCondicionIva } from '@/lib/cuenta-corriente';
import { useHotelStore } from '@/lib/store';

const SIN_DATO = '__sin_dato__';

interface Props {
  /** Si viene, se edita ese titular. Si no, se carga uno nuevo. */
  titular?: DbTitular;
  /** El tipo ya decidido (p. ej. desde la ficha de un cliente: siempre persona). */
  tipoFijo?: TipoTitular;
  nombreSugerido?: string;
  /** Para enganchar la persona a la ficha de ese cliente. */
  clienteId?: string;
  /** Si quien carga maneja la cuenta corriente: ve el límite y puede desactivar. */
  manejaCuenta: boolean;
  onGuardado: (t: DbTitular) => void;
  onCancelar: () => void;
}

export default function FormTitular({ titular, tipoFijo, nombreSugerido, clienteId, manejaCuenta, onGuardado, onCancelar }: Props) {
  const editando = !!titular;
  const [tipo, setTipo] = useState<TipoTitular>(titular?.tipo ?? tipoFijo ?? 'empresa');
  const [nombre, setNombre] = useState(titular?.nombre ?? nombreSugerido ?? '');
  const [cuit, setCuit] = useState(titular?.cuitFormateado ?? '');
  const [condicionIva, setCondicionIva] = useState<string>(titular?.condicionIva ?? SIN_DATO);
  const [domicilioFiscal, setDomicilioFiscal] = useState(titular?.domicilioFiscal ?? '');
  const [contactoNombre, setContactoNombre] = useState(titular?.contactoNombre ?? '');
  const [contactoTelefono, setContactoTelefono] = useState(titular?.contactoTelefono ?? '');
  const [contactoEmail, setContactoEmail] = useState(titular?.contactoEmail ?? '');
  const [limite, setLimite] = useState(titular?.limiteCredito != null ? String(aPesos(titular.limiteCredito)) : '');
  const [activo, setActivo] = useState(titular?.activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultandoArca, setConsultandoArca] = useState(false);
  const [resultadoArca, setResultadoArca] = useState<{ ok: boolean; texto: string; avisos: string[] } | null>(null);

  // El botón aparece si el plan del hotel incluye la facturación con ARCA:
  // usa ese mismo certificado. Si el certificado no está cargado o no tiene
  // habilitada la consulta, la API lo explica al tocarlo.
  const conArca = useHotelStore(s => !!s.usuarioActual?.featureFlags?.facturacionArca);

  // El error del CUIT se muestra recién cuando tiene los 11 números: antes
  // es alguien escribiendo, no un error.
  const digitosCuit = normalizarCuit(cuit);
  const errorCuit = digitosCuit.length >= 11 ? validarCuit(cuit) : null;
  const puedeGuardar = nombre.trim().length > 0 && digitosCuit.length === 11 && !errorCuit && !guardando;
  const puedeConsultarArca = digitosCuit.length === 11 && !errorCuit && !consultandoArca;

  // Completa con lo que dice ARCA, pisando lo que haya: la persona tocó el
  // botón justamente para eso. Nada se guarda hasta que toque "Cargar".
  const traerDeArca = async () => {
    setResultadoArca(null);
    setConsultandoArca(true);
    try {
      const d = await api.cuentaCorriente.consultarArca(digitosCuit);
      if (d.nombre) setNombre(d.nombre);
      if (d.tipo && !tipoFijo) setTipo(d.tipo);
      if (d.condicionIva && esCondicionIva(d.condicionIva)) setCondicionIva(d.condicionIva);
      if (d.domicilioFiscal) setDomicilioFiscal(d.domicilioFiscal);
      setResultadoArca({
        ok: true,
        texto: d.condicionIva
          ? 'Datos traídos de ARCA. Revisalos antes de guardar.'
          : 'ARCA respondió con avisos: la condición de IVA elegila a mano.',
        avisos: d.avisos,
      });
    } catch (e) {
      setResultadoArca({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo consultar ARCA.', avisos: [] });
    } finally {
      setConsultandoArca(false);
    }
  };

  const guardar = async () => {
    setError(null);
    const limiteNum = limite.trim() === '' ? null : Number(limite.replace(',', '.'));
    if (limiteNum != null && (!Number.isFinite(limiteNum) || limiteNum < 0)) {
      setError('El límite de crédito tiene que ser un monto positivo, o quedar vacío (sin límite).');
      return;
    }

    const datos = {
      nombre: nombre.trim(),
      cuit: digitosCuit,
      tipo,
      condicionIva: condicionIva === SIN_DATO ? null : condicionIva,
      domicilioFiscal: domicilioFiscal.trim() || null,
      contactoNombre: contactoNombre.trim() || null,
      contactoTelefono: contactoTelefono.trim() || null,
      contactoEmail: contactoEmail.trim() || null,
      // El límite y la baja solo los manda quien maneja la cuenta: si los
      // manda otro, la API los rechaza (y está bien que los rechace).
      ...(manejaCuenta ? { limiteCredito: limiteNum == null ? null : aCentavos(limiteNum) } : {}),
      ...(manejaCuenta && editando ? { activo } : {}),
    };

    setGuardando(true);
    try {
      const guardado = editando
        ? await api.cuentaCorriente.editar(titular.id, datos)
        : await api.cuentaCorriente.crear({ ...datos, ...(clienteId ? { clienteId } : {}) });
      onGuardado(guardado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3">
      {!tipoFijo && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de titular">
          {(['empresa', 'persona'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => setTipo(t)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                tipo === t ? 'border-primary bg-[#0F766E1A] text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {t === 'empresa' ? 'Empresa' : 'Persona'}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="ft-nombre">{tipo === 'empresa' ? 'Razón social' : 'Nombre y apellido (como va en la factura)'}</Label>
        <Input id="ft-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={200} autoFocus={!editando} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ft-cuit">CUIT</Label>
        <div className="flex gap-2">
          <Input
            id="ft-cuit"
            value={cuit}
            onChange={e => { setCuit(e.target.value); setResultadoArca(null); }}
            placeholder="30-12345678-9"
            inputMode="numeric"
            aria-invalid={!!errorCuit}
            className="font-mono"
          />
          {conArca && (
            <Button type="button" variant="secondary" onClick={traerDeArca} disabled={!puedeConsultarArca} className="shrink-0">
              {consultandoArca ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
              Traer de ARCA
            </Button>
          )}
        </div>
        {errorCuit ? (
          <p className="text-xs text-destructive">{errorCuit}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Es lo único obligatorio para facturarle. Con o sin guiones.</p>
        )}
        {resultadoArca && (
          <div className={`text-xs ${resultadoArca.ok ? 'text-muted-foreground' : 'text-destructive'}`} role="status">
            <p>{resultadoArca.texto}</p>
            {resultadoArca.avisos.map((a, i) => <p key={i} className="text-amber-700 dark:text-amber-400">{a}</p>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Condición frente al IVA</Label>
          <Select value={condicionIva} onValueChange={setCondicionIva}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DATO}>Sin dato por ahora</SelectItem>
              {CONDICIONES_IVA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ft-domicilio">Domicilio fiscal</Label>
          <Input id="ft-domicilio" value={domicilioFiscal} onChange={e => setDomicilioFiscal(e.target.value)} maxLength={300} placeholder="Opcional" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ft-cnombre">Contacto</Label>
          <Input id="ft-cnombre" value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} maxLength={200} placeholder="Quién paga" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ft-ctel">Teléfono</Label>
          <Input id="ft-ctel" value={contactoTelefono} onChange={e => setContactoTelefono(e.target.value)} maxLength={50} placeholder="Opcional" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ft-cmail">Email</Label>
          <Input id="ft-cmail" type="email" value={contactoEmail} onChange={e => setContactoEmail(e.target.value)} maxLength={200} placeholder="Opcional" />
        </div>
      </div>

      {manejaCuenta && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="ft-limite">Límite de crédito</Label>
            <Input id="ft-limite" value={limite} onChange={e => setLimite(e.target.value)} inputMode="decimal" placeholder="Sin límite" />
            <p className="text-xs text-muted-foreground">Por ahora solo avisa: no frena nada.</p>
          </div>
          {editando && (
            <label className="flex items-center gap-2 text-sm pb-6">
              <Switch checked={activo} onCheckedChange={setActivo} />
              {activo ? 'Activo' : 'Desactivado: no se le anotan deudas nuevas'}
            </label>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        <Button type="button" onClick={guardar} disabled={!puedeGuardar}>
          {guardando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          {editando ? 'Guardar cambios' : 'Cargar'}
        </Button>
      </div>
    </div>
  );
}

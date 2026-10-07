import Link from 'next/link';
import {
  getPublicTenant, parseFechasConsulta, parsePersonasConsulta, buscarDisponibilidad, buscarDisponibilidadPromocion,
  resolverRequisitosTarifa, promocionDeLaWeb,
} from '@/lib/public-landing';
import ReservaCheckoutForm from '@/components/public/ReservaCheckoutForm';

function AvisoVolver({ slug, hotelNombre, mensaje }: { slug: string; hotelNombre: string; mensaje: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-3 max-w-sm">
        <p className="text-muted-foreground">{mensaje}</p>
        <Link href={`/h/${slug}`} className="inline-block text-primary hover:underline text-sm">
          Volver a {hotelNombre}
        </Link>
      </div>
    </div>
  );
}

export default async function ReservarPage(
  { params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ habitacion?: string; checkin?: string; checkout?: string; personas?: string; ninos?: string; promocion?: string }>;
  }
) {
  const { slug } = await params;
  const { habitacion: numero, checkin, checkout, personas: personasStr, ninos: ninosStr, promocion: promocionId } = await searchParams;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return <AvisoVolver slug={slug} hotelNombre="el hotel" mensaje="No encontramos este hotel." />;

  const habitacion = numero ? tenant.habitaciones.find((h) => h.numero === numero) : undefined;
  const fechas = parseFechasConsulta(checkin, checkout, tenant.configuracion?.reservasHabilitadasHasta);
  const personas = parsePersonasConsulta(personasStr || '1');
  const ninos = Math.max(0, Math.min(20, parseInt(ninosStr || '0') || 0));

  if (!habitacion || 'error' in fechas || typeof personas !== 'number') {
    return <AvisoVolver slug={slug} hotelNombre={tenant.nombre} mensaje="El link de reserva no es válido o venció." />;
  }

  // Una promoción tiene que estar en la web, la estadía dentro de sus fechas
  // y su tarifa valer para esa salida.
  if (promocionId) {
    const promo = promocionDeLaWeb(tenant, promocionId, checkin!, checkout!);
    if ('error' in promo) return <AvisoVolver slug={slug} hotelNombre={tenant.nombre} mensaje={promo.error} />;
  }

  const resultados = promocionId
    ? await buscarDisponibilidadPromocion(tenant, promocionId, fechas, personas, ninos)
    : (await buscarDisponibilidad(tenant, fechas, personas)).resultados;
  const resultado = resultados.find((r) => r.numero === numero);

  if (!resultado) {
    return <AvisoVolver slug={slug} hotelNombre={tenant.nombre} mensaje="Esa habitación ya no está disponible para esas fechas — puede que se acabe de ocupar. Elegí otras fechas u otra habitación." />;
  }

  // Los requisitos de la tarifa que cobra esta reserva (datos a pedir, niños):
  // la de la promoción elegida o la de la web para ese tipo y esa salida.
  const requisitos = resolverRequisitosTarifa(tenant, promocionId ? { promocionId } : { tipo: habitacion.tipo }, fechas, ninos);

  return (
    <ReservaCheckoutForm
      slug={slug}
      hotelNombre={tenant.nombre}
      moneda={tenant.moneda}
      habitacion={{ numero: habitacion.numero, tipo: habitacion.tipo, foto: habitacion.fotos[0] || null }}
      checkin={checkin!}
      checkout={checkout!}
      personas={personas}
      ninos={requisitos?.tieneNinosDiferenciado ? ninos : undefined}
      resultado={resultado}
      promocionId={promocionId}
      camposPersonalizados={requisitos?.camposPersonalizados || []}
    />
  );
}

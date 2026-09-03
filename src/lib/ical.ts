// ==================== iCal — export/import de disponibilidad ====================
// Formato mínimo (RFC 5545) suficiente para interoperar con Booking.com y Airbnb:
// solo fechas de bloqueo (VEVENT con DTSTART/DTEND de día completo), sin recurrencia.

export interface IcsBusyRange {
  uid: string;
  checkin: Date;
  checkout: Date;
  summary: string;
}

function toIcsDate(d: Date): string {
  // Fecha de día completo (VALUE=DATE), formato YYYYMMDD en UTC.
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeIcsText(text: string): string {
  return text.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

/** Genera un feed .ics con las fechas ocupadas de una habitación, para publicar en Booking/Airbnb. */
export function buildIcsFeed(hotelNombre: string, habitacion: string, ranges: IcsBusyRange[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hospi//Sync//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(`${hotelNombre} - Hab. ${habitacion}`)}`,
  ];

  for (const r of ranges) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.uid}@hospeda`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;VALUE=DATE:${toIcsDate(r.checkin)}`,
      `DTEND;VALUE=DATE:${toIcsDate(r.checkout)}`,
      `SUMMARY:${escapeIcsText(r.summary)}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export interface IcsParsedEvent {
  uid: string;
  checkin: Date;
  checkout: Date;
}

/** Parser mínimo de VEVENTs de un feed .ics externo (Booking.com / Airbnb). Ignora recurrencia. */
export function parseIcsEvents(icsText: string): IcsParsedEvent[] {
  const events: IcsParsedEvent[] = [];
  const veventBlocks = icsText.split('BEGIN:VEVENT').slice(1);

  for (const block of veventBlocks) {
    const body = block.split('END:VEVENT')[0];
    const uidMatch = body.match(/UID:(.+)/);
    const dtstartMatch = body.match(/DTSTART[^:]*:(\d{8})/);
    const dtendMatch = body.match(/DTEND[^:]*:(\d{8})/);
    if (!dtstartMatch || !dtendMatch) continue;

    const parseYmd = (s: string) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00.000Z`);

    events.push({
      uid: uidMatch?.[1]?.trim() || `${dtstartMatch[1]}-${dtendMatch[1]}`,
      checkin: parseYmd(dtstartMatch[1]),
      checkout: parseYmd(dtendMatch[1]),
    });
  }

  return events;
}

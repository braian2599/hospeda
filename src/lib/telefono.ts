// ==================== TELÉFONO CON CÓDIGO DE PAÍS (WhatsApp) ====================
// El formulario de reserva de la página web pide el WhatsApp del huésped con
// el código de su país. Con eso el hotel le escribe con un toque (botón del
// email de la reserva) y no tiene que adivinar si es de Argentina o de afuera.
//
// Se guarda armado y legible: "+54 9 3516123456" (Argentina) o
// "+34 612345678". Para el link de WhatsApp se usan solo los números.
//
// ARGENTINA: WhatsApp necesita el 9 después del 54 en los celulares, y el
// número va sin el 0 del código de área y sin el 15: siempre quedan 10
// números (ej. 351 6123456, 11 23456789). El 9 lo pone el sistema.
//
// Puro (sin base ni navegador): lo usan el formulario y el servidor.

export interface Pais { iso: string; nombre: string; codigo: string }

// iso|nombre|código. Argentina primero; el resto por nombre.
const CRUDO = `AR|Argentina|54
DE|Alemania|49;AD|Andorra|376;AO|Angola|244;AG|Antigua y Barbuda|1;SA|Arabia Saudita|966;DZ|Argelia|213;AM|Armenia|374;AW|Aruba|297;AU|Australia|61;AT|Austria|43;AZ|Azerbaiyán|994
BS|Bahamas|1;BH|Baréin|973;BD|Bangladés|880;BB|Barbados|1;BE|Bélgica|32;BZ|Belice|501;BJ|Benín|229;BY|Bielorrusia|375;BO|Bolivia|591;BA|Bosnia y Herzegovina|387;BW|Botsuana|267;BR|Brasil|55;BN|Brunéi|673;BG|Bulgaria|359;BF|Burkina Faso|226;BI|Burundi|257;BT|Bután|975
CV|Cabo Verde|238;KH|Camboya|855;CM|Camerún|237;CA|Canadá|1;QA|Catar|974;TD|Chad|235;CL|Chile|56;CN|China|86;CY|Chipre|357;CO|Colombia|57;KM|Comoras|269;KP|Corea del Norte|850;KR|Corea del Sur|82;CI|Costa de Marfil|225;CR|Costa Rica|506;HR|Croacia|385;CU|Cuba|53;CW|Curazao|599
DK|Dinamarca|45;DM|Dominica|1;EC|Ecuador|593;EG|Egipto|20;SV|El Salvador|503;AE|Emiratos Árabes Unidos|971;ER|Eritrea|291;SK|Eslovaquia|421;SI|Eslovenia|386;ES|España|34;US|Estados Unidos|1;EE|Estonia|372;SZ|Esuatini|268;ET|Etiopía|251
PH|Filipinas|63;FI|Finlandia|358;FJ|Fiyi|679;FR|Francia|33;GA|Gabón|241;GM|Gambia|220;GE|Georgia|995;GH|Ghana|233;GD|Granada|1;GR|Grecia|30;GT|Guatemala|502;GF|Guayana Francesa|594;GN|Guinea|224;GQ|Guinea Ecuatorial|240;GW|Guinea-Bisáu|245;GY|Guyana|592
HT|Haití|509;HN|Honduras|504;HK|Hong Kong|852;HU|Hungría|36;IN|India|91;ID|Indonesia|62;IQ|Irak|964;IR|Irán|98;IE|Irlanda|353;IS|Islandia|354;IL|Israel|972;IT|Italia|39
JM|Jamaica|1;JP|Japón|81;JO|Jordania|962;KZ|Kazajistán|7;KE|Kenia|254;KG|Kirguistán|996;KW|Kuwait|965;LA|Laos|856;LS|Lesoto|266;LV|Letonia|371;LB|Líbano|961;LR|Liberia|231;LY|Libia|218;LI|Liechtenstein|423;LT|Lituania|370;LU|Luxemburgo|352
MO|Macao|853;MK|Macedonia del Norte|389;MG|Madagascar|261;MY|Malasia|60;MW|Malaui|265;MV|Maldivas|960;ML|Malí|223;MT|Malta|356;MA|Marruecos|212;MU|Mauricio|230;MR|Mauritania|222;MX|México|52;MD|Moldavia|373;MC|Mónaco|377;MN|Mongolia|976;ME|Montenegro|382;MZ|Mozambique|258;MM|Myanmar|95
NA|Namibia|264;NP|Nepal|977;NI|Nicaragua|505;NE|Níger|227;NG|Nigeria|234;NO|Noruega|47;NZ|Nueva Zelanda|64;OM|Omán|968;NL|Países Bajos|31;PK|Pakistán|92;PA|Panamá|507;PG|Papúa Nueva Guinea|675;PY|Paraguay|595;PE|Perú|51;PL|Polonia|48;PT|Portugal|351;PR|Puerto Rico|1
GB|Reino Unido|44;CF|República Centroafricana|236;CZ|República Checa|420;CG|República del Congo|242;CD|República Democrática del Congo|243;DO|República Dominicana|1;RW|Ruanda|250;RO|Rumania|40;RU|Rusia|7
WS|Samoa|685;KN|San Cristóbal y Nieves|1;SM|San Marino|378;VC|San Vicente y las Granadinas|1;LC|Santa Lucía|1;ST|Santo Tomé y Príncipe|239;SN|Senegal|221;RS|Serbia|381;SC|Seychelles|248;SL|Sierra Leona|232;SG|Singapur|65;SY|Siria|963;SO|Somalia|252;LK|Sri Lanka|94;ZA|Sudáfrica|27;SD|Sudán|249;SE|Suecia|46;CH|Suiza|41;SR|Surinam|597
TH|Tailandia|66;TW|Taiwán|886;TZ|Tanzania|255;TJ|Tayikistán|992;TL|Timor Oriental|670;TG|Togo|228;TO|Tonga|676;TT|Trinidad y Tobago|1;TN|Túnez|216;TM|Turkmenistán|993;TR|Turquía|90;UA|Ucrania|380;UG|Uganda|256;UY|Uruguay|598;UZ|Uzbekistán|998
VU|Vanuatu|678;VE|Venezuela|58;VN|Vietnam|84;YE|Yemen|967;DJ|Yibuti|253;ZM|Zambia|260;ZW|Zimbabue|263`;

export const PAISES: Pais[] = CRUDO.split(/[;\n]/).map(l => {
  const [iso, nombre, codigo] = l.trim().split('|');
  return { iso, nombre, codigo };
});

export const PAIS_POR_DEFECTO = 'AR';

export function paisPorIso(iso: string): Pais {
  return PAISES.find(p => p.iso === iso) ?? PAISES[0];
}

/** Bandera del país (imagen; los emojis de banderas no se ven en Windows). */
export function urlBandera(iso: string): string {
  return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
}

/** Ayuda que va debajo del número, según el país. */
export function ayudaNumero(iso: string): string {
  return iso === 'AR'
    ? 'Código de área sin el 0 y número sin el 15. Ej: 351 6123456'
    : 'El número completo, sin el código del país.';
}

/**
 * Arma el teléfono con el código del país a partir de lo que escribió la
 * persona. Devuelve el error para mostrar si el número no sirve.
 */
export function armarTelefono(iso: string, escrito: string): { telefono: string } | { error: string } {
  const pais = paisPorIso(iso);
  let numeros = escrito.replace(/\D/g, '');
  if (!numeros) return { error: 'Ingresá tu número de WhatsApp.' };
  if (pais.iso === 'AR') {
    // Si lo escribió con el código del país o con el 0 adelante, se saca.
    if (numeros.startsWith('549') && numeros.length === 13) numeros = numeros.slice(3);
    else if (numeros.startsWith('54') && numeros.length === 12) numeros = numeros.slice(2);
    if (numeros.startsWith('0')) numeros = numeros.slice(1);
    if (numeros.length !== 10) {
      return { error: 'El WhatsApp de Argentina lleva 10 números: código de área sin el 0 y número sin el 15. Ej: 351 6123456' };
    }
    return { telefono: `+54 9 ${numeros}` };
  }
  if (numeros.startsWith(pais.codigo) && numeros.length > pais.codigo.length + 6) numeros = numeros.slice(pais.codigo.length);
  if (numeros.length < 6 || pais.codigo.length + numeros.length > 15) {
    return { error: 'Revisá el número de WhatsApp: parece incompleto o tiene números de más.' };
  }
  return { telefono: `+${pais.codigo} ${numeros}` };
}

/** ¿Es un teléfono armado por armarTelefono? (lo controla el servidor) */
export function telefonoArmadoValido(t: string): boolean {
  if (/^\+54 9 \d{10}$/.test(t)) return true;
  const m = t.match(/^\+(\d{1,4}) (\d{6,14})$/);
  return !!m && m[1] !== '54' && m[1].length + m[2].length <= 15;
}

/** Link para escribirle por WhatsApp. null si el teléfono no tiene suficientes números. */
export function linkWhatsApp(telefono: string | null | undefined): string | null {
  const numeros = (telefono || '').replace(/\D/g, '');
  return numeros.length >= 8 ? `https://wa.me/${numeros}` : null;
}

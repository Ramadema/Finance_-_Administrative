/**
 * Limpieza de la descripción cruda del banco antes de matchear comercios.
 *
 * BBVA no manda "Rappi": manda "MERPAGO*RAPPI 4523", "RAPPI ARGENTINA S.A.",
 * "MP* RAPPI". Todo eso tiene que colapsar a la misma clave.
 */

/** Prefijos de procesadores de pago que tapan el comercio real. */
const PREFIJOS_PROCESADOR = [
  "MERPAGO", "MERCADOPAGO", "MERCADO PAGO", "MP", "PAGOSMISP", "DLO",
  "DEBITO AUTOMATICO", "DEB AUT", "DEBIN", "PAGO ELECTRONICO", "PAGOMISCUENTAS",
  "COMPRA", "CONSUMO", "PAY", "PAYU", "EBANX", "STRIPE", "SP", "SQ",
];

/** Sufijos societarios que no aportan identidad. */
const SUFIJOS_SOCIETARIOS =
  /\b(S\.?A\.?S?|S\.?R\.?L|SACIF[AI]?|CICSA|ARGENTINA|ARG|COM|COM\.AR|SUCURSAL|SUC)\b/g;

/**
 * Identificador de operación pegado al nombre del comercio:
 * "CURSOR, AI POWER in1Tm5auB4TZW". Cambia todos los meses, así que sin
 * sacarlo el mismo comercio genera una clave distinta cada vez: la memoria
 * nunca aprende y una suscripción mensual jamás se detecta como gasto fijo.
 *
 * La firma es un token de 6+ caracteres que mezcla letras y dígitos. Los de
 * 5 o menos quedan ("R4240", "24HS"): ahí el riesgo de comerse un nombre real
 * supera al de dejar pasar un id.
 */
const ID_OPERACION = /\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b/g;

/**
 * Carácter que queda cuando el banco exporta mal una letra con tilde.
 *
 * BBVA escribe "PERCEPCIÓN" como "PERCEPCI\uFFFDN" DENTRO del .xls: la Ó ya
 * viene rota en el archivo, así que ningún codepage la recupera.
 */
export const REEMPLAZO = "\uFFFD";

/**
 * `clave.includes(patron)` tratando el carácter roto como comodín.
 *
 * Sin esto, "PERCEPCI\uFFFDN AFIP" no matchea el patrón específico
 * "PERCEPCION" y termina cayendo en uno genérico ("AFIP"), con la
 * subcategoría equivocada.
 */
export function incluyeTolerante(clave: string, patron: string): boolean {
  if (!clave.includes(REEMPLAZO)) return clave.includes(patron);
  for (let i = 0; i + patron.length <= clave.length; i++) {
    let coincide = true;
    for (let j = 0; j < patron.length; j++) {
      const c = clave[i + j];
      if (c !== patron[j] && c !== REEMPLAZO) {
        coincide = false;
        break;
      }
    }
    if (coincide) return true;
  }
  return false;
}

/** Quita tildes y pasa a mayúsculas. */
export function sinTildes(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/**
 * Clave canónica para matchear y agrupar comercios.
 * "MERPAGO*RAPPI 4523" y "RAPPI ARGENTINA S.A." → "RAPPI"
 */
export function clave(descripcion: string): string {
  let s = sinTildes(descripcion);

  // El prefijo del procesador va antes de un * o un espacio.
  for (const p of PREFIJOS_PROCESADOR) {
    const re = new RegExp(`^${p}\\s*[*\\-:]\\s*`, "i");
    if (re.test(s)) {
      s = s.replace(re, "");
      break;
    }
  }
  s = s.replace(/^\*+/, "");

  s = s
    .replace(SUFIJOS_SOCIETARIOS, " ")
    .replace(/[.,;:*#/\\_|]+/g, " ")
    .replace(/\b\d{4,}\b/g, " ")        // IDs de operación, no identidad
    .replace(ID_OPERACION, " ")         // ids alfanuméricos: "in1Tm5auB4TZW"
    .replace(/\bC\.?U\.?O\.?T\.?A\b.*/i, " ")
    .replace(/\b\d{1,2}\s*DE\s*\d{1,2}\b/g, " ")
    .replace(/-+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    // Número de sucursal al final: "FARMACITY 231" y "FARMACITY 450" tienen que
    // ser el MISMO comercio, si no la memoria te pide categorizar cada sucursal.
    .replace(/(\s+\d+)+$/, "")
    .trim();

  return s;
}

/**
 * Nombre lindo para mostrar cuando no hay match en el diccionario.
 * "KIOSCO DON JOSE" → "Kiosco Don Jose"
 */
export function titulizar(s: string): string {
  const limpio = clave(s).toLowerCase();
  if (!limpio) return "Sin descripción";
  return limpio.replace(/\b[a-záéíóúñ]/g, (c) => c.toUpperCase());
}

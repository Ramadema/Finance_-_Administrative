/**
 * Parseo de importes en formato argentino.
 *
 * BBVA exporta los importes como TEXTO, no como números:
 *   { t: "s", v: "1.234,56" }
 *
 * El punto es separador de miles y la coma es decimal — al revés que en JS.
 * `parseFloat("1.234,56")` devuelve 1.234 sin tirar error: un gasto de mil
 * doscientos treinta y cuatro pesos entra como uno con veintitrés. Silencioso
 * y catastrófico. Todo importe del sistema pasa por acá.
 */

/** Espacios raros que meten los exports: NBSP, narrow NBSP, thin space. */
const ESPACIOS = /[\s   ]/g;
/** Símbolos de moneda y ruido que BBVA antepone. */
const MONEDA = /(\$|U\$S|USD|ARS|US\$)/gi;

/**
 * Convierte un importe en formato AR a number.
 * Devuelve `null` para vacío/ilegible — nunca 0, porque "sin dato" y "cero"
 * son cosas distintas y confundirlas rompe los promedios.
 */
export function parseImporteAR(input: unknown): number | null {
  if (input === null || input === undefined) return null;

  // SheetJS a veces sí devuelve number (si la celda quedó numérica). Confiamos.
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;

  let s = input.replace(MONEDA, "").replace(ESPACIOS, "");
  if (s === "") return null;

  // Negativos: signo adelante, atrás (1.234,56-) o entre paréntesis (contable).
  let negativo = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negativo = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);

  if (!/^[\d.,]+$/.test(s) || s === "") return null;

  const ultimaComa = s.lastIndexOf(",");
  const ultimoPunto = s.lastIndexOf(".");
  let normalizado: string;

  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Están los dos: el que aparece último es el decimal.
    if (ultimaComa > ultimoPunto) {
      normalizado = s.replace(/\./g, "").replace(",", ".");   // 1.234,56 → AR
    } else {
      normalizado = s.replace(/,/g, "");                       // 1,234.56 → US
    }
  } else if (ultimaComa !== -1) {
    // Solo coma → decimal argentino. "1,5" = 1.5 ; "1234,56" = 1234.56
    if (s.indexOf(",") !== ultimaComa) return null;            // "1,234,56" es basura
    normalizado = s.replace(",", ".");
  } else if (ultimoPunto !== -1) {
    // Solo punto: AMBIGUO. "1.234" es 1234 en AR pero 1.234 en JS.
    // Regla: punto seguido de exactamente 3 dígitos = separador de miles.
    // Cubre "1.234" y "1.234.567". Con 1 o 2 decimales ("0.50") es decimal.
    const grupos = s.split(".");
    const todosMiles =
      grupos.length > 1 && grupos.slice(1).every((g) => g.length === 3);
    normalizado = todosMiles ? s.replace(/\./g, "") : s;
  } else {
    normalizado = s;
  }

  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Igual que `parseImporteAR` pero con 0 en vez de null. Usar solo en totales. */
export function parseImporteARo0(input: unknown): number {
  return parseImporteAR(input) ?? 0;
}

/** Formatea a moneda argentina para la UI. */
export function formatARS(n: number, opts: { decimales?: boolean } = {}): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: opts.decimales === false ? 0 : 2,
    maximumFractionDigits: opts.decimales === false ? 0 : 2,
  }).format(n);
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

/** Compacto para ejes de gráficos: 1.2M, 340k. */
export function formatCompacto(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

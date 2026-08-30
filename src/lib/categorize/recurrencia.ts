/**
 * Detección de gastos fijos, variables y suscripciones.
 *
 * "Fijo" no es una categoría que elegís a mano: es una propiedad OBSERVADA.
 * Un comercio es fijo si aparece casi todos los meses con un monto parecido.
 * El mismo cálculo destapa suscripciones olvidadas y avisa cuando una sube
 * de precio — que es el gasto hormiga que nadie ve.
 */

export interface MovimientoParaAnalisis {
  claveComercio: string;
  comercio: string;
  categoria: string;
  /** "2026-08" */
  periodo: string;
  montoARS: number;
  /**
   * Lo cargaste vos como gasto fijo. No hace falta detectarlo — y no se puede:
   * el detector mide la fracción de meses SIN cambio, así que un alquiler que
   * aumentó de $100.000 a $200.000 da fracción plana 0 y saldría "variable".
   * Justo el gasto más ineludible que hay.
   */
  declaradoFijo: boolean;
}

export type Naturaleza = "fijo" | "variable" | "esporadico";

export interface PerfilRecurrencia {
  claveComercio: string;
  comercio: string;
  categoria: string;
  /** En cuántos meses de la ventana apareció. */
  mesesPresente: number;
  mesesVentana: number;
  naturaleza: Naturaleza;
  /** Mediana: resiste el mes con un outlier. */
  montoTipico: number;
  /** Coef. de variación, informativo. La clasificación NO se basa en esto. */
  variacion: number;
  ultimoMonto: number;
  /** Suba del último monto contra el promedio de los anteriores. */
  aumentoPct: number | null;
  /** Recurrente + monto estable = suscripción. */
  esSuscripcion: boolean;
  /** Subió más del umbral: mostrar alerta. */
  alertaAumento: boolean;
}

/** Aparece en al menos esta fracción de los meses → recurrente. */
const UMBRAL_PRESENCIA = 0.75;
/** Cambio mes a mes por debajo de esto = "no se movió". */
const UMBRAL_CAMBIO_PLANO = 0.05;
/** Fracción de meses sin cambio para considerarlo escalonado (= suscripción). */
const UMBRAL_ESCALONADO = 0.5;
/** Suba porcentual que dispara la alerta. */
const UMBRAL_AUMENTO = 10;

function mediana(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function coefVariacion(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const media = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (media === 0) return 0;
  const varianza = xs.reduce((a, x) => a + (x - media) ** 2, 0) / xs.length;
  return Math.sqrt(varianza) / Math.abs(media);
}

/**
 * ¿La serie es escalonada (suscripción) o ruidosa (gasto variable)?
 *
 * El coeficiente de variación NO sirve acá: no distingue un escalón de ruido.
 * Netflix a 5000, 5000, 5000, 7500 tiene CV 0.19 — el mismo orden que un
 * supermercado errático — y con un umbral sobre CV la suscripción dejaba de
 * detectarse justo el mes que aumenta, que es cuando querés el aviso.
 *
 * Lo que separa una suscripción de un gasto variable no es cuánto se mueve el
 * monto sino CUÁNTAS VECES: una suscripción está planchada casi todos los meses
 * y salta una vez; un gasto variable cambia todos los meses. Así que medimos la
 * fracción de transiciones mes a mes que quedaron planas.
 */
function fraccionPlana(xs: readonly number[]): number {
  if (xs.length < 2) return 1;
  let planas = 0;
  for (let i = 1; i < xs.length; i++) {
    const previo = xs[i - 1];
    if (previo === 0) continue;
    if (Math.abs((xs[i] - previo) / previo) <= UMBRAL_CAMBIO_PLANO) planas++;
  }
  return planas / (xs.length - 1);
}

/**
 * Arma el perfil de cada comercio sobre los últimos `ventana` meses.
 * `periodos` debe venir ordenado ascendente (el más reciente último).
 */
export function perfilarRecurrencia(
  movimientos: readonly MovimientoParaAnalisis[],
  periodos: readonly string[],
  ventana = 4,
): PerfilRecurrencia[] {
  const ultimosPeriodos = periodos.slice(-ventana);
  const setPeriodos = new Set(ultimosPeriodos);
  const mesesVentana = ultimosPeriodos.length;
  if (mesesVentana === 0) return [];

  // comercio → periodo → monto sumado de ese mes
  const porComercio = new Map<
    string,
    { comercio: string; categoria: string; declarado: boolean; porPeriodo: Map<string, number> }
  >();

  for (const m of movimientos) {
    if (!setPeriodos.has(m.periodo)) continue;
    let e = porComercio.get(m.claveComercio);
    if (!e) {
      e = { comercio: m.comercio, categoria: m.categoria, declarado: false, porPeriodo: new Map() };
      porComercio.set(m.claveComercio, e);
    }
    if (m.declaradoFijo) e.declarado = true;
    e.porPeriodo.set(m.periodo, (e.porPeriodo.get(m.periodo) ?? 0) + m.montoARS);
  }

  const perfiles: PerfilRecurrencia[] = [];

  for (const [claveComercio, e] of porComercio) {
    // Serie en orden cronológico, solo los meses donde hubo consumo.
    const serie = ultimosPeriodos
      .filter((p) => e.porPeriodo.has(p))
      .map((p) => e.porPeriodo.get(p)!);

    const mesesPresente = serie.length;
    const presencia = mesesPresente / mesesVentana;
    const variacion = coefVariacion(serie);
    const recurrente = presencia >= UMBRAL_PRESENCIA && mesesPresente >= 2;
    const estable = fraccionPlana(serie) >= UMBRAL_ESCALONADO;

    let naturaleza: Naturaleza;
    if (e.declarado) naturaleza = "fijo"; // lo declaraste: no hay nada que detectar
    else if (recurrente && estable) naturaleza = "fijo";
    else if (recurrente) naturaleza = "variable";
    else naturaleza = "esporadico";

    const ultimoMonto = serie[serie.length - 1] ?? 0;
    const previos = serie.slice(0, -1);
    const promPrevio =
      previos.length > 0 ? previos.reduce((a, b) => a + b, 0) / previos.length : null;
    const aumentoPct =
      promPrevio && promPrevio !== 0
        ? +(((ultimoMonto - promPrevio) / promPrevio) * 100).toFixed(1)
        : null;

    perfiles.push({
      claveComercio,
      comercio: e.comercio,
      categoria: e.categoria,
      mesesPresente,
      mesesVentana,
      naturaleza,
      montoTipico: mediana(serie),
      variacion: +variacion.toFixed(3),
      ultimoMonto,
      aumentoPct,
      esSuscripcion: naturaleza === "fijo",
      alertaAumento:
        naturaleza === "fijo" && aumentoPct !== null && aumentoPct > UMBRAL_AUMENTO,
    });
  }

  return perfiles.sort((a, b) => b.montoTipico - a.montoTipico);
}

/** Índice rápido comercio → naturaleza, para pintar cada movimiento. */
export function indiceNaturaleza(
  perfiles: readonly PerfilRecurrencia[],
): ReadonlyMap<string, Naturaleza> {
  return new Map(perfiles.map((p) => [p.claveComercio, p.naturaleza]));
}

/** Cuánto del mes es compromiso ineludible vs decisión del momento. */
export function repartoFijoVariable(
  movimientos: readonly MovimientoParaAnalisis[],
  naturalezas: ReadonlyMap<string, Naturaleza>,
  periodo: string,
): { fijo: number; variable: number; esporadico: number } {
  const r = { fijo: 0, variable: 0, esporadico: 0 };
  for (const m of movimientos) {
    if (m.periodo !== periodo) continue;
    r[naturalezas.get(m.claveComercio) ?? "esporadico"] += m.montoARS;
  }
  return r;
}

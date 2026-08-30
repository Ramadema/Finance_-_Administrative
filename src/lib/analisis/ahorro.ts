import type { ResumenPeriodo, GastoPorCategoria } from "./metricas";

/**
 * Capacidad de ahorro y proyecciones.
 *
 * ALCANCE: esto es aritmética sobre tus propios datos — cuánta plata te queda
 * libre y qué pasaría si recortaras tal categoría. NO decide en qué poner esa
 * plata: no hay acá ninguna comparación de instrumentos ni recomendación de
 * inversión. Esa decisión requiere un asesor matriculado que conozca tu
 * situación completa.
 */

export interface CapacidadAhorro {
  periodo: string;
  ingresos: number;
  gastos: number;
  fijos: number;
  variables: number;
  /** Lo que te queda: ingresos − gastos. Puede ser negativo. */
  capacidad: number;
  /** Qué fracción del ingreso lográs no gastar. */
  tasaAhorro: number | null;
  /** Ingresos − fijos: la plata sobre la que realmente podés decidir. */
  margenDiscrecional: number;
  /** Qué fracción del ingreso se lleva el piso ineludible. */
  cargaFija: number | null;
  /** Si no cargaste ingresos, casi todo lo de arriba es null/0. */
  hayIngresos: boolean;
}

export function capacidadDe(resumen: ResumenPeriodo): CapacidadAhorro {
  const { ingresos, gastos, fijo, variable, esporadico } = resumen;
  const hayIngresos = ingresos > 0;
  const capacidad = ingresos - gastos;
  return {
    periodo: resumen.periodo,
    ingresos,
    gastos,
    fijos: fijo,
    variables: variable + esporadico,
    capacidad,
    tasaAhorro: hayIngresos ? capacidad / ingresos : null,
    margenDiscrecional: ingresos - fijo,
    cargaFija: hayIngresos ? fijo / ingresos : null,
    hayIngresos,
  };
}

export interface Proyeccion {
  /** Capacidad mensual usada para proyectar (mediana, no último mes). */
  base: number;
  /** Cuántos meses de historia respaldan la estimación. */
  mesesBase: number;
  puntos: { mes: number; etiqueta: string; acumulado: number }[];
  totalAlAno: number;
  confiable: boolean;
}

function mediana(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Proyecta el ahorro acumulado a N meses.
 *
 * Usa la MEDIANA de la capacidad de los meses con ingresos cargados, no el
 * último mes: un mes con una compra grande no debería tirar abajo toda la
 * proyección. Con menos de 3 meses se marca `confiable: false` — con dos puntos
 * no hay tendencia, hay una recta.
 */
export function proyectarAhorro(
  serie: readonly ResumenPeriodo[],
  meses = 12,
): Proyeccion {
  const conIngresos = serie.filter((s) => s.ingresos > 0);
  const capacidades = conIngresos.map((s) => s.ingresos - s.gastos);
  const base = mediana(capacidades);

  const puntos = Array.from({ length: meses }, (_, i) => ({
    mes: i + 1,
    etiqueta: `${i + 1}m`,
    acumulado: base * (i + 1),
  }));

  return {
    base,
    mesesBase: conIngresos.length,
    puntos,
    totalAlAno: base * 12,
    confiable: conIngresos.length >= 3,
  };
}

export interface FondoEmergencia {
  /** Gasto fijo mensual típico: lo que necesitás sí o sí cada mes. */
  pisoMensual: number;
  ahorroActual: number;
  mesesCubiertos: number | null;
  /** Meta habitual: 6 meses de gastos fijos. */
  metaMeses: number;
  faltante: number;
  /** Meses para llegar a la meta al ritmo actual. */
  mesesParaMeta: number | null;
}

export function fondoEmergencia(
  serie: readonly ResumenPeriodo[],
  ahorroActual: number,
  capacidadMensual: number,
  metaMeses = 6,
): FondoEmergencia {
  const pisoMensual = mediana(serie.map((s) => s.fijo).filter((x) => x > 0));
  const objetivo = pisoMensual * metaMeses;
  const faltante = Math.max(0, objetivo - ahorroActual);

  return {
    pisoMensual,
    ahorroActual,
    mesesCubiertos: pisoMensual > 0 ? ahorroActual / pisoMensual : null,
    metaMeses,
    faltante,
    mesesParaMeta:
      faltante === 0 ? 0 : capacidadMensual > 0 ? Math.ceil(faltante / capacidadMensual) : null,
  };
}

export interface EscenarioRecorte {
  categoriaId: string;
  nombre: string;
  slot: number | null;
  gastoActual: number;
  ahorroMensual: number;
  ahorroAnual: number;
}

/**
 * "Si recortara un X% de esta categoría, ¿cuánto junto en un año?"
 *
 * Solo sobre categorías discrecionales: recortar impuestos o servicios básicos
 * no es una palanca real, y ofrecerlo como opción sería ruido.
 */
const NO_DISCRECIONALES = new Set(["financiero", "salud"]);

export function escenariosRecorte(
  categorias: readonly GastoPorCategoria[],
  recortePct: number,
): EscenarioRecorte[] {
  const f = Math.max(0, Math.min(100, recortePct)) / 100;
  return categorias
    .filter((c) => !NO_DISCRECIONALES.has(c.categoriaId) && c.categoriaId !== "__otros")
    .filter((c) => c.monto > 0)
    .map((c) => ({
      categoriaId: c.categoriaId,
      nombre: c.nombre,
      slot: c.slot,
      gastoActual: c.monto,
      ahorroMensual: c.monto * f,
      ahorroAnual: c.monto * f * 12,
    }))
    .sort((a, b) => b.ahorroMensual - a.ahorroMensual);
}

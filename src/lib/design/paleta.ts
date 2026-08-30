/**
 * Paleta validada con scripts/validate_palette.js del skill dataviz.
 *
 *   light (superficie #fcfcfb): 6 checks — PASS, con WARN de contraste en
 *     aqua/amarillo/magenta. Eso activa la "regla de relieve": los gráficos
 *     llevan etiquetas directas visibles y existe vista de tabla. No es opcional.
 *   dark  (superficie #1a1a19): 6 checks — PASS limpio.
 *
 * Los slots se asignan en ORDEN FIJO y NUNCA se ciclan: la taxonomía tiene
 * exactamente tantas categorías raíz como slots. Una de más no genera tono
 * nuevo — cae en "Otros", en gris neutro, indistinguible de "Sin categorizar".
 *
 * El slot 8 (teal) se agregó al partir "Ocio y viajes" en dos. Medido con el
 * mismo validador antes de agregarlo: con 9 slots los peores pares son LOS
 * MISMOS que con 8 —verde↔naranja ΔE 3.2 protan en claro, magenta↔aqua ΔE 1.6
 * deutan en oscuro— así que no introduce un problema nuevo. Lo que sí baja es
 * tritanopia en claro (5.1 → 2.4); se aceptó porque afecta a ~0,01% de la
 * gente contra ~8% de protan/deutan, y la regla de relieve ya rige igual.
 *
 * Un slot 10 no se probó: agregar hue a esta altura empieza a comer los pares
 * que hoy sí separan. Si hace falta otra raíz, medir primero.
 */

export interface ParTema {
  light: string;
  dark: string;
}

/** Slots categóricos, en el orden validado. El índice ES la identidad. */
export const SERIES: readonly ParTema[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // 0 azul
  { light: "#eb6834", dark: "#d95926" }, // 1 naranja
  { light: "#1baf7a", dark: "#199e70" }, // 2 aqua
  { light: "#eda100", dark: "#c98500" }, // 3 amarillo
  { light: "#e87ba4", dark: "#d55181" }, // 4 magenta
  { light: "#008300", dark: "#008300" }, // 5 verde
  { light: "#4a3aa7", dark: "#9085e9" }, // 6 violeta
  { light: "#e34948", dark: "#e66767" }, // 7 rojo
  { light: "#00879b", dark: "#00a2b3" }, // 8 teal
] as const;

/** Slots con contraste <3:1 en light. Obligan etiqueta directa visible. */
export const SLOTS_BAJO_CONTRASTE_LIGHT = new Set([2, 3, 4]);

/** Estados. Reservados: nunca se usan como color de serie. */
export const ESTADO = {
  bueno: "#0ca30c",
  advertencia: "#fab219",
  serio: "#ec835a",
  critico: "#d03b3b",
} as const;

/** Rampa secuencial azul, para heatmaps de magnitud. */
export const RAMPA_AZUL = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec",
  "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab",
  "#184f95", "#104281", "#0d366b",
] as const;

/** Superficies e ink. Los mismos valores contra los que corrió el validador. */
export const CHROME = {
  superficie:  { light: "#fcfcfb", dark: "#1a1a19" },
  plano:       { light: "#f9f9f7", dark: "#0d0d0d" },
  inkPrimario: { light: "#0b0b0b", dark: "#ffffff" },
  inkSecundario:{ light: "#52514e", dark: "#c3c2b7" },
  inkMudo:     { light: "#898781", dark: "#898781" },
  grilla:      { light: "#e1e0d9", dark: "#2c2c2a" },
  eje:         { light: "#c3c2b7", dark: "#383835" },
  borde:       { light: "rgba(11,11,11,0.10)", dark: "rgba(255,255,255,0.10)" },
  neutro:      { light: "#a8a69e", dark: "#6b6a64" }, // "Otros", sin categorizar
} as const;

export type Tema = "light" | "dark";

/** Color de un slot para el tema dado. Fuera de rango → neutro. */
export function colorSerie(slot: number | null, tema: Tema): string {
  if (slot === null || slot < 0 || slot >= SERIES.length) return CHROME.neutro[tema];
  return SERIES[slot][tema];
}

/** ¿Este slot necesita etiqueta directa sí o sí en modo claro? */
export function requiereEtiquetaDirecta(slot: number | null, tema: Tema): boolean {
  return tema === "light" && slot !== null && SLOTS_BAJO_CONTRASTE_LIGHT.has(slot);
}

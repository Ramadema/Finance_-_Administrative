import type { ResultadoHerramienta } from "./tipos";

/**
 * Los números de la respuesta que no salieron de ninguna herramienta.
 *
 * La regla del repo es que la app nunca inventa un número, y un LLM es una
 * máquina de producir números plausibles. El sistema le prohíbe calcular, pero
 * una prohibición en un prompt no es una garantía: esto la verifica después.
 * La UI marca lo que no tiene respaldo en vez de mostrarlo como dato.
 *
 * Es una red, no una demostración: mira cifras de plata, porcentajes y números
 * grandes —lo que duele si está mal— y deja pasar cantidades chicas ("3
 * movimientos", "12 cuotas"), años y períodos.
 */

/** Todos los números que aparecen en un resultado, en valor absoluto. */
export function numerosDe(valor: unknown, acumulado = new Set<number>()): Set<number> {
  if (typeof valor === "number" && Number.isFinite(valor)) acumulado.add(Math.abs(valor));
  else if (Array.isArray(valor)) for (const v of valor) numerosDe(v, acumulado);
  else if (valor && typeof valor === "object") for (const v of Object.values(valor)) numerosDe(v, acumulado);
  return acumulado;
}

export interface NumeroEnTexto {
  crudo: string;
  valor: number;
  esPlata: boolean;
  esPorcentaje: boolean;
}

const PERIODO_O_FECHA = /\b\d{4}-\d{2}(?:-\d{2})?\b|\b\d{2}\/\d{2}\/\d{4}\b/g;
// "$ 19.569,50" · "19.569" · "61%" · "0,3". Miles con punto, decimales con coma: formato argentino.
const NUMERO = /(\$\s?)?(-?\d{1,3}(?:\.\d{3})+|-?\d+)(,\d+)?(\s?%)?/g;

export function numerosEnTexto(texto: string): NumeroEnTexto[] {
  const limpio = texto.replace(PERIODO_O_FECHA, " ");
  const salida: NumeroEnTexto[] = [];
  for (const m of limpio.matchAll(NUMERO)) {
    const [crudo, pesos, entero, decimales, porciento] = m;
    const valor = Math.abs(Number(entero.replace(/\./g, "") + (decimales ? `.${decimales.slice(1)}` : "")));
    if (!Number.isFinite(valor)) continue;
    salida.push({ crudo: crudo.trim(), valor, esPlata: Boolean(pesos), esPorcentaje: Boolean(porciento) });
  }
  return salida;
}

/**
 * @param texto      la respuesta final del modelo
 * @param resultados lo que devolvieron las herramientas en esta conversación
 * @param pregunta   lo que preguntó el usuario: sus números también son legítimos
 */
export function numerosSinRespaldo(
  texto: string,
  resultados: readonly ResultadoHerramienta[],
  pregunta = "",
): string[] {
  const respaldo = new Set<number>();
  for (const r of resultados) numerosDe(r.salida, respaldo);
  for (const n of numerosEnTexto(pregunta)) respaldo.add(n.valor);

  // Tolera el redondeo del modelo: $19.569 por 19568,7, o 61% por 61,2.
  const tieneRespaldo = (n: number) =>
    [...respaldo].some((r) => Math.abs(n - r) <= Math.max(1, Math.abs(r) * 0.005));
  const pareceAnio = (n: NumeroEnTexto) =>
    Number.isInteger(n.valor) && n.valor >= 1900 && n.valor <= 2100 && !n.esPlata && !n.esPorcentaje;

  return numerosEnTexto(texto)
    .filter((n) => n.esPlata || n.esPorcentaje || n.valor >= 100)
    .filter((n) => !pareceAnio(n))
    .filter((n) => !tieneRespaldo(n.valor))
    .map((n) => n.crudo);
}

import { esModelo, MODELO_POR_DEFECTO, type ModeloId } from "./modelos";

/**
 * Preferencias del asistente en este navegador. Hoy, una sola: el modelo.
 *
 * Es por dispositivo a propósito: en el teléfono quizás quieras el más barato.
 * No hay ninguna key acá — la key vive en el servidor, en una variable de
 * entorno, y el navegador nunca la ve.
 *
 * Expuesto como "almacén externo" para leerlo con `useSyncExternalStore`: en el
 * prerender no existe `window`, así que el servidor ve el valor por defecto y
 * el navegador corrige al hidratar.
 */

const MODELO = "plata.ia.modelo";

const oyentes = new Set<() => void>();

export function suscribirIA(oyente: () => void): () => void {
  oyentes.add(oyente);
  window.addEventListener("storage", oyente); // cambios desde otra pestaña
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", oyente);
  };
}

const almacen = () => (typeof window === "undefined" ? null : window.localStorage);

export function leerModelo(): ModeloId {
  const v = almacen()?.getItem(MODELO);
  return esModelo(v) ? v : MODELO_POR_DEFECTO;
}

export function guardarModelo(modelo: ModeloId): void {
  almacen()?.setItem(MODELO, modelo);
  for (const o of oyentes) o();
}

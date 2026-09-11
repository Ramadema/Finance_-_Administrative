import { esModelo, MODELO_POR_DEFECTO, type ModeloId } from "./proveedores/anthropic";

/**
 * La key del usuario y su modelo elegido, en `localStorage` y en ningún otro lado.
 *
 * No va a la base de Dexie a propósito: la base entera viaja en el respaldo de
 * Drive, y una key dentro de un respaldo es una key en un archivo que no
 * controlás. `localStorage` es de este navegador y de nadie más. En cada
 * dispositivo se pega una vez.
 *
 * Expuesto como "almacén externo" para que la UI lo lea con
 * `useSyncExternalStore`: en el prerender estático no existe `window`, así que
 * el servidor ve "sin key" y el navegador corrige al hidratar sin parpadeo raro.
 */

const CLAVE = "plata.ia.clave";
const MODELO = "plata.ia.modelo";

const oyentes = new Set<() => void>();
const avisar = () => { for (const o of oyentes) o(); };

export function suscribirIA(oyente: () => void): () => void {
  oyentes.add(oyente);
  window.addEventListener("storage", oyente); // cambios desde otra pestaña
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", oyente);
  };
}

const almacen = () => (typeof window === "undefined" ? null : window.localStorage);

export function leerClave(): string | null {
  const v = almacen()?.getItem(CLAVE) ?? null;
  return v && v.trim() !== "" ? v : null;
}

export function guardarClave(clave: string): void {
  almacen()?.setItem(CLAVE, clave.trim());
  avisar();
}

export function borrarClave(): void {
  almacen()?.removeItem(CLAVE);
  avisar();
}

export function leerModelo(): ModeloId {
  const v = almacen()?.getItem(MODELO);
  return esModelo(v) ? v : MODELO_POR_DEFECTO;
}

export function guardarModelo(modelo: ModeloId): void {
  almacen()?.setItem(MODELO, modelo);
  avisar();
}

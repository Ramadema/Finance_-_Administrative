import { esModelo, MODELO_POR_DEFECTO, type ModeloId } from "./proveedores/anthropic";

/**
 * La key del usuario: dónde vive y quién la puede usar.
 *
 * La fuente de verdad es un archivo chico (`plata-ia.json`) en la carpeta
 * privada de la app en el Drive del usuario — la misma carpeta oculta del
 * respaldo, a la que solo su cuenta de Google puede entrar. Se pega una vez;
 * en cualquier otro dispositivo, entrar con Google la trae sola. Sin entrar con
 * esa cuenta no hay key, y sin key no hay preguntas: el acceso al asistente es
 * el acceso a la cuenta.
 *
 * `localStorage` es la copia local, para no volver a pedirle a Drive en cada
 * pregunta. Se borra al salir de Google. No va a la base de Dexie a propósito:
 * la base entera viaja en el respaldo de datos, y una key adentro de un
 * respaldo es una key en un archivo que se puede bajar y compartir.
 *
 * Expuesto como "almacén externo" para que la UI lo lea con
 * `useSyncExternalStore`: en el prerender estático no existe `window`, así que
 * el servidor ve "sin key" y el navegador corrige al hidratar sin parpadeo raro.
 */

export const ARCHIVO_AJUSTES = "plata-ia.json";

export interface AjustesIA {
  clave: string;
  modelo: ModeloId;
}

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

/** Lo que se guarda en Drive. Con versión, para poder cambiar la forma sin romper lo ya guardado. */
export function serializarAjustes(a: AjustesIA): string {
  return JSON.stringify({ version: 1, clave: a.clave, modelo: a.modelo });
}

/** Lo que viene de Drive puede ser viejo, ajeno o roto: si no tiene una key, no es nada. */
export function parsearAjustes(texto: string): AjustesIA | null {
  try {
    const d = JSON.parse(texto) as unknown;
    if (!d || typeof d !== "object") return null;
    const { clave, modelo } = d as Record<string, unknown>;
    if (typeof clave !== "string" || clave.trim() === "") return null;
    return { clave: clave.trim(), modelo: esModelo(modelo) ? modelo : MODELO_POR_DEFECTO };
  } catch {
    return null;
  }
}

/**
 * Copia a este navegador lo que vino de Drive. La key siempre; el modelo solo
 * si acá no había uno elegido — qué modelo usar es una preferencia de cada
 * dispositivo (en el teléfono quizás quieras el más barato).
 */
export function aplicarAjustes(a: AjustesIA): void {
  const l = almacen();
  if (!l) return;
  l.setItem(CLAVE, a.clave);
  if (!esModelo(l.getItem(MODELO))) l.setItem(MODELO, a.modelo);
  avisar();
}

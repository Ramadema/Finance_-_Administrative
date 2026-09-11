import { ErrorProveedor, type ProveedorIA, type RespuestaModelo, type TipoErrorProveedor } from "../tipos";
import type { ModeloId } from "../modelos";

/**
 * El proveedor que usa el navegador: no habla con Anthropic, habla con
 * **nuestro** servidor (`/api/modelo`), que tiene la key y verifica quién
 * pregunta. Manda la misma `Peticion` del puerto, más el modelo elegido, y el
 * token de Google como prueba de identidad.
 *
 * Que exista este archivo y no uno que llame a Anthropic directo es todo el
 * punto del cambio: la key nunca está en el navegador.
 */

export interface OpcionesProxy {
  /** Token de acceso de Google de la sesión actual. */
  token: string;
  modelo: ModeloId;
  ruta?: string;
  fetch?: typeof globalThis.fetch;
}

const TIPO_POR_ESTADO: Record<number, TipoErrorProveedor> = {
  401: "sesion", 403: "sesion", 402: "credito", 429: "limite", 500: "servidor", 502: "api",
};

interface Fallo { error: string; tipo?: TipoErrorProveedor }
const esFallo = (c: unknown): c is Fallo =>
  !!c && typeof c === "object" && typeof (c as Fallo).error === "string";

export function proveedorProxy({ token, modelo, ruta = "/api/modelo", fetch: f = globalThis.fetch }: OpcionesProxy): ProveedorIA {
  return {
    nombre: `proxy/${modelo}`,
    async responder(p) {
      let r: Response;
      try {
        r = await f(ruta, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ modelo, sistema: p.sistema, mensajes: p.mensajes, herramientas: p.herramientas }),
        });
      } catch {
        throw new ErrorProveedor("conexion", "No se pudo llegar al servidor de la app. ¿Hay internet?");
      }

      const cuerpo: unknown = await r.json().catch(() => null);
      if (!r.ok || !cuerpo || esFallo(cuerpo)) {
        const fallo = esFallo(cuerpo) ? cuerpo : null;
        throw new ErrorProveedor(
          fallo?.tipo ?? TIPO_POR_ESTADO[r.status] ?? "api",
          fallo?.error ?? `El servidor respondió ${r.status}.`,
        );
      }
      return cuerpo as RespuestaModelo;
    },
  };
}

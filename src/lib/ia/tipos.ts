/**
 * El contrato entre el agente y el modelo, sin ningún proveedor adentro.
 *
 * Todo lo que el agente necesita de un LLM es esto: le mandás un sistema, la
 * conversación y las herramientas disponibles, y te devuelve texto y/o pedidos
 * de herramientas. Anthropic, un modelo local o un guion de test son
 * adaptadores de esta interfaz — el resto de `lib/ia` no sabe cuál está atrás.
 */

/**
 * JSON Schema de los parámetros de una herramienta, en la forma estricta que
 * los proveedores pueden garantizar: sin propiedades de más y con todas las
 * declaradas en `required`. Lo opcional se modela como `["tipo", "null"]`.
 */
export type EsquemaParametros = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};
// `type` y no `interface` a propósito: el SDK tipa el esquema con un índice
// `[k: string]: unknown`, y TypeScript solo considera asignable a eso a un alias.

export interface DefinicionHerramienta {
  /** snake_case: es lo que el modelo escribe para llamarla. */
  nombre: string;
  /** La lee el modelo para decidir cuándo usarla: decí qué contesta, no cómo está hecha. */
  descripcion: string;
  parametros: EsquemaParametros;
}

export interface LlamadaHerramienta {
  /** Lo asigna el proveedor; el resultado tiene que volver con el mismo id. */
  id: string;
  nombre: string;
  entrada: Record<string, unknown>;
}

export interface ResultadoHerramienta {
  id: string;
  nombre: string;
  salida: unknown;
  /**
   * Si la herramienta no pudo correr. Se le devuelve al modelo para que se
   * corrija (otro período, otra categoría); nunca se tira como excepción.
   */
  error: string | null;
}

export type Mensaje =
  | { rol: "usuario"; texto: string }
  | {
      rol: "asistente";
      texto: string;
      llamadas: LlamadaHerramienta[];
      /**
       * Lo que el proveedor devolvió, tal cual, para devolvérselo tal cual.
       * Algunos modelos razonan antes de pedir una herramienta y exigen que ese
       * razonamiento vuelva intacto en la siguiente vuelta; el agente no lo
       * entiende ni lo necesita, solo lo guarda y lo repite.
       */
      crudo?: unknown;
    }
  | { rol: "resultados"; resultados: ResultadoHerramienta[] };

/** Tokens de una vuelta. Es lo que se cobra: conviene verlo. */
export interface Uso {
  entrada: number;
  salida: number;
  /** Parte del prefijo que el proveedor ya tenía cacheado: se cobra a una fracción. */
  cacheLeido: number;
  cacheEscrito: number;
}

export interface Peticion {
  sistema: string;
  mensajes: readonly Mensaje[];
  herramientas: readonly DefinicionHerramienta[];
}

export interface RespuestaModelo {
  texto: string;
  llamadas: LlamadaHerramienta[];
  /** `herramientas` = quiere resultados antes de seguir; `cortado` = se quedó sin tokens o no quiso. */
  fin: "terminado" | "herramientas" | "cortado";
  /** Ver `Mensaje.crudo`. */
  crudo?: unknown;
  uso?: Uso;
}

export interface ProveedorIA {
  nombre: string;
  responder(peticion: Peticion): Promise<RespuestaModelo>;
}

/**
 * Por qué no pudo responder, en términos que el usuario pueda resolver:
 * `sesion` (no entró con la cuenta correcta), `servidor` (falta configurar algo
 * del lado nuestro), `credito`, `limite`, `conexion`, `api` (Anthropic devolvió
 * otra cosa).
 */
export type TipoErrorProveedor = "sesion" | "servidor" | "credito" | "limite" | "conexion" | "api";

export class ErrorProveedor extends Error {
  constructor(public readonly tipo: TipoErrorProveedor, mensaje: string) {
    super(mensaje);
    this.name = "ErrorProveedor";
  }
}

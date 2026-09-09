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
export interface EsquemaParametros {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
}

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
  | { rol: "asistente"; texto: string; llamadas: LlamadaHerramienta[] }
  | { rol: "resultados"; resultados: ResultadoHerramienta[] };

export interface Peticion {
  sistema: string;
  mensajes: readonly Mensaje[];
  herramientas: readonly DefinicionHerramienta[];
}

export interface RespuestaModelo {
  texto: string;
  llamadas: LlamadaHerramienta[];
  /** `herramientas` = quiere resultados antes de seguir; `cortado` = se quedó sin tokens. */
  fin: "terminado" | "herramientas" | "cortado";
}

export interface ProveedorIA {
  nombre: string;
  responder(peticion: Peticion): Promise<RespuestaModelo>;
}

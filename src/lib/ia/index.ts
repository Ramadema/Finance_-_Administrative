/**
 * API pública de `lib/ia`. Lo único que el resto de la app importa de acá.
 *
 * Quién habla con el modelo es un detalle de `proveedores/`; el resto de la app
 * solo conoce `preguntar()` y lo que devuelve.
 */
export { preguntar, type Conversacion, type Dependencias, type Paso } from "./agente";
export { HERRAMIENTAS, type ContextoDatos, type Herramienta } from "./herramientas";
export { armarSistema } from "./sistema";
export { numerosSinRespaldo } from "./respaldo";
export type { ProveedorIA, Peticion, RespuestaModelo, Mensaje, DefinicionHerramienta } from "./tipos";

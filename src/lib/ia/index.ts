/**
 * API pública de `lib/ia` para el navegador. Lo único que el resto de la app
 * importa de acá.
 *
 * No exporta el adaptador de Anthropic a propósito: ese corre en el servidor
 * (`src/app/api/modelo`) y lo importa directo. Si el navegador lo importara,
 * arrastraría el SDK al bundle y la tentación de meterle una key.
 */
export { preguntar, type Conversacion, type Dependencias, type Paso } from "./agente";
export { HERRAMIENTAS, type ContextoDatos, type Herramienta } from "./herramientas";
export { armarSistema } from "./sistema";
export { numerosSinRespaldo } from "./respaldo";
export {
  ErrorProveedor,
  type ProveedorIA, type Peticion, type RespuestaModelo, type Mensaje, type DefinicionHerramienta, type Uso,
  type TipoErrorProveedor,
} from "./tipos";
export { MODELOS, MODELO_POR_DEFECTO, esModelo, costoEstimadoUSD, type ModeloId } from "./modelos";
export { proveedorProxy } from "./proveedores/proxy";
export { suscribirIA, leerModelo, guardarModelo } from "./preferencias";

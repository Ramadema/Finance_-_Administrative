import type { LlamadaHerramienta, Mensaje, ProveedorIA, ResultadoHerramienta } from "./tipos";
import { EntradaInvalida, type ContextoDatos, type Herramienta } from "./herramientas";
import { armarSistema } from "./sistema";
import { numerosSinRespaldo } from "./respaldo";

/**
 * El bucle del agente. Es corto a propósito: esto ES un agente.
 *
 *   pregunta → modelo → ¿pide herramientas? → se ejecutan → resultados → modelo → …
 *
 * hasta que el modelo responde con texto o se acaban las vueltas. El modelo
 * decide qué herramienta usar y con qué parámetros; el código decide qué
 * herramientas existen, las ejecuta y corta. Ninguna de las dos partes puede
 * hacer el trabajo de la otra, y ahí está la seguridad del diseño.
 */

export interface Paso {
  llamada: LlamadaHerramienta;
  resultado: ResultadoHerramienta;
}

export interface Conversacion {
  pregunta: string;
  /** Cada herramienta que se ejecutó, con lo que devolvió. Es la fuente de verdad de la respuesta. */
  pasos: Paso[];
  respuesta: string;
  fin: "terminado" | "cortado" | "demasiadas_vueltas";
  /** Números de la respuesta que no salieron de ninguna herramienta: la UI los marca. */
  sinRespaldo: string[];
  /** La transcripción completa tal como la vio el modelo. Para depurar y para aprender. */
  mensajes: Mensaje[];
  vueltas: number;
}

export interface Dependencias {
  proveedor: ProveedorIA;
  herramientas: readonly Herramienta[];
  contexto: ContextoDatos;
  /** Por defecto lo arma `armarSistema` con el contexto. */
  sistema?: string;
  /** Idas y vueltas con el modelo antes de cortar. Un agente que no para es un agente que factura. */
  maxVueltas?: number;
}

export async function preguntar(pregunta: string, deps: Dependencias): Promise<Conversacion> {
  const { proveedor, herramientas, contexto, maxVueltas = 6 } = deps;
  const sistema = deps.sistema ?? armarSistema(contexto);
  const definiciones = herramientas.map((h) => h.definicion);
  const porNombre = new Map(herramientas.map((h) => [h.definicion.nombre, h]));

  const mensajes: Mensaje[] = [{ rol: "usuario", texto: pregunta }];
  const pasos: Paso[] = [];
  let ultimoTexto = "";

  const ejecutar = (ll: LlamadaHerramienta): ResultadoHerramienta => {
    const h = porNombre.get(ll.nombre);
    if (!h) {
      return {
        id: ll.id, nombre: ll.nombre, salida: null,
        error: `No existe la herramienta "${ll.nombre}". Disponibles: ${[...porNombre.keys()].join(", ")}.`,
      };
    }
    try {
      return { id: ll.id, nombre: ll.nombre, salida: h.ejecutar(ll.entrada ?? {}, contexto), error: null };
    } catch (e) {
      const error = e instanceof EntradaInvalida
        ? e.message
        : `La herramienta falló: ${e instanceof Error ? e.message : String(e)}`;
      return { id: ll.id, nombre: ll.nombre, salida: null, error };
    }
  };

  const cerrar = (fin: Conversacion["fin"], vueltas: number): Conversacion => ({
    pregunta, pasos, respuesta: ultimoTexto, fin, vueltas, mensajes,
    sinRespaldo: numerosSinRespaldo(ultimoTexto, pasos.map((p) => p.resultado), pregunta),
  });

  for (let vuelta = 1; vuelta <= maxVueltas; vuelta++) {
    // Una foto, no la referencia: el bucle sigue agregando mensajes y el proveedor
    // (o un test) puede guardarse la petición para mirarla después.
    const r = await proveedor.responder({ sistema, mensajes: [...mensajes], herramientas: definiciones });
    mensajes.push({ rol: "asistente", texto: r.texto, llamadas: r.llamadas });
    if (r.texto) ultimoTexto = r.texto;

    if (r.fin !== "herramientas" || r.llamadas.length === 0) {
      return cerrar(r.fin === "cortado" ? "cortado" : "terminado", vuelta);
    }

    // Todas las llamadas de una vuelta se contestan juntas, en un solo mensaje.
    // Si se parten en varios, el modelo aprende a no pedir varias a la vez y se
    // vuelve más lento y más caro.
    const resultados = r.llamadas.map(ejecutar);
    r.llamadas.forEach((llamada, i) => pasos.push({ llamada, resultado: resultados[i] }));
    mensajes.push({ rol: "resultados", resultados });
  }

  return cerrar("demasiadas_vueltas", maxVueltas);
}

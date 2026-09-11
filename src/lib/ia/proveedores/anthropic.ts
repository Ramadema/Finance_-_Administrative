import Anthropic from "@anthropic-ai/sdk";
import type { Mensaje, ProveedorIA, RespuestaModelo, Uso } from "../tipos";

/**
 * El adaptador de Anthropic: traduce el puerto de `tipos.ts` a la API de
 * Messages y de vuelta. Es el único archivo de la app que sabe cómo habla
 * Claude; si mañana el proveedor es otro, se escribe otro archivo como este y
 * nada más cambia.
 *
 * Corre en el navegador con la key del propio usuario (`dangerouslyAllowBrowser`
 * se llama así porque exponer TU key en una app de TERCEROS es peligroso; acá
 * la key es del usuario y el navegador es el suyo).
 */

/** Precios de lista por millón de tokens, tomados el 2026-09. Si cambian, cambia la estimación, no la cuenta. */
export const MODELOS = [
  { id: "claude-opus-5", nombre: "Claude Opus 5", entradaUSD: 5, salidaUSD: 25 },
  { id: "claude-sonnet-5", nombre: "Claude Sonnet 5", entradaUSD: 2, salidaUSD: 10 },
  { id: "claude-haiku-4-5", nombre: "Claude Haiku 4.5", entradaUSD: 1, salidaUSD: 5 },
] as const;

export type ModeloId = (typeof MODELOS)[number]["id"];
export const MODELO_POR_DEFECTO: ModeloId = "claude-opus-5";

export function esModelo(id: unknown): id is ModeloId {
  return MODELOS.some((m) => m.id === id);
}

/** Cuánto costó, en dólares. El caché se cobra al 10% al leer y al 125% al escribir. */
export function costoEstimadoUSD(uso: Uso, modelo: string): number | null {
  const m = MODELOS.find((x) => x.id === modelo);
  if (!m) return null;
  const entrada = (uso.entrada + uso.cacheLeido * 0.1 + uso.cacheEscrito * 1.25) * m.entradaUSD;
  return (entrada + uso.salida * m.salidaUSD) / 1_000_000;
}

export class ErrorProveedor extends Error {
  constructor(
    public readonly tipo: "clave" | "credito" | "limite" | "conexion" | "api",
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorProveedor";
  }
}

export interface OpcionesAnthropic {
  clave: string;
  modelo?: ModeloId;
  /**
   * Cuánto piensa antes de contestar. Elegir herramientas sobre un catálogo
   * chico no necesita mucho; `medium` es el punto donde deja de equivocarse de
   * mes sin gastar en razonar de más.
   */
  esfuerzo?: "low" | "medium" | "high";
  /** Para los tests: un fetch que no sale a la red. */
  fetch?: typeof globalThis.fetch;
  maxReintentos?: number;
}

export function proveedorAnthropic(opciones: OpcionesAnthropic): ProveedorIA {
  const modelo = opciones.modelo ?? MODELO_POR_DEFECTO;
  const client = new Anthropic({
    apiKey: opciones.clave,
    dangerouslyAllowBrowser: true,
    fetch: opciones.fetch,
    maxRetries: opciones.maxReintentos ?? 2,
  });

  // Haiku 4.5 es de una generación anterior: no acepta pensamiento adaptativo ni
  // `effort`, y mandárselos es un 400. Los demás piensan por defecto.
  const piensaAdaptativo = modelo !== "claude-haiku-4-5";

  return {
    nombre: `anthropic/${modelo}`,
    async responder(p) {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: modelo,
        max_tokens: 2048,
        // El sistema y las herramientas son idénticos en cada vuelta: con el
        // punto de caché acá, la segunda vuelta paga ese prefijo al 10%.
        system: [{ type: "text", text: p.sistema, cache_control: { type: "ephemeral" } }],
        tools: p.herramientas.map((h) => ({
          name: h.nombre,
          description: h.descripcion,
          input_schema: h.parametros,
          // El proveedor garantiza que la llamada cumple el esquema, o no llama.
          strict: true,
        })),
        messages: p.mensajes.map(aMensajeAnthropic),
        ...(piensaAdaptativo
          ? { thinking: { type: "adaptive" }, output_config: { effort: opciones.esfuerzo ?? "medium" } }
          : {}),
      };

      let r: Anthropic.Message;
      try {
        r = await client.messages.create(params);
      } catch (e) {
        throw traducirError(e);
      }
      return aRespuesta(r);
    },
  };
}

function aMensajeAnthropic(m: Mensaje): Anthropic.MessageParam {
  switch (m.rol) {
    case "usuario":
      return { role: "user", content: m.texto };
    case "asistente": {
      // Si tenemos lo que el modelo devolvió, va tal cual: ahí están sus bloques
      // de razonamiento, que tienen que volver intactos.
      if (m.crudo) return { role: "assistant", content: m.crudo as Anthropic.ContentBlockParam[] };
      const bloques: Anthropic.ContentBlockParam[] = [];
      if (m.texto) bloques.push({ type: "text", text: m.texto });
      for (const ll of m.llamadas) bloques.push({ type: "tool_use", id: ll.id, name: ll.nombre, input: ll.entrada });
      return { role: "assistant", content: bloques };
    }
    case "resultados":
      return {
        role: "user",
        content: m.resultados.map((res) => ({
          type: "tool_result",
          tool_use_id: res.id,
          content: res.error ?? JSON.stringify(res.salida ?? null),
          is_error: res.error !== null,
        })),
      };
  }
}

function aRespuesta(r: Anthropic.Message): RespuestaModelo {
  let texto = "";
  const llamadas: RespuestaModelo["llamadas"] = [];
  for (const b of r.content) {
    if (b.type === "text") texto += b.text;
    else if (b.type === "tool_use") {
      llamadas.push({ id: b.id, nombre: b.name, entrada: (b.input ?? {}) as Record<string, unknown> });
    }
  }

  let fin: RespuestaModelo["fin"] = "terminado";
  if (r.stop_reason === "tool_use") fin = "herramientas";
  else if (r.stop_reason === "max_tokens") fin = "cortado";
  else if (r.stop_reason === "refusal") {
    fin = "cortado";
    const detalle = (r as { stop_details?: { explanation?: string | null } | null }).stop_details?.explanation;
    texto = texto || `El modelo no quiso contestar esto${detalle ? `: ${detalle}` : "."}`;
  }

  return {
    texto,
    llamadas,
    fin,
    crudo: r.content,
    uso: {
      entrada: r.usage.input_tokens,
      salida: r.usage.output_tokens,
      cacheLeido: r.usage.cache_read_input_tokens ?? 0,
      cacheEscrito: r.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

/** Del error del SDK a algo que el usuario pueda leer y resolver. De lo más específico a lo más general. */
function traducirError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) {
    return new ErrorProveedor("clave", "La key no es válida o fue revocada. Revisala en console.anthropic.com.");
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return new ErrorProveedor("credito", "La key no tiene permiso para este modelo o la cuenta no tiene crédito cargado.");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new ErrorProveedor("limite", "Demasiadas consultas seguidas, o se alcanzó el límite de gasto que pusiste. Esperá un momento.");
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new ErrorProveedor("conexion", "No se pudo conectar con la API de Anthropic. ¿Hay internet?");
  }
  if (e instanceof Anthropic.APIError) {
    return new ErrorProveedor("api", `La API respondió ${e.status ?? "sin código"}: ${e.message}`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

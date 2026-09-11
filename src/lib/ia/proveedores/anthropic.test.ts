import { describe, it, expect } from "vitest";
import { proveedorAnthropic } from "./anthropic";
import { costoEstimadoUSD } from "../modelos";
import { ErrorProveedor, type Peticion } from "../tipos";

/**
 * Un `fetch` que no sale a la red: guarda lo que el SDK quiso mandar y contesta
 * con lo que le digamos. Así se prueba la traducción completa —de nuestro puerto
 * al JSON de la API y de vuelta— sin gastar un token.
 */
function fetchFalso(respuesta: unknown, status = 200) {
  const pedidos: { url: string; cuerpo: Record<string, unknown>; headers: Headers }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    pedidos.push({ url, cuerpo: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify(respuesta), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, pedidos };
}

const respuestaConHerramienta = {
  id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5",
  content: [
    { type: "text", text: "Miro agosto." },
    { type: "tool_use", id: "toolu_1", name: "resumen_del_mes", input: { periodo: "2026-08" } },
  ],
  stop_reason: "tool_use", stop_sequence: null,
  usage: { input_tokens: 1200, output_tokens: 60, cache_read_input_tokens: 0, cache_creation_input_tokens: 1100 },
};

const peticion: Peticion = {
  sistema: "Sos el asistente.",
  herramientas: [{
    nombre: "resumen_del_mes", descripcion: "La foto de un mes.",
    parametros: { type: "object", properties: { periodo: { type: "string" } }, required: ["periodo"], additionalProperties: false },
  }],
  mensajes: [{ rol: "usuario", texto: "¿cuánto gasté?" }],
};

describe("proveedorAnthropic → petición", () => {
  it("manda el modelo, el sistema con punto de caché y las herramientas en modo estricto", async () => {
    const { fetch, pedidos } = fetchFalso(respuestaConHerramienta);
    await proveedorAnthropic({ clave: "sk-test", fetch, maxReintentos: 0 }).responder(peticion);

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].url).toMatch(/api\.anthropic\.com\/v1\/messages/);
    expect(pedidos[0].headers.get("x-api-key")).toBe("sk-test");

    const c = pedidos[0].cuerpo;
    expect(c.model).toBe("claude-opus-5");
    expect(c.system).toEqual([{ type: "text", text: "Sos el asistente.", cache_control: { type: "ephemeral" } }]);
    expect(c.tools).toEqual([{
      name: "resumen_del_mes", description: "La foto de un mes.", strict: true,
      input_schema: { type: "object", properties: { periodo: { type: "string" } }, required: ["periodo"], additionalProperties: false },
    }]);
    expect(c.thinking).toEqual({ type: "adaptive" });
    expect(c.output_config).toEqual({ effort: "medium" });
    expect(c.messages).toEqual([{ role: "user", content: "¿cuánto gasté?" }]);
  });

  it("a Haiku 4.5 no le manda pensamiento adaptativo ni esfuerzo (es de otra generación)", async () => {
    const { fetch, pedidos } = fetchFalso(respuestaConHerramienta);
    await proveedorAnthropic({ clave: "sk-test", modelo: "claude-haiku-4-5", fetch, maxReintentos: 0 }).responder(peticion);
    expect(pedidos[0].cuerpo.model).toBe("claude-haiku-4-5");
    expect(pedidos[0].cuerpo.thinking).toBeUndefined();
    expect(pedidos[0].cuerpo.output_config).toBeUndefined();
  });

  it("devuelve al modelo sus propios bloques tal cual y los resultados como tool_result", async () => {
    const { fetch, pedidos } = fetchFalso({ ...respuestaConHerramienta, content: [{ type: "text", text: "Listo." }], stop_reason: "end_turn" });
    const crudo = [{ type: "thinking", thinking: "…", signature: "abc" }, { type: "tool_use", id: "toolu_1", name: "resumen_del_mes", input: { periodo: "2026-08" } }];
    await proveedorAnthropic({ clave: "sk-test", fetch, maxReintentos: 0 }).responder({
      ...peticion,
      mensajes: [
        { rol: "usuario", texto: "¿cuánto gasté?" },
        { rol: "asistente", texto: "", llamadas: [{ id: "toolu_1", nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }], crudo },
        { rol: "resultados", resultados: [
          { id: "toolu_1", nombre: "resumen_del_mes", salida: { gastos: 69_569 }, error: null },
          { id: "toolu_2", nombre: "otra", salida: null, error: "No existe." },
        ] },
      ],
    });
    const mensajes = pedidos[0].cuerpo.messages as unknown[];
    expect(mensajes[1]).toEqual({ role: "assistant", content: crudo });
    expect(mensajes[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "toolu_1", content: '{"gastos":69569}', is_error: false },
        { type: "tool_result", tool_use_id: "toolu_2", content: "No existe.", is_error: true },
      ],
    });
  });

  it("sin `crudo` reconstruye el turno del asistente a partir del texto y las llamadas", async () => {
    const { fetch, pedidos } = fetchFalso({ ...respuestaConHerramienta, content: [{ type: "text", text: "Listo." }], stop_reason: "end_turn" });
    await proveedorAnthropic({ clave: "sk-test", fetch, maxReintentos: 0 }).responder({
      ...peticion,
      mensajes: [
        { rol: "usuario", texto: "hola" },
        { rol: "asistente", texto: "Miro.", llamadas: [{ id: "t1", nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }] },
        { rol: "resultados", resultados: [{ id: "t1", nombre: "resumen_del_mes", salida: 1, error: null }] },
      ],
    });
    expect((pedidos[0].cuerpo.messages as unknown[])[1]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "Miro." }, { type: "tool_use", id: "t1", name: "resumen_del_mes", input: { periodo: "2026-08" } }],
    });
  });
});

describe("proveedorAnthropic → respuesta", () => {
  it("traduce tool_use a llamadas, guarda el contenido crudo y cuenta los tokens", async () => {
    const { fetch } = fetchFalso(respuestaConHerramienta);
    const r = await proveedorAnthropic({ clave: "sk-test", fetch, maxReintentos: 0 }).responder(peticion);
    expect(r.fin).toBe("herramientas");
    expect(r.texto).toBe("Miro agosto.");
    expect(r.llamadas).toEqual([{ id: "toolu_1", nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }]);
    expect(r.crudo).toEqual(respuestaConHerramienta.content);
    expect(r.uso).toEqual({ entrada: 1200, salida: 60, cacheLeido: 0, cacheEscrito: 1100 });
  });

  it("end_turn termina; max_tokens y refusal cortan, y la negativa se explica", async () => {
    const terminado = fetchFalso({ ...respuestaConHerramienta, content: [{ type: "text", text: "Gastaste $69.569." }], stop_reason: "end_turn" });
    expect((await proveedorAnthropic({ clave: "k", fetch: terminado.fetch, maxReintentos: 0 }).responder(peticion)).fin).toBe("terminado");

    const negado = fetchFalso({ ...respuestaConHerramienta, content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: "no" } });
    const r = await proveedorAnthropic({ clave: "k", fetch: negado.fetch, maxReintentos: 0 }).responder(peticion);
    expect(r.fin).toBe("cortado");
    expect(r.texto).toMatch(/no quiso contestar/);
  });

  it("una key rechazada se convierte en un error de configuración del servidor", async () => {
    const { fetch } = fetchFalso({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401);
    const intento = proveedorAnthropic({ clave: "mala", fetch, maxReintentos: 0 }).responder(peticion);
    await expect(intento).rejects.toBeInstanceOf(ErrorProveedor);
    await expect(intento).rejects.toMatchObject({ tipo: "servidor" });
  });
});

describe("costoEstimadoUSD", () => {
  it("cobra el caché leído al 10% y el escrito al 125%", () => {
    const costo = costoEstimadoUSD({ entrada: 1_000_000, salida: 0, cacheLeido: 0, cacheEscrito: 0 }, "claude-opus-5");
    expect(costo).toBeCloseTo(5);
    const cacheado = costoEstimadoUSD({ entrada: 0, salida: 0, cacheLeido: 1_000_000, cacheEscrito: 0 }, "claude-opus-5");
    expect(cacheado).toBeCloseTo(0.5);
    expect(costoEstimadoUSD({ entrada: 1, salida: 1, cacheLeido: 0, cacheEscrito: 0 }, "otro-modelo")).toBeNull();
  });
});

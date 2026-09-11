import { describe, it, expect } from "vitest";
import { crearManejador } from "./manejador";

/**
 * Un `fetch` que atiende las dos cosas que el servidor pregunta hacia afuera:
 * a Google "¿de quién es este token?" y a Anthropic "respondé esto".
 */
function mundo({ email = "duena@gmail.com", verificado = true, google = 200 } = {}) {
  const llamadas: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    llamadas.push(url);
    if (url.includes("googleapis.com/oauth2")) {
      return new Response(JSON.stringify({ email, email_verified: verificado }), { status: google });
    }
    if (url.includes("api.anthropic.com")) {
      expect(new Headers(init?.headers).get("x-api-key")).toBe("sk-ant-servidor");
      return new Response(JSON.stringify({
        id: "m", type: "message", role: "assistant", model: "claude-opus-5",
        content: [{ type: "text", text: "Hola." }], stop_reason: "end_turn", stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`fetch inesperado: ${url}`);
  };
  return { fetch, llamadas };
}

const entorno = { ANTHROPIC_API_KEY: "sk-ant-servidor", DUENO_EMAIL: "Duena@gmail.com" };
const peticion = { modelo: "claude-opus-5", sistema: "S", mensajes: [{ rol: "usuario", texto: "hola" }], herramientas: [] };

function pedido(token: string | null, cuerpo: unknown = peticion) {
  return new Request("http://plata.test/api/modelo", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(cuerpo),
  });
}

describe("POST /api/modelo", () => {
  it("con la cuenta del dueño, llama a Anthropic con la key del servidor y devuelve la respuesta del puerto", async () => {
    const { fetch, llamadas } = mundo();
    const POST = crearManejador({ entorno, fetch });
    const r = await POST(pedido("ya29.duena"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ texto: "Hola.", fin: "terminado", uso: { entrada: 10, salida: 2 } });
    expect(llamadas.some((u) => u.includes("api.anthropic.com"))).toBe(true);
  });

  it("sin token es 401, y nunca le pregunta nada a Anthropic", async () => {
    const { fetch, llamadas } = mundo();
    const r = await crearManejador({ entorno, fetch })(pedido(null));
    expect(r.status).toBe(401);
    expect(llamadas).toEqual([]);
  });

  it("otra cuenta de Google es 403: la key no es un proxy gratis", async () => {
    const { fetch, llamadas } = mundo({ email: "otro@gmail.com" });
    const r = await crearManejador({ entorno, fetch })(pedido("ya29.otro"));
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ tipo: "sesion" });
    expect(llamadas.some((u) => u.includes("api.anthropic.com"))).toBe(false);
  });

  it("un token que Google no reconoce, o un email sin verificar, es 401", async () => {
    expect((await crearManejador({ entorno, fetch: mundo({ google: 401 }).fetch })(pedido("viejo"))).status).toBe(401);
    expect((await crearManejador({ entorno, fetch: mundo({ verificado: false }).fetch })(pedido("t"))).status).toBe(401);
  });

  it("sin las variables de entorno avisa que falta configurar, antes que nada", async () => {
    const r = await crearManejador({ entorno: {}, fetch: mundo().fetch })(pedido("t"));
    expect(r.status).toBe(500);
    expect(await r.json()).toMatchObject({ tipo: "servidor", error: /ANTHROPIC_API_KEY o DUENO_EMAIL/ });
  });

  it("un cuerpo que no es una petición es 400", async () => {
    const r = await crearManejador({ entorno, fetch: mundo().fetch })(pedido("ya29.duena", { hola: 1 }));
    expect(r.status).toBe(400);
  });

  it("recuerda de quién es el token para no preguntarle a Google en cada vuelta", async () => {
    const { fetch, llamadas } = mundo();
    const POST = crearManejador({ entorno, fetch });
    await POST(pedido("ya29.duena"));
    await POST(pedido("ya29.duena"));
    expect(llamadas.filter((u) => u.includes("oauth2")).length).toBe(1);
  });
});

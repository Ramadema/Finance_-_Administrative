import { describe, it, expect } from "vitest";
import { proveedorProxy } from "./proxy";
import { ErrorProveedor, type Peticion } from "../tipos";

function fetchFalso(cuerpo: unknown, status = 200) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    pedidos.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, pedidos };
}

const peticion: Peticion = { sistema: "S", mensajes: [{ rol: "usuario", texto: "hola" }], herramientas: [] };

describe("proveedorProxy", () => {
  it("le manda a nuestro servidor la petición, el modelo y el token de Google", async () => {
    const respuesta = { texto: "Hola.", llamadas: [], fin: "terminado" };
    const { fetch, pedidos } = fetchFalso(respuesta);
    const r = await proveedorProxy({ token: "ya29.abc", modelo: "claude-sonnet-5", fetch }).responder(peticion);

    expect(pedidos[0].url).toBe("/api/modelo");
    expect(new Headers(pedidos[0].init.headers).get("authorization")).toBe("Bearer ya29.abc");
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({ modelo: "claude-sonnet-5", ...peticion });
    expect(r).toEqual(respuesta);
  });

  it("un 403 se explica como problema de cuenta, con el mensaje del servidor", async () => {
    const { fetch } = fetchFalso({ error: "Esta cuenta de Google no es la del dueño de la app." }, 403);
    const intento = proveedorProxy({ token: "t", modelo: "claude-opus-5", fetch }).responder(peticion);
    await expect(intento).rejects.toBeInstanceOf(ErrorProveedor);
    await expect(intento).rejects.toMatchObject({ tipo: "sesion", message: /no es la del dueño/ });
  });

  it("respeta el tipo que manda el servidor cuando viene", async () => {
    const { fetch } = fetchFalso({ error: "Sin crédito.", tipo: "credito" }, 402);
    await expect(proveedorProxy({ token: "t", modelo: "claude-opus-5", fetch }).responder(peticion))
      .rejects.toMatchObject({ tipo: "credito" });
  });

  it("si no hay red, lo dice como conexión", async () => {
    const fetch: typeof globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await expect(proveedorProxy({ token: "t", modelo: "claude-opus-5", fetch }).responder(peticion))
      .rejects.toMatchObject({ tipo: "conexion" });
  });
});

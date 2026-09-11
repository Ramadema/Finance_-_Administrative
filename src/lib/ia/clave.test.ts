import { describe, it, expect } from "vitest";
import { parsearAjustes, serializarAjustes } from "./clave";

describe("ajustes del asistente en Drive", () => {
  it("van y vuelven", () => {
    const texto = serializarAjustes({ clave: "sk-ant-abc", modelo: "claude-sonnet-5" });
    expect(parsearAjustes(texto)).toEqual({ clave: "sk-ant-abc", modelo: "claude-sonnet-5" });
    expect(JSON.parse(texto).version).toBe(1);
  });

  it("un modelo que ya no existe cae al por defecto en vez de romper", () => {
    expect(parsearAjustes('{"clave":"sk-ant-x","modelo":"claude-viejo-1"}')?.modelo).toBe("claude-opus-5");
  });

  it("sin key no hay ajustes, sea lo que sea lo que haya en el archivo", () => {
    expect(parsearAjustes('{"modelo":"claude-opus-5"}')).toBeNull();
    expect(parsearAjustes('{"clave":"   "}')).toBeNull();
    expect(parsearAjustes("esto no es json")).toBeNull();
    expect(parsearAjustes("null")).toBeNull();
  });
});

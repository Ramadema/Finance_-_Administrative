import { describe, it, expect } from "vitest";
import { clasificar, cobertura, type EntradaMemoria, type Regla } from "./motor";
import { clave, titulizar } from "./normalizar";

describe("normalizar la descripción del banco", () => {
  it("saca el prefijo del procesador de pagos", () => {
    expect(clave("MERPAGO*RAPPI")).toBe("RAPPI");
    expect(clave("MP* SPOTIFY")).toBe("SPOTIFY");
  });

  it("saca sufijos societarios y números de operación", () => {
    expect(clave("COTO CICSA")).toBe("COTO");
    expect(clave("RAPPI ARGENTINA S.A.")).toBe("RAPPI");
    expect(clave("FRAVEGA SA 998877")).toBe("FRAVEGA");
  });

  it("colapsa las variantes del mismo comercio a una sola clave", () => {
    const claves = ["MERPAGO*RAPPI 4523", "RAPPI ARGENTINA S.A.", "RAPPI"].map(clave);
    expect(new Set(claves).size).toBe(1);
  });

  it("titulariza lo desconocido para mostrarlo lindo", () => {
    expect(titulizar("KIOSCO DON JOSE")).toBe("Kiosco Don Jose");
  });
});

describe("cascada de categorización", () => {
  it("capa 3: la semilla cubre comercios conocidos", () => {
    const c = clasificar("MERPAGO*RAPPI 4523");
    expect(c.categoria).toBe("gastronomia");
    expect(c.subcategoria).toBe("Delivery");
    expect(c.comercio).toBe("Rappi");
    expect(c.fuente).toBe("semilla");
  });

  it("el patrón más específico gana — PUMA ENERGY es nafta, no zapatillas", () => {
    expect(clasificar("PUMA ENERGY").subcategoria).toBe("Combustible");
    expect(clasificar("PUMA STORE").subcategoria).toBe("Indumentaria");
  });

  it("capa 2: la memoria pisa a la semilla", () => {
    const memoria = new Map<string, EntradaMemoria>([
      ["RAPPI", { categoria: "supermercado", subcategoria: "Supermercado", comercio: "Rappi Turbo" }],
    ]);
    const c = clasificar("MERPAGO*RAPPI", { memoria });
    expect(c.categoria).toBe("supermercado");
    expect(c.fuente).toBe("memoria");
    expect(c.confianza).toBe(1);
  });

  it("capa 1: tus reglas mandan sobre todo", () => {
    const reglas: Regla[] = [
      { id: "r1", patron: "RAPPI", esRegex: false, categoria: "ocio", subcategoria: null, prioridad: 10 },
    ];
    const memoria = new Map<string, EntradaMemoria>([
      ["RAPPI", { categoria: "supermercado", subcategoria: null, comercio: "Rappi" }],
    ]);
    expect(clasificar("MERPAGO*RAPPI", { reglas, memoria }).categoria).toBe("ocio");
  });

  it("una regex rota del usuario no rompe el import", () => {
    const reglas: Regla[] = [
      { id: "mala", patron: "[", esRegex: true, categoria: "ocio", subcategoria: null, prioridad: 99 },
    ];
    expect(() => clasificar("COTO", { reglas })).not.toThrow();
    expect(clasificar("COTO", { reglas }).categoria).toBe("supermercado");
  });

  it("capa 4: lo desconocido queda marcado, no adivinado", () => {
    const c = clasificar("XYZ COMERCIO RARO 123");
    expect(c.categoria).toBe("sin_categoria");
    expect(c.fuente).toBe("ninguna");
    expect(c.confianza).toBe(0);
  });

  it("el pago de tarjeta es interno, NO gasto — si no, se cuenta doble", () => {
    expect(clasificar("SU PAGO EN PESOS").categoria).toBe("interno");
    expect(clasificar("PAGO DE TARJETA VISA").categoria).toBe("interno");
  });

  it("distingue ingresos de gastos", () => {
    expect(clasificar("ACREDITACION HABERES").categoria).toBe("ingresos");
    expect(clasificar("PLAZO FIJO CONSTITUCION").categoria).toBe("inversion");
  });

  it("cubre un resumen realista arriba del 65%", () => {
    const resumen = [
      "MERPAGO*RAPPI", "COTO CICSA", "NETFLIX.COM", "YPF SERVICIOS",
      "FARMACITY 231", "EDENOR", "SPOTIFY AB", "UBER TRIP", "MERCADOLIBRE",
      "SUBE CARGA", "OSDE 210", "KIOSCO EL SOL", "XX RARO SRL",
    ];
    const cob = cobertura(resumen.map((d) => clasificar(d)));
    expect(cob.porcentaje).toBeGreaterThanOrEqual(65);
  });
});

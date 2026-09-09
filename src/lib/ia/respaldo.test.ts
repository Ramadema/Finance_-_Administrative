import { describe, it, expect } from "vitest";
import { numerosEnTexto, numerosSinRespaldo } from "./respaldo";

const resultado = (salida: unknown) => ({ id: "1", nombre: "x", salida, error: null });

describe("numerosEnTexto", () => {
  it("lee el formato argentino: miles con punto, decimales con coma, $ y %", () => {
    const n = numerosEnTexto("Gastaste $ 19.569,50 en total, un 61% más, y 1.234 en café.");
    expect(n.map((x) => x.valor)).toEqual([19_569.5, 61, 1_234]);
    expect(n[0].esPlata).toBe(true);
    expect(n[1].esPorcentaje).toBe(true);
    expect(n[2].esPlata).toBe(false);
  });

  it("no confunde períodos ni fechas con números", () => {
    expect(numerosEnTexto("En 2026-08 y el 05/08/2026 no pasó nada.")).toEqual([]);
  });
});

describe("numerosSinRespaldo", () => {
  const resultados = [resultado({ gastos: 19_568.7, porcentaje: 61.2, movimientos: [{ monto: 1_234 }] })];

  it("acepta los números que vienen de las herramientas, con tolerancia al redondeo", () => {
    expect(numerosSinRespaldo("Gastaste $19.569 (61%) y $1.234 en café.", resultados)).toEqual([]);
  });

  it("marca lo que no salió de ningún lado", () => {
    expect(numerosSinRespaldo("Gastaste $19.569 y ahorraste $80.000.", resultados)).toEqual(["$80.000"]);
    expect(numerosSinRespaldo("Subió un 15%.", resultados)).toEqual(["15%"]);
  });

  it("deja pasar cantidades chicas y años, que no son plata", () => {
    expect(numerosSinRespaldo("Fueron 3 movimientos en 12 cuotas durante 2026.", resultados)).toEqual([]);
  });

  it("sin herramientas, cualquier cifra de plata queda sin respaldo", () => {
    expect(numerosSinRespaldo("Gastaste $50.000.", [])).toEqual(["$50.000"]);
  });
});

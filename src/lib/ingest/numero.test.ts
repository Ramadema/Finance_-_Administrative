import { describe, it, expect } from "vitest";
import { parseImporteAR, formatARS, formatCompacto } from "./numero";

describe("parseImporteAR", () => {
  it("formato argentino con miles y decimales", () => {
    expect(parseImporteAR("1.234,56")).toBe(1234.56);
    expect(parseImporteAR("1.234.567,89")).toBe(1234567.89);
    expect(parseImporteAR("999.999.999,99")).toBe(999999999.99);
  });

  it("la trampa: punto como separador de miles sin decimales", () => {
    // parseFloat("1.234") daría 1.234 — mil veces menos.
    expect(parseImporteAR("1.234")).toBe(1234);
    expect(parseImporteAR("1.234.567")).toBe(1234567);
    expect(parseImporteAR("12.000")).toBe(12000);
  });

  it("punto con 1 o 2 dígitos sí es decimal", () => {
    expect(parseImporteAR("0.50")).toBe(0.5);
    expect(parseImporteAR("1.5")).toBe(1.5);
  });

  it("solo coma decimal", () => {
    expect(parseImporteAR("0,00")).toBe(0);
    expect(parseImporteAR("123,45")).toBe(123.45);
    expect(parseImporteAR("1234,56")).toBe(1234.56);
  });

  it("negativos en sus tres formas", () => {
    expect(parseImporteAR("-1.234,56")).toBe(-1234.56);
    expect(parseImporteAR("1.234,56-")).toBe(-1234.56);
    expect(parseImporteAR("(1.234,56)")).toBe(-1234.56);
  });

  it("limpia símbolos de moneda y espacios raros", () => {
    expect(parseImporteAR("$ 1.234,56")).toBe(1234.56);
    expect(parseImporteAR("U$S 99,90")).toBe(99.9);
    expect(parseImporteAR("$ 1.234,56")).toBe(1234.56); // NBSP
    expect(parseImporteAR("  1.234,56  ")).toBe(1234.56);
  });

  it("formato US por si acaso (coma miles, punto decimal)", () => {
    expect(parseImporteAR("1,234.56")).toBe(1234.56);
  });

  it("acepta números que ya vienen numéricos de SheetJS", () => {
    expect(parseImporteAR(1234.56)).toBe(1234.56);
    expect(parseImporteAR(0)).toBe(0);
  });

  it("devuelve null (no 0) cuando no hay dato", () => {
    expect(parseImporteAR("")).toBeNull();
    expect(parseImporteAR("   ")).toBeNull();
    expect(parseImporteAR(null)).toBeNull();
    expect(parseImporteAR(undefined)).toBeNull();
    expect(parseImporteAR("N/A")).toBeNull();
    expect(parseImporteAR("1,234,56")).toBeNull();
    expect(parseImporteAR(NaN)).toBeNull();
  });

  it("distingue cero de ausencia — importa para los promedios", () => {
    expect(parseImporteAR("0,00")).toBe(0);
    expect(parseImporteAR("")).toBeNull();
  });
});

describe("formato de salida", () => {
  it("formatARS usa convención argentina", () => {
    const s = formatARS(1234.56);
    expect(s).toContain("1.234,56");
  });

  it("formatCompacto para ejes", () => {
    expect(formatCompacto(1_500_000)).toBe("1,5M");
    expect(formatCompacto(340_000)).toBe("340k");
    expect(formatCompacto(500)).toBe("500");
  });
});

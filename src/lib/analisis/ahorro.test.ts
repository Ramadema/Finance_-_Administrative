import { describe, it, expect } from "vitest";
import { capacidadDe, proyectarAhorro, fondoEmergencia, escenariosRecorte } from "./ahorro";
import type { ResumenPeriodo, GastoPorCategoria } from "./metricas";

function res(p: Partial<ResumenPeriodo>): ResumenPeriodo {
  return {
    periodo: "2026-08", ingresos: 0, ingresosManuales: 0, gastos: 0, ahorro: 0,
    sobrante: 0, tasaGasto: null, fijo: 0, variable: 0, esporadico: 0,
    cantidadMovimientos: 0, sinCategorizar: 0, gastosUSD: 0, ...p,
  };
}

describe("capacidadDe", () => {
  it("calcula lo que sobra y la tasa de ahorro", () => {
    const c = capacidadDe(res({ ingresos: 1_000_000, gastos: 700_000, fijo: 400_000, variable: 300_000 }));
    expect(c.capacidad).toBe(300_000);
    expect(c.tasaAhorro).toBeCloseTo(0.3);
    expect(c.cargaFija).toBeCloseTo(0.4);
    expect(c.margenDiscrecional).toBe(600_000);
  });

  it("marca cuando gastás más de lo que entra", () => {
    const c = capacidadDe(res({ ingresos: 500_000, gastos: 620_000 }));
    expect(c.capacidad).toBe(-120_000);
    expect(c.tasaAhorro).toBeLessThan(0);
  });

  it("sin ingresos cargados no inventa una tasa", () => {
    const c = capacidadDe(res({ gastos: 300_000 }));
    expect(c.hayIngresos).toBe(false);
    expect(c.tasaAhorro).toBeNull();
    expect(c.cargaFija).toBeNull();
  });
});

describe("proyectarAhorro", () => {
  const serie = [
    res({ periodo: "2026-05", ingresos: 1_000_000, gastos: 700_000 }),
    res({ periodo: "2026-06", ingresos: 1_000_000, gastos: 750_000 }),
    res({ periodo: "2026-07", ingresos: 1_000_000, gastos: 700_000 }),
  ];

  it("proyecta sobre la mediana, no sobre el último mes", () => {
    const p = proyectarAhorro(serie);
    expect(p.base).toBe(300_000); // mediana de 300k, 250k, 300k
    expect(p.totalAlAno).toBe(3_600_000);
    expect(p.puntos).toHaveLength(12);
    expect(p.puntos[11].acumulado).toBe(3_600_000);
  });

  it("un mes con una compra grande no arruina la proyección", () => {
    const conOutlier = [...serie, res({ periodo: "2026-08", ingresos: 1_000_000, gastos: 1_900_000 })];
    const p = proyectarAhorro(conOutlier);
    expect(p.base).toBeGreaterThan(0); // la mediana aguanta
  });

  it("con menos de 3 meses avisa que no es confiable", () => {
    expect(proyectarAhorro(serie.slice(0, 2)).confiable).toBe(false);
    expect(proyectarAhorro(serie).confiable).toBe(true);
  });

  it("ignora los meses sin ingresos cargados", () => {
    const p = proyectarAhorro([...serie, res({ periodo: "2026-08", gastos: 800_000 })]);
    expect(p.mesesBase).toBe(3);
  });
});

describe("fondoEmergencia", () => {
  const serie = [res({ fijo: 300_000 }), res({ fijo: 300_000 }), res({ fijo: 320_000 })];

  it("cuenta cuántos meses de gastos fijos tenés cubiertos", () => {
    const f = fondoEmergencia(serie, 900_000, 200_000);
    expect(f.pisoMensual).toBe(300_000);
    expect(f.mesesCubiertos).toBe(3);
    expect(f.faltante).toBe(900_000); // meta 6 meses = 1.8M
    expect(f.mesesParaMeta).toBe(5);
  });

  it("si ya llegaste a la meta, no falta nada", () => {
    const f = fondoEmergencia(serie, 2_000_000, 200_000);
    expect(f.faltante).toBe(0);
    expect(f.mesesParaMeta).toBe(0);
  });

  it("sin capacidad de ahorro no puede estimar cuándo llegás", () => {
    expect(fondoEmergencia(serie, 0, -50_000).mesesParaMeta).toBeNull();
  });
});

describe("escenariosRecorte", () => {
  const cats: GastoPorCategoria[] = [
    { categoriaId: "gastronomia", nombre: "Gastronomía", slot: 1, monto: 200_000, porcentaje: 40, cantidad: 20 },
    { categoriaId: "financiero", nombre: "Impuestos y bancarios", slot: 7, monto: 150_000, porcentaje: 30, cantidad: 5 },
    { categoriaId: "salud", nombre: "Salud y cuidado", slot: 4, monto: 100_000, porcentaje: 20, cantidad: 3 },
    { categoriaId: "ocio", nombre: "Ocio y viajes", slot: 6, monto: 50_000, porcentaje: 10, cantidad: 2 },
  ];

  it("calcula el ahorro mensual y anual del recorte", () => {
    const e = escenariosRecorte(cats, 20);
    expect(e[0].categoriaId).toBe("gastronomia");
    expect(e[0].ahorroMensual).toBe(40_000);
    expect(e[0].ahorroAnual).toBe(480_000);
  });

  it("no ofrece recortar impuestos ni salud — no son palancas reales", () => {
    const ids = escenariosRecorte(cats, 20).map((e) => e.categoriaId);
    expect(ids).not.toContain("financiero");
    expect(ids).not.toContain("salud");
    expect(ids).toEqual(["gastronomia", "ocio"]);
  });

  it("acota el porcentaje a un rango válido", () => {
    expect(escenariosRecorte(cats, 500)[0].ahorroMensual).toBe(200_000);
    expect(escenariosRecorte(cats, -10)[0].ahorroMensual).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { perfilarRecurrencia, repartoFijoVariable, indiceNaturaleza, type MovimientoParaAnalisis } from "./recurrencia";

const PERIODOS = ["2026-05", "2026-06", "2026-07", "2026-08"];

function mov(
  clave: string, periodo: string, monto: number, declaradoFijo = false,
): MovimientoParaAnalisis {
  return {
    claveComercio: clave, comercio: clave, categoria: "servicios",
    periodo, montoARS: monto, declaradoFijo,
  };
}

describe("perfilarRecurrencia", () => {
  it("detecta una suscripción: todos los meses, mismo monto", () => {
    const p = perfilarRecurrencia(
      PERIODOS.map((per) => mov("NETFLIX", per, 7999)),
      PERIODOS,
    )[0];
    expect(p.naturaleza).toBe("fijo");
    expect(p.esSuscripcion).toBe(true);
    expect(p.mesesPresente).toBe(4);
    expect(p.variacion).toBe(0);
    expect(p.montoTipico).toBe(7999);
  });

  it("un gasto recurrente pero de monto errático es variable, no fijo", () => {
    const p = perfilarRecurrencia(
      [mov("COTO", "2026-05", 50000), mov("COTO", "2026-06", 120000),
       mov("COTO", "2026-07", 30000), mov("COTO", "2026-08", 95000)],
      PERIODOS,
    )[0];
    expect(p.naturaleza).toBe("variable");
    expect(p.esSuscripcion).toBe(false);
  });

  it("una compra suelta es esporádica", () => {
    const p = perfilarRecurrencia([mov("FRAVEGA", "2026-08", 250000)], PERIODOS)[0];
    expect(p.naturaleza).toBe("esporadico");
    expect(p.mesesPresente).toBe(1);
  });

  it("avisa cuando una suscripción sube de precio", () => {
    const p = perfilarRecurrencia(
      [mov("SPOTIFY", "2026-05", 5000), mov("SPOTIFY", "2026-06", 5000),
       mov("SPOTIFY", "2026-07", 5000), mov("SPOTIFY", "2026-08", 7500)],
      PERIODOS,
    )[0];
    expect(p.aumentoPct).toBe(50);
    expect(p.alertaAumento).toBe(true);
  });

  it("no alerta por una variación mínima", () => {
    const p = perfilarRecurrencia(
      [mov("OSDE", "2026-05", 100000), mov("OSDE", "2026-06", 100000),
       mov("OSDE", "2026-07", 100000), mov("OSDE", "2026-08", 102000)],
      PERIODOS,
    )[0];
    expect(p.alertaAumento).toBe(false);
  });

  it("la mediana ignora el mes con outlier", () => {
    const p = perfilarRecurrencia(
      [mov("LUZ", "2026-05", 10000), mov("LUZ", "2026-06", 10000),
       mov("LUZ", "2026-07", 900000), mov("LUZ", "2026-08", 10000)],
      PERIODOS,
    )[0];
    expect(p.montoTipico).toBe(10000);
  });

  it("suma varios consumos del mismo comercio dentro del mes", () => {
    const p = perfilarRecurrencia(
      [mov("YPF", "2026-08", 30000), mov("YPF", "2026-08", 20000)],
      PERIODOS,
    )[0];
    expect(p.ultimoMonto).toBe(50000);
  });

  it("sigue siendo suscripción si cambió de precio hace dos meses", () => {
    // Escalón, no ruido: planchado, salta una vez, planchado de nuevo.
    const p = perfilarRecurrencia(
      [mov("HBO", "2026-05", 5000), mov("HBO", "2026-06", 5000),
       mov("HBO", "2026-07", 7500), mov("HBO", "2026-08", 7500)],
      PERIODOS,
    )[0];
    expect(p.naturaleza).toBe("fijo");
    expect(p.esSuscripcion).toBe(true);
  });

  it("un gasto que cambia TODOS los meses nunca es suscripción", () => {
    const p = perfilarRecurrencia(
      [mov("NAFTA", "2026-05", 30000), mov("NAFTA", "2026-06", 45000),
       mov("NAFTA", "2026-07", 38000), mov("NAFTA", "2026-08", 52000)],
      PERIODOS,
    )[0];
    expect(p.naturaleza).toBe("variable");
    expect(p.alertaAumento).toBe(false);
  });

  it("solo mira la ventana pedida", () => {
    const p = perfilarRecurrencia(
      [mov("VIEJO", "2026-01", 1000), mov("VIEJO", "2026-02", 1000)],
      PERIODOS, 4,
    );
    expect(p).toHaveLength(0);
  });
});

describe("repartoFijoVariable", () => {
  it("separa el compromiso ineludible del gasto discrecional", () => {
    const movs = [
      ...PERIODOS.map((p) => mov("NETFLIX", p, 8000)),
      ...PERIODOS.map((p) => mov("OSDE", p, 100000)),
      mov("FRAVEGA", "2026-08", 250000),
    ];
    const nat = indiceNaturaleza(perfilarRecurrencia(movs, PERIODOS));
    const r = repartoFijoVariable(movs, nat, "2026-08");
    expect(r.fijo).toBe(108000);
    expect(r.esporadico).toBe(250000);
  });
});

describe("gastos fijos declarados a mano", () => {
  it("un alquiler que aumentó sigue siendo fijo", () => {
    // El detector mide la fracción de meses SIN cambio. Con dos meses y una
    // suba, esa fracción es 0 y saldría "variable" — justo el gasto más
    // ineludible que hay. Lo declarado no se detecta.
    const meses = ["2026-06", "2026-07"];
    const p = perfilarRecurrencia(
      [mov("ALQUILER", "2026-06", 100000, true), mov("ALQUILER", "2026-07", 200000, true)],
      meses,
    )[0];
    expect(p.naturaleza).toBe("fijo");
    expect(p.esSuscripcion).toBe(true);
  });

  it("sin declarar, ese mismo salto es variable", () => {
    const meses = ["2026-06", "2026-07"];
    const p = perfilarRecurrencia(
      [mov("ALGO", "2026-06", 100000), mov("ALGO", "2026-07", 200000)],
      meses,
    )[0];
    expect(p.naturaleza).toBe("variable");
  });

  it("declarado en un solo mes también cuenta como fijo", () => {
    // Recién cargado, o vigente desde este mes: no hay historia que mirar.
    const p = perfilarRecurrencia(
      [mov("FACULTAD", "2026-07", 90000, true)],
      ["2026-06", "2026-07"],
    )[0];
    expect(p.naturaleza).toBe("fijo");
  });
});

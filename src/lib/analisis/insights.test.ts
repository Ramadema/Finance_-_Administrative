import { describe, it, expect } from "vitest";
import { generarInsights, historicoPorCategoria, type EntradaInsights } from "./insights";
import { capacidadDe, fondoEmergencia } from "./ahorro";
import type { ResumenPeriodo, GastoPorCategoria, CuotaFutura } from "./metricas";
import type { PerfilRecurrencia } from "../categorize/recurrencia";

function res(p: Partial<ResumenPeriodo> = {}): ResumenPeriodo {
  return {
    periodo: "2026-08", ingresos: 1_000_000, ingresosManuales: 1_000_000, gastos: 600_000,
    ahorro: 0, sobrante: 400_000, tasaGasto: 0.6, fijo: 300_000, variable: 200_000,
    esporadico: 100_000, cantidadMovimientos: 20, sinCategorizar: 0, gastosUSD: 0, ...p,
  };
}

function cat(p: Partial<GastoPorCategoria> = {}): GastoPorCategoria {
  return { categoriaId: "gastronomia", nombre: "Gastronomía", slot: 1,
           monto: 100_000, porcentaje: 20, cantidad: 5, ...p };
}

function base(p: Partial<EntradaInsights> = {}): EntradaInsights {
  const resumen = p.resumen ?? res();
  return {
    periodo: "2026-08", resumen, serie: [resumen], categorias: [], perfiles: [], cuotas: [],
    capacidad: capacidadDe(resumen), fondo: null, categoriasPrevias: new Map(), ...p,
  };
}

const ids = (e: EntradaInsights) => generarInsights(e).map((i) => i.id);

describe("datos incompletos", () => {
  it("pide cargar ingresos si no hay", () => {
    const r = res({ ingresos: 0, ingresosManuales: 0 });
    expect(ids(base({ resumen: r, capacidad: capacidadDe(r) }))).toContain("sin-ingresos");
  });

  it("no lo pide si ya cargaste ingresos", () => {
    expect(ids(base())).not.toContain("sin-ingresos");
  });

  it("avisa si hay muchos movimientos sin categorizar", () => {
    const r = res({ cantidadMovimientos: 20, sinCategorizar: 5 }); // 25%
    expect(ids(base({ resumen: r }))).toContain("sin-categorizar");
  });

  it("no molesta por uno o dos sueltos", () => {
    const r = res({ cantidadMovimientos: 20, sinCategorizar: 2 }); // 10%
    expect(ids(base({ resumen: r }))).not.toContain("sin-categorizar");
  });
});

describe("categorías disparadas", () => {
  it("detecta la categoría muy por encima de su promedio", () => {
    const e = base({
      categorias: [cat({ monto: 200_000, porcentaje: 33 })],
      categoriasPrevias: new Map([["gastronomia", [100_000, 110_000, 90_000]]]),
    });
    const i = generarInsights(e).find((x) => x.id === "disparada-gastronomia");
    expect(i).toBeDefined();
    expect(i!.titulo).toMatch(/100% arriba/);
    expect(i!.detalle).toMatch(/\$/); // siempre con números
  });

  it("no dispara sin al menos 2 meses de historia", () => {
    expect(ids(base({
      categorias: [cat({ monto: 500_000 })],
      categoriasPrevias: new Map([["gastronomia", [100_000]]]),
    }))).not.toContain("disparada-gastronomia");
  });

  it("no dispara por una categoría chica aunque el % sea enorme", () => {
    // +200% pero es el 2% del mes: no es noticia.
    expect(ids(base({
      categorias: [cat({ monto: 9_000, porcentaje: 2 })],
      categoriasPrevias: new Map([["gastronomia", [3_000, 3_000]]]),
    }))).not.toContain("disparada-gastronomia");
  });

  it("no dispara por una variación normal", () => {
    expect(ids(base({
      categorias: [cat({ monto: 105_000, porcentaje: 20 })],
      categoriasPrevias: new Map([["gastronomia", [100_000, 100_000]]]),
    }))).not.toContain("disparada-gastronomia");
  });
});

describe("suscripciones", () => {
  const sub = (p: Partial<PerfilRecurrencia> = {}): PerfilRecurrencia => ({
    claveComercio: "SPOTIFY", comercio: "Spotify", categoria: "servicios",
    mesesPresente: 4, mesesVentana: 4, naturaleza: "fijo", montoTipico: 5_000,
    variacion: 0.1, ultimoMonto: 7_500, aumentoPct: 50, esSuscripcion: true,
    alertaAumento: true, ...p,
  });

  it("avisa del aumento con los dos montos", () => {
    const i = generarInsights(base({ perfiles: [sub()] })).find((x) => x.id === "aumento-SPOTIFY");
    expect(i?.titulo).toMatch(/Spotify aumentó 50%/);
    expect(i?.detalle).toMatch(/5\.000/);
    expect(i?.detalle).toMatch(/7\.500/);
  });

  it("marca crítico si los fijos superan la mitad del ingreso", () => {
    const perfiles = [sub({ montoTipico: 600_000, alertaAumento: false })];
    const i = generarInsights(base({ perfiles })).find((x) => x.id === "peso-fijos");
    expect(i?.severidad).toBe("critico");
  });

  it("no avisa si los fijos son razonables", () => {
    const perfiles = [sub({ montoTipico: 200_000, alertaAumento: false })];
    expect(ids(base({ perfiles }))).not.toContain("peso-fijos");
  });
});

describe("cuotas", () => {
  const cuota = (monto: number): CuotaFutura => ({
    periodo: "2026-09", monto, detalle: [{ comercio: "Frávega", cuota: "4/12", monto }],
  });

  it("alerta cuando el mes que viene ya está muy comprometido", () => {
    const i = generarInsights(base({ cuotas: [cuota(400_000)] })).find((x) => x.id === "cuotas-pesadas");
    expect(i?.severidad).toBe("critico"); // 40% del ingreso
  });

  it("no alerta por una cuota chica", () => {
    expect(ids(base({ cuotas: [cuota(50_000)] }))).not.toContain("cuotas-pesadas");
  });
});

describe("ahorro", () => {
  it("marca crítico el déficit", () => {
    const r = res({ ingresos: 500_000, gastos: 700_000 });
    const i = generarInsights(base({ resumen: r, capacidad: capacidadDe(r) }))
      .find((x) => x.id === "deficit");
    expect(i?.severidad).toBe("critico");
    expect(i?.detalle).toMatch(/200\.000/);
  });

  it("felicita una tasa de ahorro alta", () => {
    const r = res({ ingresos: 1_000_000, gastos: 600_000 }); // 40%
    const i = generarInsights(base({ resumen: r, capacidad: capacidadDe(r) }))
      .find((x) => x.id === "tasa-buena");
    expect(i?.severidad).toBe("bueno");
  });

  it("avisa cuando la tasa es baja", () => {
    const r = res({ ingresos: 1_000_000, gastos: 950_000 }); // 5%
    expect(ids(base({ resumen: r, capacidad: capacidadDe(r) }))).toContain("tasa-baja");
  });

  it("avisa si el colchón cubre menos de 3 meses", () => {
    const fondo = fondoEmergencia([res()], 300_000, 400_000); // 1 mes
    const i = generarInsights(base({ fondo })).find((x) => x.id === "fondo-corto");
    expect(i).toBeDefined();
    expect(i!.detalle).toMatch(/300\.000/);
  });
});

describe("tendencia y gasto hormiga", () => {
  it("detecta tres meses seguidos de suba", () => {
    const serie = [res({ gastos: 500_000 }), res({ gastos: 600_000 }), res({ gastos: 700_000 })];
    expect(ids(base({ serie, resumen: serie[2] }))).toContain("tendencia-alza");
  });

  it("no la detecta si un mes bajó", () => {
    const serie = [res({ gastos: 500_000 }), res({ gastos: 700_000 }), res({ gastos: 600_000 })];
    expect(ids(base({ serie }))).not.toContain("tendencia-alza");
  });

  it("detecta muchos consumos chicos que suman", () => {
    const e = base({
      resumen: res({ gastos: 600_000 }),
      categorias: [cat({ monto: 60_000, cantidad: 30, porcentaje: 10 })], // ticket $2.000
    });
    expect(ids(e)).toContain("hormiga-gastronomia");
  });

  it("no lo marca si son pocos consumos grandes", () => {
    expect(ids(base({ categorias: [cat({ monto: 100_000, cantidad: 3, porcentaje: 20 })] })))
      .not.toContain("hormiga-gastronomia");
  });
});

describe("garantías del motor", () => {
  it("toda observación trae un número que la respalda", () => {
    const r = res({ ingresos: 400_000, gastos: 900_000, sinCategorizar: 8, cantidadMovimientos: 20 });
    const todos = generarInsights(base({
      resumen: r, capacidad: capacidadDe(r), serie: [res({ gastos: 500_000 }), res({ gastos: 700_000 }), r],
      categorias: [cat({ monto: 300_000, porcentaje: 33 })],
      categoriasPrevias: new Map([["gastronomia", [100_000, 100_000]]]),
    }));
    expect(todos.length).toBeGreaterThan(2);
    for (const i of todos) {
      expect(`${i.titulo} ${i.detalle}`, i.id).toMatch(/\d/);
    }
  });

  it("nunca recomienda instrumentos de inversión", () => {
    const r = res({ ingresos: 5_000_000, gastos: 500_000 });
    const texto = generarInsights(base({ resumen: r, capacidad: capacidadDe(r) }))
      .map((i) => `${i.titulo} ${i.detalle} ${i.accion ?? ""}`).join(" ").toLowerCase();
    for (const prohibido of ["plazo fijo", "comprá dólares", "acciones", "cripto", "bono", "invertí en"]) {
      expect(texto, prohibido).not.toContain(prohibido);
    }
  });

  it("ordena por severidad: lo crítico primero", () => {
    const r = res({ ingresos: 400_000, gastos: 900_000, sinCategorizar: 8, cantidadMovimientos: 20 });
    const todos = generarInsights(base({ resumen: r, capacidad: capacidadDe(r) }));
    expect(todos[0].severidad).toBe("critico");
  });

  it("con datos sanos no inventa problemas", () => {
    const todos = generarInsights(base());
    expect(todos.every((i) => i.severidad === "bueno" || i.severidad === "info")).toBe(true);
  });
});

describe("historicoPorCategoria", () => {
  it("solo acumula meses anteriores al actual", () => {
    const h = historicoPorCategoria(new Map([
      ["2026-06", [cat({ monto: 100 })]],
      ["2026-07", [cat({ monto: 200 })]],
      ["2026-08", [cat({ monto: 999 })]],
    ]), "2026-08");
    expect(h.get("gastronomia")).toEqual([100, 200]);
  });
});

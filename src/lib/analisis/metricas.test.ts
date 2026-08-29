import { describe, it, expect } from "vitest";
import { resumenDe, gastoPorCategoria, cuotasComprometidas, naturalezasDe, variacionPorCategoria, flujoSankey } from "./metricas";
import type { Movimiento } from "../db/esquema";

function mv(p: Partial<Movimiento>): Movimiento {
  return {
    id: Math.random().toString(36), importacionId: "i1",
    fecha: "2026-08-05", periodo: "2026-08",
    descripcionCruda: "X", claveComercio: "X", comercio: "X",
    categoria: "supermercado", subcategoria: null, fuenteCategoria: "semilla",
    montoARS: 1000, montoUSD: null, cuotaNro: null, cuotaTotal: null,
    nroTarjeta: null, editadoManualmente: false, excluido: false,
    ...p,
  };
}

const SIN_NATURALEZA = new Map();

describe("resumenDe", () => {
  it("el pago de tarjeta NO se cuenta como gasto (evita el doble conteo)", () => {
    const r = resumenDe([
      mv({ categoria: "supermercado", montoARS: 50000 }),
      mv({ categoria: "interno", montoARS: 50000 }), // pago de la misma tarjeta
    ], "2026-08", SIN_NATURALEZA);
    expect(r.gastos).toBe(50000);
  });

  it("separa ingresos, gastos y ahorro", () => {
    const r = resumenDe([
      mv({ categoria: "ingresos", montoARS: 1_000_000 }),
      mv({ categoria: "supermercado", montoARS: 300_000 }),
      mv({ categoria: "inversion", montoARS: 200_000 }),
    ], "2026-08", SIN_NATURALEZA);
    expect(r.ingresos).toBe(1_000_000);
    expect(r.gastos).toBe(300_000);
    expect(r.ahorro).toBe(200_000);
    expect(r.sobrante).toBe(500_000);
    expect(r.tasaGasto).toBeCloseTo(0.3);
  });

  it("ignora los movimientos excluidos", () => {
    const r = resumenDe([
      mv({ montoARS: 10000 }),
      mv({ montoARS: 99999, excluido: true }),
    ], "2026-08", SIN_NATURALEZA);
    expect(r.gastos).toBe(10000);
  });

  it("no mezcla meses", () => {
    const r = resumenDe([
      mv({ periodo: "2026-08", montoARS: 1000 }),
      mv({ periodo: "2026-07", montoARS: 5000 }),
    ], "2026-08", SIN_NATURALEZA);
    expect(r.gastos).toBe(1000);
  });

  it("sin ingresos la tasa es null, no división por cero", () => {
    const r = resumenDe([mv({ montoARS: 1000 })], "2026-08", SIN_NATURALEZA);
    expect(r.tasaGasto).toBeNull();
  });

  it("reparte fijo / variable según el perfil de recurrencia", () => {
    const movs = ["2026-05", "2026-06", "2026-07", "2026-08"].flatMap((p) => [
      mv({ periodo: p, claveComercio: "NETFLIX", categoria: "servicios", montoARS: 8000 }),
    ]);
    movs.push(mv({ periodo: "2026-08", claveComercio: "FRAVEGA", categoria: "compras", montoARS: 250000 }));
    const nat = naturalezasDe(movs, ["2026-05", "2026-06", "2026-07", "2026-08"]);
    const r = resumenDe(movs, "2026-08", nat);
    expect(r.fijo).toBe(8000);
    expect(r.esporadico).toBe(250000);
  });
});

describe("gastoPorCategoria", () => {
  it("agrupa y ordena de mayor a menor", () => {
    const g = gastoPorCategoria([
      mv({ categoria: "supermercado", montoARS: 100 }),
      mv({ categoria: "supermercado", montoARS: 200 }),
      mv({ categoria: "gastronomia", montoARS: 500 }),
    ], "2026-08");
    expect(g[0].categoriaId).toBe("gastronomia");
    expect(g[1].monto).toBe(300);
    expect(g[0].porcentaje).toBeCloseTo(62.5);
  });

  it("pliega la cola larga en Otros — la paleta tiene 8 slots y no se ciclan", () => {
    const cats = ["supermercado","gastronomia","transporte","servicios","salud","compras","ocio","financiero"];
    const movs = cats.map((c, i) => mv({ categoria: c, montoARS: (cats.length - i) * 1000 }));
    const g = gastoPorCategoria(movs, "2026-08", 7);
    expect(g).toHaveLength(8);
    expect(g[7].categoriaId).toBe("__otros");
    expect(g[7].slot).toBeNull();
  });

  it("excluye ingresos e internos del desglose de gasto", () => {
    const g = gastoPorCategoria([
      mv({ categoria: "ingresos", montoARS: 999999 }),
      mv({ categoria: "interno", montoARS: 888888 }),
      mv({ categoria: "supermercado", montoARS: 1000 }),
    ], "2026-08");
    expect(g).toHaveLength(1);
    expect(g[0].monto).toBe(1000);
  });
});

describe("cuotasComprometidas", () => {
  it("proyecta las cuotas que faltan hacia los meses siguientes", () => {
    const f = cuotasComprometidas([
      mv({ periodo: "2026-08", comercio: "Frávega", montoARS: 25000, cuotaNro: 3, cuotaTotal: 12 }),
    ]);
    expect(f[0].periodo).toBe("2026-09");
    expect(f[0].monto).toBe(25000);
    expect(f[0].detalle[0].cuota).toBe("4/12");
    expect(f).toHaveLength(6); // tope por defecto
  });

  it("cruza el fin de año correctamente", () => {
    const f = cuotasComprometidas([
      mv({ periodo: "2026-11", montoARS: 1000, cuotaNro: 1, cuotaTotal: 4 }),
    ]);
    expect(f.map((x) => x.periodo)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("ignora la última cuota — ya no compromete nada", () => {
    expect(cuotasComprometidas([
      mv({ cuotaNro: 12, cuotaTotal: 12 }),
    ])).toHaveLength(0);
  });

  it("suma varias compras en cuotas en el mismo mes futuro", () => {
    const f = cuotasComprometidas([
      mv({ periodo: "2026-08", montoARS: 10000, cuotaNro: 1, cuotaTotal: 3 }),
      mv({ periodo: "2026-08", montoARS: 5000, cuotaNro: 2, cuotaTotal: 6 }),
    ]);
    expect(f[0].monto).toBe(15000);
  });
});

describe("variacionPorCategoria", () => {
  it("explica qué categoría movió la aguja entre dos meses", () => {
    const movs = [
      mv({ periodo: "2026-07", categoria: "gastronomia", montoARS: 50000 }),
      mv({ periodo: "2026-08", categoria: "gastronomia", montoARS: 120000 }),
      mv({ periodo: "2026-08", categoria: "supermercado", montoARS: 10000 }),
    ];
    const v = variacionPorCategoria(movs, "2026-07", "2026-08");
    expect(v[0].categoriaId).toBe("gastronomia");
    expect(v[0].delta).toBe(70000);
  });
});

describe("flujoSankey", () => {
  const PERIODOS = ["2026-05", "2026-06", "2026-07", "2026-08"];
  // Salud repartida: OSDE es fijo todos los meses, Farmacity es esporádico.
  const movs = [
    ...PERIODOS.map((p) => mv({ periodo: p, claveComercio: "OSDE", comercio: "OSDE",
                                categoria: "salud", montoARS: 100000 })),
    mv({ periodo: "2026-08", claveComercio: "FARMACITY", comercio: "Farmacity",
         categoria: "salud", montoARS: 40000 }),
    mv({ periodo: "2026-08", claveComercio: "COTO", comercio: "Coto",
         categoria: "supermercado", montoARS: 60000 }),
  ];
  const nat = naturalezasDe(movs, PERIODOS);
  const resumen = resumenDe(movs, "2026-08", nat);
  const flujo = flujoSankey(movs, "2026-08", nat, resumen);

  it("cada categoría del Sankey coincide EXACTO con el gráfico de barras", () => {
    const barras = new Map(
      gastoPorCategoria(movs, "2026-08", 99).map((g) => [g.nombre, g.monto]),
    );
    const entrante = new Map<string, number>();
    for (const e of flujo.enlaces) {
      const destino = flujo.nodos[e.destino];
      if (destino.nivel !== 2) continue;
      entrante.set(destino.nombre, (entrante.get(destino.nombre) ?? 0) + e.valor);
    }
    for (const [nombre, monto] of entrante) {
      expect(barras.get(nombre), nombre).toBeCloseTo(monto, 2);
    }
    expect(entrante.size).toBeGreaterThan(0);
  });

  it("una categoría partida entre naturalezas recibe varios enlaces", () => {
    const salud = flujo.nodos.findIndex((n) => n.nombre === "Salud y cuidado");
    const entrantes = flujo.enlaces.filter((e) => e.destino === salud);
    expect(entrantes.length).toBe(2); // fijo (OSDE) + esporádico (Farmacity)
    expect(entrantes.reduce((a, e) => a + e.valor, 0)).toBe(140000);
  });

  it("lo que sale de la raíz es exactamente el gasto del mes", () => {
    const desdeRaiz = flujo.enlaces
      .filter((e) => e.origen === 0)
      .reduce((a, e) => a + e.valor, 0);
    expect(desdeRaiz).toBeCloseTo(resumen.gastos, 2);
  });

  it("cada rama de naturaleza conserva su monto entre niveles", () => {
    for (const [i, n] of flujo.nodos.entries()) {
      if (n.nivel !== 1 || n.clase === "ahorro" || n.clase === "sobrante") continue;
      const entra = flujo.enlaces.filter((e) => e.destino === i).reduce((a, e) => a + e.valor, 0);
      const sale = flujo.enlaces.filter((e) => e.origen === i).reduce((a, e) => a + e.valor, 0);
      expect(sale, n.nombre).toBeCloseTo(entra, 2);
    }
  });
});

describe("flujoSankey — nodos vacíos", () => {
  it("no crea un nodo Otros si lo plegado suma cero", () => {
    // Udemy solo en dólares: su categoría queda en 0 pesos.
    const movs = [
      mv({ periodo: "2026-08", categoria: "supermercado", montoARS: 50000 }),
      mv({ periodo: "2026-08", categoria: "ocio", montoARS: 0, montoUSD: 19.99 }),
    ];
    const nat = naturalezasDe(movs, ["2026-08"]);
    const flujo = flujoSankey(movs, "2026-08", nat, resumenDe(movs, "2026-08", nat), 1);
    expect(flujo.nodos.find((n) => n.nombre === "Otros")).toBeUndefined();
  });

  it("todo nodo dibujado tiene al menos un enlace", () => {
    const movs = [
      mv({ periodo: "2026-08", categoria: "supermercado", montoARS: 50000 }),
      mv({ periodo: "2026-08", categoria: "ocio", montoARS: 0 }),
    ];
    const nat = naturalezasDe(movs, ["2026-08"]);
    const flujo = flujoSankey(movs, "2026-08", nat, resumenDe(movs, "2026-08", nat));
    const conectados = new Set(flujo.enlaces.flatMap((e) => [e.origen, e.destino]));
    flujo.nodos.forEach((n, i) => {
      expect(conectados.has(i), `nodo huérfano: ${n.nombre}`).toBe(true);
    });
  });
});

describe("consumos en dólares", () => {
  const movs = [
    mv({ periodo: "2026-08", categoria: "supermercado", montoARS: 50000 }),
    mv({ periodo: "2026-08", categoria: "ocio", montoARS: 0, montoUSD: 19.99 }),
  ];

  it("el gasto en USD se reporta aparte, no se pierde", () => {
    const r = resumenDe(movs, "2026-08", new Map());
    expect(r.gastosUSD).toBeCloseTo(19.99, 2);
    expect(r.gastos).toBe(50000); // no se mezcla con pesos sin cotización
  });

  it("una categoría con 0 pesos no aparece en el desglose", () => {
    const g = gastoPorCategoria(movs, "2026-08");
    expect(g.map((x) => x.nombre)).not.toContain("Ocio y viajes");
    expect(g).toHaveLength(1);
  });
});

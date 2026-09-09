import { describe, it, expect } from "vitest";
import type { Movimiento } from "../db/esquema";
import { HERRAMIENTAS, type ContextoDatos } from "./herramientas";

function mv(p: Partial<Movimiento>): Movimiento {
  return {
    id: Math.random().toString(36), importacionId: "i1",
    fecha: "2026-08-05", periodo: "2026-08", fechaEstimada: false,
    descripcionCruda: "X", claveComercio: "X", comercio: "X",
    categoria: "supermercado", subcategoria: null, fuenteCategoria: "semilla",
    montoARS: 1000, montoUSD: null, cuotaNro: null, cuotaTotal: null,
    nroTarjeta: null, editadoManualmente: false, excluido: false,
    ...p,
  };
}

function ctxDe(movimientos: Movimiento[], ingresos: Record<string, number> = {}): ContextoDatos {
  return {
    movimientos,
    periodos: [...new Set(movimientos.map((m) => m.periodo))].sort(),
    ingresosPorPeriodo: new Map(Object.entries(ingresos)),
  };
}

const herramienta = (nombre: string) => {
  const h = HERRAMIENTAS.find((x) => x.definicion.nombre === nombre);
  if (!h) throw new Error(`no existe ${nombre}`);
  return h;
};

const DATOS = ctxDe([
  mv({ periodo: "2026-07", fecha: "2026-07-10", montoARS: 40_000, comercio: "Coto", claveComercio: "coto" }),
  mv({ periodo: "2026-08", fecha: "2026-08-02", montoARS: 50_000, comercio: "Coto", claveComercio: "coto" }),
  mv({ periodo: "2026-08", fecha: "2026-08-03", montoARS: 12_345.67, comercio: "Café Martínez", claveComercio: "cafe martinez", categoria: "gastronomia" }),
  mv({ periodo: "2026-08", fecha: "2026-08-04", montoARS: 8_000, comercio: "Rappi", claveComercio: "rappi", categoria: "gastronomia" }),
  mv({ periodo: "2026-08", fecha: "2026-08-05", montoARS: -3_000, comercio: "Coto", claveComercio: "coto" }), // devolución
  mv({ periodo: "2026-08", fecha: "2026-08-06", montoARS: 99_999, excluido: true }),
], { "2026-08": 300_000 });

describe("resumen_del_mes", () => {
  it("devuelve la foto del mes en pesos redondeados, con los excluidos afuera", () => {
    const r = herramienta("resumen_del_mes").ejecutar({ periodo: "2026-08" }, DATOS) as Record<string, unknown>;
    expect(r.gastos).toBe(67_346); // 50000 + 12345.67 + 8000 − 3000 (la devolución resta)
    expect(r.ingresos).toBe(300_000);
    expect(r.sobrante).toBe(232_654);
    expect(r.aviso).toBeUndefined();
  });

  it("avisa cuando no hay ingresos cargados, en vez de mostrar un sobrante falso", () => {
    const r = herramienta("resumen_del_mes").ejecutar({ periodo: "2026-07" }, DATOS) as Record<string, unknown>;
    expect(r.ingresos).toBe(0);
    expect(r.aviso).toMatch(/No hay ingresos/);
  });

  it("rechaza un período que no existe y le dice al modelo cuáles hay", () => {
    expect(() => herramienta("resumen_del_mes").ejecutar({ periodo: "2026-01" }, DATOS))
      .toThrow(/Meses disponibles: 2026-07, 2026-08/);
    expect(() => herramienta("resumen_del_mes").ejecutar({ periodo: "agosto" }, DATOS))
      .toThrow(/AAAA-MM/);
  });
});

describe("buscar_movimientos", () => {
  const buscar = (entrada: Record<string, unknown>) =>
    herramienta("buscar_movimientos").ejecutar(
      { texto: null, categoria: null, periodo: null, minimo: null, maximo: null, limite: null, ...entrada },
      DATOS,
    ) as { total: number; sumaTotal: number; mostrados: number; movimientos: { comercio: string }[] };

  it("busca sin tildes y sin distinguir mayúsculas", () => {
    const r = buscar({ texto: "cafe martinez" });
    expect(r.total).toBe(1);
    expect(r.movimientos[0].comercio).toBe("Café Martínez");
  });

  it("trae la suma y el total de TODOS los que coinciden aunque recorte la lista", () => {
    const r = buscar({ texto: "coto", limite: 1 });
    expect(r.total).toBe(3);
    expect(r.sumaTotal).toBe(87_000); // 40000 + 50000 − 3000
    expect(r.mostrados).toBe(1);
    expect(r.movimientos).toHaveLength(1);
  });

  it("filtra por categoría, mes y rango de monto", () => {
    expect(buscar({ categoria: "gastronomia", periodo: "2026-08" }).total).toBe(2);
    expect(buscar({ minimo: 10_000, maximo: 20_000 }).movimientos[0].comercio).toBe("Café Martínez");
  });

  it("nunca lista un movimiento excluido", () => {
    expect(buscar({ minimo: 90_000 }).total).toBe(0);
  });
});

describe("comparar_meses", () => {
  it("compara contra el mes anterior por defecto y trae la variación en % ya calculada", () => {
    const r = herramienta("comparar_meses").ejecutar({ periodo: "2026-08", contra: null }, DATOS) as {
      contra: string; total: { antes: number; ahora: number; variacionPct: number | null };
    };
    expect(r.contra).toBe("2026-07");
    expect(r.total.antes).toBe(40_000);
    expect(r.total.ahora).toBe(67_346);
    expect(r.total.variacionPct).toBeCloseTo(68.4, 1);
  });
});

describe("las definiciones", () => {
  it("tienen esquema estricto: sin propiedades de más y todo parámetro en required", () => {
    for (const { definicion: d } of HERRAMIENTAS) {
      expect(d.parametros.additionalProperties, d.nombre).toBe(false);
      expect(new Set(d.parametros.required), d.nombre).toEqual(new Set(Object.keys(d.parametros.properties)));
    }
  });

  it("tienen nombres únicos en snake_case y una descripción que dice para qué sirve", () => {
    const nombres = HERRAMIENTAS.map((h) => h.definicion.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const h of HERRAMIENTAS) {
      expect(h.definicion.nombre).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(h.definicion.descripcion.length).toBeGreaterThan(40);
    }
  });
});

import { describe, it, expect } from "vitest";
import type { Movimiento } from "../db/esquema";
import { preguntar } from "./agente";
import { HERRAMIENTAS, type ContextoDatos } from "./herramientas";
import { proveedorFalso, dice, llama } from "./proveedores/falso";

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

const contexto: ContextoDatos = {
  movimientos: [
    mv({ periodo: "2026-07", montoARS: 40_000 }),
    mv({ periodo: "2026-08", montoARS: 50_000 }),
    mv({ periodo: "2026-08", montoARS: 19_569, categoria: "gastronomia", comercio: "Rappi", claveComercio: "rappi" }),
  ],
  periodos: ["2026-07", "2026-08"],
  ingresosPorPeriodo: new Map([["2026-08", 300_000]]),
};

const base = { herramientas: HERRAMIENTAS, contexto };

describe("el bucle del agente", () => {
  it("ejecuta lo que el modelo pide y le devuelve el resultado con el mismo id", async () => {
    const proveedor = proveedorFalso([
      llama({ nombre: "resumen_del_mes", entrada: { periodo: "2026-08" }, id: "abc" }),
      dice("En agosto gastaste $69.569."),
    ]);
    const c = await preguntar("¿cuánto gasté en agosto?", { ...base, proveedor });

    expect(c.fin).toBe("terminado");
    expect(c.vueltas).toBe(2);
    expect(c.pasos).toHaveLength(1);
    expect(c.pasos[0].resultado.id).toBe("abc");
    expect(c.pasos[0].resultado.error).toBeNull();
    expect((c.pasos[0].resultado.salida as { gastos: number }).gastos).toBe(69_569);

    // Lo que el modelo vio en la segunda vuelta: su pedido y el resultado, en ese orden.
    const segunda = proveedor.peticiones[1].mensajes;
    expect(segunda.map((m) => m.rol)).toEqual(["usuario", "asistente", "resultados"]);
    expect(c.respuesta).toBe("En agosto gastaste $69.569.");
    expect(c.sinRespaldo).toEqual([]);
  });

  it("contesta todas las llamadas de una vuelta en un solo mensaje de resultados", async () => {
    const proveedor = proveedorFalso([
      llama(
        { nombre: "resumen_del_mes", entrada: { periodo: "2026-07" }, id: "a" },
        { nombre: "resumen_del_mes", entrada: { periodo: "2026-08" }, id: "b" },
      ),
      dice("Julio $40.000, agosto $69.569."),
    ]);
    const c = await preguntar("comparame julio y agosto", { ...base, proveedor });

    const resultados = proveedor.peticiones[1].mensajes.filter((m) => m.rol === "resultados");
    expect(resultados).toHaveLength(1);
    expect(resultados[0].rol === "resultados" && resultados[0].resultados.map((r) => r.id)).toEqual(["a", "b"]);
    expect(c.pasos).toHaveLength(2);
  });

  it("una herramienta que no existe vuelve como error para el modelo, no como excepción", async () => {
    const proveedor = proveedorFalso([
      llama({ nombre: "adivinar_el_futuro", entrada: {} }),
      dice("No puedo hacer eso."),
    ]);
    const c = await preguntar("¿cuánto voy a gastar?", { ...base, proveedor });
    expect(c.pasos[0].resultado.error).toMatch(/No existe la herramienta "adivinar_el_futuro"/);
    expect(c.pasos[0].resultado.error).toMatch(/resumen_del_mes/);
    expect(c.fin).toBe("terminado");
  });

  it("una entrada inválida vuelve como error legible, para que el modelo se corrija", async () => {
    const proveedor = proveedorFalso([
      llama({ nombre: "resumen_del_mes", entrada: { periodo: "2025-01" } }),
      llama({ nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }),
      dice("Listo."),
    ]);
    const c = await preguntar("¿y en enero de 2025?", { ...base, proveedor });
    expect(c.pasos[0].resultado.error).toMatch(/Meses disponibles: 2026-07, 2026-08/);
    expect(c.pasos[1].resultado.error).toBeNull();
    expect(c.vueltas).toBe(3);
  });

  it("corta si el modelo no para de pedir herramientas", async () => {
    const proveedor = proveedorFalso(() => llama({ nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }));
    const c = await preguntar("dale que va", { ...base, proveedor, maxVueltas: 3 });
    expect(c.fin).toBe("demasiadas_vueltas");
    expect(c.vueltas).toBe(3);
    expect(proveedor.peticiones).toHaveLength(3);
  });

  it("marca los números de la respuesta que no salieron de ninguna herramienta", async () => {
    const proveedor = proveedorFalso([
      llama({ nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }),
      dice("Gastaste $69.569, o sea un 23% de tu ingreso, y te sobraron $230.431. Fueron 2 movimientos."),
    ]);
    const c = await preguntar("¿cómo me fue?", { ...base, proveedor });
    // 69.569 y 230.431 están en el resultado; 23% es de la tasa (23,2%) y entra por tolerancia;
    // "2 movimientos" es una cantidad chica y no se controla.
    expect(c.sinRespaldo).toEqual([]);

    const inventor = proveedorFalso([
      llama({ nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }),
      dice("Gastaste $69.569 y el promedio de tus últimos meses fue $54.785."),
    ]);
    const d = await preguntar("¿cómo me fue?", { ...base, proveedor: inventor });
    expect(d.sinRespaldo).toEqual(["$54.785"]);
  });

  it("no marca los números que vinieron en la pregunta", async () => {
    const proveedor = proveedorFalso([
      llama({ nombre: "resumen_del_mes", entrada: { periodo: "2026-08" } }),
      dice("No: gastaste $69.569, menos que los $100.000 que preguntás."),
    ]);
    const c = await preguntar("¿gasté más de $100.000?", { ...base, proveedor });
    expect(c.sinRespaldo).toEqual([]);
  });

  it("el sistema lleva los meses disponibles, el más reciente y las categorías", async () => {
    const proveedor = proveedorFalso([dice("Hola.")]);
    await preguntar("hola", { ...base, proveedor });
    const sistema = proveedor.peticiones[0].sistema;
    expect(sistema).toContain("Meses con datos: 2026-07, 2026-08.");
    expect(sistema).toContain("El más reciente es 2026-08 (Agosto 2026).");
    expect(sistema).toContain("- gastronomia: Gastronomía (gasto)");
    expect(sistema).toMatch(/No recomendás inversiones/);
    expect(proveedor.peticiones[0].herramientas.map((h) => h.nombre)).toContain("buscar_movimientos");
  });
});

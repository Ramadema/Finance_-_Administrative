import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parsearBBVATarjeta } from "./bbva-xls";
import type { ResultadoParseo } from "./tipos";
import { clave } from "../categorize/normalizar";
import { clasificar, cobertura } from "../categorize/motor";
import { asignarIds, fechaISO, periodoDe } from "./dedupe";
import type { Movimiento } from "../db/esquema";
import { resumenDe, cuotasComprometidas, naturalezasDe } from "../analisis/metricas";

/**
 * Regresión contra resúmenes REALES de BBVA.
 *
 * Los .xls no están en el repo —son datos financieros personales y el remote es
 * público, así que `.gitignore` los bloquea— y por eso el bloque se saltea solo
 * si no están. Localmente, con los archivos en `samples/`, esto es la única red
 * que atrapa las rarezas que ningún archivo sintético reproduce: la columna de
 * tarjeta vacía, el 01/01/0001, los importes negativos y el nombre de hoja que
 * miente sobre el período.
 *
 * Los totales están escritos a mano leyendo el Excel, no copiados de la salida
 * del parser: si se copiaran, el test pasaría incluso con el parser roto.
 */

const CASOS = [
  {
    archivo: "samples/Últimos movimientos (1).xls",
    totalARS: 964547.39,
    totalUSD: 29.85,
    movimientos: 32,
    periodo: "2026-06",
    cierre: "2026-07-02",
    tarjetas: ["****8423", "****7527"],
    sinFecha: 2,
    negativos: 2,
  },
  {
    archivo: "samples/Últimos movimientos (2).xls",
    totalARS: 515925.79,
    totalUSD: 49.49,
    movimientos: 32,
    periodo: "2026-07",
    cierre: "2026-07-30",
    tarjetas: ["****8423"],
    sinFecha: 0,
    negativos: 0,
  },
];

function parsear(ruta: string): ResultadoParseo {
  const b = readFileSync(ruta);
  return parsearBBVATarjeta(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
  );
}

const hayArchivos = CASOS.every((c) => existsSync(c.archivo));

describe.skipIf(!hayArchivos)("resúmenes reales de BBVA", () => {
  for (const caso of CASOS) {
    describe(caso.archivo.split("/").pop()!, () => {
      // Perezoso a propósito: `describe.skipIf` igual corre este cuerpo para
      // recolectar los tests, así que leer el archivo acá reventaría el archivo
      // entero cuando los .xls no están, en vez de saltearlo.
      let cache: ResultadoParseo | null = null;
      const res = () => (cache ??= parsear(caso.archivo));

      it("parsea sin error", () => {
        expect(res().error).toBeNull();
        expect(res().movimientos).toHaveLength(caso.movimientos);
      });

      it("la suma da exactamente el total que declara el archivo", () => {
        expect(res().totalDeclarado.ars).toBe(caso.totalARS);
        expect(res().totalCalculado.ars).toBe(caso.totalARS);
        expect(res().totalCalculado.usd).toBe(caso.totalUSD);
        expect(res().validacion.cuadra).toBe(true);
      });

      it("atribuye el resumen al mes de sus consumos", () => {
        expect(res().periodo).toBe(caso.periodo);
        expect(res().fechaCierre).toBe(caso.cierre);
      });

      it("reparte los consumos entre las tarjetas del resumen", () => {
        expect(res().subtotales.map((s) => s.nroTarjeta)).toEqual(caso.tarjetas);
        expect(res().subtotales.every((s) => s.cuadra)).toBe(true);
        // Ningún consumo queda huérfano: todos caen bajo alguna tarjeta.
        expect(res().movimientos.every((m) => m.nroTarjeta !== null)).toBe(true);
        const suma = res().subtotales.reduce((a, s) => a + s.calculadoARS, 0);
        expect(+suma.toFixed(2)).toBe(caso.totalARS);
      });

      it("no genera períodos fantasma", () => {
        // El bug original: 01/01/0001 se expandía a 2001 y aparecía un mes
        // falso en el selector.
        expect(res().movimientos.every((m) => m.fecha.getFullYear() >= 2020)).toBe(true);
        expect(res().movimientos.filter((m) => m.fechaEstimada)).toHaveLength(caso.sinFecha);
      });

      it("conserva el signo de las devoluciones", () => {
        expect(res().movimientos.filter((m) => (m.importeARS ?? 0) < 0)).toHaveLength(
          caso.negativos,
        );
      });

      it("no inventa advertencias sobre las filas de subtotal", () => {
        expect(res().advertencias.join(" ")).not.toMatch(/ilegible|sin importe/i);
      });

      it("categoriza al menos dos tercios de los consumos", () => {
        const cob = cobertura(res().movimientos.map((m) => clasificar(m.establecimiento)));
        expect(cob.porcentaje).toBeGreaterThanOrEqual(65);
      });
    });
  }

  it("dos resúmenes bajados el mismo día caen en meses distintos", () => {
    // Los dos archivos traen la MISMA hoja ("Mov_Periodo_29-08-2026"): sacar el
    // período de ahí los pisaba en un solo mes.
    const periodos = CASOS.map((c) => parsear(c.archivo).periodo);
    expect(new Set(periodos).size).toBe(CASOS.length);
  });

  it("cada resumen queda con su total exacto después de importar los dos", () => {
    // El pipeline entero, como lo hace `importarArchivo`. Antes las cuotas se
    // atribuían a la fecha de COMPRA: las tres de mayo caían todas en 2026-05,
    // ese mes salía con la misma compra repetida una vez por archivo, y junio y
    // julio —los meses que realmente las pagan— salían de menos.
    const movimientos = pipeline();
    const periodos = [...new Set(movimientos.map((m) => m.periodo))].sort();
    expect(periodos).toEqual(["2026-06", "2026-07"]);

    const nat = naturalezasDe(movimientos, periodos);
    for (const caso of CASOS) {
      const r = resumenDe(movimientos, caso.periodo, nat);
      expect(r.cantidadMovimientos).toBe(caso.movimientos);
      expect(r.gastos).toBeCloseTo(caso.totalARS, 2);
      expect(r.gastosUSD).toBeCloseTo(caso.totalUSD, 2);
    }
  });

  it("una compra en cuotas presente en los dos resúmenes no se proyecta doble", () => {
    const futuro = cuotasComprometidas(pipeline());

    // 2026-07 ya está importado: sus cuotas son gasto real, no compromiso.
    expect(futuro.map((f) => f.periodo)).not.toContain("2026-07");

    for (const mes of futuro) {
      const comercios = mes.detalle.map((d) => d.comercio);
      expect(new Set(comercios).size).toBe(comercios.length);
    }
    // Las tres cuotas vivas: Zentra, Nescafé y Frávega.
    expect(futuro[0].detalle).toHaveLength(3);
  });

  it("el mismo comercio conserva la clave entre meses", () => {
    // Cursor llega con un id de operación distinto cada mes. Si el id entra en
    // la clave son dos comercios, y la suscripción nunca se detecta como fija.
    const claves = CASOS.map((c) => {
      const m = parsear(c.archivo).movimientos.find((x) =>
        x.establecimiento.toUpperCase().startsWith("CURSOR"),
      );
      return m ? clave(m.establecimiento) : null;
    });
    expect(claves[0]).toBe("CURSOR AI POWER");
    expect(new Set(claves).size).toBe(1);
  });
});

/** Replica lo que hace `importarArchivo` con los dos archivos, sin IndexedDB. */
function pipeline(): Movimiento[] {
  const out: Movimiento[] = [];
  for (const caso of CASOS) {
    const r = parsear(caso.archivo);
    const ids = asignarIds(r.movimientos);
    r.movimientos.forEach((m, i) => {
      const c = clasificar(m.establecimiento);
      out.push({
        id: ids[i],
        importacionId: caso.archivo,
        fecha: fechaISO(m.fecha),
        periodo: r.periodo ?? periodoDe(m.fecha),
        fechaEstimada: m.fechaEstimada,
        descripcionCruda: m.establecimiento,
        claveComercio: c.claveComercio,
        comercio: c.comercio,
        categoria: c.categoria,
        subcategoria: c.subcategoria,
        fuenteCategoria: c.fuente,
        montoARS: m.importeARS ?? 0,
        montoUSD: m.importeUSD,
        cuotaNro: m.cuotaNro,
        cuotaTotal: m.cuotaTotal,
        nroTarjeta: m.nroTarjeta,
        editadoManualmente: false,
        excluido: false,
      });
    });
  }
  return out;
}

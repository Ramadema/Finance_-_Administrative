import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsearBBVATarjeta } from "@/lib/ingest/bbva-xls";
import { clasificar, cobertura } from "@/lib/categorize/motor";
import { perfilarRecurrencia } from "@/lib/categorize/recurrencia";

const ARCHIVOS = ["2026-05","2026-06","2026-07","2026-08"];

describe("demo end-to-end", () => {
  const parseos = ARCHIVOS.map((p) => {
    const b = readFileSync(`samples/demo-bbva-${p}.xls`);
    return parsearBBVATarjeta(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  });

  it("los 4 archivos parsean y CUADRAN con su total declarado", () => {
    parseos.forEach((r, i) => {
      expect(r.error, ARCHIVOS[i]).toBeNull();
      expect(r.validacion.cuadra, `${ARCHIVOS[i]} dif=${r.validacion.difARS}`).toBe(true);
      expect(r.movimientos.length).toBe(16);
    });
  });

  it("la cobertura de categorización supera el 90%", () => {
    const todas = parseos.flatMap((r) => r.movimientos.map((m) => clasificar(m.establecimiento)));
    const c = cobertura(todas);
    console.log(`   → cobertura: ${c.porcentaje}% (${c.categorizados}/${c.total})`);
    const sueltos = [...new Set(todas.filter((x) => x.fuente === "ninguna").map((x) => x.comercio))];
    if (sueltos.length) console.log("   → sin categorizar:", sueltos.join(", "));
    expect(c.porcentaje).toBeGreaterThanOrEqual(90);
  });

  it("detecta las suscripciones y la que aumentó", () => {
    const movs = parseos.flatMap((r, i) =>
      r.movimientos.map((m) => {
        const c = clasificar(m.establecimiento);
        return { claveComercio: c.claveComercio, comercio: c.comercio, categoria: c.categoria,
                 periodo: ARCHIVOS[i], montoARS: m.importeARS ?? 0 };
      }));
    const perfiles = perfilarRecurrencia(movs, ARCHIVOS);
    const subs = perfiles.filter((p) => p.esSuscripcion);
    console.log(`   → ${subs.length} gastos fijos:`, subs.map((s) => s.comercio).join(", "));

    const alertas = perfiles.filter((p) => p.alertaAumento);
    console.log(`   → alertas de aumento:`, alertas.map((a) => `${a.comercio} +${a.aumentoPct}%`).join(", "));

    expect(subs.length).toBeGreaterThanOrEqual(6);
    expect(alertas.some((a) => a.comercio === "Spotify")).toBe(true);
  });

  it("detecta las compras en cuotas", () => {
    const conCuotas = parseos.flatMap((r) => r.movimientos).filter((m) => m.cuotaTotal !== null);
    console.log(`   → ${conCuotas.length} compras en cuotas`);
    expect(conCuotas.length).toBeGreaterThanOrEqual(4);
  });
});

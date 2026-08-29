import { describe, it, expect } from "vitest";
import { asignarIds, hashArchivo, periodoDe } from "./dedupe";
import type { MovimientoCrudo } from "./tipos";

function m(desc: string, dia: number, monto: number): MovimientoCrudo {
  return {
    nroTarjeta: "**** 4321",
    fecha: new Date(2026, 7, dia),
    establecimiento: desc,
    cuotaNro: null,
    cuotaTotal: null,
    importeARS: monto,
    importeUSD: null,
    fechaEstimada: false,
  };
}

describe("asignarIds", () => {
  it("reimportar el mismo archivo da los mismos ids (idempotente)", () => {
    const lote = [m("COTO", 5, 10000), m("RAPPI", 6, 5000)];
    expect(asignarIds(lote)).toEqual(asignarIds(lote));
  });

  it("dos cafés iguales el mismo día son DOS movimientos, no uno", () => {
    const ids = asignarIds([m("STARBUCKS", 5, 4500), m("STARBUCKS", 5, 4500)]);
    expect(new Set(ids).size).toBe(2);
    expect(ids[1]).toMatch(/#2$/);
  });

  it("distingue por importe, fecha y comercio", () => {
    const ids = asignarIds([m("COTO", 5, 10000), m("COTO", 5, 20000), m("COTO", 6, 10000)]);
    expect(new Set(ids).size).toBe(3);
  });

  it("las variantes del mismo comercio colapsan a la misma firma", () => {
    const a = asignarIds([m("MERPAGO*RAPPI 999", 5, 5000)])[0];
    const b = asignarIds([m("RAPPI ARGENTINA S.A.", 5, 5000)])[0];
    expect(a).toBe(b);
  });
});

describe("hashArchivo", () => {
  it("el mismo contenido da el mismo hash", () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    expect(hashArchivo(buf)).toBe(hashArchivo(new Uint8Array([1, 2, 3, 4, 5]).buffer));
  });
  it("contenido distinto, hash distinto", () => {
    expect(hashArchivo(new Uint8Array([1, 2, 3]).buffer))
      .not.toBe(hashArchivo(new Uint8Array([3, 2, 1]).buffer));
  });
});

describe("periodoDe", () => {
  it("formatea AAAA-MM con cero adelante", () => {
    expect(periodoDe(new Date(2026, 0, 15))).toBe("2026-01");
    expect(periodoDe(new Date(2026, 11, 1))).toBe("2026-12");
  });
});

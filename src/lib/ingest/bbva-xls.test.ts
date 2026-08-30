import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { parsearBBVATarjeta } from "./bbva-xls";

/** Arma un .xls en memoria con el layout exacto de BBVA. */
function xlsFalso(filas: unknown[][], nombreHoja = "Mov_Periodo_31-07-2026"): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filas);
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  const buf = XLSX.write(wb, { type: "array", bookType: "xls" });
  return buf as ArrayBuffer;
}

const HEADER = [
  "Nro. Tarjeta", "Fecha", "Establecimiento", "Cuota", "Importe en $ ", "Importe en U$S",
];

describe("parsearBBVATarjeta — archivo real de BBVA", () => {
  const buf = readFileSync("samples/bbva-tarjeta-vacio.xls");
  const res = parsearBBVATarjeta(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  );

  it("lo reconoce como export de tarjeta BBVA", () => {
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(res.origen).toBe("bbva-tarjeta-xls");
  });

  it("sin movimientos no inventa período", () => {
    // El nombre de hoja trae la fecha de DESCARGA, no el período del resumen.
    // Usarlo haría que dos resúmenes bajados el mismo día colapsen en un mes.
    expect(res.periodo).toBeNull();
  });

  it("lee la fila de total como checksum", () => {
    expect(res.totalDeclarado).toEqual({ ars: 0, usd: 0 });
  });

  it("avisa que está vacío en vez de fingir que importó algo", () => {
    expect(res.movimientos).toHaveLength(0);
    expect(res.advertencias.join(" ")).toMatch(/no tiene movimientos/i);
  });
});

describe("parsearBBVATarjeta — camino feliz", () => {
  const res = parsearBBVATarjeta(
    xlsFalso([
      ["Movimientos del Período"],
      HEADER,
      ["**** 4321", "05/07/2026", "MERPAGO*RAPPI", "", "12.450,00", ""],
      ["**** 4321", "08/07/2026", "COTO CICSA", "", "87.320,55", ""],
      ["**** 4321", "12/07/2026", "NETFLIX.COM", "", "", "14,99"],
      ["**** 4321", "15/07/2026", "FRAVEGA SA", "03/12", "25.000,00", ""],
      ["", "", "Monto total de los Movimientos del período", "", "124.770,55", "14,99"],
    ]),
  );

  it("extrae todos los movimientos", () => {
    expect(res.movimientos).toHaveLength(4);
  });

  it("aplica el formato argentino a los importes", () => {
    expect(res.movimientos[0].importeARS).toBe(12450);
    expect(res.movimientos[1].importeARS).toBe(87320.55);
  });

  it("separa pesos de dólares", () => {
    const netflix = res.movimientos[2];
    expect(netflix.importeARS).toBeNull();
    expect(netflix.importeUSD).toBe(14.99);
  });

  it("parsea las cuotas", () => {
    const fravega = res.movimientos[3];
    expect(fravega.cuotaNro).toBe(3);
    expect(fravega.cuotaTotal).toBe(12);
    expect(res.movimientos[0].cuotaTotal).toBeNull();
  });

  it("parsea fechas DD/MM/AAAA", () => {
    expect(res.movimientos[0].fecha.getFullYear()).toBe(2026);
    expect(res.movimientos[0].fecha.getMonth()).toBe(6); // julio
    expect(res.movimientos[0].fecha.getDate()).toBe(5);
  });

  it("el checksum cuadra", () => {
    expect(res.totalCalculado.ars).toBeCloseTo(124770.55, 2);
    expect(res.validacion.cuadra).toBe(true);
    expect(res.advertencias).toHaveLength(0);
  });

  it("conserva la descripción cruda del banco", () => {
    expect(res.movimientos[0].establecimiento).toBe("MERPAGO*RAPPI");
  });
});

describe("parsearBBVATarjeta — detección de errores", () => {
  it("detecta cuando la suma NO cuadra con el total declarado", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        HEADER,
        ["**** 1", "05/07/2026", "COMERCIO A", "", "10.000,00", ""],
        ["", "", "Monto total de los Movimientos del período", "", "99.999,00", ""],
      ]),
    );
    expect(res.validacion.cuadra).toBe(false);
    expect(res.advertencias.join(" ")).toMatch(/no cuadra/i);
  });

  it("encuentra las columnas aunque cambien de orden", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        ["Fecha", "Importe en $ ", "Establecimiento", "Cuota"],
        ["05/07/2026", "1.500,00", "KIOSCO", ""],
      ]),
    );
    expect(res.movimientos).toHaveLength(1);
    expect(res.movimientos[0].establecimiento).toBe("KIOSCO");
    expect(res.movimientos[0].importeARS).toBe(1500);
  });

  it("tolera tildes y mayúsculas en los encabezados", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        ["FECHA", "ESTABLECIMIENTO", "IMPORTE EN $"],
        ["05/07/2026", "FARMACITY", "3.200,00"],
      ]),
    );
    expect(res.movimientos).toHaveLength(1);
    expect(res.movimientos[0].importeARS).toBe(3200);
  });

  it("omite filas con fecha inválida pero sigue con el resto", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        HEADER,
        ["**** 1", "31/02/2026", "FECHA IMPOSIBLE", "", "1.000,00", ""],
        ["**** 1", "05/07/2026", "COMERCIO OK", "", "2.000,00", ""],
      ]),
    );
    expect(res.movimientos).toHaveLength(1);
    expect(res.movimientos[0].establecimiento).toBe("COMERCIO OK");
    expect(res.advertencias.join(" ")).toMatch(/fecha ilegible/i);
  });

  it("rechaza un archivo que no es de BBVA", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([["Cosa", "Otra"], ["a", "b"]]),
    );
    expect(res.error).toBeTruthy();
    expect(res.error).toMatch(/no encontr/i);
  });

  it("no explota con un archivo corrupto", () => {
    const res = parsearBBVATarjeta(new Uint8Array([1, 2, 3, 4]).buffer);
    expect(res.error).toBeTruthy();
    expect(res.movimientos).toHaveLength(0);
  });
});

describe("parsearBBVATarjeta — rarezas que solo aparecen en resúmenes reales", () => {
  it("asigna cada consumo a la tarjeta que cierra su sección", () => {
    // La columna \"Nro. Tarjeta\" viene vacía en los consumos: el número está
    // en la fila de subtotal, DESPUÉS de ellos.
    const res = parsearBBVATarjeta(
      xlsFalso([
        HEADER,
        ["", "05/07/2026", "COMERCIO A", "/", "10.000,00", ""],
        ["", "06/07/2026", "COMERCIO B", "/", "5.000,00", ""],
        ["Total Tarjeta Nro ****8423", "", "", "", "15.000,00", "0,00"],
        ["", "07/07/2026", "COMERCIO C", "/", "2.000,00", ""],
        ["Total Tarjeta Nro ****7527", "", "", "", "2.000,00", "0,00"],
        ["", "", "Monto total de los Movimientos del período", "", "17.000,00", "0,00"],
      ]),
    );

    expect(res.movimientos.map((m) => m.nroTarjeta)).toEqual([
      "****8423", "****8423", "****7527",
    ]);
    expect(res.subtotales).toHaveLength(2);
    expect(res.subtotales.every((s) => s.cuadra)).toBe(true);
    expect(res.validacion.cuadra).toBe(true);
  });

  it("la fila de subtotal no se cuenta como movimiento ni como error", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        HEADER,
        ["", "05/07/2026", "COMERCIO A", "/", "10.000,00", ""],
        ["Total Tarjeta Nro ****8423", "", "", "", "10.000,00", "0,00"],
        ["", "", "Monto total de los Movimientos del período", "", "10.000,00", "0,00"],
      ]),
    );
    expect(res.movimientos).toHaveLength(1);
    expect(res.advertencias).toHaveLength(0);
  });

  it("avisa cuando el subtotal de una tarjeta no cuadra con sus consumos", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        HEADER,
        ["", "05/07/2026", "COMERCIO A", "/", "10.000,00", ""],
        ["Total Tarjeta Nro ****8423", "", "", "", "99.999,00", "0,00"],
      ]),
    );
    expect(res.subtotales[0].cuadra).toBe(false);
    expect(res.advertencias.join(" ")).toMatch(/subtotal de la tarjeta/i);
  });

  it("01/01/0001 no es una fecha: no inventa un período de 2001", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        HEADER,
        ["", "05/07/2026", "COMERCIO A", "/", "10.000,00", ""],
        ["", "01/01/0001", "", "/", "-2.000,00", ""],
        ["", "", "Monto total de los Movimientos del período", "", "8.000,00", "0,00"],
      ]),
    );

    const ajuste = res.movimientos[1];
    expect(ajuste.fechaEstimada).toBe(true);
    expect(ajuste.fecha.getFullYear()).toBe(2026); // el cierre, no el año 1
    expect(res.movimientos.every((m) => m.fecha.getFullYear() === 2026)).toBe(true);
    expect(res.advertencias.join(" ")).toMatch(/sin fecha/i);
  });

  it("respeta el signo: una devolución resta y el checksum cuadra", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([
        HEADER,
        ["", "05/07/2026", "COMERCIO A", "/", "10.000,00", ""],
        ["", "06/07/2026", "DEVOLUCION", "/", "-2.000,00", ""],
        ["", "", "Monto total de los Movimientos del período", "", "8.000,00", "0,00"],
      ]),
    );
    expect(res.movimientos[1].importeARS).toBe(-2000);
    expect(res.totalCalculado.ars).toBe(8000);
    expect(res.validacion.cuadra).toBe(true);
  });

  it("el período sale de los consumos, no del nombre de hoja", () => {
    // Hoja fechada en agosto, consumos de junio: es el resumen de junio.
    const res = parsearBBVATarjeta(
      xlsFalso(
        [
          HEADER,
          ["", "10/06/2026", "COMERCIO A", "/", "1.000,00", ""],
          ["", "20/06/2026", "COMERCIO B", "/", "1.000,00", ""],
          ["", "02/07/2026", "PERCEPCION", "/", "100,00", ""],
          ["", "14/05/2026", "CUOTA VIEJA", "2/12", "500,00", ""],
        ],
        "Mov_Periodo_29-08-2026",
      ),
    );
    expect(res.periodo).toBe("2026-06");
    expect(res.fechaCierre).toBe("2026-07-02");
  });

  it("\"/\" en la columna Cuota significa sin cuotas", () => {
    const res = parsearBBVATarjeta(
      xlsFalso([HEADER, ["", "05/07/2026", "COMERCIO A", "/", "1.000,00", ""]]),
    );
    expect(res.movimientos[0].cuotaNro).toBeNull();
    expect(res.movimientos[0].cuotaTotal).toBeNull();
  });
});

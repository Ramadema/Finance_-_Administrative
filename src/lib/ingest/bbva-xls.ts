import * as XLSX from "xlsx";
import { parseImporteAR } from "./numero";
import type {
  MovimientoCrudo,
  ResultadoParseo,
  TotalesDeclarados,
} from "./tipos";

/**
 * Parser del export "Últimos movimientos" de BBVA Argentina (.xls BIFF8).
 *
 * Esquema confirmado sobre un archivo real:
 *   Movimientos del Período
 *   Nro. Tarjeta | Fecha | Establecimiento | Cuota | Importe en $ | Importe en U$S
 *   ...filas...
 *   Monto total de los Movimientos del período | | | | 0,00 | 0,00
 *
 * Las columnas se buscan POR NOMBRE, no por posición: si BBVA agrega o mueve
 * una columna el parser sigue andando. La fila de total se usa como checksum.
 */

/** Normaliza un encabezado: sin tildes, minúsculas, sin espacios de más. */
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Alias aceptados por columna, en orden de preferencia. */
const COLUMNAS = {
  nroTarjeta: ["nro. tarjeta", "nro tarjeta", "numero de tarjeta", "tarjeta"],
  fecha: ["fecha", "fecha consumo", "fecha de operacion"],
  establecimiento: ["establecimiento", "descripcion", "concepto", "detalle"],
  cuota: ["cuota", "cuotas"],
  importeARS: ["importe en $", "importe en pesos", "importe $", "pesos"],
  importeUSD: ["importe en u$s", "importe en dolares", "importe u$s", "dolares"],
} as const;

type ClaveColumna = keyof typeof COLUMNAS;

/** Ubica la fila de encabezados y mapea cada columna a su índice. */
function detectarEncabezado(filas: unknown[][]): {
  fila: number;
  mapa: Partial<Record<ClaveColumna, number>>;
} | null {
  const limite = Math.min(filas.length, 20); // el header vive arriba de todo
  for (let i = 0; i < limite; i++) {
    const celdas = (filas[i] ?? []).map(norm);
    const mapa: Partial<Record<ClaveColumna, number>> = {};

    for (const [clave, alias] of Object.entries(COLUMNAS) as [
      ClaveColumna,
      readonly string[],
    ][]) {
      const idx = celdas.findIndex((c) => c !== "" && alias.includes(c));
      if (idx !== -1) mapa[clave] = idx;
    }

    // Mínimo viable para considerarlo un encabezado real.
    if (mapa.fecha !== undefined && mapa.establecimiento !== undefined) {
      return { fila: i, mapa };
    }
  }
  return null;
}

/** Fechas: Date de SheetJS, o texto DD/MM/AAAA | DD-MM-AAAA | DD/MM/AA. */
function parseFecha(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v ?? "").trim();
  if (!s) return null;

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += anio < 70 ? 2000 : 1900;

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(anio, mes - 1, dia);
  // Rechaza overflow tipo 31/02 que Date "corrige" en silencio.
  if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
}

/** "03/12" → { nro: 3, total: 12 }. Vacío o "-" → sin cuotas. */
function parseCuota(v: unknown): { nro: number | null; total: number | null } {
  const s = String(v ?? "").trim();
  if (!s || s === "-" || s === "0") return { nro: null, total: null };
  const m = s.match(/(\d{1,2})\s*[/de\s]+\s*(\d{1,2})/i);
  if (!m) return { nro: null, total: null };
  const nro = Number(m[1]);
  const total = Number(m[2]);
  if (!total || nro > total) return { nro: null, total: null };
  return { nro, total };
}

/** Del nombre de hoja "Mov_Periodo_28-08-2026" saca "2026-08". */
function parsePeriodo(nombreHoja: string): string | null {
  const m = nombreHoja.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2]}`;
  return null;
}

/** Detecta la fila de totales que BBVA agrega al final. */
function esFilaTotal(fila: unknown[]): boolean {
  return fila.some((c) => norm(c).startsWith("monto total"));
}

const TOLERANCIA = 0.05; // centavos de redondeo acumulado

export function parsearBBVATarjeta(buffer: ArrayBuffer): ResultadoParseo {
  const base: ResultadoParseo = {
    ok: false,
    origen: "desconocido",
    periodo: null,
    movimientos: [],
    totalDeclarado: { ars: null, usd: null },
    totalCalculado: { ars: 0, usd: 0 },
    validacion: { cuadra: false, difARS: 0, difUSD: 0, tolerancia: TOLERANCIA },
    advertencias: [],
    error: null,
  };

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  } catch {
    return { ...base, error: "No se pudo abrir el archivo. ¿Es un Excel de BBVA?" };
  }

  const nombreHoja = wb.SheetNames[0];
  if (!nombreHoja) return { ...base, error: "El archivo no tiene ninguna hoja." };

  const ws = wb.Sheets[nombreHoja];
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const encabezado = detectarEncabezado(filas);
  if (!encabezado) {
    return {
      ...base,
      error:
        "No encontré las columnas esperadas (Fecha / Establecimiento). " +
        "¿Seguro es el export de movimientos de BBVA?",
    };
  }

  const { fila: filaHeader, mapa } = encabezado;
  const advertencias: string[] = [];
  const movimientos: MovimientoCrudo[] = [];
  const totalDeclarado: TotalesDeclarados = { ars: null, usd: null };

  const leer = (fila: unknown[], clave: ClaveColumna): unknown => {
    const i = mapa[clave];
    return i === undefined ? "" : fila[i];
  };

  for (let i = filaHeader + 1; i < filas.length; i++) {
    const fila = filas[i] ?? [];

    if (esFilaTotal(fila)) {
      totalDeclarado.ars = parseImporteAR(leer(fila, "importeARS"));
      totalDeclarado.usd = parseImporteAR(leer(fila, "importeUSD"));
      continue;
    }

    const establecimiento = String(leer(fila, "establecimiento") ?? "").trim();
    const importeARS = parseImporteAR(leer(fila, "importeARS"));
    const importeUSD = parseImporteAR(leer(fila, "importeUSD"));

    // Fila vacía de relleno: ni descripción ni importes.
    if (!establecimiento && importeARS === null && importeUSD === null) continue;

    const fecha = parseFecha(leer(fila, "fecha"));
    if (!fecha) {
      advertencias.push(
        `Fila ${i + 1}: fecha ilegible ("${String(leer(fila, "fecha"))}"). Se omitió.`,
      );
      continue;
    }
    if (importeARS === null && importeUSD === null) {
      advertencias.push(`Fila ${i + 1}: "${establecimiento}" sin importe. Se omitió.`);
      continue;
    }

    const cuota = parseCuota(leer(fila, "cuota"));
    const tarjeta = String(leer(fila, "nroTarjeta") ?? "").trim();

    movimientos.push({
      nroTarjeta: tarjeta || null,
      fecha,
      establecimiento,
      cuotaNro: cuota.nro,
      cuotaTotal: cuota.total,
      importeARS,
      importeUSD,
    });
  }

  const totalCalculado = movimientos.reduce(
    (acc, m) => ({
      ars: acc.ars + (m.importeARS ?? 0),
      usd: acc.usd + (m.importeUSD ?? 0),
    }),
    { ars: 0, usd: 0 },
  );

  // Checksum: la suma tiene que dar el total que declara el propio archivo.
  const difARS =
    totalDeclarado.ars === null ? 0 : +(totalCalculado.ars - totalDeclarado.ars).toFixed(2);
  const difUSD =
    totalDeclarado.usd === null ? 0 : +(totalCalculado.usd - totalDeclarado.usd).toFixed(2);
  const cuadra = Math.abs(difARS) <= TOLERANCIA && Math.abs(difUSD) <= TOLERANCIA;

  if (totalDeclarado.ars === null && totalDeclarado.usd === null) {
    advertencias.push(
      "El archivo no trae fila de total, así que no pude verificar la suma.",
    );
  } else if (!cuadra) {
    advertencias.push(
      `La suma no cuadra con el total del archivo (dif: $${difARS} / U$S ${difUSD}). ` +
        "Revisá los movimientos antes de importar.",
    );
  }
  if (movimientos.length === 0) {
    advertencias.push(
      "El archivo no tiene movimientos. En BBVA, 'Últimos movimientos' trae el " +
        "período en curso: si la tarjeta cerró recién, sale vacío. Descargá un resumen cerrado.",
    );
  }

  return {
    ok: true,
    origen: "bbva-tarjeta-xls",
    periodo: parsePeriodo(nombreHoja),
    movimientos,
    totalDeclarado,
    totalCalculado,
    validacion: { cuadra, difARS, difUSD, tolerancia: TOLERANCIA },
    advertencias,
    error: null,
  };
}

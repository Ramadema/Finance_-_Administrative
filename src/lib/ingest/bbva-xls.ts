import * as XLSX from "xlsx";
import { parseImporteAR } from "./numero";
import type {
  MovimientoCrudo,
  ResultadoParseo,
  SubtotalTarjeta,
  TotalesDeclarados,
} from "./tipos";

/**
 * Parser del export "Últimos movimientos" de BBVA Argentina (.xls BIFF8).
 *
 * Estructura real, confirmada contra resúmenes con movimientos de verdad:
 *
 *   Movimientos del Período
 *   Nro. Tarjeta | Fecha | Establecimiento | Cuota | Importe en $ | Importe en U$S
 *   <consumos de la primera tarjeta>
 *   Total Tarjeta Nro ****8423 |  |  |  | 934.174,39 | 29,85
 *   <consumos de la segunda tarjeta>
 *   Total Tarjeta Nro ****7527 |  |  |  |  30.373,00 |  0,00
 *      |  | Monto total de los Movimientos del período |  | 964.547,39 | 29,85
 *
 * Cuatro cosas que solo aparecen con datos reales, y que el parser tiene que
 * respetar o los números salen mal en silencio:
 *
 * 1. La columna "Nro. Tarjeta" viene VACÍA en cada consumo. El número aparece
 *    recién en la fila que CIERRA la sección de cada tarjeta, así que a qué
 *    tarjeta pertenece un consumo se resuelve hacia atrás, no leyendo la fila.
 * 2. Los importes vienen CON SIGNO y su suma aritmética da el total declarado.
 *    Las devoluciones son negativas: pasarlas por Math.abs las convertiría en
 *    gasto y además rompería el checksum.
 * 3. Los ajustes salen con fecha 01/01/0001, que no es una fecha sino el hueco.
 *    Leída literal genera un período fantasma de 2001 en el selector de meses.
 * 4. El nombre de hoja ("Mov_Periodo_29-08-2026") es la fecha de DESCARGA, no
 *    el período del resumen. Dos resúmenes bajados el mismo día traen el mismo
 *    nombre, así que el período se deduce de los movimientos.
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

/**
 * Antes de este año no hay tarjeta que valga: cualquier fecha por debajo es el
 * centinela de "sin fecha" que usa el banco (01/01/0001), no un dato.
 */
const ANIO_MINIMO = 1990;

type Fecha =
  | { tipo: "ok"; valor: Date }
  /** El banco no trajo fecha. Se completa con el cierre del resumen. */
  | { tipo: "sin-fecha" }
  /** Había algo escrito y no es una fecha. La fila se descarta con aviso. */
  | { tipo: "ilegible" };

/** Fechas: Date de SheetJS, o texto DD/MM/AAAA | DD-MM-AAAA | DD/MM/AA. */
function parseFecha(v: unknown): Fecha {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.getFullYear() < ANIO_MINIMO ? { tipo: "sin-fecha" } : { tipo: "ok", valor: v };
  }
  const s = String(v ?? "").trim();
  if (!s) return { tipo: "sin-fecha" };

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return { tipo: "ilegible" };

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio = Number(m[3]);
  // Solo el formato de 2 dígitos es ambiguo. "0001" es 1, no 2001: expandirlo
  // era el origen del período fantasma.
  if (m[3].length <= 2) anio += anio < 70 ? 2000 : 1900;

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return { tipo: "ilegible" };
  if (anio < ANIO_MINIMO) return { tipo: "sin-fecha" };

  const d = new Date(anio, mes - 1, dia);
  // Rechaza overflow tipo 31/02 que Date "corrige" en silencio.
  if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return { tipo: "ilegible" };
  return { tipo: "ok", valor: d };
}

/** "03/12" → { nro: 3, total: 12 }. Vacío, "-" o "/" → sin cuotas. */
function parseCuota(v: unknown): { nro: number | null; total: number | null } {
  const s = String(v ?? "").trim();
  if (!s || s === "-" || s === "/" || s === "0") return { nro: null, total: null };
  const m = s.match(/(\d{1,2})\s*[/de\s]+\s*(\d{1,2})/i);
  if (!m) return { nro: null, total: null };
  const nro = Number(m[1]);
  const total = Number(m[2]);
  if (!total || nro > total) return { nro: null, total: null };
  return { nro, total };
}

/** Del nombre de hoja "Mov_Periodo_29-08-2026" saca la fecha de descarga. */
function fechaDeHoja(nombreHoja: string): Date | null {
  const m = nombreHoja.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function periodoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * A qué mes pertenece el resumen.
 *
 * No se puede usar el nombre de hoja (es la fecha de descarga) ni la fecha de
 * cierre: dos resúmenes consecutivos pueden cerrar dentro del mismo mes — los
 * de prueba cierran el 02/07 y el 30/07 — y colapsarían en un solo período.
 *
 * El mes donde cae la mayoría de los consumos sí los separa, y además es el que
 * coincide con cómo uno los llama ("el resumen de junio"). Empata para el más
 * reciente.
 */
function periodoDominante(movimientos: readonly MovimientoCrudo[]): string | null {
  const conteo = new Map<string, number>();
  for (const m of movimientos) {
    if (m.fechaEstimada) continue; // una fecha inventada no vota
    const p = periodoDe(m.fecha);
    conteo.set(p, (conteo.get(p) ?? 0) + 1);
  }
  let mejor: string | null = null;
  let max = 0;
  for (const [p, n] of [...conteo].sort((a, b) => b[0].localeCompare(a[0]))) {
    if (n > max) {
      max = n;
      mejor = p;
    }
  }
  return mejor;
}

/** Fila "Monto total de los Movimientos del período": el checksum del archivo. */
function esFilaTotal(fila: unknown[]): boolean {
  return fila.some((c) => norm(c).startsWith("monto total"));
}

/**
 * Fila "Total Tarjeta Nro ****8423": cierra la sección de una tarjeta.
 * Devuelve el número tal cual lo escribe el banco, o null si no es esa fila.
 */
function esSubtotalTarjeta(fila: unknown[]): string | null {
  for (const c of fila) {
    if (!norm(c).startsWith("total tarjeta")) continue;
    const nro = String(c).replace(/^\s*total\s+tarjeta\s+(nro\.?)?\s*/i, "").trim();
    return nro || "sin identificar";
  }
  return null;
}

const TOLERANCIA = 0.05; // centavos de redondeo acumulado

/** Movimiento a medio armar: le falta la fecha si el banco no la trajo. */
interface Pendiente {
  fecha: Date | null;
  establecimiento: string;
  cuotaNro: number | null;
  cuotaTotal: number | null;
  importeARS: number | null;
  importeUSD: number | null;
  nroTarjeta: string | null;
}

export function parsearBBVATarjeta(buffer: ArrayBuffer): ResultadoParseo {
  const base: ResultadoParseo = {
    ok: false,
    origen: "desconocido",
    periodo: null,
    fechaCierre: null,
    movimientos: [],
    totalDeclarado: { ars: null, usd: null },
    totalCalculado: { ars: 0, usd: 0 },
    validacion: { cuadra: false, difARS: 0, difUSD: 0, tolerancia: TOLERANCIA },
    subtotales: [],
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
  const pendientes: Pendiente[] = [];
  const subtotales: SubtotalTarjeta[] = [];
  const totalDeclarado: TotalesDeclarados = { ars: null, usd: null };

  const leer = (fila: unknown[], clave: ClaveColumna): unknown => {
    const i = mapa[clave];
    return i === undefined ? "" : fila[i];
  };

  /** Índice donde arranca la sección de la tarjeta que estamos leyendo. */
  let inicioSeccion = 0;

  for (let i = filaHeader + 1; i < filas.length; i++) {
    const fila = filas[i] ?? [];

    // --- Cierre de una tarjeta: recién acá aparece su número ---
    const nroTarjeta = esSubtotalTarjeta(fila);
    if (nroTarjeta !== null) {
      const seccion = pendientes.slice(inicioSeccion);
      for (const p of seccion) p.nroTarjeta = nroTarjeta;

      const calculadoARS = seccion.reduce((a, p) => a + (p.importeARS ?? 0), 0);
      const calculadoUSD = seccion.reduce((a, p) => a + (p.importeUSD ?? 0), 0);
      const declaradoARS = parseImporteAR(leer(fila, "importeARS"));
      const declaradoUSD = parseImporteAR(leer(fila, "importeUSD"));
      const cuadraARS =
        declaradoARS === null || Math.abs(calculadoARS - declaradoARS) <= TOLERANCIA;
      const cuadraUSD =
        declaradoUSD === null || Math.abs(calculadoUSD - declaradoUSD) <= TOLERANCIA;

      subtotales.push({
        nroTarjeta,
        declaradoARS,
        declaradoUSD,
        calculadoARS: +calculadoARS.toFixed(2),
        calculadoUSD: +calculadoUSD.toFixed(2),
        cuadra: cuadraARS && cuadraUSD,
      });

      if (!cuadraARS || !cuadraUSD) {
        advertencias.push(
          `El subtotal de la tarjeta ${nroTarjeta} no cuadra con sus movimientos.`,
        );
      }

      inicioSeccion = pendientes.length;
      continue;
    }

    // --- Checksum del archivo entero ---
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

    if (importeARS === null && importeUSD === null) {
      advertencias.push(`Fila ${i + 1}: "${establecimiento}" sin importe. Se omitió.`);
      continue;
    }

    const fecha = parseFecha(leer(fila, "fecha"));
    if (fecha.tipo === "ilegible") {
      advertencias.push(
        `Fila ${i + 1}: fecha ilegible ("${String(leer(fila, "fecha"))}"). Se omitió.`,
      );
      continue;
    }

    const cuota = parseCuota(leer(fila, "cuota"));

    pendientes.push({
      fecha: fecha.tipo === "ok" ? fecha.valor : null,
      establecimiento,
      cuotaNro: cuota.nro,
      cuotaTotal: cuota.total,
      importeARS,
      importeUSD,
      nroTarjeta: null,
    });
  }

  // --- Cierre del resumen: el movimiento más nuevo con fecha de verdad ---
  const reales = pendientes.map((p) => p.fecha).filter((d): d is Date => d !== null);
  const fechaCierre =
    reales.length > 0
      ? new Date(Math.max(...reales.map((d) => d.getTime())))
      : fechaDeHoja(nombreHoja);

  const movimientos: MovimientoCrudo[] = [];
  let sinFecha = 0;

  for (const p of pendientes) {
    if (p.fecha === null && fechaCierre === null) {
      // Un ajuste sin fecha en un archivo sin ninguna fecha válida: no hay a
      // qué mes atribuirlo, y meterlo con fecha inventada ensuciaría el total.
      advertencias.push(
        `Un movimiento de ${p.importeARS ?? p.importeUSD} no tiene fecha y el ` +
          "archivo tampoco trae ninguna. Se omitió.",
      );
      continue;
    }
    if (p.fecha === null) sinFecha++;
    movimientos.push({
      nroTarjeta: p.nroTarjeta,
      fecha: p.fecha ?? fechaCierre!,
      establecimiento: p.establecimiento,
      cuotaNro: p.cuotaNro,
      cuotaTotal: p.cuotaTotal,
      importeARS: p.importeARS,
      importeUSD: p.importeUSD,
      fechaEstimada: p.fecha === null,
    });
  }

  if (sinFecha > 0) {
    advertencias.push(
      `${sinFecha} ${sinFecha === 1 ? "movimiento vino" : "movimientos vinieron"} ` +
        "sin fecha (el banco los exporta con 01/01/0001). Les puse la del cierre " +
        "del resumen y quedan marcados como fecha estimada.",
    );
  }

  const totalCalculado = movimientos.reduce(
    (acc, m) => ({
      ars: acc.ars + (m.importeARS ?? 0),
      usd: acc.usd + (m.importeUSD ?? 0),
    }),
    { ars: 0, usd: 0 },
  );
  totalCalculado.ars = +totalCalculado.ars.toFixed(2);
  totalCalculado.usd = +totalCalculado.usd.toFixed(2);

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
    periodo: periodoDominante(movimientos),
    fechaCierre: fechaCierre ? isoDe(fechaCierre) : null,
    movimientos,
    totalDeclarado,
    totalCalculado,
    validacion: { cuadra, difARS, difUSD, tolerancia: TOLERANCIA },
    subtotales,
    advertencias,
    error: null,
  };
}

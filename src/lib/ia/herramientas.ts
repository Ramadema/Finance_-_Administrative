import type { Movimiento } from "../db/esquema";
import { CATEGORIAS, CATEGORIAS_GASTO, POR_ID } from "../categorize/categorias";
import { sinTildes } from "../categorize/normalizar";
import type { Naturaleza } from "../categorize/recurrencia";
import {
  resumenDe, gastoPorCategoria, comerciosDeCategoria, topComercios,
  variacionPorCategoria, serieMensual, cuotasComprometidas, naturalezasDe,
} from "../analisis/metricas";
import { periodoAnterior } from "../utils";
import type { DefinicionHerramienta } from "./tipos";

/**
 * Las herramientas del agente: lo único que el modelo puede hacer con tus datos.
 *
 * Cada una envuelve una función del dominio que ya existe y ya está testeada.
 * El modelo no ve movimientos: ve lo que estas devuelven. Y devuelven totales,
 * porcentajes y listas cortas, para que nunca tenga que sumar a mano — un LLM
 * sumando es la forma más fácil de inventar un número.
 *
 * Los errores de entrada (un período que no existe, una categoría mal escrita)
 * se devuelven como texto, no se tiran: el modelo los lee y se corrige solo.
 */

export interface ContextoDatos {
  movimientos: readonly Movimiento[];
  /** Ascendente, el más reciente último. */
  periodos: readonly string[];
  ingresosPorPeriodo: ReadonlyMap<string, number>;
}

export interface Herramienta {
  definicion: DefinicionHerramienta;
  ejecutar(entrada: Record<string, unknown>, ctx: ContextoDatos): unknown;
}

/** Una entrada que el modelo armó mal. El mensaje está escrito para que él lo lea. */
export class EntradaInvalida extends Error {}

const pesos = (n: number) => Math.round(n);
const pct = (n: number) => Math.round(n * 10) / 10;

// Las naturalezas se calculan sobre todo el histórico: una vez por juego de datos, no por llamada.
const naturalezasCache = new WeakMap<readonly Movimiento[], ReadonlyMap<string, Naturaleza>>();
function naturalezas(ctx: ContextoDatos): ReadonlyMap<string, Naturaleza> {
  let n = naturalezasCache.get(ctx.movimientos);
  if (!n) {
    n = naturalezasDe(ctx.movimientos, ctx.periodos);
    naturalezasCache.set(ctx.movimientos, n);
  }
  return n;
}

// ── validación de entradas ──────────────────────────────────────────────

function periodoDe(entrada: Record<string, unknown>, ctx: ContextoDatos, clave = "periodo"): string {
  const p = entrada[clave];
  if (typeof p !== "string" || !/^\d{4}-\d{2}$/.test(p)) {
    throw new EntradaInvalida(`"${clave}" tiene que ser un mes con formato "AAAA-MM".`);
  }
  if (!ctx.periodos.includes(p)) {
    throw new EntradaInvalida(`No hay datos del período ${p}. Meses disponibles: ${ctx.periodos.join(", ")}.`);
  }
  return p;
}

/** Como `periodoDe`, pero `null` significa "todos los meses". */
function periodoOpcional(entrada: Record<string, unknown>, ctx: ContextoDatos): string | null {
  return entrada.periodo === null || entrada.periodo === undefined ? null : periodoDe(entrada, ctx);
}

function categoriaDe(entrada: Record<string, unknown>, clave = "categoria"): string {
  const id = entrada[clave];
  if (typeof id !== "string" || !POR_ID.has(id)) {
    throw new EntradaInvalida(
      `Categoría desconocida: ${String(id)}. Usá uno de estos ids: ${CATEGORIAS.map((c) => c.id).join(", ")}.`,
    );
  }
  return id;
}

function enteroDe(entrada: Record<string, unknown>, clave: string, porDefecto: number, min: number, max: number): number {
  const v = entrada[clave];
  if (v === null || v === undefined) return porDefecto;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) throw new EntradaInvalida(`"${clave}" tiene que ser un entero.`);
  return Math.min(max, Math.max(min, n));
}

function numeroOpcional(entrada: Record<string, unknown>, clave: string): number | null {
  const v = entrada[clave];
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new EntradaInvalida(`"${clave}" tiene que ser un número.`);
  return n;
}

function textoOpcional(entrada: Record<string, unknown>, clave: string): string | null {
  const v = entrada[clave];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new EntradaInvalida(`"${clave}" tiene que ser texto.`);
  return v.trim() === "" ? null : v;
}

const PERIODO = { type: "string", description: 'Mes del resumen, con formato "AAAA-MM".' };
const PERIODO_O_TODOS = {
  type: ["string", "null"],
  description: 'Mes del resumen, "AAAA-MM". null = todos los meses cargados.',
};

// ── las herramientas ────────────────────────────────────────────────────

const resumenDelMes: Herramienta = {
  definicion: {
    nombre: "resumen_del_mes",
    descripcion:
      "La foto de un mes: ingresos, gastos, ahorro, sobrante, cuánto fue fijo/variable/esporádico, " +
      "movimientos sin categorizar y gasto en dólares (aparte, sin convertir). " +
      'Para "cuánto gasté", "cuánto me sobró", "cómo me fue en tal mes".',
    parametros: { type: "object", properties: { periodo: PERIODO }, required: ["periodo"], additionalProperties: false },
  },
  ejecutar(entrada, ctx) {
    const periodo = periodoDe(entrada, ctx);
    const r = resumenDe(ctx.movimientos, periodo, naturalezas(ctx), ctx.ingresosPorPeriodo.get(periodo) ?? 0);
    return {
      periodo,
      ingresos: pesos(r.ingresos),
      gastos: pesos(r.gastos),
      ahorro: pesos(r.ahorro),
      sobrante: pesos(r.sobrante),
      tasaGastoPct: r.tasaGasto === null ? null : pct(r.tasaGasto * 100),
      fijo: pesos(r.fijo),
      variable: pesos(r.variable),
      esporadico: pesos(r.esporadico),
      cantidadMovimientos: r.cantidadMovimientos,
      sinCategorizar: r.sinCategorizar,
      gastosUSD: r.gastosUSD,
      aviso: r.ingresos === 0
        ? "No hay ingresos cargados para este mes: el sobrante y las tasas no se pueden calcular."
        : undefined,
    };
  },
};

const gastoPorCategoriaH: Herramienta = {
  definicion: {
    nombre: "gasto_por_categoria",
    descripcion:
      "Cuánto se gastó en cada categoría en un mes, con monto, porcentaje del total y cantidad de movimientos. " +
      'Para "en qué gasté", "qué categoría pesa más".',
    parametros: {
      type: "object",
      properties: {
        periodo: PERIODO,
        maximo: { type: ["integer", "null"], description: "Cuántas categorías traer; el resto se agrupa en Otros. null = todas." },
      },
      required: ["periodo", "maximo"],
      additionalProperties: false,
    },
  },
  ejecutar(entrada, ctx) {
    const periodo = periodoDe(entrada, ctx);
    const maximo = enteroDe(entrada, "maximo", 99, 1, 99);
    return gastoPorCategoria(ctx.movimientos, periodo, maximo).map((g) => ({
      categoria: g.categoriaId, nombre: g.nombre, monto: pesos(g.monto), porcentaje: pct(g.porcentaje), cantidad: g.cantidad,
    }));
  },
};

const comerciosDeCategoriaH: Herramienta = {
  definicion: {
    nombre: "comercios_de_categoria",
    descripcion:
      "Los comercios dentro de una categoría, con monto, cantidad de consumos y ticket promedio. " +
      'Para "en qué se me fue la plata de gastronomía", "dónde compro más".',
    parametros: {
      type: "object",
      properties: {
        periodo: PERIODO_O_TODOS,
        categoria: { type: "string", enum: CATEGORIAS_GASTO.map((c) => c.id), description: "Id de la categoría." },
      },
      required: ["periodo", "categoria"],
      additionalProperties: false,
    },
  },
  ejecutar(entrada, ctx) {
    const periodo = periodoOpcional(entrada, ctx);
    const categoria = categoriaDe(entrada);
    return comerciosDeCategoria(ctx.movimientos, periodo, categoria).map((c) => ({
      comercio: c.comercio, monto: pesos(c.monto), cantidad: c.cantidad,
      porcentaje: pct(c.porcentaje), ticketPromedio: pesos(c.ticketPromedio),
    }));
  },
};

const topComerciosH: Herramienta = {
  definicion: {
    nombre: "top_comercios",
    descripcion: 'Los comercios donde más se gastó, de cualquier categoría. Para "dónde gasto más", "mis comercios principales".',
    parametros: {
      type: "object",
      properties: {
        periodo: PERIODO_O_TODOS,
        limite: { type: ["integer", "null"], description: "Cuántos traer. null = 10." },
      },
      required: ["periodo", "limite"],
      additionalProperties: false,
    },
  },
  ejecutar(entrada, ctx) {
    const periodo = periodoOpcional(entrada, ctx);
    const limite = enteroDe(entrada, "limite", 10, 1, 50);
    return topComercios(ctx.movimientos, periodo, limite).map((c) => ({
      comercio: c.comercio, categoria: c.categoriaId, monto: pesos(c.monto), cantidad: c.cantidad, porcentaje: pct(c.porcentaje),
    }));
  },
};

const compararMeses: Herramienta = {
  definicion: {
    nombre: "comparar_meses",
    descripcion:
      "Compara el gasto por categoría entre dos meses: antes, ahora, diferencia y variación en %. Trae también el total. " +
      'Para "gasté más o menos que el mes pasado", "qué subió", "qué cambió".',
    parametros: {
      type: "object",
      properties: {
        periodo: { type: "string", description: 'El mes a analizar, "AAAA-MM".' },
        contra: { type: ["string", "null"], description: 'Con qué mes compararlo, "AAAA-MM". null = el mes anterior.' },
      },
      required: ["periodo", "contra"],
      additionalProperties: false,
    },
  },
  ejecutar(entrada, ctx) {
    const periodo = periodoDe(entrada, ctx);
    const contra = entrada.contra === null || entrada.contra === undefined
      ? periodoAnterior(periodo)
      : periodoDe(entrada, ctx, "contra");
    if (!ctx.periodos.includes(contra)) {
      throw new EntradaInvalida(`No hay datos del período ${contra} para comparar. Meses disponibles: ${ctx.periodos.join(", ")}.`);
    }
    const variacion = (antes: number, ahora: number) => (antes > 0 ? pct(((ahora - antes) / antes) * 100) : null);
    const filas = variacionPorCategoria(ctx.movimientos, contra, periodo);
    const antes = filas.reduce((s, f) => s + f.a, 0);
    const ahora = filas.reduce((s, f) => s + f.b, 0);
    return {
      periodo, contra,
      total: { antes: pesos(antes), ahora: pesos(ahora), diferencia: pesos(ahora - antes), variacionPct: variacion(antes, ahora) },
      categorias: filas.map((f) => ({
        categoria: f.categoriaId, nombre: f.nombre,
        antes: pesos(f.a), ahora: pesos(f.b), diferencia: pesos(f.delta), variacionPct: variacion(f.a, f.b),
      })),
    };
  },
};

const serieMensualH: Herramienta = {
  definicion: {
    nombre: "serie_mensual",
    descripcion:
      "Ingresos, gastos, sobrante y reparto fijo/variable de cada mes cargado, en orden. " +
      'Para tendencias: "cómo viene el año", "en qué mes gasté más", "estoy gastando más que antes".',
    parametros: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  ejecutar(_entrada, ctx) {
    return serieMensual(ctx.movimientos, ctx.periodos, naturalezas(ctx), ctx.ingresosPorPeriodo).map((r) => ({
      periodo: r.periodo, ingresos: pesos(r.ingresos), gastos: pesos(r.gastos), sobrante: pesos(r.sobrante),
      fijo: pesos(r.fijo), variable: pesos(r.variable), esporadico: pesos(r.esporadico),
    }));
  },
};

const cuotasComprometidasH: Herramienta = {
  definicion: {
    nombre: "cuotas_comprometidas",
    descripcion:
      "Cuánto ya está comprometido en cuotas para los próximos meses, mes por mes, con el detalle de cada plan. " +
      'Para "cuánto debo en cuotas", "qué me viene el mes que viene".',
    parametros: {
      type: "object",
      properties: { meses: { type: ["integer", "null"], description: "Cuántos meses hacia adelante. null = 6." } },
      required: ["meses"],
      additionalProperties: false,
    },
  },
  ejecutar(entrada, ctx) {
    const meses = enteroDe(entrada, "meses", 6, 1, 24);
    return cuotasComprometidas(ctx.movimientos, meses).map((c) => ({
      periodo: c.periodo, monto: pesos(c.monto), cantidadCuotas: c.detalle.length,
      detalle: [...c.detalle].sort((a, b) => b.monto - a.monto).slice(0, 8)
        .map((d) => ({ comercio: d.comercio, cuota: d.cuota, monto: pesos(d.monto) })),
    }));
  },
};

const buscarMovimientos: Herramienta = {
  definicion: {
    nombre: "buscar_movimientos",
    descripcion:
      "Busca movimientos por texto (comercio o descripción), categoría, mes y rango de monto. " +
      "Devuelve la suma y la cantidad de TODOS los que coinciden, más una lista acotada de los más recientes. " +
      'Para "cuánto gasté en Rappi", "qué compré en tal lugar", "hay algún gasto mayor a X".',
    parametros: {
      type: "object",
      properties: {
        texto: { type: ["string", "null"], description: "Palabras a buscar en el comercio o la descripción. null = sin filtro." },
        categoria: { type: ["string", "null"], description: "Id de categoría. null = todas." },
        periodo: PERIODO_O_TODOS,
        minimo: { type: ["number", "null"], description: "Monto mínimo en pesos. null = sin piso." },
        maximo: { type: ["number", "null"], description: "Monto máximo en pesos. null = sin techo." },
        limite: { type: ["integer", "null"], description: "Cuántos movimientos listar. null = 20." },
      },
      required: ["texto", "categoria", "periodo", "minimo", "maximo", "limite"],
      additionalProperties: false,
    },
  },
  ejecutar(entrada, ctx) {
    const texto = textoOpcional(entrada, "texto");
    const categoria = entrada.categoria === null || entrada.categoria === undefined ? null : categoriaDe(entrada);
    const periodo = periodoOpcional(entrada, ctx);
    const minimo = numeroOpcional(entrada, "minimo");
    const maximo = numeroOpcional(entrada, "maximo");
    const limite = enteroDe(entrada, "limite", 20, 1, 100);

    const palabras = texto ? sinTildes(texto).toLowerCase().split(/\s+/).filter(Boolean) : [];
    const coincide = (m: Movimiento) => {
      if (m.excluido) return false;
      if (periodo && m.periodo !== periodo) return false;
      if (categoria && m.categoria !== categoria) return false;
      if (minimo !== null && m.montoARS < minimo) return false;
      if (maximo !== null && m.montoARS > maximo) return false;
      if (palabras.length > 0) {
        const pajar = sinTildes(`${m.comercio} ${m.descripcionCruda} ${m.claveComercio}`).toLowerCase();
        if (!palabras.every((p) => pajar.includes(p))) return false;
      }
      return true;
    };

    const todos = ctx.movimientos.filter(coincide).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return {
      total: todos.length,
      sumaTotal: pesos(todos.reduce((s, m) => s + m.montoARS, 0)),
      mostrados: Math.min(limite, todos.length),
      movimientos: todos.slice(0, limite).map((m) => ({
        fecha: m.fecha, periodo: m.periodo, comercio: m.comercio, monto: pesos(m.montoARS),
        categoria: m.categoria, cuota: m.cuotaNro && m.cuotaTotal ? `${m.cuotaNro}/${m.cuotaTotal}` : null,
      })),
    };
  },
};

/** El catálogo completo, en el orden en que se le presentan al modelo. */
export const HERRAMIENTAS: readonly Herramienta[] = [
  resumenDelMes, gastoPorCategoriaH, comerciosDeCategoriaH, topComerciosH,
  compararMeses, serieMensualH, cuotasComprometidasH, buscarMovimientos,
];

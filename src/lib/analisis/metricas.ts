import type { Movimiento } from "../db/esquema";
import { categoria as buscarCategoria, CATEGORIAS } from "../categorize/categorias";
import { perfilarRecurrencia, indiceNaturaleza, type Naturaleza, type MovimientoParaAnalisis } from "../categorize/recurrencia";

/**
 * Métricas derivadas del dashboard.
 *
 * Todo se calcula sobre movimientos NO excluidos y respetando la clase de flujo:
 * los internos (pago de tarjeta, transferencias propias) jamás suman como gasto.
 */

export interface ResumenPeriodo {
  periodo: string;
  /** Ingresos detectados en los movimientos + los que cargaste a mano. */
  ingresos: number;
  /** Solo la parte cargada a mano, para poder mostrar de dónde sale el número. */
  ingresosManuales: number;
  gastos: number;
  ahorro: number;
  /** ingresos − gastos − ahorro. Lo que te queda libre. */
  sobrante: number;
  /** Qué fracción del ingreso te comen los gastos. */
  tasaGasto: number | null;
  fijo: number;
  variable: number;
  esporadico: number;
  cantidadMovimientos: number;
  sinCategorizar: number;
  /**
   * Gasto en dólares del mes, SIN convertir.
   * Se reporta aparte a propósito: sin cotización no se puede sumar a los pesos,
   * y meterlo en el total como cero haría desaparecer un gasto real del análisis
   * sin que nada lo indique.
   */
  gastosUSD: number;
}

export interface GastoPorCategoria {
  categoriaId: string;
  nombre: string;
  slot: number | null;
  monto: number;
  porcentaje: number;
  cantidad: number;
}

const activos = (ms: readonly Movimiento[]) => ms.filter((m) => !m.excluido);

function claseDe(m: Movimiento) {
  return buscarCategoria(m.categoria).clase;
}

export function aAnalisis(ms: readonly Movimiento[]): MovimientoParaAnalisis[] {
  return ms.map((m) => ({
    claveComercio: m.claveComercio,
    comercio: m.comercio,
    categoria: m.categoria,
    periodo: m.periodo,
    montoARS: m.montoARS,
  }));
}

/** Resumen de un mes. `naturalezas` viene del perfil de recurrencia. */
export function resumenDe(
  movimientos: readonly Movimiento[],
  periodo: string,
  naturalezas: ReadonlyMap<string, Naturaleza>,
  ingresosManuales = 0,
): ResumenPeriodo {
  const delMes = activos(movimientos).filter((m) => m.periodo === periodo);

  let ingresos = 0, gastos = 0, ahorro = 0, sinCategorizar = 0, gastosUSD = 0;
  const reparto = { fijo: 0, variable: 0, esporadico: 0 };

  for (const m of delMes) {
    const clase = claseDe(m);
    if (clase === "ingreso") ingresos += Math.abs(m.montoARS);
    else if (clase === "ahorro") ahorro += Math.abs(m.montoARS);
    else if (clase === "gasto") {
      // Con signo, a propósito: en el resumen de tarjeta una devolución viene
      // negativa. Pasarla por Math.abs la contaba como gasto y te inflaba el
      // mes justo cuando el banco te había devuelto la plata.
      const monto = m.montoARS;
      gastos += monto;
      gastosUSD += (m.montoUSD ?? 0);
      reparto[naturalezas.get(m.claveComercio) ?? "esporadico"] += monto;
      if (m.categoria === "sin_categoria") sinCategorizar++;
    }
    // clase "interno" se ignora a propósito: sumarla contaría el mes dos veces.
  }

  ingresos += ingresosManuales;

  return {
    periodo,
    ingresos,
    ingresosManuales,
    gastos,
    ahorro,
    sobrante: ingresos - gastos - ahorro,
    tasaGasto: ingresos > 0 ? gastos / ingresos : null,
    fijo: reparto.fijo,
    variable: reparto.variable,
    esporadico: reparto.esporadico,
    cantidadMovimientos: delMes.length,
    sinCategorizar,
    gastosUSD,
  };
}

/**
 * Gasto por categoría, descendente.
 * `maxSlices` pliega la cola larga en "Otros": la paleta tiene 9 slots fijos y
 * no se ciclan, así que una décima categoría no inventa un color nuevo.
 */
export function gastoPorCategoria(
  movimientos: readonly Movimiento[],
  periodo: string | null,
  maxSlices = 8,
): GastoPorCategoria[] {
  const rel = activos(movimientos).filter(
    (m) => (periodo === null || m.periodo === periodo) && claseDe(m) === "gasto",
  );

  const acum = new Map<string, { monto: number; cantidad: number }>();
  for (const m of rel) {
    const e = acum.get(m.categoria) ?? { monto: 0, cantidad: 0 };
    e.monto += m.montoARS;
    e.cantidad++;
    acum.set(m.categoria, e);
  }

  const total = [...acum.values()].reduce((a, e) => a + e.monto, 0);
  const filas = [...acum.entries()]
    // Una categoría solo con consumos en dólares queda en 0 pesos: mostrarla
    // como "$ 0 · 0%" es ruido, no información.
    .filter(([, e]) => e.monto > 0)
    .map(([id, e]) => {
      const c = buscarCategoria(id);
      return {
        categoriaId: id, nombre: c.nombre, slot: c.slot,
        monto: e.monto, cantidad: e.cantidad,
        porcentaje: total > 0 ? (e.monto / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.monto - a.monto);

  if (filas.length <= maxSlices) return filas;

  const cabeza = filas.slice(0, maxSlices);
  const cola = filas.slice(maxSlices);
  cabeza.push({
    categoriaId: "__otros",
    nombre: `Otros (${cola.length})`,
    slot: null,
    monto: cola.reduce((a, f) => a + f.monto, 0),
    cantidad: cola.reduce((a, f) => a + f.cantidad, 0),
    porcentaje: cola.reduce((a, f) => a + f.porcentaje, 0),
  });
  return cabeza;
}

export interface FlujoSankey {
  nodos: { id: string; nombre: string; nivel: 0 | 1 | 2; slot: number | null; clase: string }[];
  enlaces: { origen: number; destino: number; valor: number }[];
}

/**
 * Flujo real del mes para el Sankey: raíz → naturaleza → categoría.
 *
 * Los montos de nivel 2 son la tabulación cruzada REAL (naturaleza × categoría),
 * no un prorrateo. Importa: una categoría suele repartirse entre naturalezas
 * (la salud es OSDE fijo + farmacia variable), y prorratear hacía que el Sankey
 * mostrara para una categoría un número distinto al del gráfico de barras.
 * Dos cifras contradictorias en la misma pantalla y el dashboard deja de servir.
 *
 * Acá cada nodo de categoría recibe varios enlaces y su total es la suma de
 * ellos, así que coincide exactamente con el resto del tablero.
 */
export function flujoSankey(
  movimientos: readonly Movimiento[],
  periodo: string,
  naturalezas: ReadonlyMap<string, Naturaleza>,
  resumen: ResumenPeriodo,
  maxCategorias = 6,
): FlujoSankey {
  const delMes = activos(movimientos).filter((m) => m.periodo === periodo);

  // Cross-tab: naturaleza → categoría → monto.
  const cruce = new Map<Naturaleza, Map<string, number>>();
  const totalPorCategoria = new Map<string, number>();

  for (const m of delMes) {
    if (claseDe(m) !== "gasto") continue;
    const nat = naturalezas.get(m.claveComercio) ?? "esporadico";
    const monto = m.montoARS;
    if (!cruce.has(nat)) cruce.set(nat, new Map());
    const porCat = cruce.get(nat)!;
    porCat.set(m.categoria, (porCat.get(m.categoria) ?? 0) + monto);
    totalPorCategoria.set(m.categoria, (totalPorCategoria.get(m.categoria) ?? 0) + monto);
  }

  // Las categorías chicas se pliegan en "Otros" — la paleta tiene 8 slots fijos.
  // Se descartan primero las de monto cero: un consumo solo en dólares deja la
  // categoría con 0 en pesos, y sin este filtro aparecía un nodo "Otros $0"
  // colgado del gráfico sin ningún hilo que llegue a él.
  const ranking = [...totalPorCategoria.entries()]
    .filter(([, monto]) => monto > 0)
    .sort((a, b) => b[1] - a[1]);
  const visibles = new Set(ranking.slice(0, maxCategorias).map(([id]) => id));
  const montoOtros = ranking.slice(maxCategorias).reduce((a, [, m]) => a + m, 0);
  const hayOtros = montoOtros > 0;

  const nodos: FlujoSankey["nodos"] = [];
  const enlaces: FlujoSankey["enlaces"] = [];
  const indice = new Map<string, number>();
  const agregar = (n: FlujoSankey["nodos"][number]) => {
    nodos.push(n);
    const i = nodos.length - 1;
    indice.set(n.id, i);
    return i;
  };

  const hayIngresos = resumen.ingresos > 0;
  const raiz = agregar({
    id: "__raiz",
    nombre: hayIngresos ? "Ingresos" : "Gasto del mes",
    nivel: 0, slot: null, clase: "raiz",
  });

  const RAMAS: { nat: Naturaleza; nombre: string; monto: number }[] = [
    { nat: "fijo", nombre: "Fijos", monto: resumen.fijo },
    { nat: "variable", nombre: "Variables", monto: resumen.variable },
    { nat: "esporadico", nombre: "Esporádicos", monto: resumen.esporadico },
  ];

  for (const r of RAMAS) {
    if (r.monto <= 0) continue;
    const i = agregar({ id: `nat:${r.nat}`, nombre: r.nombre, nivel: 1, slot: null, clase: r.nat });
    enlaces.push({ origen: raiz, destino: i, valor: r.monto });
  }

  if (hayIngresos) {
    if (resumen.ahorro > 0) {
      const i = agregar({ id: "ahorro", nombre: "Ahorro", nivel: 1, slot: null, clase: "ahorro" });
      enlaces.push({ origen: raiz, destino: i, valor: resumen.ahorro });
    }
    if (resumen.sobrante > 0) {
      const i = agregar({ id: "sobrante", nombre: "Sobrante", nivel: 1, slot: null, clase: "sobrante" });
      enlaces.push({ origen: raiz, destino: i, valor: resumen.sobrante });
    }
  }

  // Nivel 2: un nodo por categoría, alimentado por TODAS las naturalezas que la tocan.
  for (const [catId] of ranking) {
    const c = buscarCategoria(catId);
    if (visibles.has(catId)) {
      agregar({ id: `cat:${catId}`, nombre: c.nombre, nivel: 2, slot: c.slot, clase: "gasto" });
    }
  }
  if (hayOtros) {
    agregar({ id: "cat:__otros", nombre: "Otros", nivel: 2, slot: null, clase: "gasto" });
  }

  for (const [nat, porCat] of cruce) {
    const iNat = indice.get(`nat:${nat}`);
    if (iNat === undefined) continue;
    let otros = 0;
    for (const [catId, monto] of porCat) {
      if (monto <= 0) continue;
      if (visibles.has(catId)) {
        const iCat = indice.get(`cat:${catId}`);
        if (iCat !== undefined) enlaces.push({ origen: iNat, destino: iCat, valor: monto });
      } else {
        otros += monto;
      }
    }
    if (otros > 0) {
      const iOtros = indice.get("cat:__otros");
      if (iOtros !== undefined) enlaces.push({ origen: iNat, destino: iOtros, valor: otros });
    }
  }

  return { nodos, enlaces };
}

/** Serie mensual para el gráfico de evolución. */
export function serieMensual(
  movimientos: readonly Movimiento[],
  periodos: readonly string[],
  naturalezas: ReadonlyMap<string, Naturaleza>,
  ingresosPorPeriodo?: ReadonlyMap<string, number>,
): ResumenPeriodo[] {
  return periodos.map((p) =>
    resumenDe(movimientos, p, naturalezas, ingresosPorPeriodo?.get(p) ?? 0),
  );
}

/**
 * Gasto por día del mes, para el heatmap.
 *
 * Solo entran los consumos cuya FECHA DE COMPRA cae dentro del mes. Un resumen
 * también te cobra cuotas de compras viejas —la cuota 3/12 de una compra de
 * mayo llega en el resumen de julio— y esas no tienen día en la grilla de
 * julio. Se cuentan en el total del mes, no en el calendario; `gastoFueraDelMes`
 * devuelve cuánto quedó afuera para poder decirlo en pantalla.
 */
export function gastoDiario(
  movimientos: readonly Movimiento[],
  periodo: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of activos(movimientos)) {
    if (m.periodo !== periodo || claseDe(m) !== "gasto") continue;
    if (!m.fecha.startsWith(periodo)) continue;
    out.set(m.fecha, (out.get(m.fecha) ?? 0) + m.montoARS);
  }
  return out;
}

/** Lo que el resumen cobra este mes pero se compró en otro (cuotas y ajustes). */
export function gastoFueraDelMes(
  movimientos: readonly Movimiento[],
  periodo: string,
): { monto: number; cantidad: number } {
  let monto = 0;
  let cantidad = 0;
  for (const m of activos(movimientos)) {
    if (m.periodo !== periodo || claseDe(m) !== "gasto") continue;
    if (m.fecha.startsWith(periodo)) continue;
    monto += m.montoARS;
    cantidad++;
  }
  return { monto, cantidad };
}

export interface CuotaFutura {
  periodo: string;
  monto: number;
  detalle: { comercio: string; cuota: string; monto: number }[];
}

/** "2026-06" + 2 → "2026-08". Negativo va para atrás. */
export function desplazarPeriodo(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split("-").map(Number);
  const d = new Date(anio, mes - 1 + meses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Cuánto de los meses que VIENEN ya está comprometido en cuotas.
 *
 * Es el número que nadie mira y explica por qué el resumen del mes que viene
 * "vino caro". Dos trampas, las dos visibles recién con varios resúmenes
 * importados:
 *
 * 1. Una misma compra aparece en todos los resúmenes hasta que se termina de
 *    pagar (2/12 en junio, 3/12 en julio). Proyectar desde cada aparición
 *    contaba la compra una vez por resumen: en agosto salían dos cuotas 4/12
 *    del mismo comercio y el total comprometido quedaba inflado.
 *    Se agrupa por PLAN —comercio + cantidad de cuotas + mes de la cuota 1— y
 *    se proyecta solo desde la aparición más reciente.
 * 2. Un mes que ya importaste no es compromiso futuro: esa cuota ya está
 *    contada como gasto real de ese mes. Solo se proyecta más allá del último
 *    resumen que tenés.
 */
export function cuotasComprometidas(
  movimientos: readonly Movimiento[],
  mesesAdelante = 6,
): CuotaFutura[] {
  const lista = activos(movimientos);
  const ultimoPeriodo = lista.reduce((a, m) => (m.periodo > a ? m.periodo : a), "");
  if (!ultimoPeriodo) return [];
  const limite = desplazarPeriodo(ultimoPeriodo, mesesAdelante);

  // Identidad del plan de cuotas. Sin el monto a propósito: si el banco ajusta
  // la cuota, incluirlo partiría el plan en dos y volvería el doble conteo.
  const planes = new Map<string, Movimiento>();
  for (const m of lista) {
    if (m.cuotaNro === null || m.cuotaTotal === null) continue;
    if (m.cuotaTotal - m.cuotaNro <= 0) continue;
    const primeraCuota = desplazarPeriodo(m.periodo, -(m.cuotaNro - 1));
    const clave = `${m.claveComercio}|${m.cuotaTotal}|${primeraCuota}`;
    const previo = planes.get(clave);
    if (!previo || m.periodo > previo.periodo) planes.set(clave, m);
  }

  const futuro = new Map<string, CuotaFutura>();
  for (const m of planes.values()) {
    const restantes = m.cuotaTotal! - m.cuotaNro!;
    for (let i = 1; i <= restantes; i++) {
      const per = desplazarPeriodo(m.periodo, i);
      if (per <= ultimoPeriodo || per > limite) continue;
      const e = futuro.get(per) ?? { periodo: per, monto: 0, detalle: [] };
      e.monto += m.montoARS;
      e.detalle.push({
        comercio: m.comercio,
        cuota: `${m.cuotaNro! + i}/${m.cuotaTotal}`,
        monto: m.montoARS,
      });
      futuro.set(per, e);
    }
  }

  return [...futuro.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/** Perfiles de recurrencia listos para la UI. */
export function perfiles(
  movimientos: readonly Movimiento[],
  periodos: readonly string[],
) {
  return perfilarRecurrencia(aAnalisis(activos(movimientos)), periodos);
}

export function naturalezasDe(
  movimientos: readonly Movimiento[],
  periodos: readonly string[],
): ReadonlyMap<string, Naturaleza> {
  return indiceNaturaleza(perfiles(movimientos, periodos));
}

/** Comparación mes contra mes, por categoría — qué explica la diferencia. */
export function variacionPorCategoria(
  movimientos: readonly Movimiento[],
  periodoA: string,
  periodoB: string,
): { categoriaId: string; nombre: string; slot: number | null; a: number; b: number; delta: number }[] {
  const mapa = (p: string) =>
    new Map(gastoPorCategoria(movimientos, p, 99).map((g) => [g.categoriaId, g.monto]));
  const ma = mapa(periodoA);
  const mb = mapa(periodoB);
  const ids = new Set([...ma.keys(), ...mb.keys()]);

  return [...ids]
    .map((id) => {
      const c = buscarCategoria(id);
      const a = ma.get(id) ?? 0;
      const b = mb.get(id) ?? 0;
      return { categoriaId: id, nombre: c.nombre, slot: c.slot, a, b, delta: b - a };
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

export { CATEGORIAS };

export interface GastoPorComercio {
  claveComercio: string;
  comercio: string;
  monto: number;
  cantidad: number;
  porcentaje: number;
  ticketPromedio: number;
}

/**
 * Comercios dentro de una categoría, para el drill-down.
 * Responde "¿en qué se me fueron los $236k de salud?" — que es la pregunta
 * que sigue naturalmente a ver la barra.
 */
export function comerciosDeCategoria(
  movimientos: readonly Movimiento[],
  periodo: string | null,
  categoriaId: string,
): GastoPorComercio[] {
  const rel = activos(movimientos).filter(
    (m) =>
      (periodo === null || m.periodo === periodo) &&
      m.categoria === categoriaId &&
      claseDe(m) === "gasto",
  );

  const acum = new Map<string, { comercio: string; monto: number; cantidad: number }>();
  for (const m of rel) {
    const e = acum.get(m.claveComercio) ?? { comercio: m.comercio, monto: 0, cantidad: 0 };
    e.monto += m.montoARS;
    e.cantidad++;
    acum.set(m.claveComercio, e);
  }

  const total = [...acum.values()].reduce((a, e) => a + e.monto, 0);
  return [...acum.entries()]
    .filter(([, e]) => e.monto > 0)
    .map(([clave, e]) => ({
      claveComercio: clave,
      comercio: e.comercio,
      monto: e.monto,
      cantidad: e.cantidad,
      porcentaje: total > 0 ? (e.monto / total) * 100 : 0,
      ticketPromedio: e.monto / e.cantidad,
    }))
    .sort((a, b) => b.monto - a.monto);
}

/** Top comercios del mes, sin importar la categoría. */
export function topComercios(
  movimientos: readonly Movimiento[],
  periodo: string | null,
  limite = 10,
): (GastoPorComercio & { categoriaId: string })[] {
  const rel = activos(movimientos).filter(
    (m) => (periodo === null || m.periodo === periodo) && claseDe(m) === "gasto",
  );
  const acum = new Map<string, { comercio: string; categoriaId: string; monto: number; cantidad: number }>();
  for (const m of rel) {
    const e = acum.get(m.claveComercio) ??
      { comercio: m.comercio, categoriaId: m.categoria, monto: 0, cantidad: 0 };
    e.monto += m.montoARS;
    e.cantidad++;
    acum.set(m.claveComercio, e);
  }
  const total = [...acum.values()].reduce((a, e) => a + e.monto, 0);
  return [...acum.entries()]
    .filter(([, e]) => e.monto > 0)
    .map(([clave, e]) => ({
      claveComercio: clave, comercio: e.comercio, categoriaId: e.categoriaId,
      monto: e.monto, cantidad: e.cantidad,
      porcentaje: total > 0 ? (e.monto / total) * 100 : 0,
      ticketPromedio: e.monto / e.cantidad,
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, limite);
}

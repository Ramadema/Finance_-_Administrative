import type { ResumenPeriodo, GastoPorCategoria, CuotaFutura } from "./metricas";
import type { PerfilRecurrencia } from "../categorize/recurrencia";
import type { CapacidadAhorro, FondoEmergencia } from "./ahorro";
import { formatARS } from "../ingest/numero";
import { nombrePeriodo } from "../utils";

/**
 * Motor de observaciones.
 *
 * Dos reglas de diseño, ambas innegociables:
 *
 * 1. NINGUNA observación sin un número que la respalde. "Cuidá tus gastos" es
 *    ruido; "gastronomía está 47% arriba de tu promedio, son $63.000 más" es
 *    accionable. Si no hay dato suficiente, la regla no se dispara.
 *
 * 2. NO se recomiendan instrumentos de inversión. El motor dice cuánta plata te
 *    queda libre y dónde se te está yendo; en qué ponerla es una decisión que
 *    excede lo que estos datos pueden respaldar y requiere un asesor
 *    matriculado.
 */

export type Severidad = "critico" | "atencion" | "info" | "bueno";

export interface Insight {
  id: string;
  severidad: Severidad;
  grupo: "gasto" | "ahorro" | "suscripciones" | "cuotas" | "datos";
  titulo: string;
  detalle: string;
  /** Qué hacer al respecto, concreto. Opcional: a veces solo es información. */
  accion?: string;
  seccion?: string;
}

export interface EntradaInsights {
  periodo: string;
  resumen: ResumenPeriodo;
  serie: readonly ResumenPeriodo[];
  categorias: readonly GastoPorCategoria[];
  perfiles: readonly PerfilRecurrencia[];
  cuotas: readonly CuotaFutura[];
  capacidad: CapacidadAhorro;
  fondo: FondoEmergencia | null;
  categoriasPrevias: ReadonlyMap<string, number[]>;
}

const ORDEN: Record<Severidad, number> = { critico: 0, atencion: 1, bueno: 2, info: 3 };

function promedio(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function generarInsights(e: EntradaInsights): Insight[] {
  const out: Insight[] = [];
  const { resumen, serie, categorias, perfiles, cuotas, capacidad, fondo } = e;

  // ---------- Datos incompletos: sin esto, media app queda muda ----------
  if (!capacidad.hayIngresos) {
    out.push({
      id: "sin-ingresos",
      severidad: "info",
      grupo: "datos",
      titulo: "Cargá tus ingresos para saber cuánto te sobra",
      detalle:
        `Este mes gastaste ${formatARS(resumen.gastos, { decimales: false })}, pero sin ` +
        "ingresos cargados no puedo calcular tu capacidad de ahorro ni proyectar nada.",
      accion: "Cargalo una vez en Ahorro y repetilo hacia los meses siguientes.",
      seccion: "/ahorro",
    });
  }

  if (resumen.cantidadMovimientos > 0) {
    const pct = (resumen.sinCategorizar / resumen.cantidadMovimientos) * 100;
    if (pct > 15) {
      out.push({
        id: "sin-categorizar",
        severidad: "atencion",
        grupo: "datos",
        titulo: `${resumen.sinCategorizar} movimientos sin categorizar`,
        detalle:
          `Es el ${Math.round(pct)}% del mes. Mientras no estén asignados, el desglose ` +
          "por categoría te está mintiendo por abajo.",
        accion: "Asignalos una vez en Movimientos: el motor los recuerda para siempre.",
        seccion: "/movimientos",
      });
    }
  }

  // ---------- Categorías disparadas contra su propio promedio ----------
  for (const c of categorias) {
    if (c.categoriaId === "__otros") continue;
    const previos = e.categoriasPrevias.get(c.categoriaId) ?? [];
    if (previos.length < 2) continue;

    const prom = promedio(previos);
    if (prom <= 0) continue;

    const variacion = ((c.monto - prom) / prom) * 100;
    const exceso = c.monto - prom;

    // Umbral doble: porcentual Y absoluto. Un +80% sobre $3.000 no es noticia.
    if (variacion >= 30 && exceso >= prom * 0.3 && c.porcentaje >= 8) {
      out.push({
        id: `disparada-${c.categoriaId}`,
        severidad: variacion >= 60 ? "atencion" : "info",
        grupo: "gasto",
        titulo: `${c.nombre} está ${Math.round(variacion)}% arriba de tu promedio`,
        detalle:
          `Gastaste ${formatARS(c.monto, { decimales: false })} contra un promedio de ` +
          `${formatARS(prom, { decimales: false })} en los ${previos.length} meses anteriores. ` +
          `Son ${formatARS(exceso, { decimales: false })} de más.`,
        accion: "Mirá el detalle por comercio para ver si fue una compra puntual o un cambio de hábito.",
        seccion: "/gastos",
      });
    }
  }

  // ---------- Suscripciones ----------
  const subieron = perfiles.filter((p) => p.alertaAumento);
  for (const p of subieron) {
    out.push({
      id: `aumento-${p.claveComercio}`,
      severidad: "atencion",
      grupo: "suscripciones",
      titulo: `${p.comercio} aumentó ${p.aumentoPct}%`,
      detalle:
        `Venías pagando alrededor de ${formatARS(p.montoTipico, { decimales: false })} y ` +
        `el último mes te cobró ${formatARS(p.ultimoMonto, { decimales: false })}.`,
      accion: "Si no lo notaste hasta ahora, es buen momento para revisar si lo seguís usando.",
      seccion: "/fijos",
    });
  }

  const totalFijos = perfiles.filter((p) => p.esSuscripcion).reduce((a, p) => a + p.montoTipico, 0);
  if (capacidad.hayIngresos && totalFijos > 0) {
    const pesoFijos = (totalFijos / capacidad.ingresos) * 100;
    if (pesoFijos > 35) {
      out.push({
        id: "peso-fijos",
        severidad: pesoFijos > 50 ? "critico" : "atencion",
        grupo: "suscripciones",
        titulo: `Tus gastos fijos se llevan el ${Math.round(pesoFijos)}% del ingreso`,
        detalle:
          `Son ${formatARS(totalFijos, { decimales: false })} por mes comprometidos antes ` +
          "de decidir nada. Cuanto más alto ese piso, menos margen tenés para absorber un imprevisto.",
        accion: "Revisá la lista de fijos: suele haber uno o dos que ya no usás.",
        seccion: "/fijos",
      });
    }
  }

  // ---------- Cuotas ----------
  const proxima = cuotas[0];
  if (proxima && capacidad.hayIngresos) {
    const peso = (proxima.monto / capacidad.ingresos) * 100;
    if (peso > 20) {
      out.push({
        id: "cuotas-pesadas",
        severidad: peso > 35 ? "critico" : "atencion",
        grupo: "cuotas",
        titulo: `${nombrePeriodo(proxima.periodo)} ya tiene ${Math.round(peso)}% del ingreso comprometido`,
        detalle:
          `${formatARS(proxima.monto, { decimales: false })} en ${proxima.detalle.length} ` +
          "cuotas que ya están firmadas. Ese resumen llega con esa base sin importar lo que consumas.",
        accion: "Tenelo en cuenta antes de sumar otra compra en cuotas este mes.",
        seccion: "/gastos",
      });
    }
  }

  // ---------- Ahorro ----------
  if (capacidad.hayIngresos) {
    const tasa = (capacidad.tasaAhorro ?? 0) * 100;

    if (capacidad.capacidad < 0) {
      out.push({
        id: "deficit",
        severidad: "critico",
        grupo: "ahorro",
        titulo: "Este mes gastaste más de lo que entró",
        detalle:
          `El déficit es de ${formatARS(Math.abs(capacidad.capacidad), { decimales: false })}. ` +
          `Entraron ${formatARS(capacidad.ingresos, { decimales: false })} y salieron ` +
          `${formatARS(capacidad.gastos, { decimales: false })}.`,
        accion: "Mirá qué categoría se disparó respecto de los meses anteriores.",
        seccion: "/gastos",
      });
    } else if (tasa < 10) {
      out.push({
        id: "tasa-baja",
        severidad: "atencion",
        grupo: "ahorro",
        titulo: `Estás ahorrando el ${Math.round(tasa)}% de lo que ganás`,
        detalle:
          `Te quedan ${formatARS(capacidad.capacidad, { decimales: false })} libres al mes. ` +
          `De tu ingreso, ${formatARS(capacidad.fijos, { decimales: false })} son gastos fijos ` +
          `y ${formatARS(capacidad.variables, { decimales: false })} variables.`,
        accion: "Probá los escenarios de recorte para ver qué categoría mueve más la aguja.",
        seccion: "/ahorro",
      });
    } else if (tasa >= 20) {
      out.push({
        id: "tasa-buena",
        severidad: "bueno",
        grupo: "ahorro",
        titulo: `Estás ahorrando el ${Math.round(tasa)}% de tu ingreso`,
        detalle:
          `Son ${formatARS(capacidad.capacidad, { decimales: false })} al mes, o ` +
          `${formatARS(capacidad.capacidad * 12, { decimales: false })} al año si sostenés el ritmo.`,
      });
    }

    if (capacidad.cargaFija !== null && capacidad.cargaFija > 0.5) {
      out.push({
        id: "carga-fija",
        severidad: "atencion",
        grupo: "ahorro",
        titulo: `El ${Math.round(capacidad.cargaFija * 100)}% de tu ingreso ya está comprometido`,
        detalle:
          `Tu piso mensual es ${formatARS(capacidad.fijos, { decimales: false })}. ` +
          `Solo tenés ${formatARS(capacidad.margenDiscrecional, { decimales: false })} ` +
          "sobre los que podés decidir mes a mes.",
        seccion: "/fijos",
      });
    }
  }

  if (fondo && fondo.mesesCubiertos !== null && fondo.ahorroActual > 0 && fondo.mesesCubiertos < 3) {
    out.push({
      id: "fondo-corto",
      severidad: fondo.mesesCubiertos < 1 ? "critico" : "atencion",
      grupo: "ahorro",
      titulo: `Tu colchón cubre ${fondo.mesesCubiertos.toFixed(1)} meses de gastos fijos`,
      detalle:
        `Con ${formatARS(fondo.ahorroActual, { decimales: false })} ahorrados y un piso de ` +
        `${formatARS(fondo.pisoMensual, { decimales: false })} por mes. La referencia habitual ` +
        `son ${fondo.metaMeses} meses.`,
      accion:
        fondo.mesesParaMeta !== null
          ? `Al ritmo actual llegarías en ${fondo.mesesParaMeta} meses.`
          : "Sin capacidad de ahorro positiva no vas a poder construirlo.",
      seccion: "/ahorro",
    });
  }

  // ---------- Gasto hormiga ----------
  for (const c of categorias) {
    if (c.categoriaId === "__otros" || c.cantidad < 12) continue;
    const ticket = c.monto / c.cantidad;
    if (ticket < resumen.gastos * 0.02 && c.porcentaje >= 8) {
      out.push({
        id: `hormiga-${c.categoriaId}`,
        severidad: "info",
        grupo: "gasto",
        titulo: `${c.nombre}: ${c.cantidad} consumos chicos que suman ${formatARS(c.monto, { decimales: false })}`,
        detalle:
          `El ticket promedio es ${formatARS(ticket, { decimales: false })}, pero por volumen ` +
          `representa el ${Math.round(c.porcentaje)}% del mes. Es el gasto que no se siente al hacerlo.`,
        seccion: "/gastos",
      });
    }
  }

  // ---------- Tendencia sostenida ----------
  if (serie.length >= 3) {
    const ult = serie.slice(-3).map((s) => s.gastos);
    if (ult[0] < ult[1] && ult[1] < ult[2] && ult[0] > 0) {
      const alza = ((ult[2] - ult[0]) / ult[0]) * 100;
      if (alza >= 15) {
        out.push({
          id: "tendencia-alza",
          severidad: "atencion",
          grupo: "gasto",
          titulo: `Tu gasto sube tres meses seguidos (+${Math.round(alza)}%)`,
          detalle:
            `Pasaste de ${formatARS(ult[0], { decimales: false })} a ` +
            `${formatARS(ult[2], { decimales: false })}. No es un mes puntual: es una tendencia.`,
          accion: "Compará contra el mes anterior para ver qué categoría la empuja.",
          seccion: "/gastos",
        });
      }
    }
  }

  return out.sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);
}

/** Categorías previas por id, para comparar contra el promedio histórico. */
export function historicoPorCategoria(
  porPeriodo: ReadonlyMap<string, readonly GastoPorCategoria[]>,
  periodoActual: string,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const [periodo, cats] of porPeriodo) {
    if (periodo >= periodoActual) continue;
    for (const c of cats) {
      if (!out.has(c.categoriaId)) out.set(c.categoriaId, []);
      out.get(c.categoriaId)!.push(c.monto);
    }
  }
  return out;
}

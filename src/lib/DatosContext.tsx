"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { db, type Movimiento, type IngresoManual } from "./db/esquema";
import { asegurarPersistencia, mapaIngresos, todaLaConfig } from "./db/repo";
import {
  resumenDe, gastoPorCategoria, gastoDiario, gastoFueraDelMes, cuotasComprometidas, serieMensual,
  naturalezasDe, perfiles as perfilesDe, flujoSankey, variacionPorCategoria,
  type ResumenPeriodo, type GastoPorCategoria, type CuotaFutura, type FlujoSankey,
} from "./analisis/metricas";
import { capacidadDe, proyectarAhorro, fondoEmergencia, type CapacidadAhorro } from "./analisis/ahorro";
import { generarInsights, historicoPorCategoria, type Insight } from "./analisis/insights";
import type { PerfilRecurrencia, Naturaleza } from "./categorize/recurrencia";
import { periodoAnterior } from "./utils";

/**
 * Estado global de la app.
 *
 * Todo el cálculo derivado vive acá y no en las páginas: las métricas se
 * comparten entre secciones (los insights necesitan lo mismo que el dashboard)
 * y recalcularlas por página sería trabajo repetido sobre los mismos datos.
 */

export interface Datos {
  cargando: boolean;
  movimientos: Movimiento[];
  periodos: string[];
  periodo: string | null;
  setPeriodo: (p: string) => void;
  ingresosPorPeriodo: Map<string, number>;
  ahorroAcumulado: number;
  /**
   * Si el navegador se comprometió a no desalojar la base.
   * `null` = no se puede saber (el navegador no expone la API).
   */
  persistente: boolean | null;

  resumen: ResumenPeriodo | null;
  previo: ResumenPeriodo | null;
  serie: ResumenPeriodo[];
  categorias: GastoPorCategoria[];
  categoriasPorPeriodo: Map<string, GastoPorCategoria[]>;
  diario: Map<string, number>;
  /** Del resumen del mes, lo que se compró en otro mes: cuotas y ajustes. */
  fueraDelMes: { monto: number; cantidad: number };
  cuotas: CuotaFutura[];
  flujo: FlujoSankey | null;
  perfiles: PerfilRecurrencia[];
  naturalezas: ReadonlyMap<string, Naturaleza>;
  movimientosDelMes: Movimiento[];
  capacidad: CapacidadAhorro | null;
  proyeccion: ReturnType<typeof proyectarAhorro> | null;
  fondo: ReturnType<typeof fondoEmergencia> | null;
  insights: Insight[];
  variacion: ReturnType<typeof variacionPorCategoria>;

  recargar: () => Promise<void>;
}

const Ctx = createContext<Datos | null>(null);

export function useDatos(): Datos {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDatos fuera del proveedor");
  return c;
}

export function DatosProvider({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [ingresosPorPeriodo, setIngresos] = useState<Map<string, number>>(new Map());
  const [ahorroAcumulado, setAhorroAcumulado] = useState(0);
  const [periodoSel, setPeriodo] = useState<string | null>(null);
  const [persistente, setPersistente] = useState<boolean | null>(null);

  const recargar = useCallback(async () => {
    const [ms, ing, cfg] = await Promise.all([
      db().movimientos.toArray(), mapaIngresos(), todaLaConfig(),
    ]);
    setMovimientos(ms.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setIngresos(ing);
    setAhorroAcumulado(Number(cfg.get("ahorroAcumulado") ?? 0));
    setCargando(false);
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);

  // Se pide una sola vez al arrancar. Si el navegador dice que no, el usuario
  // tiene que enterarse: sin persistencia el respaldo deja de ser opcional.
  useEffect(() => {
    void asegurarPersistencia().then(setPersistente);
  }, []);

  const periodos = useMemo(
    () => [...new Set(movimientos.map((m) => m.periodo))].sort(),
    [movimientos],
  );
  const periodo = periodoSel ?? periodos[periodos.length - 1] ?? null;

  const derivado = useMemo(() => {
    if (!periodo) {
      return {
        resumen: null, previo: null, serie: [], categorias: [],
        categoriasPorPeriodo: new Map<string, GastoPorCategoria[]>(),
        diario: new Map<string, number>(), fueraDelMes: { monto: 0, cantidad: 0 },
        cuotas: [], flujo: null, perfiles: [],
        naturalezas: new Map<string, Naturaleza>() as ReadonlyMap<string, Naturaleza>,
        movimientosDelMes: [], capacidad: null, proyeccion: null, fondo: null,
        insights: [], variacion: [],
      };
    }

    const naturalezas = naturalezasDe(movimientos, periodos);
    const serie = serieMensual(movimientos, periodos, naturalezas, ingresosPorPeriodo);
    const resumen = resumenDe(movimientos, periodo, naturalezas, ingresosPorPeriodo.get(periodo) ?? 0);
    const anterior = periodoAnterior(periodo);
    const previo = periodos.includes(anterior)
      ? resumenDe(movimientos, anterior, naturalezas, ingresosPorPeriodo.get(anterior) ?? 0)
      : null;

    const categorias = gastoPorCategoria(movimientos, periodo);
    const categoriasPorPeriodo = new Map(
      periodos.map((p) => [p, gastoPorCategoria(movimientos, p, 99)]),
    );
    const cuotas = cuotasComprometidas(movimientos);
    const perfiles = perfilesDe(movimientos, periodos);
    const capacidad = capacidadDe(resumen);
    const proyeccion = proyectarAhorro(serie);
    const fondo = fondoEmergencia(serie, ahorroAcumulado, proyeccion.base);

    return {
      resumen, previo, serie, categorias, categoriasPorPeriodo,
      diario: gastoDiario(movimientos, periodo),
      fueraDelMes: gastoFueraDelMes(movimientos, periodo),
      cuotas,
      flujo: flujoSankey(movimientos, periodo, naturalezas, resumen),
      perfiles, naturalezas,
      movimientosDelMes: movimientos.filter((m) => m.periodo === periodo),
      capacidad, proyeccion, fondo,
      insights: generarInsights({
        periodo, resumen, serie, categorias, perfiles, cuotas, capacidad, fondo,
        categoriasPrevias: historicoPorCategoria(categoriasPorPeriodo, periodo),
      }),
      variacion: previo ? variacionPorCategoria(movimientos, anterior, periodo) : [],
    };
  }, [movimientos, periodos, periodo, ingresosPorPeriodo, ahorroAcumulado]);

  const valor: Datos = {
    cargando, movimientos, periodos, periodo, setPeriodo,
    ingresosPorPeriodo, ahorroAcumulado, persistente, recargar, ...derivado,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export type { IngresoManual };

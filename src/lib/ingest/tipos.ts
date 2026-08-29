export type Moneda = "ARS" | "USD";

/** Una fila del Excel, ya normalizada pero sin categorizar ni deduplicar. */
export interface MovimientoCrudo {
  nroTarjeta: string | null;
  fecha: Date;
  /** Texto tal cual lo emitió el banco. NUNCA se pisa. */
  establecimiento: string;
  cuotaNro: number | null;
  cuotaTotal: number | null;
  importeARS: number | null;
  importeUSD: number | null;
  /**
   * El banco no trajo fecha válida y se le asignó la del cierre del resumen.
   * Pasa con ajustes y devoluciones, que BBVA exporta con fecha 01/01/0001.
   */
  fechaEstimada: boolean;
}

/** Subtotal por tarjeta que BBVA emite al cerrar cada sección. */
export interface SubtotalTarjeta {
  nroTarjeta: string;
  declaradoARS: number | null;
  declaradoUSD: number | null;
  calculadoARS: number;
  calculadoUSD: number;
  cuadra: boolean;
}

export interface TotalesDeclarados {
  ars: number | null;
  usd: number | null;
}

export interface Validacion {
  /** true si la suma de movimientos coincide con el total del archivo. */
  cuadra: boolean;
  difARS: number;
  difUSD: number;
  /** Tolerancia usada (centavos de redondeo). */
  tolerancia: number;
}

export interface ResultadoParseo {
  ok: boolean;
  origen: "bbva-tarjeta-xls" | "bbva-cuenta-xls" | "desconocido";
  /**
   * Período del resumen, ej "2026-06". Sale del CONTENIDO, no del nombre de
   * hoja: BBVA nombra la hoja con la fecha de descarga, así que dos resúmenes
   * distintos bajados el mismo día traen el mismo nombre.
   */
  periodo: string | null;
  /** Fecha del movimiento más nuevo (ISO). Es el cierre efectivo del resumen. */
  fechaCierre: string | null;
  movimientos: MovimientoCrudo[];
  totalDeclarado: TotalesDeclarados;
  totalCalculado: { ars: number; usd: number };
  validacion: Validacion;
  /** Un resumen puede traer varias tarjetas, cada una con su subtotal. */
  subtotales: SubtotalTarjeta[];
  /** Problemas no fatales que el usuario debería mirar. */
  advertencias: string[];
  /** Error fatal: el archivo no se pudo interpretar. */
  error: string | null;
}

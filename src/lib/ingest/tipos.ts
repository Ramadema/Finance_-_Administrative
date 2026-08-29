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
  /** Período detectado del nombre de hoja, ej "2026-08". */
  periodo: string | null;
  movimientos: MovimientoCrudo[];
  totalDeclarado: TotalesDeclarados;
  totalCalculado: { ars: number; usd: number };
  validacion: Validacion;
  /** Problemas no fatales que el usuario debería mirar. */
  advertencias: string[];
  /** Error fatal: el archivo no se pudo interpretar. */
  error: string | null;
}

import Dexie, { type Table } from "dexie";
import type { FuenteCategoria, Regla } from "../categorize/motor";

/**
 * Base local en IndexedDB. Tus movimientos no salen de este navegador.
 *
 * Regla de oro: `descripcionCruda` NUNCA se pisa. Todo lo derivado (comercio,
 * categoría, naturaleza) es recalculable — si mejoro el motor, reproceso sin
 * pedirte que vuelvas a subir nada.
 */

export interface Importacion {
  id: string;
  nombreArchivo: string;
  hashArchivo: string;
  origen: string;
  periodo: string | null;
  fechaImport: string;
  cantidadMovimientos: number;
  totalDeclaradoARS: number | null;
  totalCalculadoARS: number;
  cuadra: boolean;
  advertencias: string[];
}

export interface Movimiento {
  id: string;
  importacionId: string;
  /** ISO "2026-08-05". Ordenable como texto. */
  fecha: string;
  /** "2026-08" */
  periodo: string;
  /** Tal cual lo emitió el banco. Intocable. */
  descripcionCruda: string;
  claveComercio: string;
  comercio: string;
  categoria: string;
  subcategoria: string | null;
  fuenteCategoria: FuenteCategoria;
  montoARS: number;
  montoUSD: number | null;
  cuotaNro: number | null;
  cuotaTotal: number | null;
  nroTarjeta: string | null;
  /** Si lo tocaste vos, un reimport no lo pisa. */
  editadoManualmente: boolean;
  /** Ocultar del análisis sin borrarlo. */
  excluido: boolean;
}

/** La memoria que aprende: categorizás una vez y no vuelve a preguntar. */
export interface ComercioMemorizado {
  clave: string;
  comercio: string;
  categoria: string;
  subcategoria: string | null;
  vecesUsado: number;
  actualizado: string;
}

export interface Presupuesto {
  id: string;
  categoria: string;
  montoMensual: number;
}

export interface Ajuste {
  clave: string;
  valor: unknown;
}

export class FinanzasDB extends Dexie {
  importaciones!: Table<Importacion, string>;
  movimientos!: Table<Movimiento, string>;
  comercios!: Table<ComercioMemorizado, string>;
  reglas!: Table<Regla, string>;
  presupuestos!: Table<Presupuesto, string>;
  ajustes!: Table<Ajuste, string>;

  constructor() {
    super("finanzas");
    this.version(1).stores({
      importaciones: "id, hashArchivo, periodo, fechaImport",
      movimientos: "id, periodo, fecha, categoria, claveComercio, importacionId, excluido",
      comercios: "clave, categoria",
      reglas: "id, prioridad",
      presupuestos: "id, categoria",
      ajustes: "clave",
    });
  }
}

/** Singleton perezoso: Dexie solo existe en el browser. */
let _db: FinanzasDB | null = null;
export function db(): FinanzasDB {
  if (typeof window === "undefined") {
    throw new Error("La base es local: solo se puede usar en el cliente.");
  }
  if (!_db) _db = new FinanzasDB();
  return _db;
}

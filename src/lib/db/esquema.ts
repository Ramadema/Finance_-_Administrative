import Dexie, { type Table } from "dexie";
import { clasificar, type FuenteCategoria, type Regla } from "../categorize/motor";

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
  /** Fecha de COMPRA, ISO "2026-08-05". Ordenable como texto. */
  fecha: string;
  /**
   * Mes del RESUMEN que lo cobra, "2026-08". No siempre es el mes de `fecha`:
   * la cuota 3/12 de una compra de mayo la pagás en julio, y BBVA repite la
   * fecha de la compra original en cada cuota. Todo lo mensual agrupa por acá.
   */
  periodo: string;
  /**
   * El banco no trajo fecha (la exporta como 01/01/0001) y se le asignó la del
   * cierre del resumen. Pasa con ajustes y devoluciones.
   */
  fechaEstimada: boolean;
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

/**
 * Ingreso cargado a mano.
 *
 * El resumen de tarjeta de BBVA no trae ingresos — solo consumos. Sin esto, la
 * app puede decirte cuánto gastás pero nunca cuánto te sobra, que es justamente
 * la pregunta que importa.
 */
export interface IngresoManual {
  id: string;
  /** "2026-08" */
  periodo: string;
  concepto: string;
  monto: number;
  /** Marca de dónde salió, para poder deshacer un "repetir hacia adelante". */
  origen: "manual" | "repetido";
}

/** Metas y parámetros que el usuario configura. */
export interface Config {
  clave: string;
  valor: number | string | boolean | null;
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
  ingresos!: Table<IngresoManual, string>;
  config!: Table<Config, string>;

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

    // v2: ingresos manuales y configuración de metas.
    this.version(2).stores({
      importaciones: "id, hashArchivo, periodo, fechaImport",
      movimientos: "id, periodo, fecha, categoria, claveComercio, importacionId, excluido",
      comercios: "clave, categoria",
      reglas: "id, prioridad",
      presupuestos: "id, categoria",
      ajustes: "clave",
      ingresos: "id, periodo",
      config: "clave",
    });

    // v3: `fechaEstimada` en los movimientos. Los que ya estaban guardados
    // traían fecha del banco sí o sí, así que arrancan en false.
    this.version(3)
      .stores({
        importaciones: "id, hashArchivo, periodo, fechaImport",
        movimientos: "id, periodo, fecha, categoria, claveComercio, importacionId, excluido",
        comercios: "clave, categoria",
        reglas: "id, prioridad",
        presupuestos: "id, categoria",
        ajustes: "clave",
        ingresos: "id, periodo",
        config: "clave",
      })
      .upgrade((tx) =>
        tx
          .table<Movimiento>("movimientos")
          .toCollection()
          .modify((m) => {
            m.fechaEstimada = m.fechaEstimada ?? false;
          }),
      );

    // v4: "Ocio y viajes" se parte en "Viajes" y "Joda y ocio". Lo ya guardado
    // apunta al id viejo, que dejó de existir: sin remapear, `categoria()` lo
    // manda a "Sin categorizar" y los números del mes cambian solos, sin que
    // nada en pantalla lo explique.
    //
    // Se reclasifica con la semilla nueva, que ya sabe que un cine es joda y
    // una aerolínea es viaje. Lo que no reconoce cae en "joda": sacando los
    // viajes —que casi siempre matchean, Despegar, Aerolíneas, Booking— era el
    // resto del cajón viejo.
    this.version(4).upgrade(async (tx) => {
      const destino = (descripcion: string) => {
        const c = clasificar(descripcion);
        return c.categoria === "viajes" || c.categoria === "joda"
          ? { categoria: c.categoria, subcategoria: c.subcategoria }
          : { categoria: "joda", subcategoria: null };
      };

      await tx
        .table<Movimiento>("movimientos")
        .where("categoria")
        .equals("ocio")
        .modify((m) => {
          Object.assign(m, destino(m.descripcionCruda));
        });

      // La memoria también: si queda apuntando a "ocio", el próximo import
      // vuelve a escribir la categoría muerta encima de la nueva.
      await tx
        .table<ComercioMemorizado>("comercios")
        .where("categoria")
        .equals("ocio")
        .modify((c) => {
          Object.assign(c, destino(c.clave));
        });
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

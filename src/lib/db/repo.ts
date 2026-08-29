import { db, type Movimiento, type Importacion, type ComercioMemorizado } from "./esquema";
import { parsearBBVATarjeta } from "../ingest/bbva-xls";
import { asignarIds, hashArchivo, fechaISO, periodoDe } from "../ingest/dedupe";
import { clasificar, type EntradaMemoria, type Regla } from "../categorize/motor";
import type { ResultadoParseo } from "../ingest/tipos";

export interface ResultadoImport {
  ok: boolean;
  error: string | null;
  yaImportado: boolean;
  nuevos: number;
  repetidos: number;
  preservados: number;
  parseo: ResultadoParseo | null;
  importacionId: string | null;
}

/** Carga la memoria de comercios como Map para el motor. */
async function cargarMemoria(): Promise<Map<string, EntradaMemoria>> {
  const filas = await db().comercios.toArray();
  return new Map(
    filas.map((c) => [
      c.clave,
      { categoria: c.categoria, subcategoria: c.subcategoria, comercio: c.comercio },
    ]),
  );
}

async function cargarReglas(): Promise<Regla[]> {
  return db().reglas.toArray();
}

/**
 * Pipeline completo: archivo → parseo → clasificación → dedupe → guardado.
 *
 * Idempotente: reimportar el mismo archivo no duplica nada. Y los movimientos
 * que editaste a mano se preservan — un reimport nunca te pisa tu trabajo.
 */
export async function importarArchivo(archivo: File): Promise<ResultadoImport> {
  const base: ResultadoImport = {
    ok: false, error: null, yaImportado: false,
    nuevos: 0, repetidos: 0, preservados: 0,
    parseo: null, importacionId: null,
  };

  const buffer = await archivo.arrayBuffer();
  const hash = hashArchivo(buffer);

  const previo = await db().importaciones.where("hashArchivo").equals(hash).first();

  const parseo = parsearBBVATarjeta(buffer);
  if (parseo.error) return { ...base, error: parseo.error, parseo };

  const [memoria, reglas] = await Promise.all([cargarMemoria(), cargarReglas()]);
  const ids = asignarIds(parseo.movimientos);

  const candidatos: Movimiento[] = parseo.movimientos.map((m, i) => {
    const c = clasificar(m.establecimiento, { memoria, reglas });
    return {
      id: ids[i],
      importacionId: hash,
      fecha: fechaISO(m.fecha),
      periodo: periodoDe(m.fecha),
      descripcionCruda: m.establecimiento,
      claveComercio: c.claveComercio,
      comercio: c.comercio,
      categoria: c.categoria,
      subcategoria: c.subcategoria,
      fuenteCategoria: c.fuente,
      montoARS: m.importeARS ?? 0,
      montoUSD: m.importeUSD,
      cuotaNro: m.cuotaNro,
      cuotaTotal: m.cuotaTotal,
      nroTarjeta: m.nroTarjeta,
      editadoManualmente: false,
      excluido: false,
    };
  });

  const existentes = await db().movimientos.bulkGet(candidatos.map((c) => c.id));
  const aGuardar: Movimiento[] = [];
  let repetidos = 0;
  let preservados = 0;

  candidatos.forEach((cand, i) => {
    const ya = existentes[i];
    if (!ya) {
      aGuardar.push(cand);
      return;
    }
    repetidos++;
    // Lo que tocaste a mano no se pisa nunca.
    if (ya.editadoManualmente) {
      preservados++;
      return;
    }
    aGuardar.push({ ...cand, excluido: ya.excluido });
  });

  const importacion: Importacion = {
    id: hash,
    nombreArchivo: archivo.name,
    hashArchivo: hash,
    origen: parseo.origen,
    periodo: parseo.periodo,
    fechaImport: new Date().toISOString(),
    cantidadMovimientos: parseo.movimientos.length,
    totalDeclaradoARS: parseo.totalDeclarado.ars,
    totalCalculadoARS: parseo.totalCalculado.ars,
    cuadra: parseo.validacion.cuadra,
    advertencias: parseo.advertencias,
  };

  await db().transaction("rw", db().movimientos, db().importaciones, async () => {
    if (aGuardar.length) await db().movimientos.bulkPut(aGuardar);
    await db().importaciones.put(importacion);
  });

  return {
    ok: true,
    error: null,
    yaImportado: Boolean(previo),
    nuevos: aGuardar.length - (repetidos - preservados),
    repetidos,
    preservados,
    parseo,
    importacionId: hash,
  };
}

/** Todos los períodos con datos, ascendente. */
export async function periodosDisponibles(): Promise<string[]> {
  const movs = await db().movimientos.toArray();
  return [...new Set(movs.map((m) => m.periodo))].sort();
}

export async function movimientosDe(periodo?: string): Promise<Movimiento[]> {
  const t = db().movimientos;
  const movs = periodo ? await t.where("periodo").equals(periodo).toArray() : await t.toArray();
  return movs.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Enseñarle una categoría: guarda la memoria y reaplica a TODO el histórico
 * de ese comercio (salvo lo que hayas editado individualmente).
 */
export async function recategorizarComercio(
  claveComercio: string,
  categoria: string,
  subcategoria: string | null,
  nombreComercio?: string,
): Promise<number> {
  const afectados = await db().movimientos.where("claveComercio").equals(claveComercio).toArray();
  const comercio = nombreComercio ?? afectados[0]?.comercio ?? claveComercio;

  const memo: ComercioMemorizado = {
    clave: claveComercio,
    comercio,
    categoria,
    subcategoria,
    vecesUsado: afectados.length,
    actualizado: new Date().toISOString(),
  };

  const actualizados = afectados
    .filter((m) => !m.editadoManualmente)
    .map((m) => ({ ...m, categoria, subcategoria, comercio, fuenteCategoria: "memoria" as const }));

  await db().transaction("rw", db().movimientos, db().comercios, async () => {
    await db().comercios.put(memo);
    if (actualizados.length) await db().movimientos.bulkPut(actualizados);
  });

  return actualizados.length;
}

/** Cambio puntual de un movimiento: queda blindado contra reimports. */
export async function editarMovimiento(
  id: string,
  cambios: Partial<Pick<Movimiento, "categoria" | "subcategoria" | "excluido" | "comercio">>,
): Promise<void> {
  await db().movimientos.update(id, { ...cambios, editadoManualmente: true });
}

/** Reprocesa la clasificación de todo el histórico con las reglas actuales. */
export async function reclasificarTodo(): Promise<number> {
  const [memoria, reglas, movs] = await Promise.all([
    cargarMemoria(), cargarReglas(), db().movimientos.toArray(),
  ]);
  const actualizados = movs
    .filter((m) => !m.editadoManualmente)
    .map((m) => {
      const c = clasificar(m.descripcionCruda, { memoria, reglas });
      return { ...m, categoria: c.categoria, subcategoria: c.subcategoria,
               comercio: c.comercio, claveComercio: c.claveComercio, fuenteCategoria: c.fuente };
    });
  if (actualizados.length) await db().movimientos.bulkPut(actualizados);
  return actualizados.length;
}

// ---------- Respaldo: la red de seguridad del modelo local ----------

export async function exportarJSON(): Promise<string> {
  const [movimientos, importaciones, comercios, reglas, presupuestos] = await Promise.all([
    db().movimientos.toArray(), db().importaciones.toArray(), db().comercios.toArray(),
    db().reglas.toArray(), db().presupuestos.toArray(),
  ]);
  return JSON.stringify(
    { version: 1, exportado: new Date().toISOString(),
      movimientos, importaciones, comercios, reglas, presupuestos },
    null, 2,
  );
}

export async function importarJSON(texto: string): Promise<{ ok: boolean; error?: string }> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(texto);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  if (!Array.isArray(data.movimientos)) {
    return { ok: false, error: "No parece un respaldo de esta app." };
  }
  await db().transaction("rw",
    [db().movimientos, db().importaciones, db().comercios, db().reglas, db().presupuestos],
    async () => {
      await db().movimientos.bulkPut(data.movimientos as Movimiento[]);
      if (Array.isArray(data.importaciones)) await db().importaciones.bulkPut(data.importaciones as Importacion[]);
      if (Array.isArray(data.comercios)) await db().comercios.bulkPut(data.comercios as ComercioMemorizado[]);
      if (Array.isArray(data.reglas)) await db().reglas.bulkPut(data.reglas as Regla[]);
      if (Array.isArray(data.presupuestos)) await db().presupuestos.bulkPut(data.presupuestos as never[]);
    },
  );
  return { ok: true };
}

export async function borrarTodo(): Promise<void> {
  await db().transaction("rw",
    [db().movimientos, db().importaciones, db().comercios, db().reglas, db().presupuestos],
    async () => {
      await Promise.all([
        db().movimientos.clear(), db().importaciones.clear(), db().comercios.clear(),
        db().reglas.clear(), db().presupuestos.clear(),
      ]);
    },
  );
}

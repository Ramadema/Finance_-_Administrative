import { db, type Movimiento, type Importacion, type ComercioMemorizado,
         type IngresoManual, type Config } from "./esquema";
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
      // El período sale del RESUMEN, no de la fecha de compra. Si se usara la
      // fecha, las cuotas de una compra de mayo caerían todas en mayo: mayo
      // saldría con la compra repetida una vez por resumen importado, y los
      // meses que realmente las pagan saldrían en cero.
      periodo: parseo.periodo ?? periodoDe(m.fecha),
      fechaEstimada: m.fechaEstimada,
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

/** Los archivos que ya importaste, del más reciente al más viejo. */
export async function listarImportaciones(): Promise<Importacion[]> {
  const filas = await db().importaciones.toArray();
  return filas.sort((a, b) => b.fechaImport.localeCompare(a.fechaImport));
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
  const [movimientos, importaciones, comercios, reglas, presupuestos, ingresos, config] =
    await Promise.all([
      db().movimientos.toArray(), db().importaciones.toArray(), db().comercios.toArray(),
      db().reglas.toArray(), db().presupuestos.toArray(),
      db().ingresos.toArray(), db().config.toArray(),
    ]);
  return JSON.stringify(
    { version: 2, exportado: new Date().toISOString(),
      movimientos, importaciones, comercios, reglas, presupuestos, ingresos, config },
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
    [db().movimientos, db().importaciones, db().comercios, db().reglas, db().presupuestos,
     db().ingresos, db().config],
    async () => {
      await db().movimientos.bulkPut(data.movimientos as Movimiento[]);
      if (Array.isArray(data.importaciones)) await db().importaciones.bulkPut(data.importaciones as Importacion[]);
      if (Array.isArray(data.comercios)) await db().comercios.bulkPut(data.comercios as ComercioMemorizado[]);
      if (Array.isArray(data.reglas)) await db().reglas.bulkPut(data.reglas as Regla[]);
      if (Array.isArray(data.presupuestos)) await db().presupuestos.bulkPut(data.presupuestos as never[]);
      if (Array.isArray(data.ingresos)) await db().ingresos.bulkPut(data.ingresos as IngresoManual[]);
      if (Array.isArray(data.config)) await db().config.bulkPut(data.config as Config[]);
    },
  );
  return { ok: true };
}

/**
 * Le pide al navegador que NO desaloje la base.
 *
 * Por defecto IndexedDB es "best effort": si al dispositivo le falta espacio, el
 * navegador puede borrarla sin avisar y sin que la app se entere. `persist()` la
 * marca como durable.
 *
 * Devuelve el estado en vez de tragárselo porque la respuesta cambia qué tan
 * grave es no tener respaldo: Chrome la concede según el uso del sitio, Firefox
 * pregunta, y en incógnito siempre es que no. Si no hay persistencia, el JSON es
 * la única copia que sobrevive.
 */
export async function asegurarPersistencia(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null; // algunos navegadores tiran en contextos no seguros
  }
}

export async function borrarTodo(): Promise<void> {
  await db().transaction("rw",
    [db().movimientos, db().importaciones, db().comercios, db().reglas, db().presupuestos,
     db().ingresos, db().config],
    async () => {
      await Promise.all([
        db().movimientos.clear(), db().importaciones.clear(), db().comercios.clear(),
        db().reglas.clear(), db().presupuestos.clear(),
        db().ingresos.clear(), db().config.clear(),
      ]);
    },
  );
}

// ---------- Ingresos manuales ----------

/**
 * El resumen de tarjeta no trae ingresos, así que se cargan a mano. Sin esto
 * la app calcula cuánto gastás pero no cuánto te sobra.
 */
export async function ingresosDe(periodo: string): Promise<IngresoManual[]> {
  const filas = await db().ingresos.where("periodo").equals(periodo).toArray();
  return filas.sort((a, b) => b.monto - a.monto);
}

export async function todosLosIngresos(): Promise<IngresoManual[]> {
  return db().ingresos.toArray();
}

/** Total de ingresos por período, para no recalcular en cada gráfico. */
export async function mapaIngresos(): Promise<Map<string, number>> {
  const filas = await db().ingresos.toArray();
  const m = new Map<string, number>();
  for (const f of filas) m.set(f.periodo, (m.get(f.periodo) ?? 0) + f.monto);
  return m;
}

export async function guardarIngreso(
  ingreso: Omit<IngresoManual, "id"> & { id?: string },
): Promise<string> {
  const id = ingreso.id ?? `${ingreso.periodo}|${ingreso.concepto}|${crypto.randomUUID()}`;
  await db().ingresos.put({ ...ingreso, id });
  return id;
}

export async function borrarIngreso(id: string): Promise<void> {
  await db().ingresos.delete(id);
}

/**
 * Copia los ingresos de un mes hacia los siguientes.
 *
 * No pisa lo que ya cargaste a mano: solo completa los meses que no tienen ese
 * concepto. Así "mi sueldo es el mismo" se carga una vez, pero el mes que
 * cobraste el aguinaldo no se te sobrescribe.
 */
export async function repetirIngresosHacia(
  periodoOrigen: string,
  periodosDestino: readonly string[],
): Promise<number> {
  const origen = await ingresosDe(periodoOrigen);
  if (origen.length === 0) return 0;

  const nuevos: IngresoManual[] = [];
  for (const destino of periodosDestino) {
    if (destino === periodoOrigen) continue;
    const yaHay = await db().ingresos.where("periodo").equals(destino).toArray();
    const conceptos = new Set(yaHay.map((i) => i.concepto.toLowerCase()));
    for (const i of origen) {
      if (conceptos.has(i.concepto.toLowerCase())) continue;
      nuevos.push({
        id: `${destino}|${i.concepto}|${crypto.randomUUID()}`,
        periodo: destino,
        concepto: i.concepto,
        monto: i.monto,
        origen: "repetido",
      });
    }
  }
  if (nuevos.length) await db().ingresos.bulkPut(nuevos);
  return nuevos.length;
}

// ---------- Configuración ----------

export async function leerConfig<T extends Config["valor"]>(
  clave: string, porDefecto: T,
): Promise<T> {
  const fila = await db().config.get(clave);
  return (fila?.valor as T) ?? porDefecto;
}

export async function guardarConfig(clave: string, valor: Config["valor"]): Promise<void> {
  await db().config.put({ clave, valor });
}

export async function todaLaConfig(): Promise<Map<string, Config["valor"]>> {
  const filas = await db().config.toArray();
  return new Map(filas.map((f) => [f.clave, f.valor]));
}

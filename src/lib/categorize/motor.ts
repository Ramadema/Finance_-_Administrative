import { clave, incluyeTolerante, titulizar } from "./normalizar";
import { SEMILLA_ORDENADA } from "./semilla";

/**
 * Cascada de categorización: barata → cara. Ninguna capa usa red ni LLM.
 *
 *   1. Reglas tuyas       — las escribís vos, mandan sobre todo lo demás.
 *   2. Memoria de comercios — lo que ya categorizaste una vez.
 *   3. Diccionario semilla  — ~180 comercios argentinos precargados.
 *   4. Sin categorizar      — te lo pregunta una vez y pasa a ser memoria.
 *
 * Al tercer mes casi todo cae en las capas 1-2 y la 3 queda de reserva.
 */

export type FuenteCategoria = "regla" | "memoria" | "semilla" | "ninguna";

export interface Regla {
  id: string;
  /** Texto a buscar, o regex si `esRegex`. */
  patron: string;
  esRegex: boolean;
  categoria: string;
  subcategoria: string | null;
  /** Mayor prioridad gana. */
  prioridad: number;
}

/** Lo que el usuario ya enseñó: clave normalizada → categoría. */
export interface EntradaMemoria {
  categoria: string;
  subcategoria: string | null;
  comercio: string;
}

export interface Clasificacion {
  categoria: string;
  subcategoria: string | null;
  /** Nombre canónico del comercio, para agrupar y mostrar. */
  comercio: string;
  /** Clave normalizada — es lo que indexa la memoria. */
  claveComercio: string;
  fuente: FuenteCategoria;
  /** 1 = el usuario lo decidió; 0.8 = semilla; 0 = nadie sabe. */
  confianza: number;
}

export function clasificar(
  descripcion: string,
  ctx: { reglas?: readonly Regla[]; memoria?: ReadonlyMap<string, EntradaMemoria> } = {},
): Clasificacion {
  const k = clave(descripcion);
  const cruda = descripcion.toUpperCase();

  // ---- Capa 1: reglas del usuario ----
  const reglas = [...(ctx.reglas ?? [])].sort((a, b) => b.prioridad - a.prioridad);
  for (const r of reglas) {
    let matchea = false;
    if (r.esRegex) {
      try {
        matchea = new RegExp(r.patron, "i").test(descripcion);
      } catch {
        matchea = false; // regex rota del usuario: se ignora, no rompe el import
      }
    } else {
      const patron = r.patron.toUpperCase();
      matchea = incluyeTolerante(cruda, patron) || incluyeTolerante(k, patron);
    }
    if (matchea) {
      return {
        categoria: r.categoria,
        subcategoria: r.subcategoria,
        comercio: titulizar(descripcion),
        claveComercio: k,
        fuente: "regla",
        confianza: 1,
      };
    }
  }

  // ---- Capa 2: memoria de comercios ----
  const recordado = ctx.memoria?.get(k);
  if (recordado) {
    return {
      categoria: recordado.categoria,
      subcategoria: recordado.subcategoria,
      comercio: recordado.comercio,
      claveComercio: k,
      fuente: "memoria",
      confianza: 1,
    };
  }

  // ---- Capa 3: diccionario semilla (más específico primero) ----
  for (const e of SEMILLA_ORDENADA) {
    if (!incluyeTolerante(k, e.patron)) continue;

    // La clave pasa a ser el nombre canónico, no el texto del banco.
    //
    // BBVA trunca el campo distinto cada mes: el mismo Game Pass sale
    // "MICROSOFT*PC GAME PASS" y "Microsoft*PC Gam Microsoft*PC". Agrupando por
    // el texto crudo son dos comercios, y una suscripción que aparece una sola
    // vez por mes bajo dos nombres nunca se detecta como gasto fijo.
    const kCanonica = clave(e.comercio) || k;

    // Si ya recategorizaste el grupo, tu decisión manda sobre la semilla.
    const delGrupo = ctx.memoria?.get(kCanonica);
    if (delGrupo) {
      return {
        categoria: delGrupo.categoria,
        subcategoria: delGrupo.subcategoria,
        comercio: delGrupo.comercio,
        claveComercio: kCanonica,
        fuente: "memoria",
        confianza: 1,
      };
    }

    return {
      categoria: e.categoria,
      subcategoria: e.subcategoria ?? null,
      comercio: e.comercio,
      claveComercio: kCanonica,
      fuente: "semilla",
      confianza: 0.8,
    };
  }

  // ---- Capa 4: nadie sabe ----
  return {
    categoria: "sin_categoria",
    subcategoria: null,
    comercio: titulizar(descripcion),
    claveComercio: k,
    fuente: "ninguna",
    confianza: 0,
  };
}

/** Cobertura del import: cuánto quedó sin categorizar. */
export function cobertura(clasificaciones: readonly Clasificacion[]): {
  total: number;
  categorizados: number;
  porcentaje: number;
} {
  const total = clasificaciones.length;
  const categorizados = clasificaciones.filter((c) => c.fuente !== "ninguna").length;
  return {
    total,
    categorizados,
    porcentaje: total === 0 ? 0 : Math.round((categorizados / total) * 100),
  };
}

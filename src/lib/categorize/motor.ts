import { clave, titulizar } from "./normalizar";
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
      matchea = cruda.includes(r.patron.toUpperCase()) || k.includes(r.patron.toUpperCase());
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
    if (k.includes(e.patron)) {
      return {
        categoria: e.categoria,
        subcategoria: e.subcategoria ?? null,
        comercio: e.comercio,
        claveComercio: k,
        fuente: "semilla",
        confianza: 0.8,
      };
    }
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

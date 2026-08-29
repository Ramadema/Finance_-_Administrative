/**
 * Taxonomía de categorías.
 *
 * Exactamente 9 raíces de GASTO, una por slot de la paleta validada. El límite
 * viene del color, no del capricho: los slots categóricos no se ciclan, así que
 * una raíz de más no tendría tono propio y saldría en el gris de "Otros". Todo
 * lo demás vive como subcategoría.
 *
 * Las clases que NO son gasto (ingreso / ahorro / interno) usan color semántico,
 * nunca un slot de serie.
 */

/**
 * Qué representa el movimiento en el flujo de plata.
 *
 * `interno` existe para el bug clásico del doble conteo: el pago de la tarjeta
 * aparece como débito en el resumen de cuenta Y sus consumos aparecen en el
 * resumen de tarjeta. Sumar ambos duplica el mes entero. Solo `gasto` suma.
 */
export type ClaseFlujo = "gasto" | "ingreso" | "ahorro" | "interno";

export interface Categoria {
  id: string;
  nombre: string;
  /** Índice en la paleta categórica. null = usa color semántico. */
  slot: number | null;
  clase: ClaseFlujo;
  /** Nombre de ícono de lucide-react. */
  icono: string;
  subcategorias: readonly string[];
}

export const CATEGORIAS: readonly Categoria[] = [
  {
    id: "supermercado",
    nombre: "Supermercado y hogar",
    slot: 0,
    clase: "gasto",
    icono: "ShoppingCart",
    subcategorias: ["Supermercado", "Almacén y verdulería", "Limpieza", "Mascotas"],
  },
  {
    id: "gastronomia",
    nombre: "Gastronomía",
    slot: 1,
    clase: "gasto",
    icono: "UtensilsCrossed",
    subcategorias: ["Delivery", "Restaurantes", "Cafés y bares", "Kiosco"],
  },
  {
    id: "transporte",
    nombre: "Transporte",
    slot: 2,
    clase: "gasto",
    icono: "Car",
    subcategorias: ["Combustible", "Apps de viaje", "SUBE y transporte público", "Peajes y cochera", "Mantenimiento"],
  },
  {
    id: "servicios",
    nombre: "Servicios y suscripciones",
    slot: 3,
    clase: "gasto",
    icono: "Zap",
    subcategorias: ["Luz", "Gas", "Agua", "Internet y cable", "Celular", "Streaming", "Software", "Expensas", "Alquiler", "Educación"],
  },
  {
    id: "salud",
    nombre: "Salud y cuidado",
    slot: 4,
    clase: "gasto",
    icono: "HeartPulse",
    subcategorias: ["Farmacia", "Prepaga y obra social", "Consultas", "Gimnasio", "Peluquería y estética"],
  },
  {
    id: "compras",
    nombre: "Compras",
    slot: 5,
    clase: "gasto",
    icono: "ShoppingBag",
    subcategorias: ["Indumentaria", "Electrónica", "Muebles y deco", "Librería", "Regalos"],
  },
  {
    id: "viajes",
    nombre: "Viajes",
    slot: 6,
    clase: "gasto",
    icono: "Plane",
    subcategorias: ["Pasajes", "Hotelería", "Excursiones", "Alquiler de auto"],
  },
  {
    id: "joda",
    nombre: "Joda y ocio",
    slot: 8,
    clase: "gasto",
    icono: "PartyPopper",
    subcategorias: ["Salidas y boliches", "Recitales y eventos", "Cine y teatro", "Deportes", "Juegos"],
  },
  {
    id: "financiero",
    nombre: "Impuestos y bancarios",
    slot: 7,
    clase: "gasto",
    icono: "Landmark",
    subcategorias: ["Impuestos", "Percepciones", "Comisiones", "Intereses", "Seguros"],
  },

  // ---- Fuera de la paleta categórica: no son gasto ----
  {
    id: "ingresos",
    nombre: "Ingresos",
    slot: null,
    clase: "ingreso",
    icono: "TrendingUp",
    subcategorias: ["Sueldo", "Freelance", "Reintegros", "Intereses ganados", "Otros ingresos"],
  },
  {
    id: "inversion",
    nombre: "Ahorro e inversión",
    slot: null,
    clase: "ahorro",
    icono: "PiggyBank",
    subcategorias: ["Dólares", "Plazo fijo", "Fondos", "Acciones y cripto"],
  },
  {
    id: "interno",
    nombre: "Movimientos internos",
    slot: null,
    clase: "interno",
    icono: "ArrowLeftRight",
    subcategorias: ["Pago de tarjeta", "Transferencia entre cuentas", "Extracción de efectivo"],
  },
  {
    id: "sin_categoria",
    nombre: "Sin categorizar",
    slot: null,
    clase: "gasto",
    icono: "CircleHelp",
    subcategorias: [],
  },
] as const;

export const POR_ID: ReadonlyMap<string, Categoria> = new Map(
  CATEGORIAS.map((c) => [c.id, c]),
);

/** Solo estas suman al "cuánto gasté". */
export const CATEGORIAS_GASTO = CATEGORIAS.filter((c) => c.clase === "gasto");

export function categoria(id: string): Categoria {
  return POR_ID.get(id) ?? POR_ID.get("sin_categoria")!;
}

/** Color semántico para las clases que no tienen slot. */
export const COLOR_CLASE: Record<Exclude<ClaseFlujo, "gasto">, { light: string; dark: string }> = {
  ingreso: { light: "#006300", dark: "#0ca30c" },
  ahorro:  { light: "#0ca30c", dark: "#0ca30c" },
  interno: { light: "#898781", dark: "#898781" },
};

import type { Uso } from "./tipos";

/**
 * Los modelos que se pueden elegir y lo que cuestan. Sin ninguna dependencia:
 * esto lo importa el navegador para el selector y la estimación, y no tiene
 * que arrastrar el SDK.
 */

/** Precios de lista por millón de tokens, tomados el 2026-09. Si cambian, cambia la estimación, no la cuenta. */
export const MODELOS = [
  { id: "claude-opus-5", nombre: "Claude Opus 5", entradaUSD: 5, salidaUSD: 25 },
  { id: "claude-sonnet-5", nombre: "Claude Sonnet 5", entradaUSD: 2, salidaUSD: 10 },
  { id: "claude-haiku-4-5", nombre: "Claude Haiku 4.5", entradaUSD: 1, salidaUSD: 5 },
] as const;

export type ModeloId = (typeof MODELOS)[number]["id"];
export const MODELO_POR_DEFECTO: ModeloId = "claude-opus-5";

export function esModelo(id: unknown): id is ModeloId {
  return MODELOS.some((m) => m.id === id);
}

/** Cuánto costó, en dólares. El caché se cobra al 10% al leer y al 125% al escribir. */
export function costoEstimadoUSD(uso: Uso, modelo: string): number | null {
  const m = MODELOS.find((x) => x.id === modelo);
  if (!m) return null;
  const entrada = (uso.entrada + uso.cacheLeido * 0.1 + uso.cacheEscrito * 1.25) * m.entradaUSD;
  return (entrada + uso.salida * m.salidaUSD) / 1_000_000;
}

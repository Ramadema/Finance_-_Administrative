import { clave } from "../categorize/normalizar";
import type { MovimientoCrudo } from "./tipos";

/**
 * Identidad estable de un movimiento, para que reimportar el mismo archivo no
 * duplique nada.
 *
 * La trampa: si tomás dos cafés el mismo día en el mismo lugar por el mismo
 * importe, son DOS movimientos reales con clave idéntica. Deduplicar por
 * contenido pelado se los comería y te haría perder plata del total.
 *
 * Por eso la clave lleva un índice de ocurrencia dentro del mismo archivo: los
 * repetidos legítimos sobreviven, y reimportar produce exactamente los mismos
 * ids → el import es idempotente.
 */

function fechaISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** "2026-08" a partir de la fecha del movimiento. */
export function periodoDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Firma de contenido, sin el desempate. */
function firma(m: MovimientoCrudo): string {
  const monto = (m.importeARS ?? 0).toFixed(2);
  const usd = (m.importeUSD ?? 0).toFixed(2);
  const cuota = m.cuotaNro !== null ? `${m.cuotaNro}/${m.cuotaTotal}` : "-";
  return [
    fechaISO(m.fecha),
    clave(m.establecimiento),
    monto,
    usd,
    cuota,
    m.nroTarjeta ?? "-",
  ].join("|");
}

/**
 * Asigna id estable a cada movimiento del lote.
 * Repetidos legítimos dentro del archivo reciben #2, #3…
 */
export function asignarIds(movimientos: readonly MovimientoCrudo[]): string[] {
  const vistos = new Map<string, number>();
  return movimientos.map((m) => {
    const f = firma(m);
    const n = (vistos.get(f) ?? 0) + 1;
    vistos.set(f, n);
    return n === 1 ? f : `${f}#${n}`;
  });
}

/** Hash del archivo entero, para avisar "este archivo ya lo subiste". */
export function hashArchivo(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // FNV-1a de 32 bits, en dos pasadas con semillas distintas para bajar colisiones.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + bytes[i]) >>> 0;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

export { fechaISO };

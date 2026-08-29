import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "2026-08" → "Agosto 2026" */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export function nombrePeriodo(periodo: string): string {
  const [a, m] = periodo.split("-").map(Number);
  if (!a || !m) return periodo;
  return `${MESES[m - 1]} ${a}`;
}

/** "2026-08" → "Ago" */
export function periodoCorto(periodo: string): string {
  const [, m] = periodo.split("-").map(Number);
  return MESES[m - 1]?.slice(0, 3) ?? periodo;
}

export function periodoAnterior(periodo: string): string {
  const [a, m] = periodo.split("-").map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

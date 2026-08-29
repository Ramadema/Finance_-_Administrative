"use client";

import { motion } from "motion/react";
import { formatARS } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import type { GastoPorCategoria } from "@/lib/analisis/metricas";

/**
 * Gasto por categoría, barras horizontales.
 *
 * Barras y no torta: comparar longitudes es mucho más preciso que comparar
 * ángulos, y con 8 categorías una torta se vuelve ilegible. Cada barra lleva
 * su nombre y su monto escritos — la identidad nunca depende solo del color.
 */
export function BarrasCategoria({
  datos, onSeleccionar,
}: {
  datos: GastoPorCategoria[];
  onSeleccionar?: (categoriaId: string) => void;
}) {
  const tema = useTema();
  const max = Math.max(...datos.map((d) => d.monto), 1);

  if (datos.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Todavía no hay gastos cargados.
      </p>
    );
  }

  return (
    <div className="space-y-2.5 px-5 pb-5">
      {datos.map((d, i) => {
        const color = colorSerie(d.slot, tema);
        const pct = (d.monto / max) * 100;
        return (
          <button
            key={d.categoriaId}
            onClick={() => onSeleccionar?.(d.categoriaId)}
            className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            style={{ outlineColor: "var(--s1)" }}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ background: color }} />
                <span className="truncate">{d.nombre}</span>
              </span>
              <span className="tabular shrink-0 text-[13px] font-medium">
                {formatARS(d.monto, { decimales: false })}
                <span className="ml-1.5 text-[11.5px] font-normal"
                      style={{ color: "var(--ink-mudo)" }}>
                  {d.porcentaje.toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="h-[7px] w-full overflow-hidden rounded-full"
                 style={{ background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.55, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

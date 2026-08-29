"use client";

import { motion } from "motion/react";
import { formatARS } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { categoria as buscarCategoria } from "@/lib/categorize/categorias";
import { useTema } from "@/lib/design/useTema";
import { topComercios } from "@/lib/analisis/metricas";
import { useDatos } from "@/lib/DatosContext";

/** Los comercios que más te sacaron este mes, sin importar la categoría. */
export function TopComercios({ limite = 8 }: { limite?: number }) {
  const tema = useTema();
  const { movimientos, periodo } = useDatos();
  const top = topComercios(movimientos, periodo, limite);

  if (top.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        No hay gastos en este mes.
      </p>
    );
  }

  const max = top[0].monto;

  return (
    <ol className="space-y-2 px-5 pb-5">
      {top.map((c, i) => {
        const cat = buscarCategoria(c.categoriaId);
        return (
          <li key={c.claveComercio} className="flex items-center gap-3">
            <span className="tabular w-4 shrink-0 text-right text-[12px]"
                  style={{ color: "var(--ink-mudo)" }}>
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-medium">{c.comercio}</span>
                <span className="tabular shrink-0 text-[13px] font-medium">
                  {formatARS(c.monto, { decimales: false })}
                </span>
              </div>
              <div className="h-[5px] w-full overflow-hidden rounded-full"
                   style={{ background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: colorSerie(cat.slot, tema) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(c.monto / max) * 100}%` }}
                  transition={{ duration: 0.5, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-mudo)" }}>
                {cat.nombre}
                {c.cantidad > 1 && ` · ${c.cantidad} veces`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

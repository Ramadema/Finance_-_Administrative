"use client";

import { motion } from "motion/react";
import { formatARS } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { nombrePeriodo } from "@/lib/utils";
import type { CuotaFutura } from "@/lib/analisis/metricas";

/**
 * Cuánto de los meses que vienen ya está comprometido en cuotas.
 * Es el número que explica por qué el resumen "vino caro" sin haber comprado nada.
 */
export function Cuotas({ futuro }: { futuro: CuotaFutura[] }) {
  const tema = useTema();
  const color = colorSerie(3, tema);
  const max = Math.max(...futuro.map((f) => f.monto), 1);

  if (futuro.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        No tenés cuotas pendientes. Los meses que vienen arrancan limpios.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-5 pb-5">
      {futuro.map((f, i) => (
        <div key={f.periodo}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium">{nombrePeriodo(f.periodo)}</span>
            <span className="tabular text-[13px] font-medium">
              {formatARS(f.monto, { decimales: false })}
              <span className="ml-1.5 text-[11.5px] font-normal" style={{ color: "var(--ink-mudo)" }}>
                {f.detalle.length} {f.detalle.length === 1 ? "cuota" : "cuotas"}
              </span>
            </span>
          </div>
          <div className="h-[7px] w-full overflow-hidden rounded-full"
               style={{ background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: color, opacity: 1 - i * 0.11 }}
              initial={{ width: 0 }}
              animate={{ width: `${(f.monto / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="mt-1 truncate text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
            {f.detalle.slice(0, 3).map((d) => `${d.comercio} ${d.cuota}`).join(" · ")}
            {f.detalle.length > 3 && ` · +${f.detalle.length - 3} más`}
          </p>
        </div>
      ))}
    </div>
  );
}

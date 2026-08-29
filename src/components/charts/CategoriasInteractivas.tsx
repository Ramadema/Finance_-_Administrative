"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import { formatARS } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { comerciosDeCategoria, type GastoPorCategoria } from "@/lib/analisis/metricas";
import { useDatos } from "@/lib/DatosContext";
import { cn } from "@/lib/utils";

/**
 * Gasto por categoría con drill-down a comercios.
 *
 * Ver "Salud $236k" invita inmediatamente a la pregunta "¿en qué?". Abrir la
 * fila la responde sin cambiar de pantalla ni perder el contexto de las otras
 * categorías, que es lo que se pierde al navegar a un detalle aparte.
 */
export function CategoriasInteractivas({ datos }: { datos: GastoPorCategoria[] }) {
  const tema = useTema();
  const { movimientos, periodo } = useDatos();
  const [abierta, setAbierta] = useState<string | null>(null);

  const max = Math.max(...datos.map((d) => d.monto), 1);

  if (datos.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Todavía no hay gastos en este mes.
      </p>
    );
  }

  return (
    <div className="px-5 pb-5">
      <ul className="space-y-1">
        {datos.map((d, i) => {
          const color = colorSerie(d.slot, tema);
          const abierto = abierta === d.categoriaId;
          const desglosable = d.categoriaId !== "__otros";
          const comercios = abierto ? comerciosDeCategoria(movimientos, periodo, d.categoriaId) : [];

          return (
            <li key={d.categoriaId}>
              <button
                onClick={() => desglosable && setAbierta(abierto ? null : d.categoriaId)}
                disabled={!desglosable}
                aria-expanded={desglosable ? abierto : undefined}
                className={cn(
                  "group block w-full rounded-lg px-2 py-2 text-left transition-colors",
                  desglosable && "hover:bg-[color-mix(in_oklab,currentColor_4%,transparent)]",
                  !desglosable && "cursor-default",
                  "focus-visible:outline-2 focus-visible:outline-offset-1",
                )}
                style={{ outlineColor: "var(--s1)" }}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                    {desglosable && (
                      <ChevronRight
                        className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
                        style={{
                          color: "var(--ink-mudo)",
                          transform: abierto ? "rotate(90deg)" : "none",
                        }}
                      />
                    )}
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ background: color, marginLeft: desglosable ? 0 : 20 }} />
                    <span className="truncate">{d.nombre}</span>
                  </span>
                  <span className="tabular shrink-0 text-[13px] font-medium">
                    {formatARS(d.monto, { decimales: false })}
                    <span className="ml-1.5 text-[11.5px] font-normal" style={{ color: "var(--ink-mudo)" }}>
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
                    animate={{ width: `${(d.monto / max) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {abierto && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-1 mb-2 ml-[30px] space-y-1 border-l pl-3"
                        style={{ borderColor: "var(--borde)" }}>
                      {comercios.map((c) => (
                        <li key={c.claveComercio}
                            className="flex items-baseline justify-between gap-3 py-0.5 text-[12.5px]">
                          <span className="min-w-0 truncate" style={{ color: "var(--ink-secundario)" }}>
                            {c.comercio}
                            {c.cantidad > 1 && (
                              <span style={{ color: "var(--ink-mudo)" }}>
                                {" "}· {c.cantidad} veces · prom {formatARS(c.ticketPromedio, { decimales: false })}
                              </span>
                            )}
                          </span>
                          <span className="tabular shrink-0" style={{ color: "var(--ink-secundario)" }}>
                            {formatARS(c.monto, { decimales: false })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { motion } from "motion/react";
import { formatARS } from "@/lib/ingest/numero";
import { CHROME } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { nombrePeriodo } from "@/lib/utils";

/**
 * Qué categoría explica que este mes gastaras más (o menos) que el anterior.
 *
 * Codificación DIVERGENTE: dos polos (rojo = gastaste más, azul = menos) con
 * el cero como neutro. Nunca un arcoíris: acá lo que importa es el signo, no
 * la identidad de la categoría — el nombre escrito ya la identifica.
 */
export function Waterfall({
  variacion, periodoA, periodoB,
}: {
  variacion: { categoriaId: string; nombre: string; slot: number | null; a: number; b: number; delta: number }[];
  periodoA: string;
  periodoB: string;
}) {
  const tema = useTema();
  const filas = variacion.filter((v) => Math.abs(v.delta) > 0).slice(0, 8);

  if (filas.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        No hay diferencias contra {nombrePeriodo(periodoA)}.
      </p>
    );
  }

  const max = Math.max(...filas.map((v) => Math.abs(v.delta)));
  const total = filas.reduce((a, v) => a + v.delta, 0);

  const masCaro = tema === "dark" ? "#e66767" : "#e34948";
  const masBarato = tema === "dark" ? "#3987e5" : "#2a78d6";

  return (
    <div className="px-5 pb-5">
      <p className="mb-4 text-[13px]" style={{ color: "var(--ink-secundario)" }}>
        Contra {nombrePeriodo(periodoA)} gastaste{" "}
        <strong style={{ color: total > 0 ? masCaro : "var(--texto-bueno)" }}>
          {formatARS(Math.abs(total), { decimales: false })} {total > 0 ? "más" : "menos"}
        </strong>
        .
      </p>

      <div className="space-y-2">
        {filas.map((v, i) => {
          const subio = v.delta > 0;
          const ancho = (Math.abs(v.delta) / max) * 50; // 50% para cada lado del eje
          return (
            <div key={v.categoriaId} className="flex items-center gap-3">
              <span className="w-[38%] shrink-0 truncate text-[12.5px]" title={v.nombre}>
                {v.nombre}
              </span>

              <div className="relative h-[18px] flex-1">
                {/* Eje del cero */}
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-px"
                      style={{ background: CHROME.eje[tema] }} />
                <motion.div
                  className="absolute top-[3px] h-[12px] rounded-[3px]"
                  style={{
                    background: subio ? masCaro : masBarato,
                    left: subio ? "50%" : undefined,
                    right: subio ? undefined : "50%",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${ancho}%` }}
                  transition={{ duration: 0.45, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <span
                className="tabular w-[26%] shrink-0 text-right text-[12.5px] font-medium"
                style={{ color: subio ? masCaro : "var(--texto-bueno)" }}
              >
                {subio ? "+" : "−"}{formatARS(Math.abs(v.delta), { decimales: false }).replace("$", "").trim()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: masCaro }} />
          Gastaste más
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: masBarato }} />
          Gastaste menos
        </span>
        <span className="ml-auto">{nombrePeriodo(periodoB)}</span>
      </div>
    </div>
  );
}

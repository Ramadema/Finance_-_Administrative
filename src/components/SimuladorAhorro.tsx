"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { formatARS } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { escenariosRecorte } from "@/lib/analisis/ahorro";
import type { GastoPorCategoria } from "@/lib/analisis/metricas";

/**
 * "Si recortara un X% de esto, ¿cuánto junto en un año?"
 *
 * Interactivo a propósito: el número abstracto "ahorrá más" no mueve a nadie,
 * pero ver que un 20% menos de delivery son $480.000 al año sí. Se pueden
 * seleccionar varias categorías para sumar el efecto combinado.
 *
 * Solo muestra categorías discrecionales — proponer recortar impuestos o salud
 * sería ruido, no una palanca real.
 */
export function SimuladorAhorro({
  categorias, capacidadActual,
}: {
  categorias: GastoPorCategoria[];
  capacidadActual: number | null;
}) {
  const tema = useTema();
  const [pct, setPct] = useState(20);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());

  const escenarios = useMemo(() => escenariosRecorte(categorias, pct), [categorias, pct]);

  const seleccionadas = escenarios.filter((e) => elegidas.has(e.categoriaId));
  const ahorroMensual = seleccionadas.reduce((a, e) => a + e.ahorroMensual, 0);
  const ahorroAnual = ahorroMensual * 12;

  function alternar(id: string) {
    setElegidas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  if (escenarios.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        No hay categorías discrecionales con gasto este mes.
      </p>
    );
  }

  return (
    <div className="px-5 pb-5">
      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="recorte" className="text-[13px]" style={{ color: "var(--ink-secundario)" }}>
            Recortar un
          </label>
          <span className="tabular text-[15px] font-semibold">{pct}%</span>
        </div>
        <input
          id="recorte"
          type="range"
          min={5}
          max={50}
          step={5}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-full accent-[var(--s1)]"
          style={{ accentColor: "var(--s1)" }}
        />
        <div className="mt-1 flex justify-between text-[11px]" style={{ color: "var(--ink-mudo)" }}>
          <span>5%</span><span>50%</span>
        </div>
      </div>

      <p className="mb-2 text-[12px]" style={{ color: "var(--ink-mudo)" }}>
        Elegí en qué categorías lo aplicarías:
      </p>

      <ul className="space-y-1">
        {escenarios.map((e) => {
          const activa = elegidas.has(e.categoriaId);
          return (
            <li key={e.categoriaId}>
              <button
                onClick={() => alternar(e.categoriaId)}
                aria-pressed={activa}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                style={{
                  outlineColor: "var(--s1)",
                  background: activa
                    ? "color-mix(in oklab, var(--s1) 10%, transparent)"
                    : "transparent",
                }}
              >
                <span
                  aria-hidden
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-2"
                  style={{
                    borderColor: activa ? colorSerie(e.slot, tema) : "var(--borde-fuerte)",
                    background: activa ? colorSerie(e.slot, tema) : "transparent",
                  }}
                >
                  {activa && (
                    <svg viewBox="0 0 10 8" className="h-2 w-2.5" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{e.nombre}</span>
                  <span className="block text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
                    hoy gastás {formatARS(e.gastoActual, { decimales: false })} por mes
                  </span>
                </span>

                <span className="tabular shrink-0 text-right text-[13px] font-medium"
                      style={{ color: "var(--texto-bueno)" }}>
                  +{formatARS(e.ahorroMensual, { decimales: false })}
                  <span className="block text-[11px] font-normal" style={{ color: "var(--ink-mudo)" }}>
                    al mes
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <motion.div
        className="mt-4 rounded-xl px-4 py-3.5"
        style={{
          background: ahorroMensual > 0
            ? "color-mix(in oklab, var(--bueno) 12%, transparent)"
            : "color-mix(in oklab, var(--ink-primario) 4%, transparent)",
          border: `1px solid ${ahorroMensual > 0
            ? "color-mix(in oklab, var(--bueno) 30%, transparent)"
            : "var(--borde)"}`,
        }}
        animate={{ scale: ahorroMensual > 0 ? 1 : 0.995 }}
        transition={{ duration: 0.2 }}
      >
        {ahorroMensual > 0 ? (
          <>
            <p className="text-[13px]" style={{ color: "var(--ink-secundario)" }}>
              Recortando {pct}% en {seleccionadas.length}{" "}
              {seleccionadas.length === 1 ? "categoría" : "categorías"} juntarías
            </p>
            <p className="mt-1 text-[26px] leading-none font-semibold tracking-tight">
              {formatARS(ahorroAnual, { decimales: false })}
              <span className="ml-2 text-[14px] font-normal" style={{ color: "var(--ink-secundario)" }}>
                al año
              </span>
            </p>
            {capacidadActual !== null && capacidadActual > 0 && (
              <p className="mt-2 text-[12px]" style={{ color: "var(--ink-mudo)" }}>
                Sobre tu capacidad actual de {formatARS(capacidadActual, { decimales: false })} por mes,
                pasarías a {formatARS(capacidadActual + ahorroMensual, { decimales: false })}.
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--ink-mudo)" }}>
            Marcá una o más categorías para ver cuánto juntarías en un año.
          </p>
        )}
      </motion.div>
    </div>
  );
}

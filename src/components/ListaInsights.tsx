"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  TriangleAlert, CircleAlert, Info, CircleCheck, ArrowRight, Sparkles,
} from "lucide-react";
import type { Insight, Severidad } from "@/lib/analisis/insights";
import { Card } from "./ui/Card";

/**
 * Panel de observaciones.
 *
 * Cada tarjeta lleva ícono + rótulo de severidad además del color: los tonos de
 * estado no son accesibles por sí solos y "atención" no puede depender de que
 * distingas naranja de rojo.
 */

const ESTILO: Record<Severidad, { color: string; rotulo: string; Icono: typeof Info }> = {
  critico:   { color: "var(--critico)",     rotulo: "Urgente",  Icono: CircleAlert },
  atencion:  { color: "var(--advertencia)", rotulo: "Atención", Icono: TriangleAlert },
  bueno:     { color: "var(--bueno)",       rotulo: "Bien",     Icono: CircleCheck },
  info:      { color: "var(--s1)",          rotulo: "Dato",     Icono: Info },
};

export function ListaInsights({ insights, limite }: { insights: Insight[]; limite?: number }) {
  const items = limite ? insights.slice(0, limite) : insights;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <Sparkles className="h-6 w-6" style={{ color: "var(--ink-mudo)" }} />
        <p className="text-[14px] font-medium">Todo en orden</p>
        <p className="max-w-[320px] text-[12.5px]" style={{ color: "var(--ink-mudo)" }}>
          No encontré nada que merezca tu atención este mes. Cargá más meses para que las
          comparaciones sean más finas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((i, idx) => {
        const { color, rotulo, Icono } = ESTILO[i.severidad];
        return (
          <motion.div
            key={i.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: idx * 0.035, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="overflow-hidden p-4">
              <span aria-hidden className="absolute" />
              <div className="flex gap-3">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
                >
                  <Icono className="h-[15px] w-[15px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase"
                      style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
                    >
                      {rotulo}
                    </span>
                    <h3 className="text-[14px] font-semibold">{i.titulo}</h3>
                  </div>

                  <p className="mt-1.5 text-[13px] leading-relaxed"
                     style={{ color: "var(--ink-secundario)" }}>
                    {i.detalle}
                  </p>

                  {i.accion && (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed"
                       style={{ color: "var(--ink-mudo)" }}>
                      {i.accion}
                    </p>
                  )}

                  {i.seccion && (
                    <Link
                      href={i.seccion}
                      className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium focus-visible:outline-2"
                      style={{ color: "var(--s1)", outlineColor: "var(--s1)" }}
                    >
                      Ver detalle
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

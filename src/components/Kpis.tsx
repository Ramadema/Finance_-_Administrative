"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Lock, CalendarClock, Wallet, TrendingDown } from "lucide-react";
import { formatARS } from "@/lib/ingest/numero";
import type { ResumenPeriodo } from "@/lib/analisis/metricas";
import { Card } from "./ui/Card";

/**
 * Fichas de cabecera. Responden las tres preguntas del usuario de un vistazo:
 * cuánto gasté, cuánto me sobra, cuánto de eso ya está comprometido.
 *
 * El delta lleva SIEMPRE flecha + signo además del color: en gastos "subió" es
 * malo y "bajó" es bueno, al revés que en ingresos, y el color solo no alcanza
 * para decirlo (ni es accesible).
 */
export function Kpis({
  actual, previo, comprometido,
}: {
  actual: ResumenPeriodo;
  previo: ResumenPeriodo | null;
  comprometido: number;
}) {
  const deltaGasto =
    previo && previo.gastos > 0 ? ((actual.gastos - previo.gastos) / previo.gastos) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        i={0}
        icono={<TrendingDown className="h-4 w-4" />}
        rotulo="Gastaste este mes"
        valor={formatARS(actual.gastos, { decimales: false })}
        delta={deltaGasto}
        deltaBuenoSiBaja
        pie={`${actual.cantidadMovimientos} movimientos`}
        acento="var(--s2)"
      />
      <Tile
        i={1}
        icono={<Wallet className="h-4 w-4" />}
        rotulo="Te sobra"
        valor={
          actual.ingresos > 0
            ? formatARS(actual.sobrante, { decimales: false })
            : "—"
        }
        pie={
          actual.ingresos > 0
            ? `sobre ${formatARS(actual.ingresos, { decimales: false })} de ingresos`
            : "Cargá un resumen de cuenta para ver ingresos"
        }
        acento={actual.sobrante >= 0 ? "var(--bueno)" : "var(--critico)"}
        resaltado
      />
      <Tile
        i={2}
        icono={<Lock className="h-4 w-4" />}
        rotulo="Gastos fijos"
        valor={formatARS(actual.fijo, { decimales: false })}
        pie={
          actual.gastos > 0
            ? `${Math.round((actual.fijo / actual.gastos) * 100)}% del gasto es ineludible`
            : "Sin datos suficientes"
        }
        acento="var(--s7)"
      />
      <Tile
        i={3}
        icono={<CalendarClock className="h-4 w-4" />}
        rotulo="Ya comprometido"
        valor={formatARS(comprometido, { decimales: false })}
        pie="en cuotas del mes que viene"
        acento="var(--s4)"
      />
    </div>
  );
}

function Tile({
  i, icono, rotulo, valor, pie, delta, deltaBuenoSiBaja, acento, resaltado,
}: {
  i: number;
  icono: React.ReactNode;
  rotulo: string;
  valor: string;
  pie: string;
  delta?: number | null;
  deltaBuenoSiBaja?: boolean;
  acento: string;
  resaltado?: boolean;
}) {
  const subio = delta !== null && delta !== undefined && delta > 0;
  const esBueno = delta == null ? null : deltaBuenoSiBaja ? !subio : subio;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="relative overflow-hidden p-5">
        {/* Filete de acento: identidad de la ficha sin teñir el texto. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: acento, opacity: resaltado ? 1 : 0.55 }}
        />
        <div className="flex items-center gap-2">
          <span style={{ color: acento }}>{icono}</span>
          <span className="text-[12px] font-medium tracking-wide uppercase"
                style={{ color: "var(--ink-secundario)" }}>
            {rotulo}
          </span>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-[27px] leading-none font-semibold tracking-tight">{valor}</span>
          {delta != null && (
            <span
              className="inline-flex items-center gap-0.5 text-[12px] font-medium"
              style={{ color: esBueno ? "var(--texto-bueno)" : "var(--critico)" }}
            >
              {subio ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>

        <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-mudo)" }}>{pie}</p>
      </Card>
    </motion.div>
  );
}

"use client";

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { TriangleAlert } from "lucide-react";
import { formatARS, formatCompacto } from "@/lib/ingest/numero";
import { CHROME } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import type { Proyeccion as TipoProyeccion } from "@/lib/analisis/ahorro";

/**
 * Cuánto juntarías en 12 meses si sostenés el ritmo actual.
 *
 * Es una PROYECCIÓN, no una promesa: se dibuja punteada y con la advertencia
 * visible cuando hay menos de 3 meses de historia. Mostrar una línea sólida
 * sobre dos datos sugeriría una certeza que no existe.
 */
export function Proyeccion({ proyeccion }: { proyeccion: TipoProyeccion }) {
  const tema = useTema();

  if (proyeccion.base <= 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        {proyeccion.mesesBase === 0
          ? "Cargá tus ingresos para poder proyectar."
          : "Con la capacidad de ahorro actual no hay nada que proyectar: estás gastando todo lo que entra."}
      </p>
    );
  }

  const color = tema === "dark" ? "#0ca30c" : "#006300";
  const meta = proyeccion.base * 6;

  return (
    <div className="px-2 pb-4">
      {!proyeccion.confiable && (
        <p className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[12px]"
           style={{
             background: "color-mix(in oklab, var(--advertencia) 12%, transparent)",
             color: "var(--ink-secundario)",
           }}>
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: "var(--advertencia)" }} />
          Con {proyeccion.mesesBase} {proyeccion.mesesBase === 1 ? "mes" : "meses"} de historia esto
          es apenas una recta, no una tendencia. Cargá más meses para que valga.
        </p>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={proyeccion.puntos} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="gAhorro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.26} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHROME.grilla[tema]} vertical={false} />
          <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: CHROME.eje[tema] }}
                 tick={{ fill: CHROME.inkMudo[tema], fontSize: 11 }} dy={4} />
          <YAxis tickLine={false} axisLine={false} width={46}
                 tick={{ fill: CHROME.inkMudo[tema], fontSize: 11 }}
                 tickFormatter={(v: number) => formatCompacto(v)} />
          <Tooltip
            cursor={{ stroke: CHROME.eje[tema], strokeWidth: 1 }}
            contentStyle={{
              background: CHROME.superficie[tema], border: `1px solid ${CHROME.eje[tema]}`,
              borderRadius: 10, fontSize: 12,
            }}
            labelStyle={{ color: CHROME.inkSecundario[tema], marginBottom: 4 }}
            labelFormatter={(l) => `En ${l}`}
            formatter={(v) => [formatARS(Number(v) || 0, { decimales: false }), "Acumulado"]}
          />
          <ReferenceLine y={meta} stroke={CHROME.eje[tema]} strokeDasharray="4 4"
                         label={{ value: "6 meses de fijos", position: "insideTopLeft",
                                  fill: CHROME.inkMudo[tema], fontSize: 10.5 }} />
          <Area type="monotone" dataKey="acumulado" stroke={color} strokeWidth={2}
                strokeDasharray={proyeccion.confiable ? undefined : "5 4"}
                fill="url(#gAhorro)" dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHROME.superficie[tema] }} />
        </AreaChart>
      </ResponsiveContainer>

      <p className="px-3 text-center text-[12px]" style={{ color: "var(--ink-mudo)" }}>
        Proyectado sobre {formatARS(proyeccion.base, { decimales: false })} por mes
        (mediana de {proyeccion.mesesBase} {proyeccion.mesesBase === 1 ? "mes" : "meses"} con ingresos cargados).
      </p>
    </div>
  );
}

"use client";

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatARS, formatCompacto } from "@/lib/ingest/numero";
import { colorSerie, CHROME } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { periodoCorto, nombrePeriodo } from "@/lib/utils";
import type { ResumenPeriodo } from "@/lib/analisis/metricas";

/**
 * Evolución mensual de gasto e ingreso.
 *
 * UN SOLO EJE: gasto e ingreso son la misma magnitud (pesos), así que comparten
 * escala. Nunca dos ejes Y — es la forma más rápida de mentir con un gráfico.
 */
export function Evolucion({ serie }: { serie: ResumenPeriodo[] }) {
  const tema = useTema();
  const hayIngresos = serie.some((s) => s.ingresos > 0);

  const datos = serie.map((s) => ({
    periodo: s.periodo,
    etiqueta: periodoCorto(s.periodo),
    Gastos: s.gastos,
    Ingresos: s.ingresos,
  }));

  if (datos.length < 2) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Cargá al menos dos meses para ver la evolución.
      </p>
    );
  }

  const cGasto = colorSerie(1, tema);
  const cIngreso = colorSerie(5, tema);

  return (
    <div className="px-2 pb-4">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={datos} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="gGasto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cGasto} stopOpacity={0.28} />
              <stop offset="100%" stopColor={cGasto} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gIngreso" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cIngreso} stopOpacity={0.2} />
              <stop offset="100%" stopColor={cIngreso} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={CHROME.grilla[tema]} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: CHROME.eje[tema] }}
                 tick={{ fill: CHROME.inkMudo[tema], fontSize: 11 }} dy={4} />
          <YAxis tickLine={false} axisLine={false} width={46}
                 tick={{ fill: CHROME.inkMudo[tema], fontSize: 11 }}
                 tickFormatter={(v: number) => formatCompacto(v)} />
          <Tooltip
            cursor={{ stroke: CHROME.eje[tema], strokeWidth: 1 }}
            contentStyle={{
              background: CHROME.superficie[tema],
              border: `1px solid ${CHROME.eje[tema]}`,
              borderRadius: 10, fontSize: 12,
              boxShadow: "0 8px 24px -12px rgba(0,0,0,.4)",
            }}
            labelStyle={{ color: CHROME.inkSecundario[tema], marginBottom: 4 }}
            labelFormatter={(_l, p) => nombrePeriodo(p?.[0]?.payload?.periodo ?? "")}
            formatter={(v, n) => [formatARS(Number(v) || 0, { decimales: false }), String(n)]}
          />

          {hayIngresos && (
            <Area type="monotone" dataKey="Ingresos" stroke={cIngreso} strokeWidth={2}
                  fill="url(#gIngreso)" dot={false}
                  activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHROME.superficie[tema] }} />
          )}
          <Area type="monotone" dataKey="Gastos" stroke={cGasto} strokeWidth={2}
                fill="url(#gGasto)" dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHROME.superficie[tema] }} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Leyenda: obligatoria con 2 series. */}
      {hayIngresos && (
        <div className="mt-1 flex items-center justify-center gap-4 text-[12px]"
             style={{ color: "var(--ink-secundario)" }}>
          <Item color={cGasto} texto="Gastos" />
          <Item color={cIngreso} texto="Ingresos" />
        </div>
      )}
    </div>
  );
}

function Item({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="h-[3px] w-4 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  );
}

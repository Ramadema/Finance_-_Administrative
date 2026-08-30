"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatARS, formatCompacto } from "@/lib/ingest/numero";
import { colorSerie, CHROME } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { periodoCorto, nombrePeriodo } from "@/lib/utils";
import type { ResumenPeriodo } from "@/lib/analisis/metricas";

/**
 * Composición del gasto mes a mes: qué parte es piso ineludible y qué parte
 * decidiste. Es la vista que muestra si el problema es estructural (los fijos
 * crecen) o de un mes puntual (te mandaste una compra grande).
 *
 * Hay 2px de superficie entre segmentos apilados para que se lean como piezas
 * separadas y no como un degradé continuo.
 */
export function Composicion({ serie }: { serie: ResumenPeriodo[] }) {
  const tema = useTema();

  if (serie.length < 2) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Cargá al menos dos meses para comparar la composición.
      </p>
    );
  }

  const datos = serie.map((s) => ({
    periodo: s.periodo,
    etiqueta: periodoCorto(s.periodo),
    Fijos: s.fijo,
    Variables: s.variable,
    Esporádicos: s.esporadico,
  }));

  const cFijo = colorSerie(6, tema);
  const cVar = colorSerie(0, tema);
  const cEsp = colorSerie(1, tema);
  const superficie = CHROME.superficie[tema];

  return (
    <div className="px-2 pb-4">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={datos} margin={{ top: 8, right: 16, left: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid stroke={CHROME.grilla[tema]} vertical={false} />
          <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: CHROME.eje[tema] }}
                 tick={{ fill: CHROME.inkMudo[tema], fontSize: 11 }} dy={4} />
          <YAxis tickLine={false} axisLine={false} width={46}
                 tick={{ fill: CHROME.inkMudo[tema], fontSize: 11 }}
                 tickFormatter={(v: number) => formatCompacto(v)} />
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, currentColor 5%, transparent)" }}
            contentStyle={{
              background: superficie, border: `1px solid ${CHROME.eje[tema]}`,
              borderRadius: 10, fontSize: 12,
            }}
            labelStyle={{ color: CHROME.inkSecundario[tema], marginBottom: 4 }}
            labelFormatter={(_l, p) => nombrePeriodo(p?.[0]?.payload?.periodo ?? "")}
            formatter={(v, n) => [formatARS(Number(v) || 0, { decimales: false }), String(n)]}
          />
          <Bar dataKey="Fijos" stackId="g" fill={cFijo} stroke={superficie} strokeWidth={2} />
          <Bar dataKey="Variables" stackId="g" fill={cVar} stroke={superficie} strokeWidth={2} />
          <Bar dataKey="Esporádicos" stackId="g" fill={cEsp} stroke={superficie} strokeWidth={2}
               radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-[12px]"
           style={{ color: "var(--ink-secundario)" }}>
        <Item color={cFijo} texto="Fijos" />
        <Item color={cVar} texto="Variables" />
        <Item color={cEsp} texto="Esporádicos" />
      </div>
    </div>
  );
}

function Item({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {texto}
    </span>
  );
}

"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatARS } from "@/lib/ingest/numero";
import { colorSerie, CHROME } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import type { GastoPorCategoria } from "@/lib/analisis/metricas";

/**
 * Torta del mes: qué fracción se llevó cada categoría.
 *
 * Responde "¿cuánto pesa cada cosa?" de un vistazo, que es distinto de "¿cuál
 * gastó más?" — para eso están las barras, que comparan largos y son más
 * precisas. Acá lo que se lee es la proporción.
 *
 * Tope de 6 porciones a propósito: pasado eso los ángulos se vuelven
 * indistinguibles y la torta miente. La cola se pliega en "Otros", en gris.
 *
 * Cada porción lleva su número al lado sí o sí: tres tonos de la paleta quedan
 * bajo 3:1 de contraste en modo claro, así que el color no puede ser la única
 * forma de identificar una porción.
 */
const MAX_PORCIONES = 6;

export function Torta({ datos }: { datos: GastoPorCategoria[] }) {
  const tema = useTema();

  if (datos.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Todavía no hay gastos en este mes.
      </p>
    );
  }

  const ordenadas = [...datos].sort((a, b) => b.monto - a.monto);
  const cabeza = ordenadas.slice(0, MAX_PORCIONES);
  const cola = ordenadas.slice(MAX_PORCIONES);
  const montoCola = cola.reduce((a, c) => a + c.monto, 0);

  const porciones = [
    ...cabeza.map((c) => ({
      nombre: c.nombre,
      monto: c.monto,
      color: colorSerie(c.slot, tema),
    })),
    ...(montoCola > 0
      ? [{
          nombre: `Otros (${cola.length})`,
          monto: montoCola,
          color: CHROME.neutro[tema],
        }]
      : []),
  ];

  const total = porciones.reduce((a, p) => a + p.monto, 0);
  const pct = (m: number) => (total > 0 ? (m / total) * 100 : 0);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-5 sm:flex-row sm:items-center">
      <div className="relative h-[190px] w-[190px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={porciones}
              dataKey="monto"
              nameKey="nombre"
              innerRadius="58%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              /* 2px de superficie entre porciones: se leen como piezas
                 separadas y no como un degradé continuo. */
              stroke={CHROME.superficie[tema]}
              strokeWidth={2}
            >
              {porciones.map((p) => (
                <Cell key={p.nombre} fill={p.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] tracking-wide uppercase" style={{ color: "var(--ink-mudo)" }}>
            Total
          </span>
          <span className="tabular text-[17px] leading-tight font-semibold tracking-tight">
            {formatARS(total, { decimales: false })}
          </span>
        </div>
      </div>

      {/* La leyenda es la vista de tabla: nombre, monto y porcentaje en tinta,
          nunca en el color de la serie. */}
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {porciones.map((p) => (
          <li key={p.nombre} className="flex items-baseline gap-2">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-[13px]"
                  style={{ color: "var(--ink-secundario)" }}>
              {p.nombre}
            </span>
            <span className="tabular shrink-0 text-[13px] font-medium">
              {formatARS(p.monto, { decimales: false })}
            </span>
            <span className="tabular w-[38px] shrink-0 text-right text-[12px]"
                  style={{ color: "var(--ink-mudo)" }}>
              {Math.round(pct(p.monto))}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

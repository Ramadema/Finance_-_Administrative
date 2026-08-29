"use client";

import Link from "next/link";
import { formatARS } from "@/lib/ingest/numero";
import { RAMPA_AZUL } from "@/lib/design/paleta";
import { nombrePeriodo } from "@/lib/utils";
import type { GastoPorCategoria } from "@/lib/analisis/metricas";

/**
 * La misma categoría, mes contra mes.
 *
 * Responde la pregunta directa: "¿en qué gasté más que el mes pasado?". El
 * waterfall responde algo parecido pero muestra la DIFERENCIA; acá se ven los
 * dos montos, que es lo que hace falta para saber si un +$50.000 es mucho o
 * poco sobre lo que ya gastabas.
 *
 * Barras horizontales porque los nombres son largos ("Servicios y
 * suscripciones" no entra debajo de una columna sin rotarlo, y una etiqueta
 * rotada es una etiqueta que no se lee).
 *
 * Los meses NO llevan colores categóricos: son una secuencia ordenada, así que
 * van en una rampa de un solo tono, más reciente = más oscuro. Usar hues
 * distintos sugeriría que un mes es otra "cosa" en vez de el mismo dato después.
 */
const MAX_CATEGORIAS = 6;
const MAX_MESES = 3;

export function ComparacionMeses({
  porPeriodo, periodos,
}: {
  porPeriodo: Map<string, GastoPorCategoria[]>;
  periodos: string[];
}) {
  const meses = periodos.slice(-MAX_MESES);

  if (meses.length < 2) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Cargá al menos dos resúmenes para poder comparar.
      </p>
    );
  }

  // Un tono por mes, del más viejo (claro) al más nuevo (oscuro).
  const pasos = meses.length === 2 ? [4, 9] : [2, 6, 10];
  const colorMes = (i: number) => RAMPA_AZUL[pasos[i]];

  const totales = new Map<string, { nombre: string; total: number; porMes: number[] }>();
  meses.forEach((p, i) => {
    for (const g of porPeriodo.get(p) ?? []) {
      const e = totales.get(g.categoriaId) ?? {
        nombre: g.nombre, total: 0, porMes: new Array(meses.length).fill(0),
      };
      e.porMes[i] = g.monto;
      e.total += g.monto;
      totales.set(g.categoriaId, e);
    }
  });

  const filas = [...totales.entries()]
    .map(([id, e]) => ({ id, ...e }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_CATEGORIAS);

  if (filas.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        No hay gastos para comparar.
      </p>
    );
  }

  const max = Math.max(...filas.flatMap((f) => f.porMes), 1);

  return (
    <div className="px-5 pb-5">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-4">
        {meses.map((p, i) => (
          <li key={p} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: colorMes(i) }} />
            <span className="text-[12px]" style={{ color: "var(--ink-secundario)" }}>
              {nombrePeriodo(p)}
            </span>
          </li>
        ))}
      </ul>

      <ul className="space-y-3.5">
        {filas.map((f) => (
          <li key={f.id}>
            {/* Mismo destino que el Sankey y la torta: el nombre de una
                categoría lleva siempre a los movimientos que la componen. */}
            <Link
              href={`/movimientos?categoria=${f.id}`}
              className="-mx-1 mb-1.5 block truncate rounded px-1 text-[12.5px] font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--ink-primario)_6%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-1"
              style={{ outlineColor: "var(--s1)" }}
              aria-label={`Ver los movimientos de ${f.nombre}`}
            >
              {f.nombre}
            </Link>
            <div className="space-y-1">
              {meses.map((p, i) => (
                <div key={p} className="flex items-center gap-2">
                  <div className="h-[10px] min-w-0 flex-1 overflow-hidden rounded-full"
                       style={{ background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max((f.porMes[i] / max) * 100, f.porMes[i] > 0 ? 1.5 : 0)}%`,
                        background: colorMes(i),
                      }}
                    />
                  </div>
                  <span className="tabular w-[86px] shrink-0 text-right text-[12px]"
                        style={{ color: "var(--ink-secundario)" }}>
                    {f.porMes[i] > 0 ? formatARS(f.porMes[i], { decimales: false }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

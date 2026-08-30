"use client";

import { formatARS } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { categoria as buscarCategoria } from "@/lib/categorize/categorias";
import { useTema } from "@/lib/design/useTema";
import type { CuotasDelMes } from "@/lib/analisis/metricas";

/**
 * Qué parte del resumen de este mes son cuotas de compras ya hechas.
 *
 * El punto no es el monto sino el porcentaje: es la plata del mes sobre la que
 * ya no podés decidir nada. Cada fila mantiene el color de la categoría real de
 * la compra —una heladera sigue siendo "Compras"— porque las cuotas son una
 * forma de pago, no un tipo de gasto.
 */
export function CuotasMes({ datos }: { datos: CuotasDelMes }) {
  const tema = useTema();

  if (datos.cantidad === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Este mes no pagás ninguna cuota. Todo lo que gastaste fue de una.
      </p>
    );
  }

  const max = Math.max(...datos.detalle.map((d) => d.monto), 1);

  return (
    <div className="px-5 pb-5">
      <div className="mb-4 flex items-baseline gap-2">
        <span className="tabular text-[22px] leading-none font-semibold tracking-tight">
          {formatARS(datos.monto, { decimales: false })}
        </span>
        <span className="text-[13px]" style={{ color: "var(--ink-secundario)" }}>
          · {Math.round(datos.porcentaje)}% del mes ·{" "}
          {datos.cantidad === 1 ? "1 cuota" : `${datos.cantidad} cuotas`}
        </span>
      </div>

      <ul className="space-y-2.5">
        {datos.detalle.map((d, i) => {
          const cat = buscarCategoria(d.categoriaId);
          const color = colorSerie(cat.slot, tema);
          return (
            <li key={`${d.comercio}-${d.cuota}-${i}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-[13px] font-medium">{d.comercio}</span>
                  <span
                    className="tabular shrink-0 rounded px-1.5 py-px text-[10.5px] font-medium"
                    style={{
                      background: `color-mix(in oklab, ${color} 18%, transparent)`,
                      color: "var(--ink-secundario)",
                    }}
                  >
                    {d.cuota}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[13px] font-medium">
                  {formatARS(d.monto, { decimales: false })}
                </span>
              </div>
              <div className="h-[6px] w-full overflow-hidden rounded-full"
                   style={{ background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)" }}>
                <div className="h-full rounded-full"
                     style={{ width: `${(d.monto / max) * 100}%`, background: color }} />
              </div>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
                {cat.nombre}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

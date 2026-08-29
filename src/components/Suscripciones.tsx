"use client";

import { TrendingUp, Repeat } from "lucide-react";
import { formatARS } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { categoria as buscarCategoria } from "@/lib/categorize/categorias";
import { useTema } from "@/lib/design/useTema";
import type { PerfilRecurrencia } from "@/lib/categorize/recurrencia";

/**
 * Suscripciones y gastos fijos detectados automáticamente.
 *
 * No los etiquetás vos: se deducen de que el comercio aparece casi todos los
 * meses con un monto planchado. El mismo cálculo destapa la suscripción que
 * subió de precio sin avisarte.
 */
export function Suscripciones({ perfiles }: { perfiles: PerfilRecurrencia[] }) {
  const tema = useTema();
  const fijos = perfiles.filter((p) => p.esSuscripcion);
  const total = fijos.reduce((a, p) => a + p.montoTipico, 0);

  if (fijos.length === 0) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Todavía no detecté gastos fijos. Hacen falta al menos 2 meses cargados para
        que el patrón se note.
      </p>
    );
  }

  return (
    <div className="px-5 pb-5">
      <p className="mb-3 text-[13px]" style={{ color: "var(--ink-secundario)" }}>
        <strong style={{ color: "var(--ink-primario)" }}>
          {formatARS(total, { decimales: false })}
        </strong>{" "}
        por mes en {fijos.length} {fijos.length === 1 ? "gasto fijo" : "gastos fijos"}.
      </p>

      <ul className="space-y-1">
        {fijos.map((p) => {
          const cat = buscarCategoria(p.categoria);
          return (
            <li
              key={p.claveComercio}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
              style={{ background: "transparent" }}
            >
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: colorSerie(cat.slot, tema) }} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{p.comercio}</p>
                <p className="text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
                  {cat.nombre} · {p.mesesPresente} de {p.mesesVentana} meses
                </p>
              </div>

              {p.alertaAumento && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background: "color-mix(in oklab, var(--advertencia) 18%, transparent)",
                    color: "var(--ink-primario)",
                  }}
                  title={`Subió ${p.aumentoPct}% respecto al promedio anterior`}
                >
                  <TrendingUp className="h-3 w-3" />
                  +{p.aumentoPct}%
                </span>
              )}

              <span className="tabular shrink-0 text-[13px] font-medium">
                {formatARS(p.montoTipico, { decimales: false })}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
        <Repeat className="h-3 w-3" />
        Detectados solos: aparecen casi todos los meses con monto estable.
      </p>
    </div>
  );
}

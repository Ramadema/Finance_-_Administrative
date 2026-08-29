"use client";

import { useDatos } from "@/lib/DatosContext";
import { ListaInsights } from "@/components/ListaInsights";
import { Card } from "@/components/ui/Card";
import { nombrePeriodo } from "@/lib/utils";

export default function Insights() {
  const d = useDatos();
  if (!d.periodo) return null;

  const urgentes = d.insights.filter((i) => i.severidad === "critico").length;
  const atencion = d.insights.filter((i) => i.severidad === "atencion").length;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">
          {d.insights.length === 0
            ? `Nada que reportar en ${nombrePeriodo(d.periodo)}`
            : urgentes > 0
            ? `${urgentes} ${urgentes === 1 ? "cosa urgente" : "cosas urgentes"} en ${nombrePeriodo(d.periodo)}`
            : atencion > 0
            ? `${atencion} ${atencion === 1 ? "cosa" : "cosas"} para mirar en ${nombrePeriodo(d.periodo)}`
            : `Todo en orden en ${nombrePeriodo(d.periodo)}`}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--ink-secundario)" }}>
          Cada observación sale de comparar este mes contra tu propio historial. No hay consejos
          genéricos: si no hay un número que lo respalde, no aparece.
        </p>
      </Card>

      <ListaInsights insights={d.insights} />
    </div>
  );
}

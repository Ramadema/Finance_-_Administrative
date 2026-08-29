"use client";

import { useDatos } from "@/lib/DatosContext";
import { Suscripciones } from "@/components/Suscripciones";
import { Cuotas } from "@/components/charts/Cuotas";
import { Card, CardHead } from "@/components/ui/Card";
import { formatARS } from "@/lib/ingest/numero";
import { Lock, TrendingUp } from "lucide-react";

export default function Fijos() {
  const d = useDatos();
  if (!d.resumen) return null;

  const fijos = d.perfiles.filter((p) => p.esSuscripcion);
  const totalFijos = fijos.reduce((a, p) => a + p.montoTipico, 0);
  const conAumento = fijos.filter((p) => p.alertaAumento);
  const pesoIngreso =
    d.capacidad?.hayIngresos && d.capacidad.ingresos > 0
      ? (totalFijos / d.capacidad.ingresos) * 100
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Mini
          icono={<Lock className="h-4 w-4" />}
          rotulo="Piso mensual"
          valor={formatARS(totalFijos, { decimales: false })}
          pie={`${fijos.length} ${fijos.length === 1 ? "gasto fijo" : "gastos fijos"}`}
          acento="var(--s7)"
        />
        <Mini
          icono={<Lock className="h-4 w-4" />}
          rotulo="Del ingreso"
          valor={pesoIngreso !== null ? `${Math.round(pesoIngreso)}%` : "—"}
          pie={pesoIngreso !== null ? "ya comprometido antes de decidir" : "Cargá tus ingresos"}
          acento={pesoIngreso !== null && pesoIngreso > 50 ? "var(--critico)" : "var(--s1)"}
        />
        <Mini
          icono={<TrendingUp className="h-4 w-4" />}
          rotulo="Aumentaron"
          valor={String(conAumento.length)}
          pie={
            conAumento.length > 0
              ? conAumento.map((p) => p.comercio).join(", ")
              : "ninguno este mes"
          }
          acento={conAumento.length > 0 ? "var(--advertencia)" : "var(--bueno)"}
        />
      </div>

      <Card>
        <CardHead
          titulo="Gastos fijos y suscripciones"
          sub="Detectados solos: aparecen casi todos los meses con monto estable"
        />
        <Suscripciones perfiles={d.perfiles} />
      </Card>

      <Card>
        <CardHead
          titulo="Cuotas comprometidas"
          sub="Lo que ya está firmado para los próximos meses"
        />
        <Cuotas futuro={d.cuotas} />
      </Card>
    </div>
  );
}

function Mini({
  icono, rotulo, valor, pie, acento,
}: {
  icono: React.ReactNode; rotulo: string; valor: string; pie: string; acento: string;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]"
            style={{ background: acento, opacity: 0.6 }} />
      <div className="flex items-center gap-2">
        <span style={{ color: acento }}>{icono}</span>
        <span className="text-[11.5px] font-medium tracking-wide uppercase"
              style={{ color: "var(--ink-secundario)" }}>
          {rotulo}
        </span>
      </div>
      <p className="mt-2 text-[22px] leading-none font-semibold tracking-tight">{valor}</p>
      <p className="mt-1.5 truncate text-[12px]" style={{ color: "var(--ink-mudo)" }} title={pie}>
        {pie}
      </p>
    </Card>
  );
}

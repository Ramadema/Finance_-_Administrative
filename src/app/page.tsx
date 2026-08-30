"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDatos } from "@/lib/DatosContext";
import { Kpis } from "@/components/Kpis";
import { Sankey } from "@/components/charts/Sankey";
import { Evolucion } from "@/components/charts/Evolucion";
import { Composicion } from "@/components/charts/Composicion";
import { ListaInsights } from "@/components/ListaInsights";
import { ZonaCarga } from "@/components/ZonaCarga";
import { Card, CardHead } from "@/components/ui/Card";
import { nombrePeriodo } from "@/lib/utils";

export default function Resumen() {
  const d = useDatos();

  if (d.cargando) return <Esqueleto />;
  if (d.movimientos.length === 0) return <Bienvenida onImportado={d.recargar} />;
  if (!d.resumen || !d.periodo) return null;

  const pendientes = d.insights.filter(
    (i) => i.severidad === "critico" || i.severidad === "atencion",
  );

  return (
    <div className="space-y-4">
      <Kpis
        actual={d.resumen}
        previo={d.previo}
        comprometido={d.cuotas[0]?.monto ?? 0}
      />

      {pendientes.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--ink-secundario)" }}>
              Lo que pide atención
            </h2>
            {pendientes.length > 2 && (
              <Link href="/insights" className="flex items-center gap-1 text-[12.5px] font-medium"
                    style={{ color: "var(--s1)" }}>
                Ver las {pendientes.length}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <ListaInsights insights={pendientes} limite={2} />
        </section>
      )}

      {d.flujo && (
        <Card className="overflow-hidden">
          <CardHead
            titulo="A dónde se fue la plata"
            sub={`${nombrePeriodo(d.periodo)} · el ancho de cada flujo es proporcional al monto`}
          />
          <Sankey flujo={d.flujo} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead titulo="Evolución" sub="Gasto e ingreso mes a mes" />
          <Evolucion serie={d.serie} />
        </Card>

        <Card>
          <CardHead titulo="Composición" sub="Cuánto es piso y cuánto decidís" />
          <Composicion serie={d.serie} />
        </Card>
      </div>
    </div>
  );
}

function Bienvenida({ onImportado }: { onImportado: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center">
      <div className="w-full max-w-[620px] text-center">
        <h2 className="text-[26px] leading-tight font-semibold tracking-tight">
          Enterate a dónde se va tu plata
        </h2>
        <p className="mx-auto mt-2 max-w-[460px] text-[14px] leading-relaxed"
           style={{ color: "var(--ink-secundario)" }}>
          Subí el Excel de movimientos que te da BBVA y armo el dashboard: en qué gastás,
          cuánto es fijo, cuánto te sobra y qué cuotas ya tenés comprometidas.
        </p>

        <div className="mt-7">
          <ZonaCarga onImportado={onImportado} />
        </div>

        <ul className="mx-auto mt-7 grid max-w-[520px] grid-cols-1 gap-2 text-left text-[13px] sm:grid-cols-2"
            style={{ color: "var(--ink-secundario)" }}>
          {[
            "Nada sale de tu navegador",
            "Categoriza solo ~180 comercios",
            "Detecta gastos fijos y suscripciones",
            "Verifica que la suma cuadre",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--s1)" }} />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[110px] animate-pulse rounded-[14px]"
             style={{ background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)" }} />
      ))}
    </div>
  );
}

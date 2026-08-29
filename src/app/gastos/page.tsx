"use client";

import { useDatos } from "@/lib/DatosContext";
import { CategoriasInteractivas } from "@/components/charts/CategoriasInteractivas";
import { Calendario } from "@/components/charts/Calendario";
import { Waterfall } from "@/components/charts/Waterfall";
import { Torta } from "@/components/charts/Torta";
import { ComparacionMeses } from "@/components/charts/ComparacionMeses";
import { TopComercios } from "@/components/TopComercios";
import { Cuotas } from "@/components/charts/Cuotas";
import { Card, CardHead } from "@/components/ui/Card";
import { nombrePeriodo, periodoAnterior } from "@/lib/utils";
import { formatARS } from "@/lib/ingest/numero";

export default function Gastos() {
  const d = useDatos();
  if (!d.periodo || !d.resumen) return null;

  const anterior = periodoAnterior(d.periodo);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            titulo="Cómo se reparte el mes"
            sub={`${nombrePeriodo(d.periodo)} · cuánto pesa cada categoría sobre el total`}
          />
          <Torta datos={d.categorias} />
        </Card>

        <Card>
          <CardHead
            titulo="Mes contra mes"
            sub="Los mismos rubros, para ver dónde cambió de verdad"
          />
          <ComparacionMeses porPeriodo={d.categoriasPorPeriodo} periodos={d.periodos} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHead
            titulo="Gasto por categoría"
            sub="Tocá una categoría para ver en qué comercios se fue"
          />
          <CategoriasInteractivas datos={d.categorias} />
          {d.resumen.gastosUSD > 0 && (
            <p className="px-5 pb-5 text-[12px]" style={{ color: "var(--ink-mudo)" }}>
              Además gastaste{" "}
              <strong style={{ color: "var(--ink-secundario)" }}>
                US$ {d.resumen.gastosUSD.toFixed(2)}
              </strong>{" "}
              en consumos en dólares. No están sumados arriba porque el resumen no trae
              la cotización.
            </p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHead titulo="Ritmo del mes" sub="Gasto día por día" />
          <Calendario gastoPorDia={d.diario} periodo={d.periodo} />
          {d.fueraDelMes.cantidad > 0 && (
            <p className="px-5 pb-5 text-[12px]" style={{ color: "var(--ink-mudo)" }}>
              El calendario no muestra{" "}
              <strong style={{ color: "var(--ink-secundario)" }}>
                {formatARS(d.fueraDelMes.monto, { decimales: false })}
              </strong>{" "}
              en {d.fueraDelMes.cantidad}{" "}
              {d.fueraDelMes.cantidad === 1 ? "movimiento que se compró" : "movimientos que se compraron"}{" "}
              en otro mes —cuotas y ajustes—. Sí están en el total de{" "}
              {nombrePeriodo(d.periodo)}.
            </p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            titulo="Qué cambió"
            sub={`${nombrePeriodo(d.periodo)} contra ${nombrePeriodo(anterior)}`}
          />
          {d.previo ? (
            <Waterfall variacion={d.variacion} periodoA={anterior} periodoB={d.periodo} />
          ) : (
            <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
              No hay datos de {nombrePeriodo(anterior)} para comparar.
            </p>
          )}
        </Card>

        <Card>
          <CardHead titulo="Dónde más gastaste" sub={`Top comercios de ${nombrePeriodo(d.periodo)}`} />
          <TopComercios />
        </Card>
      </div>

      <Card>
        <CardHead
          titulo="Ya comprometido"
          sub={
            d.cuotas.length > 0
              ? `${formatARS(d.cuotas.reduce((a, c) => a + c.monto, 0), { decimales: false })} en cuotas por delante`
              : "Cuotas que caen en los próximos meses"
          }
        />
        <Cuotas futuro={d.cuotas} />
      </Card>
    </div>
  );
}

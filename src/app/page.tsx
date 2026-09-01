"use client";

import Link from "next/link";
import { ArrowRight, Cloud, Loader2, TriangleAlert } from "lucide-react";
import { useDatos } from "@/lib/DatosContext";
import { Kpis } from "@/components/Kpis";
import { Sankey } from "@/components/charts/Sankey";
import { Evolucion } from "@/components/charts/Evolucion";
import { Composicion } from "@/components/charts/Composicion";
import { ListaInsights } from "@/components/ListaInsights";
import { ZonaCarga } from "@/components/ZonaCarga";
import { Card, CardHead } from "@/components/ui/Card";
import { Boton } from "@/components/ui/Boton";
import { nombrePeriodo } from "@/lib/utils";

export default function Resumen() {
  const d = useDatos();

  if (d.cargando) return <Esqueleto />;
  if (d.movimientos.length === 0) return <Bienvenida />;
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

/**
 * Puerta de entrada, con dos caminos.
 *
 * Entrar con Google trae lo que ya tenías guardado — es el camino de "vuelvo
 * desde otro dispositivo". Subir el Excel sin cuenta deja todo en este
 * navegador — es el camino de "quiero probar la app". Ninguno de los dos es un
 * requisito del otro: la app funciona entera sin cuenta.
 */
function Bienvenida() {
  const d = useDatos();
  const { drive } = d;
  const entrando = drive.ocupado === "entrando";

  return (
    /* Centrado vertical y escalado con la pantalla: en un monitor grande, un
       bloque de 620px pegado arriba deja un vacío enorme debajo y la puerta de
       entrada de la app queda pareciendo una nota al pie. */
    <div className="flex min-h-[calc(100svh-150px)] flex-col items-center justify-center">
      <div className="w-full max-w-[620px] text-center lg:max-w-[760px]">
        <h2 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-[34px] lg:text-[42px]">
          Enterate a dónde se va tu plata
        </h2>
        <p className="mx-auto mt-3 max-w-[460px] text-[14px] leading-relaxed lg:max-w-[560px] lg:text-[16px]"
           style={{ color: "var(--ink-secundario)" }}>
          Subí el Excel de movimientos que te da BBVA y armo el dashboard: en qué gastás,
          cuánto es fijo, cuánto te sobra y qué cuotas ya tenés comprometidas.
        </p>

        {drive.disponible && (
          <div className="mt-8 lg:mt-10">
            <Boton
              variante="solido"
              onClick={() => void drive.entrar()}
              disabled={entrando}
              className="gap-2 px-5 py-2.5 text-[15px] lg:px-6 lg:py-3 lg:text-[16px]"
            >
              {entrando
                ? <Loader2 className="h-[18px] w-[18px] animate-spin" />
                : <Cloud className="h-[18px] w-[18px]" />}
              {drive.sesionPrevia ? "Reconectar con Google" : "Entrar con Google"}
            </Boton>
            <p className="mt-2.5 text-[13px] lg:text-[13.5px]" style={{ color: "var(--ink-mudo)" }}>
              {drive.sesionPrevia
                ? "Ya usaste Drive en este navegador. Un clic y traigo tus datos."
                : "Si ya usaste la app antes, te trae lo que tenías guardado en tu Drive."}
            </p>

            {drive.error && (
              <p className="mx-auto mt-3 flex max-w-[440px] items-start gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] leading-relaxed"
                 style={{
                   background: "color-mix(in oklab, var(--critico) 14%, transparent)",
                   color: "var(--ink-secundario)",
                 }}>
                <TriangleAlert className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--critico)" }} />
                {drive.error}
              </p>
            )}

            <div className="mx-auto mt-7 flex max-w-[420px] items-center gap-3 lg:mt-9">
              <span className="h-px flex-1" style={{ background: "var(--borde)" }} />
              <span className="text-[12.5px] whitespace-nowrap" style={{ color: "var(--ink-mudo)" }}>
                o probala sin cuenta
              </span>
              <span className="h-px flex-1" style={{ background: "var(--borde)" }} />
            </div>
          </div>
        )}

        <div className="mt-5">
          <ZonaCarga onImportado={d.recargar} grande />
        </div>
        {drive.disponible && (
          <p className="mt-2.5 text-[12.5px]" style={{ color: "var(--ink-mudo)" }}>
            Sin cuenta, tus datos quedan solo en este navegador.
          </p>
        )}

        <ul className="mx-auto mt-8 grid max-w-[520px] grid-cols-1 gap-2 text-left text-[13px] sm:grid-cols-2 lg:mt-10 lg:max-w-[600px] lg:gap-3 lg:text-[14px]"
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

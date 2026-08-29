"use client";

import { useState } from "react";
import { PiggyBank, Wallet, Shield, Percent } from "lucide-react";
import { useDatos } from "@/lib/DatosContext";
import { FormIngresos } from "@/components/FormIngresos";
import { SimuladorAhorro } from "@/components/SimuladorAhorro";
import { Proyeccion } from "@/components/charts/Proyeccion";
import { Card, CardHead } from "@/components/ui/Card";
import { Boton } from "@/components/ui/Boton";
import { formatARS, parseImporteAR } from "@/lib/ingest/numero";
import { guardarConfig } from "@/lib/db/repo";
import { nombrePeriodo } from "@/lib/utils";

export default function Ahorro() {
  const d = useDatos();
  if (!d.periodo || !d.capacidad) return null;

  const c = d.capacidad;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          titulo={`Ingresos de ${nombrePeriodo(d.periodo)}`}
          sub="El resumen de tarjeta solo trae consumos — los ingresos se cargan a mano"
        />
        <FormIngresos />
      </Card>

      {c.hayIngresos ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Mini
              icono={<Wallet className="h-4 w-4" />}
              rotulo="Te queda libre"
              valor={formatARS(c.capacidad, { decimales: false })}
              pie="ingresos menos gastos"
              acento={c.capacidad >= 0 ? "var(--bueno)" : "var(--critico)"}
            />
            <Mini
              icono={<Percent className="h-4 w-4" />}
              rotulo="Tasa de ahorro"
              valor={`${Math.round((c.tasaAhorro ?? 0) * 100)}%`}
              pie="del ingreso que no gastás"
              acento="var(--s1)"
            />
            <Mini
              icono={<PiggyBank className="h-4 w-4" />}
              rotulo="Margen propio"
              valor={formatARS(c.margenDiscrecional, { decimales: false })}
              pie="ingreso menos el piso fijo"
              acento="var(--s7)"
            />
            <Mini
              icono={<Shield className="h-4 w-4" />}
              rotulo="Colchón"
              valor={
                d.fondo?.mesesCubiertos != null && d.fondo.ahorroActual > 0
                  ? `${d.fondo.mesesCubiertos.toFixed(1)} meses`
                  : "—"
              }
              pie="de gastos fijos cubiertos"
              acento="var(--s3)"
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHead
                titulo="Si sostenés el ritmo"
                sub="Ahorro acumulado proyectado a 12 meses"
              />
              {d.proyeccion && <Proyeccion proyeccion={d.proyeccion} />}
            </Card>

            <Card>
              <CardHead
                titulo="Simulador de recorte"
                sub="Cuánto juntarías si bajaras el gasto de alguna categoría"
              />
              <SimuladorAhorro categorias={d.categorias} capacidadActual={d.proyeccion?.base ?? null} />
            </Card>
          </div>

          <Card>
            <CardHead
              titulo="Fondo de emergencia"
              sub="Cuántos meses podrías sostener tus gastos fijos sin ingresos"
            />
            <FondoForm />
          </Card>

          <p className="px-1 pb-2 text-[11.5px] leading-relaxed" style={{ color: "var(--ink-mudo)" }}>
            Los números de esta sección son aritmética sobre tus propios datos: cuánta plata te
            queda libre y qué pasaría si recortaras un gasto. No incluyen ninguna recomendación
            sobre dónde poner esa plata — esa decisión depende de tu situación completa y de tu
            tolerancia al riesgo, y corresponde a un asesor matriculado.
          </p>
        </>
      ) : (
        <Card className="p-6 text-center">
          <PiggyBank className="mx-auto h-7 w-7" style={{ color: "var(--ink-mudo)" }} />
          <p className="mt-2 text-[14px] font-medium">Cargá tus ingresos para desbloquear esta sección</p>
          <p className="mx-auto mt-1 max-w-[380px] text-[12.5px]" style={{ color: "var(--ink-mudo)" }}>
            Sin saber cuánto entra no puedo calcular cuánto te sobra, tu tasa de ahorro ni
            proyectar nada. Se carga una vez y se repite a los meses siguientes.
          </p>
        </Card>
      )}
    </div>
  );
}

function FondoForm() {
  const { ahorroAcumulado, fondo, recargar } = useDatos();
  const [valor, setValor] = useState(ahorroAcumulado ? String(ahorroAcumulado) : "");
  const [guardado, setGuardado] = useState(false);

  const parseado = parseImporteAR(valor);

  async function guardar() {
    await guardarConfig("ahorroAcumulado", parseado ?? 0);
    setGuardado(true);
    await recargar();
    setTimeout(() => setGuardado(false), 2200);
  }

  return (
    <div className="px-5 pb-5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label htmlFor="ahorro" className="mb-1 block text-[11.5px]"
                 style={{ color: "var(--ink-mudo)" }}>
            ¿Cuánto tenés ahorrado hoy?
          </label>
          <input
            id="ahorro" value={valor} onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void guardar(); }}
            inputMode="decimal" placeholder="2.500.000"
            className="tabular w-full rounded-lg px-2.5 py-1.5 text-[13px] focus-visible:outline-2"
            style={{
              background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)",
              outlineColor: "var(--s1)",
            }}
          />
        </div>
        <Boton variante="solido" onClick={() => void guardar()}>
          {guardado ? "Guardado" : "Guardar"}
        </Boton>
      </div>

      {fondo && fondo.ahorroActual > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between text-[13px]">
            <span style={{ color: "var(--ink-secundario)" }}>
              Cubrís {fondo.mesesCubiertos?.toFixed(1)} de {fondo.metaMeses} meses
            </span>
            <span className="tabular font-medium">
              {formatARS(fondo.ahorroActual, { decimales: false })}
            </span>
          </div>

          <div className="h-[9px] w-full overflow-hidden rounded-full"
               style={{ background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.min(100, ((fondo.mesesCubiertos ?? 0) / fondo.metaMeses) * 100)}%`,
                background: (fondo.mesesCubiertos ?? 0) >= fondo.metaMeses
                  ? "var(--bueno)"
                  : (fondo.mesesCubiertos ?? 0) >= 3 ? "var(--s1)" : "var(--advertencia)",
              }}
            />
          </div>

          <p className="text-[12px]" style={{ color: "var(--ink-mudo)" }}>
            {fondo.faltante === 0
              ? `Ya cubrís los ${fondo.metaMeses} meses de referencia.`
              : fondo.mesesParaMeta !== null
              ? `Te faltan ${formatARS(fondo.faltante, { decimales: false })}. Al ritmo actual llegarías en ${fondo.mesesParaMeta} meses.`
              : `Te faltan ${formatARS(fondo.faltante, { decimales: false })}, pero sin capacidad de ahorro positiva no vas a poder construirlo.`}
          </p>
        </div>
      )}
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
      <p className="mt-2 text-[21px] leading-none font-semibold tracking-tight">{valor}</p>
      <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-mudo)" }}>{pie}</p>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon, Sun, Download, Upload as UploadIcon, Wallet, ChevronDown } from "lucide-react";

import { ZonaCarga } from "@/components/ZonaCarga";
import { Kpis } from "@/components/Kpis";
import { Suscripciones } from "@/components/Suscripciones";
import { TablaMovimientos } from "@/components/TablaMovimientos";
import { Sankey } from "@/components/charts/Sankey";
import { Calendario } from "@/components/charts/Calendario";
import { BarrasCategoria } from "@/components/charts/BarrasCategoria";
import { Evolucion } from "@/components/charts/Evolucion";
import { Cuotas } from "@/components/charts/Cuotas";
import { Card, CardHead } from "@/components/ui/Card";
import { Boton } from "@/components/ui/Boton";

import { db } from "@/lib/db/esquema";
import type { Movimiento } from "@/lib/db/esquema";
import { exportarJSON, importarJSON } from "@/lib/db/repo";
import {
  resumenDe, gastoPorCategoria, gastoDiario, cuotasComprometidas,
  serieMensual, naturalezasDe, perfiles as perfilesDe, flujoSankey,
} from "@/lib/analisis/metricas";
import { alternarTema, useTema } from "@/lib/design/useTema";
import { nombrePeriodo, periodoAnterior } from "@/lib/utils";

export default function Pagina() {
  const [montado, setMontado] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);
  const tema = useTema();

  const recargar = useCallback(async () => {
    const ms = await db().movimientos.toArray();
    setMovimientos(ms.sort((a, b) => b.fecha.localeCompare(a.fecha)));
  }, []);

  useEffect(() => {
    setMontado(true);
    void recargar();
  }, [recargar]);

  const periodos = useMemo(
    () => [...new Set(movimientos.map((m) => m.periodo))].sort(),
    [movimientos],
  );

  const periodo = periodoSel ?? periodos[periodos.length - 1] ?? null;

  const datos = useMemo(() => {
    if (!periodo) return null;
    const naturalezas = naturalezasDe(movimientos, periodos);
    const anterior = periodoAnterior(periodo);
    const futuro = cuotasComprometidas(movimientos);
    const resumen = resumenDe(movimientos, periodo, naturalezas);
    return {
      resumen,
      flujo: flujoSankey(movimientos, periodo, naturalezas, resumen),
      previo: periodos.includes(anterior)
        ? resumenDe(movimientos, anterior, naturalezas)
        : null,
      categorias: gastoPorCategoria(movimientos, periodo),
      diario: gastoDiario(movimientos, periodo),
      serie: serieMensual(movimientos, periodos, naturalezas),
      futuro,
      comprometidoProximo: futuro[0]?.monto ?? 0,
      perfiles: perfilesDe(movimientos, periodos),
      delMes: movimientos.filter((m) => m.periodo === periodo),
    };
  }, [movimientos, periodos, periodo]);

  async function descargarRespaldo() {
    const json = await exportarJSON();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restaurarRespaldo(archivo: File) {
    const r = await importarJSON(await archivo.text());
    if (r.ok) await recargar();
    else alert(r.error);
  }

  if (!montado) return <Esqueleto />;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:py-9">
      <Encabezado
        tema={tema}
        periodos={periodos}
        periodo={periodo}
        onPeriodo={setPeriodoSel}
        onRespaldo={descargarRespaldo}
        onRestaurar={restaurarRespaldo}
      />

      {movimientos.length === 0 ? (
        <Bienvenida onImportado={recargar} />
      ) : (
        datos && (
          <div className="mt-6 space-y-4">
            <Kpis
              actual={datos.resumen}
              previo={datos.previo}
              comprometido={datos.comprometidoProximo}
            />

            <Card className="overflow-hidden">
              <CardHead
                titulo="A dónde se fue la plata"
                sub={`${nombrePeriodo(periodo!)} · el ancho de cada flujo es proporcional al monto`}
              />
              <Sankey flujo={datos.flujo} />
            </Card>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHead titulo="Gasto por categoría" sub={nombrePeriodo(periodo!)} />
                <BarrasCategoria datos={datos.categorias} />
                {datos.resumen.gastosUSD > 0 && (
                  <p className="px-5 pb-5 text-[12px]" style={{ color: "var(--ink-mudo)" }}>
                    Además gastaste{" "}
                    <strong style={{ color: "var(--ink-secundario)" }}>
                      US$ {datos.resumen.gastosUSD.toFixed(2)}
                    </strong>{" "}
                    en consumos en dólares. No están sumados arriba porque el resumen
                    no trae la cotización.
                  </p>
                )}
              </Card>

              <Card className="lg:col-span-2">
                <CardHead titulo="Ritmo del mes" sub="Gasto día por día" />
                <Calendario gastoPorDia={datos.diario} periodo={periodo!} />
              </Card>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <Card>
                <CardHead titulo="Evolución" sub="Mes a mes" />
                <Evolucion serie={datos.serie} />
              </Card>

              <Card>
                <CardHead
                  titulo="Ya comprometido"
                  sub="Cuotas que caen en los próximos meses"
                />
                <Cuotas futuro={datos.futuro} />
              </Card>
            </div>

            <Card>
              <CardHead
                titulo="Gastos fijos y suscripciones"
                sub="Detectados automáticamente por su patrón mensual"
              />
              <Suscripciones perfiles={datos.perfiles} />
            </Card>

            <Card>
              <CardHead
                titulo="Movimientos"
                sub="Clic en la categoría para cambiarla — se aplica a todo el histórico de ese comercio"
              />
              <TablaMovimientos movimientos={datos.delMes} onCambio={recargar} />
            </Card>

            <Card>
              <CardHead titulo="Cargar otro resumen" />
              <div className="px-5 pb-5">
                <ZonaCarga onImportado={recargar} />
              </div>
            </Card>

            <p className="pt-2 pb-6 text-center text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
              Tus datos viven solo en este navegador. Descargá un respaldo de vez en cuando.
            </p>
          </div>
        )
      )}
    </div>
  );
}

function Encabezado({
  tema, periodos, periodo, onPeriodo, onRespaldo, onRestaurar,
}: {
  tema: string;
  periodos: string[];
  periodo: string | null;
  onPeriodo: (p: string) => void;
  onRespaldo: () => void;
  onRestaurar: (f: File) => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[11px]"
          style={{ background: "color-mix(in oklab, var(--s1) 16%, transparent)", color: "var(--s1)" }}
        >
          <Wallet className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h1 className="text-[17px] leading-tight font-semibold tracking-tight">Plata</h1>
          <p className="text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
            Tus finanzas, claras
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {periodos.length > 0 && periodo && (
          <div className="relative">
            <select
              value={periodo}
              onChange={(e) => onPeriodo(e.target.value)}
              className="appearance-none rounded-lg py-1.5 pr-7 pl-3 text-[13px] font-medium focus-visible:outline-2"
              style={{
                background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)",
                color: "var(--ink-primario)",
                outlineColor: "var(--s1)",
              }}
            >
              {[...periodos].reverse().map((p) => (
                <option key={p} value={p}>{nombrePeriodo(p)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2"
                         style={{ color: "var(--ink-mudo)" }} />
          </div>
        )}

        <Boton variante="fantasma" onClick={onRespaldo} title="Descargar respaldo">
          <Download className="h-4 w-4" />
        </Boton>

        <label
          className="inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5"
          style={{ color: "var(--ink-secundario)" }}
          title="Restaurar respaldo"
        >
          <UploadIcon className="h-4 w-4" />
          <input
            type="file" accept="application/json" className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onRestaurar(f);
              e.target.value = "";
            }}
          />
        </label>

        <Boton variante="fantasma" onClick={alternarTema} title="Cambiar tema">
          {tema === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Boton>
      </div>
    </header>
  );
}

function Bienvenida({ onImportado }: { onImportado: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center">
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
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
      <div className="h-9 w-40 animate-pulse rounded-lg"
           style={{ background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)" }} />
    </div>
  );
}

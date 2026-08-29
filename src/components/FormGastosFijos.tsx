"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatARS, parseImporteAR } from "@/lib/ingest/numero";
import { listarGastosFijos, guardarGastoFijo, borrarGastoFijo } from "@/lib/db/repo";
import type { GastoFijo } from "@/lib/db/esquema";
import { CATEGORIAS, categoria as buscarCategoria } from "@/lib/categorize/categorias";
import { colorSerie } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { useDatos } from "@/lib/DatosContext";
import { nombrePeriodo } from "@/lib/utils";
import { Boton } from "./ui/Boton";
import { Tooltip } from "./ui/Tooltip";

/**
 * Carga de gastos fijos que no pasan por la tarjeta.
 *
 * El alquiler, la facultad y la prepaga salen por débito o transferencia, así
 * que el resumen de BBVA no los ve. Sin esto el "piso mensual" deja afuera los
 * gastos más grandes y la capacidad de ahorro sale inflada.
 *
 * Cada uno se guarda con su categoría REAL, no en un cajón "gastos fijos": el
 * alquiler es Servicios/Alquiler y la facultad Servicios/Educación. Que sean
 * fijos no se etiqueta — se detecta solo, porque se repiten todos los meses con
 * el mismo monto.
 */
const OPCIONES = CATEGORIAS.filter(
  (c) => c.clase === "gasto" && c.id !== "sin_categoria",
);

export function FormGastosFijos() {
  const tema = useTema();
  const { periodos, recargar } = useDatos();
  const [items, setItems] = useState<GastoFijo[]>([]);

  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoriaId, setCategoriaId] = useState("servicios");
  const [subcategoria, setSubcategoria] = useState("Alquiler");
  const [desde, setDesde] = useState("");

  const refrescar = useCallback(async () => {
    setItems(await listarGastosFijos());
  }, []);

  useEffect(() => { void refrescar(); }, [refrescar]);
  useEffect(() => {
    // Por defecto corre desde el primer mes que tenés cargado.
    if (!desde && periodos.length > 0) setDesde(periodos[0]);
  }, [periodos, desde]);

  const subcategorias = buscarCategoria(categoriaId).subcategorias;
  const montoParseado = parseImporteAR(monto);
  const puedeAgregar =
    concepto.trim() !== "" && montoParseado !== null && montoParseado > 0 && desde !== "";

  async function agregar() {
    if (!puedeAgregar) return;
    await guardarGastoFijo({
      concepto: concepto.trim(),
      monto: montoParseado!,
      categoria: categoriaId,
      subcategoria: subcategoria || null,
      desde,
      hasta: null,
    });
    setConcepto("");
    setMonto("");
    await refrescar();
    await recargar();
  }

  async function quitar(id: string) {
    await borrarGastoFijo(id);
    await refrescar();
    await recargar();
  }

  const total = items.reduce((a, i) => a + i.monto, 0);

  return (
    <div className="px-5 pb-5">
      {items.length > 0 && (
        <ul className="mb-3 space-y-1">
          {items.map((i) => {
            const cat = buscarCategoria(i.categoria);
            return (
              <li key={i.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                  style={{ background: "color-mix(in oklab, var(--ink-primario) 3%, transparent)" }}>
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: colorSerie(cat.slot, tema) }} />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {i.concepto}
                  <span className="ml-1.5 text-[11px]" style={{ color: "var(--ink-mudo)" }}>
                    {cat.nombre}
                    {i.subcategoria ? ` · ${i.subcategoria}` : ""}
                    {i.desde !== periodos[0] ? ` · desde ${nombrePeriodo(i.desde)}` : ""}
                  </span>
                </span>
                <span className="tabular text-[13px] font-medium">
                  {formatARS(i.monto, { decimales: false })}
                </span>
                <Tooltip texto={`Quitar "${i.concepto}" de todos los meses`} lado="left">
                  <button onClick={() => void quitar(i.id)}
                          aria-label={`Quitar ${i.concepto}`}
                          className="rounded p-1 opacity-40 transition-opacity hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Campo etiqueta="Concepto" className="min-w-[140px] flex-1">
          <input
            value={concepto} onChange={(e) => setConcepto(e.target.value)}
            placeholder="Alquiler, facultad, prepaga…"
            className="w-full rounded-lg px-2.5 py-1.5 text-[13px] focus-visible:outline-2"
            style={{ background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)", outlineColor: "var(--s1)" }}
          />
        </Campo>

        <Campo etiqueta="Monto" className="w-[130px]">
          <input
            value={monto} onChange={(e) => setMonto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void agregar(); }}
            inputMode="decimal" placeholder="500.000"
            className="tabular w-full rounded-lg px-2.5 py-1.5 text-[13px] focus-visible:outline-2"
            style={{ background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)", outlineColor: "var(--s1)" }}
          />
        </Campo>

        <Campo etiqueta="Categoría" className="w-[170px]">
          <Select
            value={categoriaId}
            onChange={(v) => {
              setCategoriaId(v);
              setSubcategoria(buscarCategoria(v).subcategorias[0] ?? "");
            }}
            opciones={OPCIONES.map((c) => ({ valor: c.id, texto: c.nombre }))}
          />
        </Campo>

        {subcategorias.length > 0 && (
          <Campo etiqueta="Subcategoría" className="w-[150px]">
            <Select
              value={subcategoria}
              onChange={setSubcategoria}
              opciones={subcategorias.map((sc) => ({ valor: sc, texto: sc }))}
            />
          </Campo>
        )}

        <Campo etiqueta="Desde" className="w-[130px]">
          <Select
            value={desde}
            onChange={setDesde}
            opciones={periodos.map((p) => ({ valor: p, texto: nombrePeriodo(p) }))}
          />
        </Campo>

        <Boton variante="solido" onClick={() => void agregar()} disabled={!puedeAgregar}>
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Boton>
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex items-baseline justify-between border-t pt-3"
             style={{ borderColor: "var(--borde)" }}>
          <span className="text-[13px]" style={{ color: "var(--ink-secundario)" }}>
            Por mes, cargado a mano
          </span>
          <span className="tabular text-[17px] font-semibold">
            {formatARS(total, { decimales: false })}
          </span>
        </div>
      )}

      <p className="mt-3 text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
        Se suman a los {periodos.length} {periodos.length === 1 ? "mes" : "meses"} que tenés
        cargados, desde el que elijas. Cuando importes un resumen nuevo, se agregan solos.
      </p>
    </div>
  );
}

function Campo({
  etiqueta, className, children,
}: {
  etiqueta: string; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
        {etiqueta}
      </span>
      {children}
    </label>
  );
}

function Select({
  value, onChange, opciones,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-2.5 py-1.5 text-[13px] focus-visible:outline-2"
      style={{
        background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)",
        color: "var(--ink-primario)",
        outlineColor: "var(--s1)",
      }}
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>{o.texto}</option>
      ))}
    </select>
  );
}

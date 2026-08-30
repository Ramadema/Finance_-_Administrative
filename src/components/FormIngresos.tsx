"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, CopyPlus } from "lucide-react";
import { formatARS, parseImporteAR } from "@/lib/ingest/numero";
import { ingresosDe, guardarIngreso, borrarIngreso, repetirIngresosHacia } from "@/lib/db/repo";
import type { IngresoManual } from "@/lib/db/esquema";
import { useDatos } from "@/lib/DatosContext";
import { nombrePeriodo } from "@/lib/utils";
import { Boton } from "./ui/Boton";
import { Tooltip } from "./ui/Tooltip";

/**
 * Carga manual de ingresos.
 *
 * El resumen de tarjeta de BBVA solo trae consumos, así que sin esto la app
 * nunca puede responder "cuánto me sobra". El monto se parsea con el mismo
 * lector de formato argentino que usa el importador: escribir "1.250.000" tiene
 * que dar un millón doscientos cincuenta mil, no 1,25.
 */
export function FormIngresos() {
  const { periodo, periodos, recargar } = useDatos();
  const [items, setItems] = useState<IngresoManual[]>([]);
  const [concepto, setConcepto] = useState("Sueldo");
  const [monto, setMonto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (periodo) void ingresosDe(periodo).then(setItems);
  }, [periodo]);

  if (!periodo) return null;

  const total = items.reduce((a, i) => a + i.monto, 0);
  const montoParseado = parseImporteAR(monto);
  const puedeAgregar = concepto.trim() !== "" && montoParseado !== null && montoParseado > 0;

  async function agregar() {
    if (!puedeAgregar || !periodo) return;
    await guardarIngreso({
      periodo, concepto: concepto.trim(), monto: montoParseado!, origen: "manual",
    });
    setMonto("");
    setItems(await ingresosDe(periodo));
    await recargar();
  }

  async function quitar(id: string) {
    if (!periodo) return;
    await borrarIngreso(id);
    setItems(await ingresosDe(periodo));
    await recargar();
  }

  async function repetir() {
    if (!periodo) return;
    const posteriores = periodos.filter((p) => p > periodo);
    const n = await repetirIngresosHacia(periodo, posteriores);
    setAviso(
      n === 0
        ? "Los meses siguientes ya tenían estos conceptos cargados."
        : `Copiado a ${n} ${n === 1 ? "mes" : "meses"}. No se pisó nada de lo que ya habías cargado.`,
    );
    await recargar();
  }

  return (
    <div className="px-5 pb-5">
      {items.length > 0 && (
        <ul className="mb-3 space-y-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                style={{ background: "color-mix(in oklab, var(--ink-primario) 3%, transparent)" }}>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {i.concepto}
                {i.origen === "repetido" && (
                  <span className="ml-1.5 text-[11px]" style={{ color: "var(--ink-mudo)" }}>
                    copiado
                  </span>
                )}
              </span>
              <span className="tabular text-[13px] font-medium">
                {formatARS(i.monto, { decimales: false })}
              </span>
              <Tooltip texto={`Quitar "${i.concepto}"`} lado="left">
                <button onClick={() => void quitar(i.id)}
                        aria-label={`Quitar ${i.concepto}`}
                        className="rounded p-1 opacity-40 transition-opacity hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[130px] flex-1">
          <label htmlFor="concepto" className="mb-1 block text-[11.5px]"
                 style={{ color: "var(--ink-mudo)" }}>
            Concepto
          </label>
          <input
            id="concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)}
            placeholder="Sueldo, freelance…"
            className="w-full rounded-lg px-2.5 py-1.5 text-[13px] focus-visible:outline-2"
            style={{
              background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)",
              outlineColor: "var(--s1)",
            }}
          />
        </div>

        <div className="w-[140px]">
          <label htmlFor="monto" className="mb-1 block text-[11.5px]"
                 style={{ color: "var(--ink-mudo)" }}>
            Monto
          </label>
          <input
            id="monto" value={monto} onChange={(e) => setMonto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void agregar(); }}
            inputMode="decimal" placeholder="1.250.000"
            className="tabular w-full rounded-lg px-2.5 py-1.5 text-[13px] focus-visible:outline-2"
            style={{
              background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)",
              outlineColor: "var(--s1)",
            }}
          />
        </div>

        <Boton variante="solido" onClick={() => void agregar()} disabled={!puedeAgregar}>
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Boton>
      </div>

      {items.length > 0 && (
        <>
          <div className="mt-4 flex items-baseline justify-between border-t pt-3"
               style={{ borderColor: "var(--borde)" }}>
            <span className="text-[13px]" style={{ color: "var(--ink-secundario)" }}>
              Total de {nombrePeriodo(periodo)}
            </span>
            <span className="tabular text-[17px] font-semibold">
              {formatARS(total, { decimales: false })}
            </span>
          </div>

          {periodos.some((p) => p > periodo) && (
            <div className="mt-3">
              <Boton onClick={() => void repetir()}>
                <CopyPlus className="h-3.5 w-3.5" />
                Repetir en los meses siguientes
              </Boton>
              {aviso && (
                <p className="mt-2 text-[12px]" style={{ color: "var(--ink-mudo)" }}>{aviso}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

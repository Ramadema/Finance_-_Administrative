"use client";

import { useMemo, useState } from "react";
import { Search, CircleHelp, EyeOff, Check } from "lucide-react";
import { formatARS, formatUSD } from "@/lib/ingest/numero";
import { colorSerie } from "@/lib/design/paleta";
import { CATEGORIAS, categoria as buscarCategoria } from "@/lib/categorize/categorias";
import { useTema } from "@/lib/design/useTema";
import { recategorizarComercio, editarMovimiento } from "@/lib/db/repo";
import type { Movimiento } from "@/lib/db/esquema";
import { Boton } from "./ui/Boton";
import { Tooltip } from "./ui/Tooltip";

/**
 * Tabla de movimientos: el detalle auditable de todo.
 *
 * Cumple dos funciones. Es donde categorizás lo que quedó suelto (y al hacerlo
 * le enseñás al motor para siempre), y es la "vista de tabla" que exige la
 * regla de relieve del skill de visualización — con tres tonos de la paleta
 * bajo 3:1 en modo claro, los números tienen que poder leerse sin depender
 * del color.
 */
export function TablaMovimientos({
  movimientos, onCambio,
}: {
  movimientos: Movimiento[];
  onCambio: () => void;
}) {
  const tema = useTema();
  const [busqueda, setBusqueda] = useState("");
  const [soloSinCategoria, setSoloSinCategoria] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return movimientos.filter((m) => {
      if (soloSinCategoria && m.categoria !== "sin_categoria") return false;
      if (!q) return true;
      return (
        m.comercio.toLowerCase().includes(q) ||
        m.descripcionCruda.toLowerCase().includes(q) ||
        buscarCategoria(m.categoria).nombre.toLowerCase().includes(q)
      );
    });
  }, [movimientos, busqueda, soloSinCategoria]);

  const sinCategoria = movimientos.filter((m) => m.categoria === "sin_categoria").length;

  async function asignar(mov: Movimiento, categoriaId: string) {
    // Enseñar el comercio: aplica a todo el histórico, no solo a esta fila.
    await recategorizarComercio(mov.claveComercio, categoriaId, null, mov.comercio);
    setEditando(null);
    onCambio();
  }

  async function alternarExcluido(mov: Movimiento) {
    await editarMovimiento(mov.id, { excluido: !mov.excluido });
    onCambio();
  }

  return (
    <div className="px-5 pb-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: "var(--ink-mudo)" }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar comercio o categoría…"
            className="w-full rounded-lg py-1.5 pr-3 pl-8 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
            style={{
              background: "color-mix(in oklab, var(--ink-primario) 5%, transparent)",
              outlineColor: "var(--s1)",
            }}
          />
        </div>

        {sinCategoria > 0 && (
          <Boton
            variante={soloSinCategoria ? "solido" : "suave"}
            onClick={() => setSoloSinCategoria((v) => !v)}
          >
            <CircleHelp className="h-3.5 w-3.5" />
            {sinCategoria} sin categorizar
          </Boton>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p className="py-6 text-center text-[13px]" style={{ color: "var(--ink-mudo)" }}>
          {movimientos.length === 0
            ? "No hay movimientos en este período."
            : "Ningún movimiento coincide con el filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr style={{ color: "var(--ink-mudo)" }}>
                <th className="pb-2 text-left font-medium">Fecha</th>
                <th className="pb-2 text-left font-medium">Comercio</th>
                <th className="pb-2 text-left font-medium">Categoría</th>
                <th className="pb-2 text-right font-medium">Importe</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => {
                const cat = buscarCategoria(m.categoria);
                const desconocida = m.categoria === "sin_categoria";
                return (
                  <tr
                    key={m.id}
                    className="border-t transition-colors"
                    style={{
                      borderColor: "var(--borde)",
                      opacity: m.excluido ? 0.4 : 1,
                    }}
                  >
                    <td className="tabular py-2 pr-3 whitespace-nowrap"
                        style={{ color: "var(--ink-mudo)" }}>
                      {m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)}
                    </td>

                    <td className="py-2 pr-3">
                      <span className={m.excluido ? "line-through" : ""}>{m.comercio}</span>
                      {m.cuotaTotal && (
                        <span className="ml-1.5 rounded px-1 py-0.5 text-[10.5px]"
                              style={{
                                background: "color-mix(in oklab, var(--ink-primario) 7%, transparent)",
                                color: "var(--ink-secundario)",
                              }}>
                          cuota {m.cuotaNro}/{m.cuotaTotal}
                        </span>
                      )}
                      <span className="block truncate text-[11px]" style={{ color: "var(--ink-mudo)" }}>
                        {m.descripcionCruda}
                      </span>
                    </td>

                    <td className="py-2 pr-3">
                      {editando === m.id ? (
                        <select
                          autoFocus
                          defaultValue={m.categoria}
                          onChange={(e) => void asignar(m, e.target.value)}
                          onBlur={() => setEditando(null)}
                          className="rounded-md px-1.5 py-1 text-[12.5px]"
                          style={{
                            background: "var(--elevado)",
                            border: "1px solid var(--borde-fuerte)",
                            color: "var(--ink-primario)",
                          }}
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditando(m.id)}
                          className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left focus-visible:outline-2"
                          style={{ outlineColor: "var(--s1)" }}
                          title="Clic para cambiar — se aplica a todo el histórico de este comercio"
                        >
                          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                                style={{
                                  background: desconocida ? "transparent" : colorSerie(cat.slot, tema),
                                  border: desconocida ? "1.5px dashed var(--ink-mudo)" : "none",
                                }} />
                          <span style={{ color: desconocida ? "var(--ink-mudo)" : "inherit" }}>
                            {desconocida ? "Asignar…" : cat.nombre}
                          </span>
                          {m.fuenteCategoria === "memoria" && (
                            <Check className="h-3 w-3" style={{ color: "var(--texto-bueno)" }} />
                          )}
                        </button>
                      )}
                    </td>

                    <td className="tabular py-2 text-right font-medium whitespace-nowrap">
                      {m.montoUSD !== null && m.montoARS === 0
                        ? formatUSD(m.montoUSD)
                        : formatARS(m.montoARS, { decimales: false })}
                    </td>

                    <td className="py-2 pl-2">
                      <Tooltip
                        lado="left"
                        texto={
                          m.excluido
                            ? "Volver a incluirlo en el análisis"
                            : "Excluirlo del análisis sin borrarlo"
                        }
                      >
                        <button
                          onClick={() => void alternarExcluido(m)}
                          aria-label={m.excluido ? "Volver a incluir" : "Excluir del análisis"}
                          className="rounded p-1 opacity-40 transition-opacity hover:opacity-100"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

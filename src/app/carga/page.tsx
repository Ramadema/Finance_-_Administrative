"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, TriangleAlert, FileSpreadsheet } from "lucide-react";
import { useDatos } from "@/lib/DatosContext";
import { listarImportaciones } from "@/lib/db/repo";
import type { Importacion } from "@/lib/db/esquema";
import { ZonaCarga } from "@/components/ZonaCarga";
import { Card, CardHead } from "@/components/ui/Card";
import { formatARS } from "@/lib/ingest/numero";
import { nombrePeriodo } from "@/lib/utils";

/**
 * Sección de carga: subir resúmenes y ver cuáles ya están.
 *
 * El listado no es decorativo. Cada mes bajás un archivo que se llama igual que
 * el anterior ("Últimos movimientos.xls"), así que sin ver qué períodos ya
 * entraron no hay forma de saber si te falta uno o si estás subiendo el mismo
 * dos veces. Reimportar no duplica nada, pero enterarte después no sirve.
 */
export default function Carga() {
  const { recargar } = useDatos();
  const [importaciones, setImportaciones] = useState<Importacion[]>([]);

  const refrescar = useCallback(async () => {
    setImportaciones(await listarImportaciones());
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const alImportar = useCallback(async () => {
    await Promise.all([recargar(), refrescar()]);
  }, [recargar, refrescar]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          titulo="Subir un resumen"
          sub="BBVA → Tarjetas → Resúmenes → Descargar Excel. Elegí uno ya cerrado."
        />
        <div className="px-5 pb-5">
          <ZonaCarga onImportado={alImportar} />
        </div>
      </Card>

      <Card>
        <CardHead
          titulo="Resúmenes cargados"
          sub={
            importaciones.length === 0
              ? "Todavía no subiste ninguno"
              : `${importaciones.length} ${importaciones.length === 1 ? "archivo" : "archivos"} · subir el mismo de nuevo no duplica nada`
          }
        />

        {importaciones.length === 0 ? (
          <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
            Cuando subas el primero, acá vas a ver qué meses tenés y cuáles te faltan.
          </p>
        ) : (
          <ul className="px-5 pb-4">
            {importaciones.map((i) => (
              <li
                key={i.id}
                className="flex items-start gap-3 py-3"
                style={{ borderTop: "1px solid var(--borde)" }}
              >
                <FileSpreadsheet
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "var(--ink-mudo)" }}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{i.nombreArchivo}</p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--ink-mudo)" }}>
                    {i.periodo ? nombrePeriodo(i.periodo) : "Sin período"} ·{" "}
                    {i.cantidadMovimientos} movimientos ·{" "}
                    {formatARS(i.totalCalculadoARS, { decimales: false })}
                  </p>
                </div>

                {/* El checksum del propio archivo. Es lo único que separa
                    "importé bien" de "importé algo". */}
                {i.cuadra ? (
                  <span
                    className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium"
                    style={{ color: "var(--texto-bueno)" }}
                  >
                    <CircleCheck className="h-3.5 w-3.5" />
                    Cuadra
                  </span>
                ) : (
                  <span
                    className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium"
                    style={{ color: "var(--critico)" }}
                  >
                    <TriangleAlert className="h-3.5 w-3.5" />
                    No cuadra
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

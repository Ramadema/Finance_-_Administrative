"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, CircleCheck, TriangleAlert, CircleX, Loader2 } from "lucide-react";
import { importarArchivo, type ResultadoImport } from "@/lib/db/repo";
import { formatARS } from "@/lib/ingest/numero";
import { cn } from "@/lib/utils";

/**
 * Carga del Excel del banco. Todo el parseo corre acá, en el navegador:
 * el archivo no viaja a ningún servidor.
 */
export function ZonaCarga({
  onImportado, grande = false,
}: {
  onImportado: () => void;
  /** Variante de la pantalla de bienvenida: es el foco de la página. */
  grande?: boolean;
}) {
  const [encima, setEncima] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<(ResultadoImport & { archivo: string }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const procesar = useCallback(
    async (archivo: File) => {
      setCargando(true);
      setRes(null);
      try {
        const r = await importarArchivo(archivo);
        setRes({ ...r, archivo: archivo.name });
        if (r.ok) onImportado();
      } catch (e) {
        setRes({
          ok: false, error: e instanceof Error ? e.message : "Error inesperado al leer el archivo.",
          yaImportado: false, nuevos: 0, repetidos: 0, preservados: 0,
          parseo: null, importacionId: null, archivo: archivo.name,
        });
      } finally {
        setCargando(false);
      }
    },
    [onImportado],
  );

  const alSoltar = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setEncima(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void procesar(f);
    },
    [procesar],
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={alSoltar}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-2",
          "rounded-[14px] border-2 border-dashed px-6 text-center transition-all duration-200",
          grande ? "py-12 lg:py-16" : "py-9",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
        style={{
          borderColor: encima ? "var(--s1)" : "var(--borde-fuerte)",
          background: encima
            ? "color-mix(in oklab, var(--s1) 8%, transparent)"
            : "color-mix(in oklab, var(--ink-primario) 2%, transparent)",
          outlineColor: "var(--s1)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void procesar(f);
            e.target.value = "";
          }}
        />

        {cargando ? (
          <Loader2 className={cn("animate-spin", grande ? "h-8 w-8" : "h-6 w-6")}
                   style={{ color: "var(--s1)" }} />
        ) : (
          <Upload className={grande ? "h-8 w-8" : "h-6 w-6"}
                  style={{ color: encima ? "var(--s1)" : "var(--ink-mudo)" }} />
        )}

        <div>
          <p className={cn("font-medium", grande ? "text-[17px] lg:text-[19px]" : "text-[15px]")}>
            {cargando ? "Leyendo el archivo…" : "Arrastrá el Excel del banco"}
          </p>
          <p className={cn("mt-1", grande ? "text-[13.5px]" : "text-[13px]")}
             style={{ color: "var(--ink-mudo)" }}>
            BBVA → Tarjetas → Resúmenes → Descargar Excel · o hacé clic para elegirlo
          </p>
        </div>

        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-mudo)" }}>
          Se procesa en tu navegador. El archivo no se sube a ningún servidor.
        </p>
      </div>

      {res && <ResultadoCarga res={res} />}
    </div>
  );
}

function ResultadoCarga({ res }: { res: ResultadoImport & { archivo: string } }) {
  if (res.error) {
    return (
      <Aviso tono="critico" icono={<CircleX className="h-4 w-4 shrink-0" />}>
        <strong>{res.archivo}</strong> — {res.error}
      </Aviso>
    );
  }

  const p = res.parseo;
  const vacio = p && p.movimientos.length === 0;
  const noCuadra = p && !p.validacion.cuadra && p.totalDeclarado.ars !== null;

  return (
    <div className="mt-3 space-y-2">
      {noCuadra ? (
        <Aviso tono="advertencia" icono={<TriangleAlert className="h-4 w-4 shrink-0" />}>
          <strong>La suma no cuadra con el total del archivo.</strong> Calculé{" "}
          {formatARS(p!.totalCalculado.ars)} y el resumen declara{" "}
          {formatARS(p!.totalDeclarado.ars!)} — diferencia de{" "}
          {formatARS(Math.abs(p!.validacion.difARS))}. Revisá los movimientos antes de confiar
          en los números.
        </Aviso>
      ) : vacio ? (
        <Aviso tono="advertencia" icono={<TriangleAlert className="h-4 w-4 shrink-0" />}>
          <strong>El archivo no tiene movimientos.</strong> En BBVA, “Últimos movimientos” trae
          el período en curso: si la tarjeta cerró recién, sale vacío. Descargá un resumen ya
          cerrado.
        </Aviso>
      ) : (
        <Aviso tono="bueno" icono={<CircleCheck className="h-4 w-4 shrink-0" />}>
          <strong>{res.nuevos} movimientos nuevos.</strong>
          {res.repetidos > 0 && ` ${res.repetidos} ya estaban.`}
          {res.preservados > 0 && ` ${res.preservados} que editaste a mano quedaron intactos.`}
          {p?.totalDeclarado.ars !== null && " La suma cuadra con el total del resumen."}
        </Aviso>
      )}

      {p?.advertencias
        .filter((a) => !/no cuadra|no tiene movimientos/i.test(a))
        .map((a, i) => (
          <Aviso key={i} tono="advertencia" icono={<TriangleAlert className="h-4 w-4 shrink-0" />}>
            {a}
          </Aviso>
        ))}
    </div>
  );
}

function Aviso({
  tono, icono, children,
}: {
  tono: "bueno" | "advertencia" | "critico";
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  const color = `var(--${tono === "bueno" ? "bueno" : tono === "critico" ? "critico" : "advertencia"})`;
  return (
    <div
      className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed"
      style={{
        background: `color-mix(in oklab, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
      }}
    >
      <span style={{ color }} className="mt-0.5">{icono}</span>
      <span style={{ color: "var(--ink-primario)" }}>{children}</span>
    </div>
  );
}

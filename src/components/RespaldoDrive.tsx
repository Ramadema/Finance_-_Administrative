"use client";

import { CloudUpload, CloudDownload, LogOut, TriangleAlert, Loader2, Cloud } from "lucide-react";
import { useDatos } from "@/lib/DatosContext";
import { Boton } from "./ui/Boton";

/**
 * Control detallado del respaldo en Drive.
 *
 * El login y el estado viven en el encabezado, que es donde se necesitan
 * siempre. Acá quedan las acciones explícitas —guardar ahora, traer ahora,
 * salir— y las fechas, para cuando querés mirar de cerca qué hay de cada lado.
 */
export function RespaldoDrive() {
  const { drive, movimientos } = useDatos();

  if (!drive.disponible) {
    return (
      <p className="px-5 pb-6 text-[13px] leading-relaxed" style={{ color: "var(--ink-mudo)" }}>
        Todavía no está configurado el acceso a Google. Falta crear el permiso en
        la consola de Google y cargar el <code>Client ID</code> en el proyecto —
        es un trámite de una sola vez.
      </p>
    );
  }

  const ocupado = drive.ocupado !== null;

  if (!drive.conectado) {
    return (
      <div className="px-5 pb-5">
        <Boton variante="solido" onClick={() => void drive.entrar()} disabled={ocupado}>
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
          {drive.sesionPrevia ? "Reconectar con Google" : "Entrar con Google"}
        </Boton>
        <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--ink-mudo)" }}>
          La app solo pide acceso a <strong>su propia carpeta oculta</strong> en tu
          Drive. No puede ver tus documentos, tus fotos ni el resto de tus archivos.
        </p>
        {drive.error && <Error texto={drive.error} />}
      </div>
    );
  }

  return (
    <div className="px-5 pb-5">
      <div className="flex flex-wrap items-center gap-2">
        <Boton variante="solido" onClick={() => void drive.guardar()} disabled={ocupado}>
          {drive.ocupado === "guardando"
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CloudUpload className="h-3.5 w-3.5" />}
          Guardar en Drive
        </Boton>

        <Boton onClick={() => void drive.traer()} disabled={ocupado || drive.enNube === null}>
          {drive.ocupado === "trayendo"
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <CloudDownload className="h-3.5 w-3.5" />}
          Traer de Drive
        </Boton>

        <Boton variante="fantasma" onClick={() => void drive.salir()} disabled={ocupado}>
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </Boton>
      </div>

      <dl className="mt-4 space-y-1 text-[12.5px]">
        <Fila
          rotulo="En Drive"
          valor={
            drive.enNube
              ? `${fecha(drive.enNube.modificado)} · ${(drive.enNube.tamano / 1024).toFixed(0)} KB`
              : "todavía no subiste nada"
          }
        />
        <Fila
          rotulo="En este navegador"
          valor={`${movimientos.length} movimientos${
            drive.ultimaSync ? ` · última subida ${fecha(drive.ultimaSync)}` : ""
          }`}
        />
      </dl>

      {drive.error && <Error texto={drive.error} />}
    </div>
  );
}

function Error({ texto }: { texto: string }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed"
       style={{
         background: "color-mix(in oklab, var(--critico) 14%, transparent)",
         color: "var(--ink-secundario)",
       }}>
      <TriangleAlert className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--critico)" }} />
      {texto}
    </p>
  );
}

function Fila({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt style={{ color: "var(--ink-mudo)" }}>{rotulo}</dt>
      <dd className="truncate text-right" style={{ color: "var(--ink-secundario)" }}>{valor}</dd>
    </div>
  );
}

function fecha(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

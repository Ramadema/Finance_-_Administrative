"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudUpload, CloudDownload, LogOut, TriangleAlert, CircleCheck, Loader2, Cloud } from "lucide-react";
import { exportarJSON, importarJSON, guardarConfig, leerConfig } from "@/lib/db/repo";
import { obtenerToken, cerrarSesion, haySesion, HAY_CLIENT_ID, ErrorGoogle } from "@/lib/nube/google";
import { buscarRespaldo, subirRespaldo, bajarRespaldo, type ArchivoNube } from "@/lib/nube/drive";
import { useDatos } from "@/lib/DatosContext";
import { Boton } from "./ui/Boton";
import { Confirmar } from "./ui/Confirmar";

/**
 * Respaldo en tu Google Drive.
 *
 * Lo que viaja es el mismo JSON del botón de respaldo, guardado en una carpeta
 * privada que solo esta app puede ver. Sirve para dos cosas: que no dependas de
 * que el navegador no desaloje la base, y que puedas abrir la app desde otro
 * dispositivo y traer tus datos.
 *
 * Es a mano a propósito en esta etapa: "traer" PISA lo local, y una operación
 * que puede tapar lo que cargaste hoy no puede pasar sola sin que la veas.
 */
const CLAVE_ULTIMA = "driveUltimaSubida";

type Estado = "libre" | "entrando" | "subiendo" | "bajando";

export function RespaldoDrive() {
  const { recargar, movimientos } = useDatos();
  const [conectado, setConectado] = useState(false);
  const [estado, setEstado] = useState<Estado>("libre");
  const [enNube, setEnNube] = useState<ArchivoNube | null>(null);
  const [ultimaSubida, setUltimaSubida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBajada, setConfirmandoBajada] = useState(false);

  useEffect(() => {
    void leerConfig<string>(CLAVE_ULTIMA, "").then((v) => setUltimaSubida(v || null));
  }, []);

  const fallar = useCallback((e: unknown) => {
    // Cancelar no es un error: cerrar la ventana de Google es una decisión.
    if (e instanceof ErrorGoogle && e.cancelado) return;
    setError(e instanceof Error ? e.message : "Algo salió mal con Drive.");
  }, []);

  const refrescarNube = useCallback(async () => {
    setEnNube(await buscarRespaldo());
  }, []);

  async function entrar() {
    setError(null);
    setEstado("entrando");
    try {
      await obtenerToken(true);
      setConectado(haySesion());
      await refrescarNube();
    } catch (e) {
      fallar(e);
    } finally {
      setEstado("libre");
    }
  }

  async function salir() {
    await cerrarSesion();
    setConectado(false);
    setEnNube(null);
  }

  async function subir() {
    setError(null);
    setEstado("subiendo");
    try {
      const archivo = await subirRespaldo(await exportarJSON());
      setEnNube(archivo);
      const ahora = new Date().toISOString();
      await guardarConfig(CLAVE_ULTIMA, ahora);
      setUltimaSubida(ahora);
    } catch (e) {
      fallar(e);
    } finally {
      setEstado("libre");
    }
  }

  async function bajar() {
    setConfirmandoBajada(false);
    setError(null);
    setEstado("bajando");
    try {
      if (!enNube) throw new ErrorGoogle("No hay ningún respaldo en Drive todavía.");
      const r = await importarJSON(await bajarRespaldo(enNube.id));
      if (!r.ok) throw new ErrorGoogle(r.error ?? "El respaldo de Drive no se pudo leer.");
      await recargar();
    } catch (e) {
      fallar(e);
    } finally {
      setEstado("libre");
    }
  }

  if (!HAY_CLIENT_ID) {
    return (
      <p className="px-5 pb-6 text-[13px] leading-relaxed" style={{ color: "var(--ink-mudo)" }}>
        Todavía no está configurado el acceso a Google. Falta crear el permiso en
        la consola de Google y cargar el <code>Client ID</code> en el proyecto —
        es un trámite de una sola vez.
      </p>
    );
  }

  const ocupado = estado !== "libre";

  return (
    <div className="px-5 pb-5">
      {!conectado ? (
        <>
          <Boton variante="solido" onClick={() => void entrar()} disabled={ocupado}>
            {estado === "entrando"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Cloud className="h-3.5 w-3.5" />}
            Entrar con Google
          </Boton>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--ink-mudo)" }}>
            La app solo pide acceso a <strong>su propia carpeta oculta</strong> en tu
            Drive. No puede ver tus documentos, tus fotos ni el resto de tus archivos.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="solido" onClick={() => void subir()} disabled={ocupado}>
              {estado === "subiendo"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CloudUpload className="h-3.5 w-3.5" />}
              Guardar en Drive
            </Boton>

            <Boton
              onClick={() => setConfirmandoBajada(true)}
              disabled={ocupado || enNube === null}
              title={enNube === null ? "Todavía no subiste ningún respaldo" : undefined}
            >
              {estado === "bajando"
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CloudDownload className="h-3.5 w-3.5" />}
              Traer de Drive
            </Boton>

            <Boton variante="fantasma" onClick={() => void salir()} disabled={ocupado}>
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </Boton>
          </div>

          <dl className="mt-4 space-y-1 text-[12.5px]">
            <Fila
              rotulo="En Drive"
              valor={
                enNube
                  ? `${fecha(enNube.modificado)} · ${(enNube.tamano / 1024).toFixed(0)} KB`
                  : "todavía no subiste nada"
              }
            />
            <Fila
              rotulo="En este navegador"
              valor={`${movimientos.length} movimientos${
                ultimaSubida ? ` · última subida ${fecha(ultimaSubida)}` : ""
              }`}
            />
          </dl>
        </>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed"
           style={{
             background: "color-mix(in oklab, var(--critico) 14%, transparent)",
             color: "var(--ink-secundario)",
           }}>
          <TriangleAlert className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--critico)" }} />
          {error}
        </p>
      )}

      {conectado && !error && estado === "libre" && enNube && (
        <p className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: "var(--texto-bueno)" }}>
          <CircleCheck className="h-3.5 w-3.5" />
          Tenés una copia guardada en tu Drive.
        </p>
      )}

      <Confirmar
        abierto={confirmandoBajada}
        onAbierto={setConfirmandoBajada}
        titulo="¿Traer los datos de Drive?"
        textoConfirmar="Traer y reemplazar"
        onConfirmar={bajar}
      >
        <p>
          Lo que hay en Drive se escribe encima de lo que tenés en este navegador.
          Si cargaste algo acá y todavía no lo subiste, se pierde.
        </p>
        <p>
          Si no estás seguro, primero tocá <strong>Guardar en Drive</strong> desde el
          dispositivo que tenga los datos buenos.
        </p>
      </Confirmar>
    </div>
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { exportarJSON, importarJSON, guardarConfig, leerConfig } from "../db/repo";
import { obtenerToken, cerrarSesion, HAY_CLIENT_ID, ErrorGoogle } from "./google";
import { buscarRespaldo, subirRespaldo, bajarRespaldo, type ArchivoNube } from "./drive";

/**
 * Sesión de Drive, compartida por toda la app.
 *
 * Vivía adentro de un componente escondido al fondo de "Cargar resumen", así
 * que entrar con Google era algo que había que ir a buscar. Acá arriba el
 * estado lo puede leer la pantalla de bienvenida, el encabezado y la sección de
 * datos, y el login pasa a ser parte de cómo entrás a la app.
 */

const CLAVE_USA_DRIVE = "driveConectado";
const CLAVE_ULTIMA = "driveUltimaSubida";

export type Ocupado = null | "entrando" | "guardando" | "trayendo";

/**
 * Hay respaldo en Drive Y datos en este navegador. No se resuelve solo: traer
 * pisaría lo local, y lo local puede ser lo que cargaste hace cinco minutos.
 */
export interface Conflicto {
  enNube: ArchivoNube;
  movimientosLocales: number;
}

export interface SesionDrive {
  disponible: boolean;
  conectado: boolean;
  /**
   * Ya usaste Drive antes en este navegador. No alcanza para entrar solo —Google
   * exige un clic— pero sirve para decir "reconectar" en vez de "entrar".
   */
  sesionPrevia: boolean;
  ocupado: Ocupado;
  error: string | null;
  ultimaSync: string | null;
  enNube: ArchivoNube | null;
  conflicto: Conflicto | null;
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
  guardar: () => Promise<void>;
  traer: () => Promise<void>;
  descartarConflicto: () => void;
  limpiarError: () => void;
}

export function useSesionDrive({
  movimientosLocales,
  recargar,
  listo,
}: {
  movimientosLocales: number;
  recargar: () => Promise<void>;
  /** La base local ya se leyó: antes de eso no se sabe si está vacía. */
  listo: boolean;
}): SesionDrive {
  const [conectado, setConectado] = useState(false);
  const [sesionPrevia, setSesionPrevia] = useState(false);
  const [ocupado, setOcupado] = useState<Ocupado>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [enNube, setEnNube] = useState<ArchivoNube | null>(null);
  const [conflicto, setConflicto] = useState<Conflicto | null>(null);

  // El número más fresco sin volver a crear los callbacks en cada render.
  const locales = useRef(movimientosLocales);
  // eslint-disable-next-line react-hooks/refs -- espejo de una prop en un ref, leído solo en handlers y efectos (nunca en render).
  locales.current = movimientosLocales;

  const fallar = useCallback((e: unknown) => {
    if (e instanceof ErrorGoogle && e.cancelado) return; // cerrar la ventana no es un error
    setError(e instanceof Error ? e.message : "Algo salió mal con Drive.");
  }, []);

  const bajarYAplicar = useCallback(
    async (archivo: ArchivoNube) => {
      const r = await importarJSON(await bajarRespaldo(archivo.id));
      if (!r.ok) throw new ErrorGoogle(r.error ?? "El respaldo de Drive no se pudo leer.");
      await recargar();
      setConflicto(null);
    },
    [recargar],
  );

  /**
   * Qué hacer apenas hay sesión.
   *
   * Con el navegador vacío se trae solo: es el caso de estrenar dispositivo y
   * no hay nada que perder. Con datos locales NO, porque traer los pisa — ahí
   * se avisa y decide el usuario.
   */
  const alConectar = useCallback(async () => {
    const archivo = await buscarRespaldo();
    setEnNube(archivo);
    if (!archivo) return;
    if (locales.current === 0) await bajarYAplicar(archivo);
    else setConflicto({ enNube: archivo, movimientosLocales: locales.current });
  }, [bajarYAplicar]);

  /**
   * Al abrir solo se lee el estado guardado. NO se intenta reconectar solo:
   * Google entrega el token por ventana emergente y el navegador la bloquea si
   * no viene de un clic. Intentarlo al cargar la página no renovaba nada y
   * ensuciaba la consola con "Failed to open popup window".
   */
  const yaLeyo = useRef(false);
  useEffect(() => {
    if (!HAY_CLIENT_ID || !listo || yaLeyo.current) return;
    yaLeyo.current = true;

    void (async () => {
      setSesionPrevia(await leerConfig<boolean>(CLAVE_USA_DRIVE, false));
      setUltimaSync((await leerConfig<string>(CLAVE_ULTIMA, "")) || null);
    })();
  }, [listo]);

  const entrar = useCallback(async () => {
    setError(null);
    setOcupado("entrando");
    try {
      await obtenerToken();
      setConectado(true);
      setSesionPrevia(true);
      await guardarConfig(CLAVE_USA_DRIVE, true);
      await alConectar();
    } catch (e) {
      fallar(e);
    } finally {
      setOcupado(null);
    }
  }, [alConectar, fallar]);

  const salir = useCallback(async () => {
    await cerrarSesion();
    await guardarConfig(CLAVE_USA_DRIVE, false);
    setConectado(false);
    setSesionPrevia(false);
    setEnNube(null);
    setConflicto(null);
  }, []);

  const guardar = useCallback(async () => {
    setError(null);
    setOcupado("guardando");
    try {
      setEnNube(await subirRespaldo(await exportarJSON()));
      const ahora = new Date().toISOString();
      await guardarConfig(CLAVE_ULTIMA, ahora);
      setUltimaSync(ahora);
      setConflicto(null);
    } catch (e) {
      fallar(e);
    } finally {
      setOcupado(null);
    }
  }, [fallar]);

  const traer = useCallback(async () => {
    setError(null);
    setOcupado("trayendo");
    try {
      const archivo = enNube ?? (await buscarRespaldo());
      if (!archivo) throw new ErrorGoogle("No hay ningún respaldo en Drive todavía.");
      setEnNube(archivo);
      await bajarYAplicar(archivo);
    } catch (e) {
      fallar(e);
    } finally {
      setOcupado(null);
    }
  }, [enNube, bajarYAplicar, fallar]);

  return {
    disponible: HAY_CLIENT_ID,
    conectado, sesionPrevia, ocupado, error, ultimaSync, enNube, conflicto,
    entrar, salir, guardar, traer,
    descartarConflicto: () => setConflicto(null),
    limpiarError: () => setError(null),
  };
}

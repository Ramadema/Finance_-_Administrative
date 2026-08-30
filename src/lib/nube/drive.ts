"use client";

import { obtenerToken, ErrorGoogle } from "./google";

/**
 * Lee y escribe UN archivo en la carpeta privada de la app en tu Drive.
 *
 * El contenido es el mismo respaldo JSON que baja el botón del encabezado, así
 * que la nube no introduce un formato nuevo: lo que sube es exactamente lo que
 * ya sabías exportar, y lo que baja entra por el mismo importador. Si algún día
 * Drive deja de andar, el respaldo a mano sigue siendo el mismo archivo.
 */

const NOMBRE = "plata.json";
const API = "https://www.googleapis.com/drive/v3";
const SUBIDA = "https://www.googleapis.com/upload/drive/v3";

export interface ArchivoNube {
  id: string;
  /** ISO. Cuándo lo escribió Drive por última vez. */
  modificado: string;
  /** Bytes, según Drive. */
  tamano: number;
}

interface FilaDrive {
  id: string;
  modifiedTime?: string;
  size?: string;
}

async function pedir(ruta: string, opciones: RequestInit = {}): Promise<Response> {
  const token = await obtenerToken();
  const r = await fetch(ruta, {
    ...opciones,
    headers: { ...opciones.headers, Authorization: `Bearer ${token}` },
  });

  if (r.ok) return r;

  // Traducir los códigos que el usuario puede llegar a ver, en vez de mostrar
  // un número que no le dice nada.
  if (r.status === 401 || r.status === 403) {
    throw new ErrorGoogle(
      "Google rechazó el permiso. Probá salir y volver a entrar con tu cuenta.",
    );
  }
  if (r.status === 429 || r.status >= 500) {
    throw new ErrorGoogle("Drive no está respondiendo. Probá de nuevo en un rato.");
  }
  throw new ErrorGoogle(`Drive devolvió un error (${r.status}).`);
}

function aArchivo(f: FilaDrive): ArchivoNube {
  return {
    id: f.id,
    modificado: f.modifiedTime ?? new Date().toISOString(),
    tamano: Number(f.size ?? 0),
  };
}

/** El respaldo que ya está en Drive, o null si todavía no subiste ninguno. */
export async function buscarRespaldo(): Promise<ArchivoNube | null> {
  const url =
    `${API}/files?spaces=appDataFolder` +
    `&q=${encodeURIComponent(`name='${NOMBRE}' and trashed=false`)}` +
    `&fields=${encodeURIComponent("files(id,modifiedTime,size)")}` +
    `&orderBy=modifiedTime desc&pageSize=1`;
  const r = await pedir(url);
  const datos = (await r.json()) as { files?: FilaDrive[] };
  const primero = datos.files?.[0];
  return primero ? aArchivo(primero) : null;
}

/**
 * Sube el respaldo. Si ya existe uno lo REEMPLAZA, para no ir dejando copias
 * sueltas que después nadie sabe cuál es la buena.
 */
export async function subirRespaldo(contenido: string): Promise<ArchivoNube> {
  const existente = await buscarRespaldo();
  const campos = "?uploadType=multipart&fields=id,modifiedTime,size";

  const metadatos = existente
    ? { name: NOMBRE }
    : { name: NOMBRE, parents: ["appDataFolder"] };

  const limite = "plata-" + Math.random().toString(36).slice(2);
  const cuerpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadatos)}\r\n` +
    `--${limite}\r\nContent-Type: application/json\r\n\r\n` +
    `${contenido}\r\n` +
    `--${limite}--`;

  const r = await pedir(
    existente ? `${SUBIDA}/files/${existente.id}${campos}` : `${SUBIDA}/files${campos}`,
    {
      method: existente ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${limite}` },
      body: cuerpo,
    },
  );
  return aArchivo((await r.json()) as FilaDrive);
}

/** Trae el contenido del respaldo guardado en Drive. */
export async function bajarRespaldo(id: string): Promise<string> {
  const r = await pedir(`${API}/files/${id}?alt=media`);
  return r.text();
}

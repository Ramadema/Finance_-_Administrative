"use client";

import { obtenerToken, ErrorGoogle } from "./google";

/**
 * Lee y escribe archivos en la carpeta privada de la app en tu Drive.
 *
 * El principal es el respaldo (`plata.json`): el mismo JSON que baja el botón
 * del encabezado, así que la nube no introduce un formato nuevo — lo que sube
 * es exactamente lo que ya sabías exportar, y lo que baja entra por el mismo
 * importador. Si algún día Drive deja de andar, el respaldo a mano sigue siendo
 * el mismo archivo.
 *
 * Al lado viven archivos chicos de ajustes (hoy, la key del asistente). Misma
 * carpeta, misma cuenta, misma regla: solo tu Google los ve. Van separados del
 * respaldo a propósito, para que bajar o compartir el respaldo de datos nunca
 * arrastre una credencial.
 */

const RESPALDO = "plata.json";
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

async function buscarArchivo(nombre: string): Promise<ArchivoNube | null> {
  const url =
    `${API}/files?spaces=appDataFolder` +
    `&q=${encodeURIComponent(`name='${nombre}' and trashed=false`)}` +
    `&fields=${encodeURIComponent("files(id,modifiedTime,size)")}` +
    `&orderBy=modifiedTime desc&pageSize=1`;
  const r = await pedir(url);
  const datos = (await r.json()) as { files?: FilaDrive[] };
  const primero = datos.files?.[0];
  return primero ? aArchivo(primero) : null;
}

/**
 * Sube un archivo. Si ya existe uno con ese nombre lo REEMPLAZA, para no ir
 * dejando copias sueltas que después nadie sabe cuál es la buena.
 */
async function subirArchivo(nombre: string, contenido: string): Promise<ArchivoNube> {
  const existente = await buscarArchivo(nombre);
  const campos = "?uploadType=multipart&fields=id,modifiedTime,size";

  const metadatos = existente
    ? { name: nombre }
    : { name: nombre, parents: ["appDataFolder"] };

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

async function bajarArchivo(id: string): Promise<string> {
  const r = await pedir(`${API}/files/${id}?alt=media`);
  return r.text();
}

// ── el respaldo ────────────────────────────────────────────────────────

/** El respaldo que ya está en Drive, o null si todavía no subiste ninguno. */
export const buscarRespaldo = (): Promise<ArchivoNube | null> => buscarArchivo(RESPALDO);

/** Sube el respaldo, reemplazando el anterior. */
export const subirRespaldo = (contenido: string): Promise<ArchivoNube> => subirArchivo(RESPALDO, contenido);

/** Trae el contenido del respaldo guardado en Drive. */
export const bajarRespaldo = (id: string): Promise<string> => bajarArchivo(id);

// ── ajustes chicos ─────────────────────────────────────────────────────

/** El contenido de un archivo de ajustes, o null si no existe. */
export async function leerArchivoApp(nombre: string): Promise<string | null> {
  const archivo = await buscarArchivo(nombre);
  return archivo ? bajarArchivo(archivo.id) : null;
}

export async function escribirArchivoApp(nombre: string, contenido: string): Promise<void> {
  await subirArchivo(nombre, contenido);
}

export async function borrarArchivoApp(nombre: string): Promise<void> {
  const archivo = await buscarArchivo(nombre);
  if (archivo) await pedir(`${API}/files/${archivo.id}`, { method: "DELETE" });
}

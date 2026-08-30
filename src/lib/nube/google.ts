"use client";

/**
 * Login con Google, solo para la carpeta privada de la app en tu Drive.
 *
 * Sin backend: el navegador habla directo con Google. No hay secreto de
 * cliente que esconder porque no existe — el Client ID es público a propósito,
 * y lo que autoriza el acceso es tu sesión de Google, no un dato del bundle.
 * Por eso esto SÍ protege: lo que hay del otro lado es tu Drive, no un `if`.
 *
 * El script de Google se carga solo cuando lo usás por primera vez. Mientras
 * no toques nada de sincronización, la app sigue sin hablarle a nadie.
 */

/**
 * Se inyecta en el build (`NEXT_PUBLIC_*`). Es público por diseño: identifica
 * a la app ante Google, no autoriza nada por sí solo.
 */
export const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const HAY_CLIENT_ID = CLIENT_ID !== "";

/**
 * El permiso más chico que existe para esto.
 *
 * `drive.appdata` es una carpeta oculta, propia de esta app: no aparece
 * listada en tu Drive, ninguna otra app la puede leer, y NO da acceso a tus
 * documentos, fotos ni al resto de tus archivos. Si algún día ves que la app
 * pide más que esto, algo está mal.
 */
const PERMISO = "https://www.googleapis.com/auth/drive.appdata";

// ---------- Tipos mínimos de Google Identity Services ----------
// Se declaran acá en vez de sumar un paquete de tipos: es la única superficie
// que se usa y así el proyecto no gana una dependencia por tres firmas.
interface RespuestaToken {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface ClienteToken {
  requestAccessToken: (opciones?: { prompt?: string }) => void;
}
interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (r: RespuestaToken) => void;
        error_callback?: (e: { type?: string }) => void;
      }) => ClienteToken;
      revoke: (token: string, hecho?: () => void) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

const URL_SCRIPT = "https://accounts.google.com/gsi/client";
let cargando: Promise<GoogleGlobal> | null = null;

function cargarGoogle(): Promise<GoogleGlobal> {
  if (cargando) return cargando;
  cargando = new Promise((listo, falla) => {
    if (typeof window === "undefined") {
      falla(new Error("La sincronización solo funciona en el navegador."));
      return;
    }
    if (window.google?.accounts?.oauth2) {
      listo(window.google);
      return;
    }
    const script = document.createElement("script");
    script.src = URL_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) listo(window.google);
      else falla(new Error("Google cargó pero no expuso el login."));
    };
    script.onerror = () => {
      cargando = null; // que un corte de red no deje la promesa rota para siempre
      falla(new Error("No se pudo contactar a Google. ¿Estás sin internet?"));
    };
    document.head.appendChild(script);
  });
  return cargando;
}

/** Token en memoria a propósito: guardarlo en el disco sería regalar la llave. */
let token: { valor: string; vence: number } | null = null;

function vigente(): string | null {
  if (!token) return null;
  // Margen de 60s: un token que vence mientras viaja la request es un error raro.
  return Date.now() < token.vence - 60_000 ? token.valor : null;
}

export class ErrorGoogle extends Error {
  constructor(mensaje: string, readonly cancelado = false) {
    super(mensaje);
    this.name = "ErrorGoogle";
  }
}

/**
 * Devuelve un token de acceso, pidiéndoselo a Google si hace falta.
 *
 * `interactivo` en false intenta renovarlo sin molestar al usuario: sirve para
 * refrescar en segundo plano cuando ya diste permiso. Si Google necesita
 * preguntarte algo, falla en vez de abrir una ventana que no pediste.
 */
export function obtenerToken(interactivo = true): Promise<string> {
  const cacheado = vigente();
  if (cacheado) return Promise.resolve(cacheado);

  if (!HAY_CLIENT_ID) {
    return Promise.reject(
      new ErrorGoogle(
        "Falta configurar el Client ID de Google. Sin eso la app no puede " +
          "hablar con tu Drive.",
      ),
    );
  }

  return cargarGoogle().then(
    (google) =>
      new Promise<string>((listo, falla) => {
        let respondio = false;
        const cliente = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: PERMISO,
          callback: (r) => {
            respondio = true;
            if (r.error || !r.access_token) {
              falla(new ErrorGoogle(`Google rechazó el permiso (${r.error ?? "sin token"}).`));
              return;
            }
            token = {
              valor: r.access_token,
              vence: Date.now() + (r.expires_in ?? 3600) * 1000,
            };
            listo(r.access_token);
          },
          error_callback: (e) => {
            respondio = true;
            const cancelado = e.type === "popup_closed" || e.type === "popup_failed_to_open";
            falla(
              new ErrorGoogle(
                cancelado
                  ? "Cerraste la ventana de Google antes de terminar."
                  : "Google no pudo completar el ingreso.",
                cancelado,
              ),
            );
          },
        });

        cliente.requestAccessToken(interactivo ? {} : { prompt: "none" });

        // Si Google no llama a ninguno de los dos callbacks, la promesa quedaría
        // colgada y el botón girando para siempre.
        setTimeout(() => {
          if (!respondio) falla(new ErrorGoogle("Google no respondió a tiempo."));
        }, 60_000);
      }),
  );
}

/** Olvida el token de esta pestaña y le avisa a Google. */
export async function cerrarSesion(): Promise<void> {
  const actual = token?.valor;
  token = null;
  if (!actual) return;
  try {
    const google = await cargarGoogle();
    await new Promise<void>((listo) => google.accounts.oauth2.revoke(actual, listo));
  } catch {
    // Que Google no conteste no puede impedirte salir: el token local ya se borró.
  }
}

export function haySesion(): boolean {
  return vigente() !== null;
}

import { proveedorAnthropic } from "@/lib/ia/proveedores/anthropic";
import { esModelo, MODELO_POR_DEFECTO } from "@/lib/ia/modelos";
import { ErrorProveedor, type Peticion, type TipoErrorProveedor } from "@/lib/ia/tipos";

/**
 * El único código de servidor de la app: un proxy autenticado al modelo.
 *
 * Existe por una sola razón: que la key de Anthropic no viaje al navegador.
 * Recibe la petición que armó el agente (que sigue corriendo en el navegador,
 * con los datos que solo están ahí), verifica que quien pregunta es el dueño,
 * agrega la key y llama a Anthropic. No guarda nada, no lee ninguna base, no
 * conoce los movimientos.
 *
 * Quién es el dueño: la cuenta de Google cuyo email coincide con `DUENO_EMAIL`.
 * El navegador manda su token de Google; acá se le pregunta a Google de quién es.
 * Sin eso, la ruta sería un proxy gratis para cualquiera que la encuentre.
 *
 * Separado de `route.ts` para poder testearlo sin red: recibe el entorno y el
 * `fetch` por parámetro.
 */

export interface Entorno {
  ANTHROPIC_API_KEY?: string;
  DUENO_EMAIL?: string;
}

const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
/** Cuánto recordar a quién pertenece un token, para no preguntarle a Google en cada vuelta. */
const RECORDAR_MS = 5 * 60 * 1000;

const ESTADO: Record<TipoErrorProveedor, number> = {
  sesion: 401, servidor: 500, credito: 402, limite: 429, conexion: 502, api: 502,
};

const json = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });

export function crearManejador({ entorno, fetch: f = globalThis.fetch }: { entorno: Entorno; fetch?: typeof globalThis.fetch }) {
  const identidades = new Map<string, { email: string; vence: number }>();

  async function emailDe(token: string): Promise<string | null> {
    const recordado = identidades.get(token);
    if (recordado && recordado.vence > Date.now()) return recordado.email;

    const r = await f(USERINFO, { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
    if (!r || !r.ok) return null;
    const datos = (await r.json().catch(() => null)) as { email?: string; email_verified?: boolean } | null;
    if (!datos?.email || datos.email_verified === false) return null;

    const email = datos.email.trim().toLowerCase();
    if (identidades.size > 100) identidades.clear(); // no es una base, es una memoria corta
    identidades.set(token, { email, vence: Date.now() + RECORDAR_MS });
    return email;
  }

  return async function POST(req: Request): Promise<Response> {
    const clave = entorno.ANTHROPIC_API_KEY?.trim();
    const dueno = entorno.DUENO_EMAIL?.trim().toLowerCase();
    if (!clave || !dueno) {
      return json(500, { tipo: "servidor", error: "Falta configurar ANTHROPIC_API_KEY o DUENO_EMAIL en el servidor." });
    }

    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { tipo: "sesion", error: "Sin sesión de Google. Entrá con tu cuenta para preguntar." });

    const email = await emailDe(token);
    if (!email) return json(401, { tipo: "sesion", error: "La sesión de Google venció o no es válida. Volvé a entrar." });
    if (email !== dueno) return json(403, { tipo: "sesion", error: "Esta cuenta de Google no es la del dueño de la app." });

    const cuerpo = await req.json().catch(() => null);
    const peticion = validar(cuerpo);
    if (!peticion) return json(400, { tipo: "api", error: "La petición no tiene la forma esperada." });

    const modelo = esModelo(peticion.modelo) ? peticion.modelo : MODELO_POR_DEFECTO;
    try {
      const respuesta = await proveedorAnthropic({ clave, modelo, fetch: f }).responder(peticion);
      return json(200, respuesta);
    } catch (e) {
      if (e instanceof ErrorProveedor) return json(ESTADO[e.tipo], { tipo: e.tipo, error: e.message });
      return json(502, { tipo: "api", error: "El modelo no respondió." });
    }
  };
}

function validar(c: unknown): (Peticion & { modelo?: unknown }) | null {
  if (!c || typeof c !== "object") return null;
  const { sistema, mensajes, herramientas, modelo } = c as Record<string, unknown>;
  if (typeof sistema !== "string" || !Array.isArray(mensajes) || !Array.isArray(herramientas)) return null;
  return { sistema, mensajes, herramientas, modelo } as Peticion & { modelo?: unknown };
}

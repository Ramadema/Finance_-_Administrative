"use client";

import { useState, useSyncExternalStore } from "react";
import { Sparkles, Wrench, AlertTriangle, Loader2, LogIn } from "lucide-react";
import { useDatos } from "@/lib/DatosContext";
import type { SesionDrive } from "@/lib/nube/useSesionDrive";
import {
  preguntar, HERRAMIENTAS, proveedorProxy, costoEstimadoUSD, ErrorProveedor, MODELOS, MODELO_POR_DEFECTO,
  suscribirIA, leerModelo, guardarModelo,
  type Conversacion, type Paso, type ModeloId, type ContextoDatos,
} from "@/lib/ia";
import { formatARS } from "@/lib/ingest/numero";
import { Card, CardHead } from "./ui/Card";
import { Boton } from "./ui/Boton";

/**
 * "Preguntale a tus datos".
 *
 * Quién puede preguntar: quien entre con la cuenta de Google del dueño. No hay
 * ninguna key acá: el navegador le manda la pregunta a nuestro servidor con su
 * token de Google, el servidor verifica que sea el dueño y habla con el modelo.
 *
 * La respuesta jerarquiza a propósito: primero el texto del modelo con sus
 * cifras sin respaldo marcadas, después "De dónde salió" — lo que devolvieron
 * las herramientas, que son los números reales, calculados por la app acá en
 * el navegador.
 */

const SUGERENCIAS = [
  "¿Cuánto gasté este mes y cuánto me sobró?",
  "¿En qué gasté más que el mes pasado?",
  "¿Dónde gasto más plata?",
  "¿Qué me viene en cuotas los próximos meses?",
];

const campo = "w-full rounded-lg px-2.5 py-1.5 text-[13px] focus-visible:outline-2";
const estiloCampo = {
  background: "var(--plano)",
  border: "1px solid var(--borde)",
  color: "var(--ink-primario)",
  outlineColor: "var(--s1)",
};

export function Preguntar() {
  const { movimientos, periodos, ingresosPorPeriodo, drive } = useDatos();
  const modelo = useSyncExternalStore(suscribirIA, leerModelo, () => MODELO_POR_DEFECTO);

  if (periodos.length === 0) {
    return (
      <Card className="px-5 py-6 text-[13.5px]" style={{ color: "var(--ink-secundario)" }}>
        Primero cargá un resumen del banco: sin movimientos no hay nada que preguntar.
      </Card>
    );
  }

  if (!drive.disponible) {
    return (
      <Card className="px-5 py-6 text-[13.5px]" style={{ color: "var(--ink-secundario)" }}>
        Preguntar necesita la cuenta de Google: falta configurar <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {drive.conectado
        ? <Consulta modelo={modelo} drive={drive} contexto={{ movimientos, periodos, ingresosPorPeriodo }} />
        : <EntrarConGoogle drive={drive} />}
      <QueSale />
    </div>
  );
}

// ── el acceso ──────────────────────────────────────────────────────────

function EntrarConGoogle({ drive }: { drive: SesionDrive }) {
  return (
    <Card>
      <CardHead
        titulo="Preguntar es solo para tu cuenta"
        sub="La key del modelo está en el servidor de la app y solo responde a la cuenta de Google del dueño. Entrá con la tuya; sin ella, nadie puede preguntar."
      />
      <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
        <Boton variante="solido" onClick={() => void drive.entrar()} disabled={drive.ocupado !== null}>
          {drive.ocupado === "entrando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
          {drive.sesionPrevia ? "Reconectar con Google" : "Entrar con Google"}
        </Boton>
        <span className="text-[12.5px]" style={{ color: "var(--ink-mudo)" }}>
          Google pide un clic por sesión; después no vuelve a preguntar.
        </span>
      </div>
      {drive.error && <div className="px-5 pb-4"><AvisoError mensaje={drive.error} /></div>}
    </Card>
  );
}

function QueSale() {
  return (
    <p className="px-1 text-[12.5px] leading-relaxed" style={{ color: "var(--ink-mudo)" }}>
      <strong style={{ color: "var(--ink-secundario)" }}>Qué sale de tu máquina:</strong> tu pregunta, las
      reglas del asistente y los resultados que el modelo pida —totales por categoría o comercio, y en una
      búsqueda, los movimientos que coincidan—. Pasan por el servidor de la app, que no guarda nada, y de ahí
      a Anthropic. Nunca la base entera ni la descripción cruda del banco. El modelo no calcula: elige qué
      preguntarle a la app, y la app calcula acá.
    </p>
  );
}

// ── la consulta ────────────────────────────────────────────────────────

function Consulta({ modelo, drive, contexto }: {
  modelo: ModeloId;
  drive: SesionDrive;
  contexto: ContextoDatos;
}) {
  const [pregunta, setPregunta] = useState("");
  const [enCurso, setEnCurso] = useState<Paso[] | null>(null);
  const [conversacion, setConversacion] = useState<Conversacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar(texto: string) {
    const q = texto.trim();
    if (!q || enCurso) return;
    setPregunta(q);
    setError(null);
    setConversacion(null);
    setEnCurso([]);
    try {
      // El token se pide acá, desde el clic: si venció, Google lo renueva con su ventana.
      const token = await drive.token();
      const c = await preguntar(q, {
        proveedor: proveedorProxy({ token, modelo }),
        herramientas: HERRAMIENTAS,
        contexto,
        alPaso: (paso) => setEnCurso((prev) => [...(prev ?? []), paso]),
      });
      setConversacion(c);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Algo salió mal.";
      setError(e instanceof ErrorProveedor && e.tipo === "sesion" ? `${mensaje} Salí y volvé a entrar con la cuenta del dueño.` : mensaje);
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <>
      <Card>
        <CardHead
          titulo="Preguntale a tus datos"
          sub="En castellano, como se lo preguntarías a alguien que tiene tus resúmenes adelante"
          accion={<SelectorModelo modelo={modelo} />}
        />
        <form className="flex flex-col gap-2 px-5 pb-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void enviar(pregunta); }}>
          <input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="¿Cuánto llevo gastado en delivery este año?"
            className={campo}
            style={estiloCampo}
            aria-label="Tu pregunta"
            disabled={enCurso !== null}
          />
          <Boton type="submit" variante="solido" disabled={enCurso !== null || pregunta.trim() === ""}>
            {enCurso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Preguntar
          </Boton>
        </form>
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void enviar(s)}
              disabled={enCurso !== null}
              className="rounded-full px-2.5 py-1 text-[12px] transition-colors disabled:opacity-45"
              style={{ background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)", color: "var(--ink-secundario)" }}
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {enCurso && <Progreso pasos={enCurso} />}
      {error && <AvisoError mensaje={error} />}
      {conversacion && <Respuesta c={conversacion} modelo={modelo} />}
    </>
  );
}

function SelectorModelo({ modelo }: { modelo: ModeloId }) {
  return (
    <select
      value={modelo}
      onChange={(e) => guardarModelo(e.target.value as ModeloId)}
      className="rounded-lg px-2 py-1 text-[12px]"
      style={estiloCampo}
      aria-label="Modelo"
    >
      {MODELOS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre} · US${m.entradaUSD}/{m.salidaUSD} por M tokens
        </option>
      ))}
    </select>
  );
}

function Progreso({ pasos }: { pasos: Paso[] }) {
  return (
    <Card className="px-5 py-4 text-[13px]" style={{ color: "var(--ink-secundario)" }}>
      <p className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {pasos.length === 0 ? "El modelo está decidiendo qué preguntarle a tus datos…" : "Calculando…"}
      </p>
      {pasos.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12.5px]" style={{ color: "var(--ink-mudo)" }}>
          {pasos.map((p) => (
            <li key={p.llamada.id} className="flex items-center gap-1.5">
              <Wrench className="h-3 w-3" /> <code>{p.llamada.nombre}</code> {resumenEntrada(p.llamada.entrada)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AvisoError({ mensaje }: { mensaje: string }) {
  return (
    <p
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed"
      style={{ background: "color-mix(in oklab, var(--critico) 14%, transparent)", color: "var(--ink-secundario)" }}
    >
      <AlertTriangle className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--critico)" }} />
      <span>{mensaje}</span>
    </p>
  );
}

// ── la respuesta ───────────────────────────────────────────────────────

function Respuesta({ c, modelo }: { c: Conversacion; modelo: ModeloId }) {
  const costo = costoEstimadoUSD(c.uso, modelo);
  return (
    <div className="space-y-3">
      <Card>
        <CardHead titulo="Respuesta" sub={c.fin !== "terminado" ? explicarFin(c.fin) : undefined} />
        <div className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: "var(--ink-primario)" }}>
          <TextoMarcado texto={c.respuesta || "El modelo no devolvió texto."} marcas={c.sinRespaldo} />
          {c.sinRespaldo.length > 0 && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--advertencia)" }}>
              Los números marcados no salieron de ninguna herramienta: el modelo los calculó o los inventó.
              Fiate de las tablas de abajo, no de esas cifras.
            </p>
          )}
        </div>
      </Card>

      {c.pasos.length > 0 && (
        <Card>
          <CardHead
            titulo="De dónde salió"
            sub={`${c.pasos.length} ${c.pasos.length === 1 ? "herramienta" : "herramientas"} en ${c.vueltas} ${c.vueltas === 1 ? "vuelta" : "vueltas"}. Estos números los calculó la app, no el modelo.`}
          />
          <div className="space-y-4 px-5 pb-5">
            {c.pasos.map((p) => (
              <div key={p.llamada.id}>
                <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--ink-secundario)" }}>
                  <Wrench className="h-3 w-3" />
                  <code className="font-medium">{p.llamada.nombre}</code>
                  <span style={{ color: "var(--ink-mudo)" }}>{resumenEntrada(p.llamada.entrada)}</span>
                </p>
                {p.resultado.error
                  ? <p className="text-[12.5px]" style={{ color: "var(--advertencia)" }}>{p.resultado.error}</p>
                  : <Salida valor={p.resultado.salida} />}
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="tabular px-1 text-[12px]" style={{ color: "var(--ink-mudo)" }}>
        {c.uso.entrada.toLocaleString("es-AR")} tokens de entrada
        {c.uso.cacheLeido > 0 && ` (+${c.uso.cacheLeido.toLocaleString("es-AR")} desde caché)`}
        {" · "}{c.uso.salida.toLocaleString("es-AR")} de salida
        {costo !== null && ` · ≈ US$ ${costo.toFixed(4)}`}
      </p>
    </div>
  );
}

function explicarFin(fin: Conversacion["fin"]): string {
  return fin === "cortado"
    ? "El modelo se cortó antes de terminar."
    : "Se alcanzó el máximo de idas y vueltas; la respuesta puede estar incompleta.";
}

/** Marca en el texto las cifras que no tienen respaldo. */
function TextoMarcado({ texto, marcas }: { texto: string; marcas: string[] }) {
  if (marcas.length === 0) return <>{texto}</>;
  const patron = new RegExp(`(${marcas.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {texto.split(patron).map((trozo, i) =>
        marcas.includes(trozo) ? (
          <mark
            key={i}
            title="Este número no salió de tus datos"
            className="rounded px-0.5"
            style={{ background: "color-mix(in oklab, var(--advertencia) 30%, transparent)", color: "inherit" }}
          >
            {trozo}
          </mark>
        ) : (
          <span key={i}>{trozo}</span>
        ),
      )}
    </>
  );
}

/** `{periodo: "2026-08", limite: null}` → `(periodo: 2026-08)` */
function resumenEntrada(entrada: Record<string, unknown>): string {
  const partes = Object.entries(entrada)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return partes.length ? `(${partes.join(", ")})` : "";
}

// ── render genérico de lo que devuelve una herramienta ────────────────

const CLAVES_PLATA = new Set([
  "monto", "gastos", "ingresos", "ahorro", "sobrante", "fijo", "variable", "esporadico",
  "sumaTotal", "antes", "ahora", "diferencia", "ticketPromedio",
]);

function formatear(clave: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (CLAVES_PLATA.has(clave)) return formatARS(v, { decimales: false });
    if (/pct$|porcentaje/i.test(clave)) return `${v}%`;
    return v.toLocaleString("es-AR");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function Salida({ valor }: { valor: unknown }) {
  if (Array.isArray(valor)) {
    if (valor.length === 0) return <p className="text-[12.5px]" style={{ color: "var(--ink-mudo)" }}>Sin resultados.</p>;
    if (esObjeto(valor[0])) return <Tabla filas={valor as Record<string, unknown>[]} />;
    return <p className="text-[13px]">{valor.map((v) => formatear("", v)).join(", ")}</p>;
  }
  if (esObjeto(valor)) {
    const escalares = Object.entries(valor).filter(([, v]) => !esObjeto(v) && !Array.isArray(v));
    const anidados = Object.entries(valor).filter(([, v]) => esObjeto(v) || Array.isArray(v));
    return (
      <div className="space-y-3">
        {escalares.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3 md:grid-cols-4">
            {escalares.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="truncate text-[11.5px] uppercase tracking-wide" style={{ color: "var(--ink-mudo)" }}>{k}</dt>
                <dd className="tabular font-medium">{formatear(k, v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {anidados.map(([k, v]) => (
          <div key={k}>
            <p className="mb-1 text-[11.5px] uppercase tracking-wide" style={{ color: "var(--ink-mudo)" }}>{k}</p>
            <Salida valor={v} />
          </div>
        ))}
      </div>
    );
  }
  return <p className="tabular text-[13px]">{formatear("", valor)}</p>;
}

function Tabla({ filas }: { filas: Record<string, unknown>[] }) {
  const columnas = Object.keys(filas[0]).filter((k) => !esObjeto(filas[0][k]) && !Array.isArray(filas[0][k]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr style={{ color: "var(--ink-mudo)" }}>
            {columnas.map((k) => (
              <th key={k} className={`pb-1.5 font-medium ${typeof filas[0][k] === "number" ? "text-right" : "text-left"}`}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--borde)" }}>
              {columnas.map((k) => (
                <td key={k} className={`tabular py-1.5 ${typeof f[k] === "number" ? "text-right" : "text-left"}`}>{formatear(k, f[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

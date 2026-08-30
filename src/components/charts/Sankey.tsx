"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import { formatARS, formatCompacto } from "@/lib/ingest/numero";
import { colorSerie, CHROME } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import type { FlujoSankey } from "@/lib/analisis/metricas";

/**
 * Flujo del dinero del mes.
 *
 *   Ingresos ─┬─ Fijos ───────┬─ categorías
 *             ├─ Variables ───┤
 *             ├─ Esporádicos ─┘
 *             ├─ Ahorro
 *             └─ Sobrante
 *
 * Los montos vienen de la tabulación cruzada real, así que el total de cada
 * categoría acá coincide exacto con el gráfico de barras. Una categoría puede
 * recibir de varias naturalezas a la vez (salud = OSDE fijo + farmacia variable)
 * y eso se ve como varios hilos entrando al mismo nodo.
 *
 * Todos los nodos llevan etiqueta directa con su monto: es la mitigación
 * obligatoria del WARN de contraste de la paleta en modo claro.
 */

const ALTO = 360;
const ANCHO = 800;
const ANCHO_NODO = 12;

interface NodoD3 {
  id: string;
  nombre: string;
  nivel: 0 | 1 | 2;
  slot: number | null;
  clase: string;
}
interface EnlaceD3 {
  source: number;
  target: number;
  value: number;
}

export function Sankey({ flujo }: { flujo: FlujoSankey }) {
  const tema = useTema();
  const router = useRouter();
  const [activo, setActivo] = useState<number | null>(null);

  /**
   * Los nodos de categoría llevan al detalle. Ver "Gastronomía $289k" invita
   * directamente a "¿de qué está hecho?", y hasta ahora había que ir a
   * Movimientos y filtrar a mano. "Otros" no lleva a ningún lado: es un pliegue
   * de varias categorías, no una.
   */
  const categoriaDe = (id: string): string | null =>
    id.startsWith("cat:") && id !== "cat:__otros" ? id.slice(4) : null;

  const colorDe = useMemo(
    () => (n: NodoD3): string => {
      if (n.nivel === 2) return colorSerie(n.slot, tema);
      switch (n.clase) {
        case "fijo": return colorSerie(6, tema);
        case "variable": return colorSerie(0, tema);
        case "esporadico": return colorSerie(1, tema);
        case "ahorro": return "#0ca30c";
        case "sobrante": return CHROME.neutro[tema];
        default: return CHROME.inkMudo[tema];
      }
    },
    [tema],
  );

  const layout = useMemo(() => {
    if (flujo.enlaces.length === 0) return null;
    try {
      return sankey<NodoD3, EnlaceD3>()
        .nodeWidth(ANCHO_NODO)
        .nodePadding(15)
        .nodeAlign(sankeyJustify)
        .extent([[1, 10], [ANCHO - 1, ALTO - 10]])({
          nodes: flujo.nodos.map((n) => ({ ...n })),
          links: flujo.enlaces.map((e) => ({ source: e.origen, target: e.destino, value: e.valor })),
        });
    } catch {
      return null;
    }
  }, [flujo]);

  if (!layout) {
    return (
      <p className="px-5 pb-6 text-[13px]" style={{ color: "var(--ink-mudo)" }}>
        Todavía no hay suficientes movimientos para dibujar el flujo.
      </p>
    );
  }

  const ink = CHROME.inkPrimario[tema];
  const inkMudo = CHROME.inkMudo[tema];

  return (
    <div className="overflow-x-auto px-5 pb-5">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full min-w-[660px]" role="img"
           aria-label="Diagrama de flujo del dinero del mes">
        <g>
          {layout.links!.map((l, i) => {
            const s = l.source as unknown as NodoD3 & { index: number };
            const t = l.target as unknown as NodoD3 & { index: number };
            const vivo = activo === null || activo === s.index || activo === t.index;
            return (
              <path
                key={i}
                d={sankeyLinkHorizontal()(l) ?? undefined}
                fill="none"
                stroke={colorDe(t)}
                strokeWidth={Math.max(1, l.width ?? 1)}
                strokeOpacity={vivo ? 0.32 : 0.06}
                style={{ transition: "stroke-opacity 160ms" }}
              >
                <title>{`${s.nombre} → ${t.nombre}: ${formatARS(l.value, { decimales: false })}`}</title>
              </path>
            );
          })}
        </g>

        <g>
          {layout.nodes!.map((n) => {
            const alto = (n.y1 ?? 0) - (n.y0 ?? 0);
            const izquierda = n.nivel === 2;
            const atenuado = activo !== null && activo !== n.index;
            const categoria = categoriaDe(n.id);
            const irAlDetalle = categoria
              ? () => router.push(`/movimientos?categoria=${categoria}`)
              : undefined;
            return (
              <g
                key={n.id}
                onMouseEnter={() => setActivo(n.index ?? null)}
                onMouseLeave={() => setActivo(null)}
                onClick={irAlDetalle}
                onKeyDown={(e) => {
                  if (irAlDetalle && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    irAlDetalle();
                  }
                }}
                tabIndex={irAlDetalle ? 0 : undefined}
                role={irAlDetalle ? "link" : undefined}
                aria-label={
                  irAlDetalle ? `Ver los movimientos de ${n.nombre}` : undefined
                }
                style={{
                  opacity: atenuado ? 0.38 : 1,
                  transition: "opacity 160ms",
                  cursor: irAlDetalle ? "pointer" : "default",
                }}
              >
                <rect
                  x={n.x0} y={n.y0}
                  width={(n.x1 ?? 0) - (n.x0 ?? 0)}
                  height={Math.max(2, alto)}
                  fill={colorDe(n)}
                  rx={3}
                >
                  <title>
                    {`${n.nombre}: ${formatARS(n.value ?? 0, { decimales: false })}` +
                      (categoria ? " — clic para ver el detalle" : "")}
                  </title>
                </rect>
                <text
                  x={izquierda ? (n.x0 ?? 0) - 8 : (n.x1 ?? 0) + 8}
                  y={(n.y0 ?? 0) + alto / 2}
                  textAnchor={izquierda ? "end" : "start"}
                  dominantBaseline="middle"
                  fontSize={11.5}
                  fill={ink}
                  fontWeight={n.nivel === 0 ? 600 : 500}
                  /* La etiqueta es el blanco natural: es más grande que la
                     barra y es lo que uno lee. Dejarla inerte obligaba a
                     apuntarle a una barra de 12px de ancho. Las que no llevan
                     a ningún lado siguen sin recibir el mouse, para no comerle
                     el hover a la barra. */
                  style={{
                    pointerEvents: categoria ? "auto" : "none",
                    textDecoration: categoria && activo === n.index ? "underline" : "none",
                    textUnderlineOffset: 3,
                  }}
                >
                  {n.nombre}
                  <tspan fill={inkMudo} fontWeight={400}>
                    {"  "}${formatCompacto(n.value ?? 0)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

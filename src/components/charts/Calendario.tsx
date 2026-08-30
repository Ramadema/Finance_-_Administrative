"use client";

import { useMemo } from "react";
import { formatARS } from "@/lib/ingest/numero";
import { RAMPA_AZUL, CHROME } from "@/lib/design/paleta";
import { useTema } from "@/lib/design/useTema";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Calendario de gasto diario del mes.
 *
 * Encoding secuencial: un solo tono (azul), claro→oscuro, donde el paso más
 * claro significa "casi nada". Nunca arcoíris. La escala se corta por
 * cuantiles y no linealmente: un solo día con una compra grande aplanaría
 * todo el resto de los días si se usara el máximo como tope.
 */

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function Calendario({
  gastoPorDia, periodo,
}: {
  gastoPorDia: Map<string, number>;
  periodo: string;
}) {
  const tema = useTema();

  const { celdas, cortes, maximo } = useMemo(() => {
    const [anio, mes] = periodo.split("-").map(Number);
    const diasEnMes = new Date(anio, mes, 0).getDate();

    // Lunes = 0 (getDay da domingo = 0).
    const primerDia = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;

    const valores: number[] = [];
    const celdas: (
      { fecha: string; dia: number; monto: number; diaSemana: number } | null
    )[] = [];
    for (let i = 0; i < primerDia; i++) celdas.push(null);

    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const monto = gastoPorDia.get(fecha) ?? 0;
      if (monto > 0) valores.push(monto);
      celdas.push({ fecha, dia: d, monto, diaSemana: (primerDia + d - 1) % 7 });
    }

    // Cortes por cuantiles sobre los días CON gasto.
    const ordenados = [...valores].sort((a, b) => a - b);
    const q = (p: number) =>
      ordenados.length === 0 ? 0 : ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * p))];
    const cortes = [q(0.2), q(0.4), q(0.6), q(0.8)];

    return { celdas, cortes, maximo: ordenados[ordenados.length - 1] ?? 0 };
  }, [gastoPorDia, periodo]);

  const pasos = [RAMPA_AZUL[1], RAMPA_AZUL[3], RAMPA_AZUL[5], RAMPA_AZUL[7], RAMPA_AZUL[10]];

  const nivel = (monto: number): number => {
    if (monto <= 0) return -1;
    if (monto <= cortes[0]) return 0;
    if (monto <= cortes[1]) return 1;
    if (monto <= cortes[2]) return 2;
    if (monto <= cortes[3]) return 3;
    return 4;
  };

  const vacio = tema === "dark" ? "#242422" : "#eeede8";

  return (
    <div className="px-5 pb-5">
      <div className="grid grid-cols-7 gap-1.5">
        {DIAS.map((d, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-medium"
               style={{ color: CHROME.inkMudo[tema] }}>
            {d}
          </div>
        ))}

        {celdas.map((c, i) => {
          if (!c) return <div key={`v${i}`} />;
          const n = nivel(c.monto);
          const intenso = n >= 3;
          const etiqueta =
            c.monto > 0
              ? `${DIAS_LARGOS[c.diaSemana]} ${c.dia} · ${formatARS(c.monto, { decimales: false })}`
              : `${DIAS_LARGOS[c.diaSemana]} ${c.dia} · sin gastos`;
          return (
            <Tooltip key={c.fecha} texto={etiqueta} lado="top">
              <div
                /* `tabIndex` para que el dato también salga con teclado: el
                   color solo dice "más" o "menos", nunca cuánto. */
                tabIndex={0}
                aria-label={etiqueta}
                className="relative flex aspect-square cursor-default items-center justify-center rounded-[7px] text-[10.5px] font-medium transition-transform duration-150 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: n < 0 ? vacio : pasos[n],
                  color: n < 0 ? CHROME.inkMudo[tema] : intenso ? "#fff" : "#0b0b0b",
                  border: `1px solid ${n < 0 ? "transparent" : "color-mix(in oklab, #000 8%, transparent)"}`,
                  outlineColor: "var(--s1)",
                }}
              >
                {c.dia}
              </div>
            </Tooltip>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[11px]" style={{ color: CHROME.inkMudo[tema] }}>
          Día más caro: {maximo > 0 ? formatARS(maximo, { decimales: false }) : "—"}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: CHROME.inkMudo[tema] }}>menos</span>
          {[vacio, ...pasos].map((c, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
          ))}
          <span className="text-[11px]" style={{ color: CHROME.inkMudo[tema] }}>más</span>
        </div>
      </div>
    </div>
  );
}

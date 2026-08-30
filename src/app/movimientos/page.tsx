"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDatos } from "@/lib/DatosContext";
import { TablaMovimientos } from "@/components/TablaMovimientos";
import { Card, CardHead } from "@/components/ui/Card";
import { categoria as buscarCategoria } from "@/lib/categorize/categorias";
import { nombrePeriodo } from "@/lib/utils";

/**
 * Detalle auditable del mes.
 *
 * Se puede entrar con `?categoria=<id>` desde cualquier gráfico: tocar
 * "Gastronomía" en el Sankey o en la torta trae acá los movimientos que forman
 * ese número. Es la respuesta a "¿y eso de qué está hecho?", que es la pregunta
 * que sigue naturalmente a ver una cifra grande.
 */
export default function Movimientos() {
  // `useSearchParams` necesita un límite de Suspense para prerenderizar en el
  // export estático: la URL solo se conoce en el navegador.
  return (
    <Suspense fallback={null}>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const d = useDatos();
  const params = useSearchParams();
  const [todosLosMeses, setTodosLosMeses] = useState(false);
  if (!d.periodo) return null;

  const alcance = todosLosMeses ? "todos los meses" : nombrePeriodo(d.periodo);
  const pedida = params.get("categoria");
  // Un id inventado en la URL no puede dejar la tabla vacía sin explicación.
  const categoria = pedida && buscarCategoria(pedida).id === pedida ? pedida : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          titulo={
            categoria
              ? `${buscarCategoria(categoria).nombre} · ${alcance}`
              : `Movimientos de ${alcance}`
          }
          sub="Clic en la categoría para cambiarla — se aplica a todo el histórico de ese comercio"
        />
        <TablaMovimientos
          movimientos={d.movimientosDelMes}
          movimientosTodos={d.movimientos}
          categoriaInicial={categoria}
          todosLosMeses={todosLosMeses}
          onTodosLosMeses={setTodosLosMeses}
          onCambio={d.recargar}
        />
      </Card>

      <p className="pb-2 text-center text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
        Tus datos viven solo en este navegador. Descargá un respaldo de vez en cuando.
      </p>
    </div>
  );
}

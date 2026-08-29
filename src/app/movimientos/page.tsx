"use client";

import { useDatos } from "@/lib/DatosContext";
import { TablaMovimientos } from "@/components/TablaMovimientos";
import { ZonaCarga } from "@/components/ZonaCarga";
import { Card, CardHead } from "@/components/ui/Card";
import { nombrePeriodo } from "@/lib/utils";

export default function Movimientos() {
  const d = useDatos();
  if (!d.periodo) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          titulo={`Movimientos de ${nombrePeriodo(d.periodo)}`}
          sub="Clic en la categoría para cambiarla — se aplica a todo el histórico de ese comercio"
        />
        <TablaMovimientos movimientos={d.movimientosDelMes} onCambio={d.recargar} />
      </Card>

      <Card>
        <CardHead titulo="Cargar otro resumen" sub="Se procesa en tu navegador" />
        <div className="px-5 pb-5">
          <ZonaCarga onImportado={d.recargar} />
        </div>
      </Card>

      <p className="pb-2 text-center text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
        Tus datos viven solo en este navegador. Descargá un respaldo de vez en cuando.
      </p>
    </div>
  );
}

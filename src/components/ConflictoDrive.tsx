"use client";

import { useDatos } from "@/lib/DatosContext";
import { Confirmar } from "./ui/Confirmar";
import { Boton } from "./ui/Boton";

/**
 * Hay datos en Drive Y en este navegador: hay que elegir cuál gana.
 *
 * Traer automáticamente sería lo cómodo, pero pisa lo local — y lo local puede
 * ser el resumen que cargaste hace cinco minutos y todavía no subiste. Cuando
 * el navegador está vacío no se pregunta nada y se trae solo; esto aparece
 * únicamente cuando hay algo real que perder.
 */
export function ConflictoDrive() {
  const { drive } = useDatos();
  const c = drive.conflicto;
  if (!c) return null;

  return (
    <Confirmar
      abierto
      onAbierto={(v) => { if (!v) drive.descartarConflicto(); }}
      titulo="Tenés datos en los dos lados"
      textoConfirmar="Traer de Drive"
      onConfirmar={() => void drive.traer()}
      extra={
        <Boton onClick={() => void drive.guardar()} className="mr-auto">
          Subir lo de acá
        </Boton>
      }
    >
      <p>
        En <strong style={{ color: "var(--ink-primario)" }}>este navegador</strong> hay{" "}
        {c.movimientosLocales} movimientos. En{" "}
        <strong style={{ color: "var(--ink-primario)" }}>tu Drive</strong> hay una copia
        guardada el {fecha(c.enNube.modificado)}.
      </p>
      <p>
        <strong style={{ color: "var(--ink-primario)" }}>Traer de Drive</strong> reemplaza
        lo de este navegador. <strong style={{ color: "var(--ink-primario)" }}>Subir lo de
        acá</strong> reemplaza la copia de Drive. En los dos casos se pierde el otro lado,
        así que elegí el que tenga lo más nuevo.
      </p>
      <p style={{ color: "var(--ink-mudo)" }}>
        Si no querés decidir ahora, cerrá este cartel: no se toca nada.
      </p>
    </Confirmar>
  );
}

function fecha(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

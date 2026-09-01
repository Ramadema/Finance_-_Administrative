"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  Cloud, CloudOff, Loader2, Check, CloudUpload, CloudDownload, LogOut, ChevronDown,
} from "lucide-react";
import { useDatos } from "@/lib/DatosContext";
import { Boton } from "./ui/Boton";
import { Tooltip } from "./ui/Tooltip";

/**
 * Estado y control de la conexión con Drive, en el encabezado.
 *
 * Todo lo de la cuenta vive acá: entrar, guardar, traer y salir. Antes estaba
 * repartido al fondo de "Cargar resumen", y no había forma de saber —mirando la
 * pantalla— si lo que veías era lo último o una copia vieja del navegador.
 */
export function EstadoDrive() {
  const { drive } = useDatos();
  if (!drive.disponible) return null;

  if (!drive.conectado) {
    return (
      <Tooltip
        texto={
          drive.sesionPrevia
            ? "Ya usaste Drive acá. Google pide un clic por sesión para volver a darte acceso."
            : "Guardá tus datos en tu Drive para verlos desde otro dispositivo"
        }
      >
        <Boton
          variante="fantasma"
          onClick={() => void drive.entrar()}
          disabled={drive.ocupado !== null}
          aria-label={drive.sesionPrevia ? "Reconectar con Google" : "Entrar con Google"}
        >
          {drive.ocupado === "entrando"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <CloudOff className="h-4 w-4"
                        style={drive.sesionPrevia ? { color: "var(--advertencia)" } : undefined} />}
          <span className="hidden sm:inline">
            {drive.sesionPrevia ? "Reconectar" : "Sin cuenta"}
          </span>
        </Boton>
      </Tooltip>
    );
  }

  const trabajando = drive.ocupado === "guardando" || drive.ocupado === "trayendo";
  const sinSubir = drive.ultimaSync === null;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Boton variante="fantasma" disabled={trabajando} aria-label="Opciones de Drive">
          {trabajando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sinSubir ? (
            <Cloud className="h-4 w-4" style={{ color: "var(--advertencia)" }} />
          ) : (
            <span className="relative flex h-4 w-4 items-center justify-center">
              <Cloud className="h-4 w-4" />
              <Check className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5"
                     style={{ color: "var(--bueno)" }} />
            </span>
          )}
          <span className="hidden sm:inline">{sinSubir ? "Sin guardar" : "En Drive"}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Boton>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[236px] overflow-hidden rounded-[12px] p-1"
          style={{
            background: "var(--elevado)",
            border: "1px solid var(--borde)",
            boxShadow: "var(--sombra-card)",
          }}
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[11.5px] leading-snug"
             style={{ color: "var(--ink-mudo)" }}>
            {sinSubir
              ? "Conectado, pero todavía no guardaste nada en Drive."
              : `Última copia en Drive: ${fecha(drive.ultimaSync!)}`}
          </p>

          <Item onSelect={() => void drive.guardar()}>
            <CloudUpload className="h-4 w-4" />
            Guardar en Drive ahora
          </Item>
          <Item onSelect={() => void drive.traer()} deshabilitado={drive.enNube === null}>
            <CloudDownload className="h-4 w-4" />
            Traer de Drive
          </Item>

          <Menu.Separator className="my-1 h-px" style={{ background: "var(--borde)" }} />

          <Item onSelect={() => void drive.salir()}>
            <LogOut className="h-4 w-4" />
            Salir de la cuenta
          </Item>
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] leading-snug"
             style={{ color: "var(--ink-mudo)" }}>
            Salir no borra nada: tus datos siguen en este navegador y la copia sigue en
            tu Drive.
          </p>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Item({
  onSelect, deshabilitado, children,
}: {
  onSelect: () => void;
  deshabilitado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Menu.Item
      onSelect={onSelect}
      disabled={deshabilitado}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-[color-mix(in_oklab,var(--ink-primario)_7%,transparent)]"
      style={{ color: "var(--ink-primario)" }}
    >
      {children}
    </Menu.Item>
  );
}

function fecha(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

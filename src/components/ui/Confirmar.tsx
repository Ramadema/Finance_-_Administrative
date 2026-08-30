"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Boton } from "./Boton";

/**
 * Confirmación para lo que no se puede deshacer.
 *
 * Modal y no un `confirm()` del navegador porque acá hace falta explicar QUÉ se
 * borra y ofrecer el respaldo en el mismo lugar: en una app sin servidor borrar
 * es definitivo, no hay copia en ningún otro lado de donde recuperarlo.
 */
export function Confirmar({
  abierto,
  onAbierto,
  titulo,
  children,
  textoConfirmar,
  onConfirmar,
  extra,
}: {
  abierto: boolean;
  onAbierto: (v: boolean) => void;
  titulo: string;
  children: React.ReactNode;
  textoConfirmar: string;
  onConfirmar: () => void | Promise<void>;
  /** Acción alternativa —"bajá el respaldo antes"— al lado de los botones. */
  extra?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={abierto} onOpenChange={onAbierto}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: "rgba(11, 11, 11, 0.45)" }}
        />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] p-5 focus:outline-none"
          style={{
            background: "var(--elevado)",
            border: "1px solid var(--borde)",
            boxShadow: "var(--sombra-card)",
          }}
        >
          <Dialog.Title className="text-[16px] font-semibold tracking-tight">
            {titulo}
          </Dialog.Title>

          <Dialog.Description asChild>
            <div
              className="mt-2 space-y-2 text-[13px] leading-relaxed"
              style={{ color: "var(--ink-secundario)" }}
            >
              {children}
            </div>
          </Dialog.Description>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {extra}
            <Dialog.Close asChild>
              <Boton variante="fantasma">Cancelar</Boton>
            </Dialog.Close>
            <Boton
              onClick={() => void onConfirmar()}
              style={{ background: "var(--critico)", color: "#fff", outlineColor: "var(--s1)" }}
            >
              {textoConfirmar}
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

"use client";

import * as RTooltip from "@radix-ui/react-tooltip";

/**
 * Etiqueta para los controles que son solo un ícono.
 *
 * El `title` nativo del navegador tarda cerca de un segundo en aparecer, no se
 * puede estilar y en touch no existe. En una barra donde ningún ícono se explica
 * solo, eso llega tarde: el usuario ya adivinó o ya se fue.
 *
 * No reemplaza al `aria-label`: el tooltip se anuncia como descripción, no como
 * nombre, así que el botón igual tiene que decir qué es.
 */
export function Tooltip({
  texto,
  lado = "bottom",
  children,
}: {
  texto: string;
  lado?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={lado}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-[240px] rounded-md px-2 py-1 text-[12px] leading-snug font-medium"
          style={{
            background: "var(--ink-primario)",
            color: "var(--superficie)",
            boxShadow: "var(--sombra-card)",
          }}
        >
          {texto}
          <RTooltip.Arrow style={{ fill: "var(--ink-primario)" }} />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/**
 * Va una sola vez en la raíz. `delayDuration` bajo a propósito: son íconos de
 * una barra de herramientas, no información secundaria que convenga esconder.
 */
export function ProveedorTooltips({ children }: { children: React.ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={200} skipDelayDuration={300}>
      {children}
    </RTooltip.Provider>
  );
}

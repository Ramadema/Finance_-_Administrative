"use client";

import { cn } from "@/lib/utils";

type Variante = "solido" | "suave" | "fantasma";

export function Boton({
  variante = "suave", className, ...props
}: React.ComponentProps<"button"> & { variante?: Variante }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium",
        "transition-colors duration-150 disabled:opacity-45 disabled:pointer-events-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
      style={{
        outlineColor: "var(--s1)",
        ...(variante === "solido"
          ? { background: "var(--s1)", color: "#fff" }
          : variante === "suave"
          ? {
              background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)",
              color: "var(--ink-primario)",
            }
          : { background: "transparent", color: "var(--ink-secundario)" }),
      }}
      {...props}
    />
  );
}

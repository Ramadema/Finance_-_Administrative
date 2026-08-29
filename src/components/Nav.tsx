"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, PieChart, Repeat, PiggyBank, Lightbulb, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDatos } from "@/lib/DatosContext";

export const SECCIONES = [
  { href: "/", nombre: "Resumen", Icono: LayoutDashboard },
  { href: "/gastos", nombre: "Gastos", Icono: PieChart },
  { href: "/fijos", nombre: "Fijos", Icono: Repeat },
  { href: "/ahorro", nombre: "Ahorro", Icono: PiggyBank },
  { href: "/insights", nombre: "Alertas", Icono: Lightbulb },
  { href: "/movimientos", nombre: "Movimientos", Icono: Receipt },
] as const;

/** Cuántas observaciones piden atención — se muestra como globo en el menú. */
function usePendientes(): number {
  const { insights } = useDatos();
  return insights.filter((i) => i.severidad === "critico" || i.severidad === "atencion").length;
}

export function NavLateral() {
  const pathname = usePathname();
  const pendientes = usePendientes();

  return (
    <nav className="hidden lg:block" aria-label="Secciones">
      <ul className="space-y-0.5">
        {SECCIONES.map(({ href, nombre, Icono }) => {
          const activo = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium",
                  "transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2",
                )}
                style={{
                  outlineColor: "var(--s1)",
                  background: activo
                    ? "color-mix(in oklab, var(--s1) 14%, transparent)"
                    : "transparent",
                  color: activo ? "var(--s1)" : "var(--ink-secundario)",
                }}
              >
                <Icono className="h-[17px] w-[17px] shrink-0" />
                <span className="flex-1">{nombre}</span>
                {href === "/insights" && pendientes > 0 && <Globo n={pendientes} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NavInferior() {
  const pathname = usePathname();
  const pendientes = usePendientes();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      aria-label="Secciones"
      style={{
        background: "color-mix(in oklab, var(--superficie) 92%, transparent)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid var(--borde)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex">
        {SECCIONES.map(({ href, nombre, Icono }) => {
          const activo = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className="relative flex flex-col items-center gap-0.5 py-2"
                style={{ color: activo ? "var(--s1)" : "var(--ink-mudo)" }}
              >
                <Icono className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-medium">{nombre}</span>
                {href === "/insights" && pendientes > 0 && (
                  <span
                    className="absolute top-1 right-[22%] h-[7px] w-[7px] rounded-full"
                    style={{ background: "var(--critico)" }}
                    aria-label={`${pendientes} alertas`}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Globo({ n }: { n: number }) {
  return (
    <span
      className="tabular flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold"
      style={{ background: "var(--critico)", color: "#fff" }}
    >
      {n}
    </span>
  );
}

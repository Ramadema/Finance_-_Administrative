"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Moon, Sun, Download, Upload as UploadIcon, Wallet, ChevronDown, Trash2, ShieldAlert } from "lucide-react";
import { DatosProvider, useDatos } from "@/lib/DatosContext";
import { borrarTodo, exportarJSON, importarJSON } from "@/lib/db/repo";
import { alternarTema, useTema } from "@/lib/design/useTema";
import { nombrePeriodo } from "@/lib/utils";
import { NavLateral, NavInferior, SECCIONES } from "./Nav";
import { Boton } from "./ui/Boton";
import { Confirmar } from "./ui/Confirmar";

/**
 * Estructura de la app: sidebar en desktop, barra inferior en mobile.
 * El selector de período vive en el encabezado porque TODAS las secciones
 * miran el mismo mes — cambiarlo en una y que otra muestre otro sería confuso.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DatosProvider>
      <Marco>{children}</Marco>
    </DatosProvider>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  const { cargando, movimientos, persistente } = useDatos();
  const pathname = usePathname();
  const seccion = SECCIONES.find((s) => s.href === pathname);

  // Sin datos todavía: la app es solo la pantalla de carga, sin menú que estorbe.
  const vacia = !cargando && movimientos.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <Encabezado />

      {/* El navegador dijo explícitamente que puede desalojar la base. Callarlo
          sería peor: es el único aviso antes de perder todo el histórico. */}
      {!vacia && persistente === false && (
        <p
          className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed"
          style={{
            background: "color-mix(in oklab, var(--advertencia) 14%, transparent)",
            color: "var(--ink-secundario)",
          }}
        >
          <ShieldAlert className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--advertencia)" }} />
          <span>
            Tu navegador no se comprometió a conservar estos datos: si le falta espacio
            puede borrarlos. Bajá un respaldo con el botón{" "}
            <Download className="inline h-3.5 w-3.5 align-text-bottom" /> del encabezado.
          </span>
        </p>
      )}

      {vacia ? (
        <main className="pb-16">{children}</main>
      ) : (
        <div className="flex gap-7 pb-24 lg:pb-10">
          <aside className="sticky top-6 hidden h-fit w-[184px] shrink-0 lg:block">
            <NavLateral />
          </aside>

          <main className="min-w-0 flex-1">
            {seccion && (
              <h1 className="mb-4 text-[20px] font-semibold tracking-tight lg:hidden">
                {seccion.nombre}
              </h1>
            )}
            {children}
          </main>
        </div>
      )}

      {!vacia && <NavInferior />}
    </div>
  );
}

function Encabezado() {
  const { periodos, periodo, setPeriodo, movimientos, recargar } = useDatos();
  const tema = useTema();
  const [confirmando, setConfirmando] = useState(false);

  async function descargar() {
    const json = await exportarJSON();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `plata-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restaurar(archivo: File) {
    const r = await importarJSON(await archivo.text());
    if (r.ok) await recargar();
    else alert(r.error);
  }

  async function borrar() {
    await borrarTodo();
    setConfirmando(false);
    await recargar();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-6">
      <Link href="/" className="flex items-center gap-2.5 rounded focus-visible:outline-2"
            style={{ outlineColor: "var(--s1)" }}>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[11px]"
          style={{ background: "color-mix(in oklab, var(--s1) 16%, transparent)", color: "var(--s1)" }}
        >
          <Wallet className="h-[18px] w-[18px]" />
        </span>
        <div>
          <span className="block text-[17px] leading-tight font-semibold tracking-tight">Plata</span>
          <span className="block text-[11.5px]" style={{ color: "var(--ink-mudo)" }}>
            Tus finanzas, claras
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        {periodos.length > 0 && periodo && (
          <div className="relative">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              aria-label="Período"
              className="appearance-none rounded-lg py-1.5 pr-7 pl-3 text-[13px] font-medium focus-visible:outline-2"
              style={{
                background: "color-mix(in oklab, var(--ink-primario) 6%, transparent)",
                color: "var(--ink-primario)", outlineColor: "var(--s1)",
              }}
            >
              {[...periodos].reverse().map((p) => (
                <option key={p} value={p}>{nombrePeriodo(p)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2"
                         style={{ color: "var(--ink-mudo)" }} />
          </div>
        )}

        <Boton variante="fantasma" onClick={descargar} title="Descargar respaldo">
          <Download className="h-4 w-4" />
        </Boton>

        <label className="inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5"
               style={{ color: "var(--ink-secundario)" }} title="Restaurar respaldo">
          <UploadIcon className="h-4 w-4" />
          <input type="file" accept="application/json" className="sr-only"
                 onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) void restaurar(f);
                   e.target.value = "";
                 }} />
        </label>

        {movimientos.length > 0 && (
          <Boton
            variante="fantasma"
            onClick={() => setConfirmando(true)}
            title="Borrar todos los datos"
          >
            <Trash2 className="h-4 w-4" />
          </Boton>
        )}

        <Boton variante="fantasma" onClick={alternarTema} title="Cambiar tema">
          {tema === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Boton>
      </div>

      <Confirmar
        abierto={confirmando}
        onAbierto={setConfirmando}
        titulo="¿Borrar todos tus datos?"
        textoConfirmar="Borrar todo"
        onConfirmar={borrar}
        extra={
          <Boton onClick={descargar} className="mr-auto">
            <Download className="h-4 w-4" /> Bajar respaldo
          </Boton>
        }
      >
        <p>
          Se borran los {movimientos.length} movimientos importados, las categorías que
          le enseñaste, tus ingresos y tus reglas.
        </p>
        <p>
          No se puede deshacer: los datos viven solo en este navegador, así que no hay
          copia en ningún otro lado. Si querés conservarlos, bajá el respaldo primero.
        </p>
      </Confirmar>
    </header>
  );
}

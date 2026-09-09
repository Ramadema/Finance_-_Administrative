"use client";

import { useEffect, useState } from "react";
import type { Tema } from "./paleta";

/**
 * Tema efectivo del documento. Los gráficos SVG necesitan el hex real (no
 * pueden resolver una var CSS en un atributo `fill`), así que hay que saber
 * en cuál de los dos estamos.
 */
export function useTema(): Tema {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    const calcular = (): Tema => {
      const marcado = document.documentElement.getAttribute("data-theme");
      if (marcado === "dark" || marcado === "light") return marcado;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- el tema solo se puede leer del DOM, y en el export estático el primer render es servidor.
    setTema(calcular());

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => setTema(calcular());
    mq.addEventListener("change", onMedia);

    const obs = new MutationObserver(() => setTema(calcular()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      mq.removeEventListener("change", onMedia);
      obs.disconnect();
    };
  }, []);

  return tema;
}

/** Alterna y persiste la preferencia. */
export function alternarTema() {
  const actual = document.documentElement.getAttribute("data-theme");
  const efectivo =
    actual ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const nuevo = efectivo === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nuevo);
  try {
    localStorage.setItem("tema", nuevo);
  } catch {
    /* modo privado: el tema simplemente no persiste */
  }
}

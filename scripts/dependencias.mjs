#!/usr/bin/env node
/**
 * Ninguna dependencia declarada que nadie importe, ninguna importada que nadie
 * declare.
 *
 * Las dos fallan calladas y en direcciones opuestas:
 *
 * - **Declarada y sin usar** no rompe nada, y por eso se queda para siempre.
 *   El costo no es el bundle (lo que nadie importa no llega al navegador): es
 *   que quien lee `package.json` —o un agente— concluye que la app usa esa
 *   librería y escribe código con ella, en vez de con lo que el repo ya tiene.
 *   Este repo llegó a tener ocho, entre ellas 26 MB de `date-fns` mientras los
 *   períodos se manejaban como texto en `src/lib/utils.ts`.
 *
 * - **Importada y sin declarar** anda en tu máquina —está en node_modules
 *   porque otra la arrastró— y explota en un `npm ci` limpio o el día que esa
 *   otra cambie de versión.
 */

import { readFileSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";

const raiz = process.cwd();
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const runtime = Object.keys(pkg.dependencies ?? {});
const declaradas = new Set([...runtime, ...Object.keys(pkg.devDependencies ?? {})]);

/**
 * Paquetes que se usan sin que ningún archivo los importe por nombre.
 * La lista es corta y cada entrada dice quién lo usa: si crece sin explicación,
 * el chequeo dejó de servir.
 */
const SIN_IMPORT_DIRECTO = {
  "react-dom": "lo usa Next para renderizar; ningún archivo nuestro lo importa",
};

/** Archivos donde puede aparecer un import: el código y los configs. */
function archivos() {
  const salida = [];
  const recorrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) recorrer(p);
      else if (/\.(ts|tsx|mts|mjs|js|css)$/.test(e.name)) salida.push(p);
    }
  };
  recorrer("src");
  recorrer("scripts");
  for (const f of readdirSync(raiz)) {
    if (/\.(ts|mjs|mts)$/.test(f)) salida.push(f);
  }
  return salida;
}

/** "@scope/pkg/sub" → "@scope/pkg" · "next/link" → "next" · "./x" → null */
function paquete(especificador) {
  if (!especificador || /^[./]/.test(especificador)) return null;
  if (especificador.startsWith("node:")) return null;
  if (especificador.startsWith("@/")) return null; // alias del repo (tsconfig paths)
  const partes = especificador.split("/");
  const nombre = especificador.startsWith("@") ? partes.slice(0, 2).join("/") : partes[0];
  return builtinModules.includes(nombre) ? null : nombre;
}

const importados = new Map(); // paquete → primer archivo que lo importa
const patrones = [
  /from\s+["']([^"']+)["']/g,      // import x from "y"
  /import\s+["']([^"']+)["']/g,    // import "y"  ·  @import "y" (css)
  /import\(\s*["']([^"']+)["']/g,  // import("y")
  /require\(\s*["']([^"']+)["']/g, // require("y")
];

/**
 * Sin comentarios: un import comentado no es un uso, y los ejemplos que este
 * mismo archivo tiene en su cabecera no son dependencias.
 */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, "")       // bloques /* … */
    .replace(/(^|[^:])\/\/.*$/gm, "$1");    // de // al fin de línea, sin comerse https://
}

for (const archivo of archivos()) {
  const texto = sinComentarios(readFileSync(archivo, "utf8"));
  for (const patron of patrones) {
    for (const [, especificador] of texto.matchAll(patron)) {
      const nombre = paquete(especificador);
      if (nombre && !importados.has(nombre)) importados.set(nombre, archivo);
    }
  }
}

const errores = [];

for (const dep of runtime) {
  if (importados.has(dep)) continue;
  if (dep in SIN_IMPORT_DIRECTO) continue;
  errores.push(
    `${dep} está en dependencies y no lo importa ningún archivo.\n` +
    `     Si de verdad hace falta, sacalo con \`npm uninstall ${dep}\`; si se usa sin\n` +
    `     import (como react-dom), agregalo a SIN_IMPORT_DIRECTO en este script con el porqué.`,
  );
}

for (const [nombre, archivo] of importados) {
  if (declaradas.has(nombre)) continue;
  // Tailwind se importa desde el CSS y se declara como devDependency del plugin.
  if (nombre === "tailwindcss") continue;
  errores.push(
    `${nombre} se importa en ${archivo} y no está en package.json.\n` +
    `     Hoy anda porque otra dependencia lo arrastra; un \`npm ci\` limpio lo rompe.`,
  );
}

if (errores.length === 0) {
  console.log(`Dependencias: ${runtime.length} declaradas, todas en uso.`);
  process.exit(0);
}

console.error(`\n📦 package.json no coincide con el código (${errores.length}):\n`);
for (const e of errores) console.error(`  • ${e}\n`);
process.exit(1);

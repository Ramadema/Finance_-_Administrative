#!/usr/bin/env node
/**
 * Verifica que docs/ siga describiendo el repo que existe.
 *
 * Dos cosas distintas, porque fallan distinto:
 *
 * 1. HECHOS — afirmaciones de la documentación que se pueden contrastar contra
 *    el código: rutas que menciona, links entre archivos, la cantidad de tests,
 *    la versión del esquema. Si una queda vieja, es un error objetivo: alguien
 *    va a leer un número que ya no es cierto y va a decidir con eso.
 *
 * 2. OBLIGACIONES — cambios que casi nunca se pueden hacer sin tocar la
 *    documentación (el esquema, la taxonomía, las secciones, las fronteras).
 *    Acá no se puede verificar el contenido, solo avisar: cambiaste esto y
 *    ningún doc se movió.
 *
 * Uso:
 *   node scripts/docs-al-dia.mjs                  las dos, sobre el árbol de trabajo
 *   node scripts/docs-al-dia.mjs --hechos         solo los hechos
 *   node scripts/docs-al-dia.mjs --obligaciones   solo las obligaciones
 *   node scripts/docs-al-dia.mjs --staged         obligaciones sobre lo que está en el índice
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, normalize } from "node:path";

const raiz = process.cwd();
const args = process.argv.slice(2);
const soloHechos = args.includes("--hechos");
const soloObligaciones = args.includes("--obligaciones");
const staged = args.includes("--staged");

const errores = [];
const falla = (titulo, detalle) => errores.push({ titulo, detalle });

const leer = (p) => readFileSync(join(raiz, p), "utf8");
const hay = (p) => existsSync(join(raiz, p));

/** Todos los .md que documentan el repo (no los del build ni node_modules). */
function documentos() {
  const salida = [];
  const recorrer = (dir) => {
    for (const e of readdirSync(join(raiz, dir), { withFileTypes: true })) {
      const p = dir === "." ? e.name : `${dir}/${e.name}`;
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith(".md")) salida.push(p);
    }
  };
  recorrer("docs");
  return [...salida, "README.md", "AGENTS.md"];
}

// ─────────────────────────────────────────────────────────── HECHOS

/** Rutas del repo citadas entre backticks: si se renombró el archivo, saltan acá. */
function rutasCitadas() {
  const patron = /`((?:src|docs|scripts|\.claude|\.github)\/[\w./-]+\.\w+)`/g;
  for (const doc of documentos()) {
    for (const [, ruta] of leer(doc).matchAll(patron)) {
      if (!hay(ruta)) falla(`Ruta que ya no existe, citada en ${doc}`, ruta);
    }
  }
}

/** Links relativos entre documentos. Un índice que apunta al vacío es peor que no tenerlo. */
function linksRotos() {
  const patron = /\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g;
  for (const doc of documentos()) {
    for (const [, destino] of leer(doc).matchAll(patron)) {
      if (/^(https?:|mailto:)/.test(destino)) continue;
      const resuelto = normalize(join(dirname(doc), destino));
      if (!hay(resuelto)) falla(`Link roto en ${doc}`, `${destino} → ${resuelto}`);
    }
  }
}

/** Un ADR o un playbook que nadie indexó es un archivo que nadie va a leer. */
function indicesCompletos() {
  for (const carpeta of ["decisiones", "playbooks"]) {
    const indice = `docs/${carpeta}/README.md`;
    if (!hay(indice)) { falla("Falta el índice", indice); continue; }
    const texto = leer(indice);
    for (const archivo of readdirSync(join(raiz, "docs", carpeta))) {
      if (!archivo.endsWith(".md") || archivo === "README.md") continue;
      if (!texto.includes(archivo)) {
        falla(`Sin listar en ${indice}`, `${archivo} — agregalo al índice`);
      }
    }
  }
}

/**
 * Números que la documentación afirma y el código decide.
 *
 * Si reescribís la frase que los contiene, este chequeo avisa que perdió el
 * ancla en vez de quedarse callado: un chequeo que dejó de mirar es peor que
 * ninguno, porque igual da verde.
 */
function numerosAfirmados() {
  const dato = (archivo, patron, queEs) => {
    const m = leer(archivo).match(patron);
    if (!m) {
      falla("Se perdió un dato verificable", 
        `No encuentro ${queEs} en ${archivo}. Si reescribiste la frase, ajustá el patrón en scripts/docs-al-dia.mjs.`);
      return null;
    }
    return m[1];
  };

  // Cantidad de tests. La real la pasa el hook por env para no correrlos dos veces.
  let reales = process.env.PLATA_TESTS;
  if (!reales) {
    try {
      const salida = execFileSync("npx", ["vitest", "run", "--reporter=dot"], {
        cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
      reales = salida.match(/Tests\s+(\d+) passed/)?.[1];
    } catch { reales = null; }
  }
  if (reales) {
    for (const doc of documentos()) {
      for (const linea of leer(doc).split("\n")) {
        // Una cita histórica ("antes decía X") no es una afirmación vigente.
        if (linea.includes("<!-- histórico")) continue;
        const [frase, n] = linea.match(/(\d+) tests\b/) ?? [];
        if (frase && n !== String(reales)) {
          falla(`Cantidad de tests desactualizada en ${doc}`,
            `dice "${frase}" y hoy son ${reales}`);
        }
      }
    }
  }

  // Versión del esquema Dexie.
  const enCodigo = [...leer("src/lib/db/esquema.ts").matchAll(/this\.version\((\d+)\)/g)]
    .map((m) => Number(m[1]));
  const ultima = Math.max(...enCodigo);
  const declarada = dato("docs/playbooks/tocar-la-base.md", /\*\*versión (\d+)\*\*/, "la versión del esquema");
  if (declarada && Number(declarada) !== ultima) {
    falla("Versión del esquema desactualizada en docs/playbooks/tocar-la-base.md",
      `dice ${declarada} y esquema.ts va por la ${ultima}`);
  }

  // Versión del formato de respaldo.
  const respaldo = leer("src/lib/db/repo.ts").match(/\{\s*version:\s*(\d+),/)?.[1];
  const respaldoDoc = dato("docs/playbooks/tocar-la-base.md", /\(hoy \*\*(\d+)\*\*\)/, "la versión del respaldo");
  if (respaldo && respaldoDoc && respaldo !== respaldoDoc) {
    falla("Versión del respaldo desactualizada en docs/playbooks/tocar-la-base.md",
      `dice ${respaldoDoc} y exportarJSON() escribe ${respaldo}`);
  }
}

// ─────────────────────────────────────────────────────── OBLIGACIONES

/**
 * Cambios que rara vez se pueden hacer sin tocar la documentación.
 *
 * La lista es corta a propósito: un aviso que salta siempre se ignora siempre.
 */
const OBLIGACIONES = [
  { patron: /^src\/lib\/db\/esquema\.ts$/, dice:
    "Cambió el esquema de la base → docs/playbooks/tocar-la-base.md (versión de Dexie y del respaldo). Si aparece un concepto nuevo, también docs/dominio.md." },
  { patron: /^src\/lib\/categorize\/categorias\.ts$/, dice:
    "Cambió la taxonomía de categorías → docs/dominio.md, y la tabla de secciones del README si se ve distinto." },
  { patron: /^src\/components\/Nav\.tsx$/, dice:
    "Cambiaron las secciones → la tabla \"Secciones\" del README y docs/arquitectura.md." },
  { patron: /^src\/lib\/categorize\/recurrencia\.ts$/, dice:
    "Cambió cómo se detecta lo fijo → docs/dominio.md y el ADR 0004 (si cambió el criterio, va un ADR nuevo)." },
  { patron: /^eslint\.config\.mjs$/, dice:
    "Cambiaron las fronteras entre capas → docs/arquitectura.md y el ADR 0007." },
  { patron: /^next\.config\.ts$/, dice:
    "Cambió la configuración del export estático → ADR 0001 (es la promesa de que no hay servidor)." },
  { patron: /^package\.json$/, dice:
    "Cambió package.json. Si es una dependencia nueva, eso es una decisión: va un ADR." },
  { patron: /^src\/app\/[^/]+\/page\.tsx$/, soloNuevos: true, dice:
    "Sección nueva → la tabla \"Secciones\" del README y docs/arquitectura.md." },
  { patron: /^src\/lib\/ingest\/[^/]+\.ts$/, soloNuevos: true, dice:
    "Parser nuevo → docs/playbooks/agregar-un-banco.md y las \"Limitaciones conocidas\" del README." },
  { patron: /^src\/lib\/[^/]+\/[^/]+\.ts$/, soloNuevos: true, dice:
    "Archivo nuevo en el dominio → docs/arquitectura.md (qué capa es y qué puede tocar)." },
];

function cambios() {
  const correr = (a) => execFileSync("git", a, { cwd: raiz, encoding: "utf8" });
  const filas = staged
    ? correr(["diff", "--cached", "--name-status"]).split("\n")
    : correr(["status", "--porcelain"]).split("\n");

  const lista = [];
  for (const fila of filas) {
    if (!fila.trim()) continue;
    if (staged) {
      const [estado, ...resto] = fila.split("\t");
      lista.push({ ruta: resto[resto.length - 1], nuevo: estado.startsWith("A") });
    } else {
      const estado = fila.slice(0, 2);
      lista.push({ ruta: fila.slice(3).trim(), nuevo: estado === "??" || estado.includes("A") });
    }
  }
  return lista;
}

function obligaciones() {
  const lista = cambios();
  if (lista.length === 0) return;

  const tocoDocs = lista.some(({ ruta }) =>
    ruta.startsWith("docs/") || ruta === "README.md" || ruta === "AGENTS.md");
  if (tocoDocs) return; // Se documentó algo; el contenido no lo puede juzgar un script.

  const pendientes = new Map();
  for (const { ruta, nuevo } of lista) {
    for (const o of OBLIGACIONES) {
      if (!o.patron.test(ruta)) continue;
      if (o.soloNuevos && !nuevo) continue;
      pendientes.set(o.dice, [...(pendientes.get(o.dice) ?? []), ruta]);
    }
  }
  for (const [dice, rutas] of pendientes) {
    falla("Cambio sin documentar", `${rutas.join(", ")}\n     ${dice}`);
  }
}

// ─────────────────────────────────────────────────────────── main

if (!soloObligaciones) { rutasCitadas(); linksRotos(); indicesCompletos(); numerosAfirmados(); }
if (!soloHechos) obligaciones();

if (errores.length === 0) {
  if (!process.env.PLATA_SILENCIO) console.log("docs/ al día.");
  process.exit(0);
}

console.error(`\n📄 La documentación quedó atrás (${errores.length}):\n`);
for (const { titulo, detalle } of errores) console.error(`  • ${titulo}\n     ${detalle}\n`);
console.error("Actualizá lo que corresponda (docs/README.md dice qué archivo es cuál).");
console.error("Si de verdad este cambio no amerita documentación, decilo y seguí.\n");
process.exit(1);

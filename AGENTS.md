<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Plata — reglas del repo

Dashboard personal de finanzas. Corre entero en el navegador: sin servidor, sin
base en la nube, sin API keys. El `README.md` explica **qué hace** para quien lo
usa; este archivo dice **cómo se toca** el código. El porqué de cada decisión
está en `docs/decisiones/`.

Todo se escribe en castellano: nombres, comentarios, commits, docs. El dominio
es en castellano rioplatense y traducirlo a medias es peor que no traducirlo.

## Antes de dar algo por terminado

```bash
npm run lint && npm run typecheck && npm test
```

Los tres tienen que pasar. No están de adorno: el lint es el que hace ciertas
las fronteras de `docs/arquitectura.md`, y los 160 tests son el contrato del
dominio. Si tocaste el parseo del Excel, corré además `npm test` con archivos
reales en `samples/` (la tanda de regresión se saltea sola si no están).

## Plata: invariantes que no se rompen

1. **Todo importe del banco entra por `parseImporteAR()`** (`src/lib/ingest/numero.ts`).
   `parseFloat("1.234,56")` devuelve `1.234` y no tira error. El lint prohíbe
   `parseFloat` en todo `src/`.
2. **Los importes llevan signo.** Las devoluciones vienen negativas y su suma da
   el total declarado. `Math.abs()` sobre un monto de gasto lo convierte en
   gasto: te infla el mes justo cuando el banco te devolvió la plata.
3. **La app nunca inventa un número.** No hay valores por defecto, ni datos de
   ejemplo, ni estimaciones que rellenen un hueco. Si falta un dato, la métrica
   muestra "—" y dice qué hay que cargar. Un número inventado en una app de
   finanzas es una mentira, no un placeholder.
4. **Ninguna observación sin un número que la respalde.** Si una regla de
   `insights.ts` no tiene datos para calcular la comparación, no se dispara.
5. **`descripcionCruda` nunca se pisa.** Todo lo derivado (comercio, categoría,
   naturaleza) es recalculable; el texto del banco es la fuente y es intocable.
6. **`periodo` ≠ `fecha`.** `fecha` es cuándo compraste, `periodo` es qué
   resumen te lo cobra. Todo lo mensual agrupa por `periodo`. Ver
   `docs/decisiones/0003-el-mes-es-el-del-resumen.md`.
7. **Nada de consejos de inversión.** La app hace aritmética sobre tus datos.
   Dónde poner la plata es de un asesor matriculado, y el código no opina.

## Fronteras entre capas

El sentido de las dependencias es UI → dominio → nada. Está en
`docs/arquitectura.md` y lo verifica `eslint.config.mjs`:

- **`src/lib/{ingest,categorize,analisis}/`** es dominio puro: recibe datos por
  parámetro y devuelve cálculo. No importa React, ni `dexie`, ni `db/repo`, ni
  componentes. Por eso se testea sin navegador y sin mocks.
- **`src/lib/db/`** es lo único que habla con IndexedDB. Fuera de ahí no se
  importa `dexie` ni se llama a `db()`.
- **`src/components/` y `src/app/`** leen del contexto (`useDatos`) y escriben
  por `@/lib/db/repo`. De `db/esquema` solo pueden sacar tipos (`import type`).
- **`src/components/ui/`** son primitivas tontas: reciben props, no conocen el
  dominio.

Si una regla te estorba, la pregunta es si la frontera está mal puesta — no si
conviene un `eslint-disable`. Hoy los únicos `eslint-disable` del repo son 7 de
`react-hooks`, cada uno con su razón en la misma línea.

## Qué NO hacer sin que te lo pidan

- **No agregar backend, ni API keys, ni llamadas a un LLM en el producto.** Es
  la promesa central: los movimientos no salen de la máquina. Ver
  `docs/decisiones/0001-todo-corre-en-el-navegador.md`.
- **No agregar dependencias.** Si hace falta una, decilo y esperá — cada una es
  peso en el bundle de una app que se baja entera al navegador.
- **No cambiar el esquema de la base a la ligera.** Hay datos reales del otro
  lado y no hay servidor que los recupere: seguí `docs/playbooks/tocar-la-base.md`.
- **No romper el export estático.** Nada de `route handlers`, `middleware` ni
  `server actions`: `next build` tiene que seguir escupiendo `out/`.
- **No commitear nada de `samples/`.** Son resúmenes bancarios reales.

## Antes de escribir código, leé el playbook

| Vas a… | Leé |
|---|---|
| agregar una métrica o un gráfico | `docs/playbooks/agregar-una-metrica.md` |
| agregar una sección entera | `docs/playbooks/agregar-una-seccion.md` |
| soportar otro banco o el resumen de cuenta | `docs/playbooks/agregar-un-banco.md` |
| cambiar el esquema o migrar datos | `docs/playbooks/tocar-la-base.md` |
| mover un módulo a la estructura nueva | `docs/playbooks/migrar-un-modulo.md` |
| tomar una decisión que cueste revertir | `docs/decisiones/README.md` |

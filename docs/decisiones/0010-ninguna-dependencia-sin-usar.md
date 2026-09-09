# 0010 — Ninguna dependencia declarada sin usar

## Contexto

`package.json` tenía ocho dependencias que ningún archivo del repo importaba:
`date-fns` (26 MB en disco), `dexie-react-hooks`, `d3-shape`, `d3-array` y
cuatro paquetes de Radix (popover, select, switch, tabs).

Ninguna rompía nada, y por eso llevaban meses ahí. El costo real no es el
bundle: lo que nadie importa no llega al navegador. El costo es que
`package.json` **es lo primero que se lee** para saber con qué está hecho algo,
y estaba mintiendo. Cualquiera que lo abriera —una persona nueva o un agente—
concluía que la app maneja fechas con `date-fns` y escribía
`format(new Date(...))`, cuando los períodos se manejan como texto `"2026-08"`
en `src/lib/utils.ts`, a propósito y con tests.

Dos de ellas además duplicaban: `d3-sankey` trae sus propias `d3-array` y
`d3-shape` en versiones viejas, así que npm instalaba dos copias de cada una.

## Decisión

Se sacaron las ocho, y `npm run deps:check` (`scripts/dependencias.mjs`)
verifica las dos direcciones en cada corrida:

- **Declarada y sin usar** — está en `dependencies` y ningún archivo la importa.
- **Importada y sin declarar** — se importa y no está en `package.json`. Anda en
  tu máquina porque otra dependencia la arrastra, y se rompe en un `npm ci`
  limpio o el día que esa otra cambie de versión.

Lo que se usa sin importarse por nombre (hoy solo `react-dom`, que lo usa Next
para renderizar) va en una lista corta dentro del script, cada entrada con quién
lo usa. Si esa lista crece sin explicación, el chequeo dejó de servir.

## Consecuencias

- `package.json` vuelve a ser una respuesta confiable a "¿con qué está hecho
  esto?", que es de lo que depende toda la documentación de
  [`../arquitectura.md`](../arquitectura.md).
- `npm ci` baja menos y el CI corre más rápido.
- **Se paga**: agregar una dependencia "para usarla en el próximo commit" ya no
  se puede — el chequeo falla hasta que algo la importe. Es el comportamiento
  buscado, pero hay que saberlo antes de que te frene.
- El chequeo mira `dependencies`, no `devDependencies`: las herramientas
  (TypeScript, ESLint, Vitest, los `@types`) casi nunca se importan por nombre y
  distinguirlas pediría una lista de excepciones más larga que el chequeo.

## Cómo se verifica

`npm run deps:check`. Corre en CI y al cerrar cada sesión de Claude.

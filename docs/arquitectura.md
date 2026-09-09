# Arquitectura

## La forma en una línea

Un archivo del banco entra, se convierte en movimientos, se guardan en el
navegador, y todo lo que ves arriba es cálculo derivado de esos movimientos.

```
  .xls del banco
        │
        ▼
  lib/ingest/        parsea, valida contra el total declarado, arma ids estables
        │
        ▼
  lib/categorize/    le pone comercio y categoría (reglas → memoria → semilla)
        │
        ▼
  lib/db/            IndexedDB (Dexie) detrás de repo.ts  ← única capa que persiste
        │
        ▼
  lib/DatosContext   carga los movimientos y calcula TODO lo derivado, una vez
        │
        ├──▶ lib/analisis/    métricas, ahorro, observaciones (funciones puras)
        │
        ▼
  app/ + components/ dibujan lo que el contexto ya calculó
```

La dependencia va en un solo sentido: **UI → dominio → nada**. El dominio no
sabe que existen React, IndexedDB ni Drive; por eso los 160 tests corren en
milisegundos, sin navegador y sin un solo mock.

## Las capas

| Carpeta | Qué es | Puede tocar | Nunca toca |
|---|---|---|---|
| `src/lib/ingest/` | Parseo del Excel y formato de números | archivos, texto | React, base, red |
| `src/lib/categorize/` | Taxonomía, normalización de comercios, recurrencia | funciones puras | React, base, red |
| `src/lib/analisis/` | Métricas, capacidad de ahorro, observaciones | funciones puras | React, base, red |
| `src/lib/db/` | Esquema Dexie + repositorio | IndexedDB | React, `analisis/` |
| `src/lib/nube/` | OAuth de Google y respaldo en Drive | red, `db/` | React salvo su hook, `analisis/` |
| `src/lib/design/` | Paleta y tema | — | dominio, base |
| `src/lib/DatosContext.tsx` | Estado global: carga y orquesta el cálculo | todo `lib/` | — |
| `src/components/` | Componentes con dominio adentro | `useDatos`, `db/repo` | `dexie`, `db()` |
| `src/components/ui/` | Primitivas tontas (Boton, Card, Tooltip) | props | dominio, base, contexto |
| `src/app/` | Rutas: composición, sin cálculo | componentes, `useDatos` | `dexie` |

**`categorize/` conoce la paleta a propósito.** Cada categoría raíz declara su
`slot` de color: hay exactamente 9 raíces de gasto porque hay 9 slots
categóricos validados. No es una fuga de la UI hacia el dominio, es la
restricción que mantiene los colores estables entre gráficos.

## Las fronteras las verifica el lint

Están escritas como error de `eslint` en `eslint.config.mjs`, no como buena
intención. Cada regla lleva el mensaje que explica por qué existe, así el error
se lee solo. Lo que hoy se prohíbe:

- `dexie` y `db()` fuera de `src/lib/db/`.
- `db/repo`, React, `next/*`, componentes y `nube/` dentro del dominio puro.
- `db/esquema` importado por la UI para otra cosa que no sean tipos.
- El contexto y la base dentro de `components/ui/`.
- `parseFloat` en todo `src/` (ver `decisiones/0002`).

El repo pasa todas sin una sola excepción. Si agregás una regla nueva, tiene que
quedar en cero el mismo día: una regla con excepciones no frena nada.

## Dónde va lo que vas a escribir

| Estás escribiendo… | Va en |
|---|---|
| una cuenta sobre movimientos | `lib/analisis/metricas.ts` (o un archivo nuevo si es un tema propio) |
| algo que se guarda o se lee de la base | `lib/db/repo.ts` — nunca en un componente |
| una regla de observación | `lib/analisis/insights.ts`, con su test |
| un gráfico | `components/charts/`, recibiendo por props lo ya calculado |
| una pantalla | `app/<ruta>/page.tsx`, componiendo componentes |
| un dato que dos secciones necesitan | el `useMemo` de `DatosContext` |

Regla práctica: **si tiene un `if` sobre plata, va en `lib/`, y lleva test.** Un
componente puede decidir cómo mostrar un número, nunca cuánto vale.

## Lo que sabemos que va a doler

Dos archivos concentran el crecimiento: `lib/analisis/metricas.ts` (567 líneas,
todas las métricas de todas las secciones) y `lib/db/repo.ts` (530, importaciones
+ fijos + ingresos + config + respaldo). Y `DatosContext` calcula en un solo
`useMemo` lo que consumen las seis secciones: agregar una sección es tocar el
archivo central.

El destino es **módulos por dominio** (`movimientos/`, `fijos/`, `ahorro/`,
`observaciones/`), cada uno con su cálculo puro, su acceso a datos y su UI, y una
API pública en su `index.ts`. No se hace de una: se migra un módulo cuando ya
tenés que tocarlo por otra razón, y el paso está en
[`playbooks/migrar-un-modulo.md`](playbooks/migrar-un-modulo.md). El porqué de
ir así y no de un saque está en
[`decisiones/0008-migracion-incremental-a-modulos.md`](decisiones/0008-migracion-incremental-a-modulos.md).

Hasta que eso pase, la estructura de arriba es la real y la que hay que respetar.

## Lo que no se negocia

- **Cliente puro.** `next.config.ts` tiene `output: "export"`. Nada de route
  handlers, middleware ni server actions: `npm run build` tiene que seguir
  escribiendo `out/`.
- **Los datos no salen de la máquina** salvo al respaldo de Drive del propio
  usuario, con su sesión (`decisiones/0006`).
- **Sin datos de ejemplo.** La app arranca vacía y muestra únicamente lo que se
  importó.

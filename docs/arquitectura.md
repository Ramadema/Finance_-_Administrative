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

## Con qué está hecho

| Pieza | Qué usa | Por qué |
|---|---|---|
| App | **Next.js 16** con `output: "export"` + **React 19** | Da rutas, build y dev server, pero el resultado son archivos sueltos: no hay servidor que mantener ([0001](decisiones/0001-todo-corre-en-el-navegador.md)) |
| Estilos | **Tailwind 4** (+ `clsx` y `tailwind-merge` en `cn()`) | Sin hoja de estilos que se desincronice del componente |
| Base local | **Dexie 4** sobre IndexedDB | IndexedDB a secas es una API cruel; Dexie da consultas, transacciones y migraciones versionadas |
| Excel del banco | **SheetJS** (`xlsx`) | Lee el `.xls` viejo que exporta BBVA. Ojo: viene del CDN de SheetJS, no del registro de npm — está fijado por URL en `package.json` |
| Gráficos | **Recharts** y **d3-sankey** | Recharts para lo común; el Sankey se dibuja a mano porque ningún componente listo daba el flujo que hacía falta |
| Componentes | **Radix** (dialog, dropdown-menu, tooltip) | Accesibilidad y teclado resueltos, sin estilos impuestos |
| Íconos y animación | **lucide-react**, **motion** | |
| Tests | **Vitest** | Corre en Node, sin jsdom, sin testing-library y sin un solo mock: el dominio es puro, así que alcanza con llamarlo |
| Tipos y lint | **TypeScript** en `strict`, **ESLint 9** | El lint además verifica las fronteras entre capas |

**Lo que no hay, a propósito**: servidor, base en la nube, API keys, LLM en el
producto, librería de estado global (alcanza un context), y ninguna librería de
fetching — la única red que existe es la de Drive.

**Ocho dependencias están instaladas y no las importa nadie**:
`dexie-react-hooks`, `date-fns`, `d3-shape`, `d3-array` y cuatro de Radix
(popover, select, switch, tabs). No llegan al bundle, pero mienten: quien lee
`package.json` —o un agente— asume que la app usa hooks de Dexie o `date-fns` y
escribe código con ellas. Sacarlas es una limpieza pendiente.

## Los cuatro caminos

Todo lo que hace la app es uno de estos cuatro recorridos.

**1. Entra un archivo del banco.** `ZonaCarga` recibe el `.xls` y llama a
`importarArchivo()` (`src/lib/db/repo.ts`), que orquesta:

```
hashArchivo()          ¿este archivo ya se importó? → si sí, no duplica nada
parsearBBVATarjeta()   filas → movimientos crudos + período + totales declarados
                       y valida la suma contra el total que trae el archivo
clasificar()           por cada uno: regla → memoria → semilla → sin categorizar
asignarIds()           ids estables, derivados del contenido
→ guarda los Movimiento y una fila Importacion con `cuadra`
→ la UI llama recargar() del contexto
```

Si el total no cuadra, se guarda igual **pero marcado**: la pantalla de carga te
avisa en vez de mostrarte números en los que no podés confiar.

**2. Se pinta una pantalla.** `DatosContext` carga una vez
(`movimientosDe()`, `mapaIngresos()`, `todaLaConfig()`) y de ahí sale todo lo
demás en un `useMemo`, en este orden porque cada paso usa el anterior:

```
naturalezasDe()      qué comercios son fijos, variables o esporádicos
serieMensual()       la foto de cada mes
resumenDe()          el mes elegido (y el anterior, para comparar)
gastoPorCategoria() · gastoDiario() · cuotasComprometidas() · flujoSankey()
capacidadDe() → proyectarAhorro() → fondoEmergencia()
generarInsights()    las observaciones, sobre todo lo anterior
```

Las páginas de `src/app/` no calculan: leen de `useDatos()` y componen.

**3. Corregís algo.** Categorizar un movimiento en la tabla llama a
`recategorizarComercio()`, que guarda la memoria **y reaplica al histórico
entero de ese comercio** —salvo lo que hayas editado uno por uno—, y después
`recargar()`. Por eso categorizás una vez y no vuelve a preguntar. Lo mismo con
los ingresos y los gastos fijos que cargás a mano.

**4. Respaldás.** `useSesionDrive` pide el token a Google (`lib/nube/google.ts`),
`exportarJSON()` arma el respaldo entero y `subirRespaldo()` lo escribe en tu
Drive. Al revés, `bajarRespaldo()` + `importarJSON()`. Si lo local y lo remoto
difieren, **pregunta**: un merge automático sobre datos financieros puede
duplicar o borrar movimientos sin que nadie se entere.

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

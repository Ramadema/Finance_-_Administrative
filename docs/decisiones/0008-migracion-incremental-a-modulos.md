# 0008 — Migración incremental a módulos por dominio

## Contexto

Dos archivos concentran todo el crecimiento: `lib/analisis/metricas.ts` (567
líneas con las métricas de las seis secciones) y `lib/db/repo.ts` (530, con
importaciones + fijos + ingresos + config + respaldo). Y `DatosContext` calcula
en un solo `useMemo` lo que consumen todas las páginas.

Son cajones **por capa**: cada feature nueva toca los mismos tres archivos. Dos
tareas en paralelo chocan siempre en el mismo lugar, y para un agente significa
leer 567 líneas para cambiar una cuenta.

La alternativa es agrupar **por dominio**: `movimientos/`, `fijos/`, `ahorro/`,
`observaciones/`, cada uno con su cálculo puro, su acceso a datos, su UI y una
API pública en `index.ts`.

## Decisión

La estructura por dominio es el destino, pero **no se migra de una**. Primero el
andamiaje que no mueve archivos: `AGENTS.md`, `docs/`, fronteras en el lint, CI y
hook de verificación. Después, cada módulo se migra **cuando ya hay que tocarlo
por otra razón**, siguiendo [`../playbooks/migrar-un-modulo.md`](../playbooks/migrar-un-modulo.md).

## Consecuencias

- Los 160 tests quedan verdes en todo momento y no existe el commit gigante que
  nadie puede revisar.
- El orden lo decide el uso: se ordena primero lo que más se toca, que es
  justamente lo que más conviene tener ordenado.
- **Se paga**: durante un tiempo conviven las dos formas. Es aceptable con una
  condición — que la estructura vigente esté escrita
  ([`../arquitectura.md`](../arquitectura.md)) y que ningún módulo quede a medio
  migrar entre dos commits.

## Cómo se verifica

Cada migración termina con `npm run lint && npm run typecheck && npm test` en
verde y sin cambios de comportamiento en el mismo commit.

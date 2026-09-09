# 0007 — Las fronteras viven en el lint

## Contexto

El repo estaba prolijo por disciplina: el dominio sin React, la base detrás del
repositorio, los componentes sin Dexie. Nada de eso estaba escrito en ningún
lado ni lo verificaba nada.

Con el código escribiéndose cada vez más con agentes, esa disciplina no escala.
Un agente no hereda el criterio: hereda lo que puede leer y lo que le falla.
Y una regla que solo vive en un `.md` se viola en la iteración 40 sin que nadie
lo note, porque cruzar una capa nunca rompe un test — solo hace que dentro de
seis meses no se pueda tocar nada.

## Decisión

Cada frontera de [`../arquitectura.md`](../arquitectura.md) se escribe como error
de ESLint en `eslint.config.mjs`, con un mensaje que explica el porqué en el
propio error. Lo que hoy se prohíbe:

- `dexie` y `db()` fuera de `src/lib/db/`.
- `db/repo`, React, `next/*`, componentes y `nube/` dentro del dominio puro.
- `db/esquema` en la UI para otra cosa que no sean tipos.
- El contexto y la base dentro de `components/ui/`.
- `parseFloat` en todo `src/` (ver [0002](0002-importes-como-texto-en-formato-argentino.md)).

**Una regla nueva tiene que quedar en cero violaciones el mismo día.** Una regla
con excepciones no frena nada: enseña que el error se ignora.

Para dejarla en cero se movió el único `db()` que quedaba fuera de la capa de
datos (`DatosContext` ahora lee por `movimientosDe()`) y se anotaron los 7
errores preexistentes de `react-hooks` con su razón en la misma línea.

## Consecuencias

- El lint deja de ser cosmético: `npm run lint` es la verificación de la
  arquitectura y por eso corre en CI y en el hook de cierre.
- El error llega en el momento en que se escribe el import, no en la revisión.
- **Se paga**: agregar una capa nueva implica agregar su regla, y ese trabajo es
  fácil de saltear. Si aparece un `eslint-disable` de frontera en un diff, la
  pregunta no es si está justificado sino si la frontera está mal puesta.

## Cómo se verifica

`npm run lint` en cero, sin `eslint-disable` de frontera. `grep -rn "eslint-disable" src`
es la lista completa de deuda: hoy, 7 de `react-hooks`, ninguna de arquitectura.
